import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { construirParedes } from '../src/engine/paredes.js';
import { criarEtapasConstrucao } from '../src/engine/etapasConstrucao.js';
import { carregarSh3d, parseHomeXml } from '../src/sh3d/lerHome.js';
import { cmParaMetros, pontoParaThree } from '../src/sh3d/unidades.js';

const arquivoReal = resolve(process.cwd(), '..', 'modelos', 'BANHEIRO-ENTRE-QUARTOS.sh3d');
const arquivoNovaCasa = resolve(process.cwd(), 'public', 'modelos', 'TESTE-CASA.sh3d');

async function modeloReal() {
  return carregarSh3d(await readFile(arquivoReal));
}

describe('leitor do arquivo real .sh3d', () => {
  it('carrega as contagens validadas do inventário', async () => {
    const modelo = await modeloReal();
    expect(modelo.formatVersion).toBe('7400');
    expect(modelo.walls).toHaveLength(13);
    expect(modelo.rooms).toHaveLength(7);
    expect(modelo.openings).toHaveLength(12);
    expect(modelo.furniture).toHaveLength(1);
    expect(modelo.sashes).toHaveLength(13);
  });

  it('preserva nomes, áreas, comprimento e extensão dentro da tolerância do plano', async () => {
    const modelo = await modeloReal();
    const ambientes = modelo.rooms.filter((room) => !room.isLot);
    expect(ambientes.map((room) => room.name).sort()).toEqual([
      'SALA/COZINHA', 'QUARTO 2', 'QUARTO 1', 'QUARTO 3', 'CORREDOR', 'BANHEIRO',
    ].sort());
    const areas = Object.fromEntries(ambientes.map((room) => [room.name, room.area]));
    expect(areas['SALA/COZINHA']).toBeCloseTo(33.5, 1);
    expect(areas['QUARTO 2']).toBeCloseTo(13.6, 1);
    expect(areas['QUARTO 1']).toBeCloseTo(12.5, 1);
    expect(areas['QUARTO 3']).toBeCloseTo(9.3, 1);
    expect(areas.CORREDOR).toBeCloseTo(4.2, 1);
    expect(areas.BANHEIRO).toBeCloseTo(2.9, 1);
    expect(modelo.walls.reduce((total, wall) => total + Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z), 0)).toBeCloseTo(63.4, 1);
    expect(modelo.extents.width).toBeCloseTo(8.7, 1);
    expect(modelo.extents.depth).toBeCloseTo(9.8, 1);
    expect(modelo.rooms.find((room) => room.isLot).area).toBeCloseTo(86.9, 1);
  });

  it('deduz as conexões geométricas ausentes', async () => {
    const modelo = await modeloReal();
    const semAtributos = modelo.walls.filter((wall) => !wall.wallAtStart || !wall.wallAtEnd);
    expect(semAtributos.length).toBeGreaterThanOrEqual(5);
    expect(modelo.walls.some((wall) => wall.inferredTopology.start || wall.inferredTopology.end)).toBe(true);
    expect(modelo.walls.flatMap((wall) => [...wall.connections.start, ...wall.connections.end])).not.toHaveLength(0);
  });

  it('gera um recorte retangular para cada abertura na parede correta', async () => {
    const modelo = await modeloReal();
    const root = new THREE.Group();
    const grupo = construirParedes(modelo, root);
    const meshes = [...grupo.children];
    const totalRecortes = meshes.reduce((total, mesh) => total + (mesh.userData.openingIds?.length || 0), 0);
    expect(totalRecortes).toBe(modelo.openings.length);
    for (const abertura of modelo.openings) {
      const parede = meshes.find((mesh) => mesh.userData.id === abertura.wallId);
      expect(parede).toBeTruthy();
      const shape = parede.geometry.parameters.shapes;
      const vãos = shape.holes || [];
      expect(vãos.length).toBe(parede.userData.openingIds.length);
      const dimensoes = vãos.map((vao) => {
        const pontos = vao.getPoints(2);
        const xs = pontos.map((ponto) => ponto.x);
        const ys = pontos.map((ponto) => ponto.y);
        return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), bottom: Math.min(...ys) };
      });
      expect(dimensoes.some((dimensao) => Math.abs(dimensao.width - abertura.width) < 0.0001 && Math.abs(dimensao.height - abertura.height) < 0.0001 && Math.abs(dimensao.bottom - abertura.elevation) < 0.0001)).toBe(true);
    }
  });
});

describe('unidades e robustez do XML', () => {
  it('converte centímetros e mapeia x/y para x/z com elevação em y', () => {
    expect(cmParaMetros(280)).toBe(2.8);
    expect(pontoParaThree('120', '-240', '87')).toEqual({ x: 1.2, y: 0.87, z: -2.4 });
  });

  it('aceita aspas simples, elevation ausente, fallback de height e lote sem nome', () => {
    const xml = `<home version='7400' wallHeight='250'>
      <wall id='w1' xStart='0' yStart='0' xEnd='100' yEnd='0' thickness='20'/>
      <room id='lot' ceilingVisible='false'><point x='0' y='0'/><point x='100' y='0'/><point x='100' y='100'/></room>
      <doorOrWindow id='d1' catalogId='eteks-door' model='2/door/door.obj' x='50' y='0' angle='0' width='80' depth='20' height='200' cutOutShape='M0,0 v1 h1 v-1 z'/>
    </home>`;
    const modelo = parseHomeXml(xml);
    expect(modelo.walls[0].height).toBe(2.5);
    expect(modelo.openings[0].elevation).toBe(0);
    expect(modelo.rooms[0].isLot).toBe(true);
    expect(modelo.openings[0].wallId).toBe('w1');
  });

  it('preserva avisos e usa fallback para cutOutShape não retangular', () => {
    const avisos = [];
    const originalWarn = console.warn;
    console.warn = (mensagem) => avisos.push(mensagem);
    try {
      const xml = `<home version='7400' wallHeight='250'>
        <wall id='w1' xStart='0' yStart='0' xEnd='100' yEnd='0' thickness='20' height='280'/>
        <doorOrWindow id='d1' model='2/door/door.obj' x='50' y='0' width='80' depth='20' height='200' cutOutShape='M1,1'/>
      </home>`;
      const modelo = parseHomeXml(xml);
      expect(modelo.openings[0].cutOutShape).toBe('M1,1');
    } finally {
      console.warn = originalWarn;
    }
    expect(avisos.some((aviso) => aviso.includes('cutOutShape'))).toBe(true);
  });
});

describe('arquivo ZIP', () => {
  it('tem Home.xml e modelos OBJ referenciados no arquivo real', async () => {
    const bytes = await readFile(arquivoReal);
    const zip = unzipSync(bytes);
    expect(zip['Home.xml']).toBeTruthy();
    expect(Object.keys(zip).some((nome) => nome.endsWith('.obj'))).toBe(true);
  });
});

describe('nova fonte da casa e etapas da construção', () => {
  it('carrega a nova fonte com paredes em níveis e aberturas embutidas', async () => {
    const modelo = await carregarSh3d(await readFile(arquivoNovaCasa));
    expect(modelo.walls).toHaveLength(49);
    expect(modelo.openings).toHaveLength(13);
    expect(modelo.furniture).toHaveLength(0);
    expect(modelo.levels).toHaveLength(4);
    expect(new Set(modelo.walls.map((wall) => wall.levelId))).toEqual(new Set([
      'level-a128d6ed-fe94-480b-b7f0-f16f6fc2059b',
      'level-89caa3c0-1f5f-46bb-b95c-b2fd6a7546d5',
    ]));
    expect(Math.max(...modelo.walls.map((wall) => wall.levelElevation))).toBeCloseTo(2.95, 2);
    expect(modelo.openings.every((opening) => opening.wallId)).toBe(true);
    expect(modelo.rooms.filter((room) => !room.isLot)).toHaveLength(6);
    expect(modelo.rooms.find((room) => room.levelName === 'Nível 1')?.isLot).toBe(false);
    expect(modelo.rooms.find((room) => room.levelName === 'Nível 2')?.isLot).toBe(true);
  });

  it('alterna as camadas geradas sem apagar a geometria da planta', async () => {
    const modelo = await carregarSh3d(await readFile(arquivoNovaCasa));
    const parent = new THREE.Group();
    const terrain = new THREE.Group();
    const wallsGroup = new THREE.Group();
    const interiorsGroup = new THREE.Group();
    const objectsGroup = new THREE.Group();
    parent.add(terrain, wallsGroup, interiorsGroup, objectsGroup);
    const etapas = criarEtapasConstrucao(modelo, { parent, terrain, wallsGroup, interiorsGroup, objectsGroup });

    expect(etapas.atual()).toBe('complete');
    expect(parent.getObjectByName('Etapa · Fundação')).toBeTruthy();
    expect(parent.getObjectByName('Etapa · Estrutura')).toBeTruthy();
    expect(parent.getObjectByName('Etapa · Cobertura')).toBeTruthy();
    expect(parent.getObjectByName('Etapa · Instalações')).toBeTruthy();

    etapas.aplicar('walls');
    expect(wallsGroup.visible).toBe(true);
    expect(interiorsGroup.visible).toBe(false);
    expect(objectsGroup.visible).toBe(false);
    expect(parent.getObjectByName('Etapa · Fundação').visible).toBe(true);
    expect(parent.getObjectByName('Etapa · Cobertura').visible).toBe(false);

    etapas.aplicar('complete');
    expect(interiorsGroup.visible).toBe(true);
    expect(objectsGroup.visible).toBe(true);
    expect(parent.getObjectByName('Etapa · Fundação').visible).toBe(false);
    expect(parent.getObjectByName('Etapa · Estrutura').visible).toBe(false);
    expect(parent.getObjectByName('Etapa · Cobertura').visible).toBe(false);
    expect(parent.getObjectByName('Etapa · Instalações').visible).toBe(false);
  });
});
