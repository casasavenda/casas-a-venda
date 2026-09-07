import * as THREE from 'three';
import { criarMaterial, prepararMaterialParaInteracao } from './materiais.js';

export const ETAPAS_CONSTRUCAO = [
  { id: 'terrain', label: 'Terreno', description: 'O lote e a implantação da casa.' },
  { id: 'foundation', label: 'Fundação', description: 'Base estrutural e laje de fundação.' },
  { id: 'structure', label: 'Estrutura', description: 'Pilares e vigas que sustentam a construção.' },
  { id: 'walls', label: 'Paredes', description: 'Paredes e divisões da planta aparecem.' },
  { id: 'roof', label: 'Cobertura', description: 'A cobertura visual protege o volume da casa.' },
  { id: 'installations', label: 'Instalações', description: 'Percursos visuais de água, energia e infraestrutura.' },
  { id: 'finishes', label: 'Acabamentos', description: 'Pisos, forros, portas, janelas e materiais finais.' },
  { id: 'complete', label: 'Casa pronta', description: 'A casa completa pronta para apresentação.' },
];

const INDICES = new Map(ETAPAS_CONSTRUCAO.map((item, indice) => [item.id, indice]));

function materialEtapa(tipo, color, opcoes = {}) {
  const material = criarMaterial(tipo, { color, roughness: opcoes.roughness ?? .72, metalness: opcoes.metalness ?? 0, unique: true });
  prepararMaterialParaInteracao(material);
  return material;
}

function marcar(mesh, kind) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { selectable: false, kind, stage: kind };
  return mesh;
}

function limitesDoModelo(modelo) {
  const { minX, maxX, minZ, maxZ } = modelo.extents;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: Math.max(.8, maxX - minX),
    depth: Math.max(.8, maxZ - minZ),
  };
}

function criarFundacao(modelo) {
  const grupo = new THREE.Group();
  grupo.name = 'Etapa · Fundação';
  grupo.userData = { selectable: false, kind: 'construction-foundation' };
  const limite = limitesDoModelo(modelo);
  const material = materialEtapa('foundation', '#9b9b91', { roughness: .9 });
  const laje = marcar(new THREE.Mesh(new THREE.BoxGeometry(limite.width + .5, .16, limite.depth + .5), material), 'foundation');
  laje.position.set(limite.centerX, .08, limite.centerZ);
  laje.name = 'Laje de fundação';
  grupo.add(laje);

  for (const [x, z, width, depth] of [
    [limite.centerX, limite.minZ - .12, limite.width + .7, .2],
    [limite.centerX, limite.maxZ + .12, limite.width + .7, .2],
    [limite.minX - .12, limite.centerZ, .2, limite.depth + .7],
    [limite.maxX + .12, limite.centerZ, .2, limite.depth + .7],
  ]) {
    const footing = marcar(new THREE.Mesh(new THREE.BoxGeometry(width, .28, depth), material), 'foundation');
    footing.position.set(x, .14, z);
    footing.name = 'Sapata corrida';
    grupo.add(footing);
  }
  return grupo;
}

function criarBarraEstrutural(parede, material) {
  const dx = parede.end.x - parede.start.x;
  const dz = parede.end.z - parede.start.z;
  const comprimento = Math.hypot(dx, dz);
  if (!comprimento) return null;
  const barra = marcar(new THREE.Mesh(new THREE.BoxGeometry(comprimento, .16, .16), material), 'structure');
  barra.position.set((parede.start.x + parede.end.x) / 2, (parede.levelElevation || 0) + Math.max(.16, parede.height - .12), (parede.start.z + parede.end.z) / 2);
  barra.rotation.y = -Math.atan2(dz, dx);
  barra.name = `Viga ${parede.id}`;
  return barra;
}

function criarEstrutura(modelo) {
  const grupo = new THREE.Group();
  grupo.name = 'Etapa · Estrutura';
  grupo.userData = { selectable: false, kind: 'construction-structure' };
  const material = materialEtapa('structure', '#77736d', { roughness: .62, metalness: .08 });
  const pontos = new Map();
  for (const parede of modelo.walls) {
    const elevacao = parede.levelElevation || 0;
    const altura = Math.max(.2, parede.height);
    for (const ponto of [parede.start, parede.end]) {
      const chave = `${parede.levelId || 'base'}:${ponto.x.toFixed(3)}:${ponto.z.toFixed(3)}`;
      if (pontos.has(chave)) continue;
      pontos.set(chave, true);
      const pilar = marcar(new THREE.Mesh(new THREE.BoxGeometry(.18, altura, .18), material), 'structure');
      pilar.position.set(ponto.x, elevacao + altura / 2, ponto.z);
      pilar.name = 'Pilar estrutural';
      grupo.add(pilar);
    }
    const viga = criarBarraEstrutural(parede, material);
    if (viga) grupo.add(viga);
  }
  return grupo;
}

function criarCobertura(modelo) {
  const grupo = new THREE.Group();
  grupo.name = 'Etapa · Cobertura';
  grupo.userData = { selectable: false, kind: 'construction-roof' };
  const limite = limitesDoModelo(modelo);
  const topo = modelo.walls.reduce((maior, parede) => Math.max(maior, (parede.levelElevation || 0) + parede.height), modelo.wallHeight || 2.5);
  const material = materialEtapa('roof', '#6b5548', { roughness: .78 });
  const telhado = marcar(new THREE.Mesh(new THREE.BoxGeometry(limite.width + .72, .22, limite.depth + .72), material), 'roof');
  telhado.position.set(limite.centerX, topo + .11, limite.centerZ);
  telhado.name = 'Cobertura visual';
  grupo.add(telhado);
  return grupo;
}

function cilindroEntrePontos(a, b, material, radius = .025) {
  const direcao = new THREE.Vector3().subVectors(b, a);
  const comprimento = direcao.length();
  if (comprimento < .05) return null;
  const tubo = marcar(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, comprimento, 8), material), 'installations');
  tubo.position.copy(a).add(b).multiplyScalar(.5);
  tubo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direcao.normalize());
  tubo.name = 'Tubo de instalação';
  return tubo;
}

function criarInstalacoes(modelo) {
  const grupo = new THREE.Group();
  grupo.name = 'Etapa · Instalações';
  grupo.userData = { selectable: false, kind: 'construction-installations' };
  const agua = materialEtapa('water-installation', '#3c86c8', { roughness: .45, metalness: .12 });
  const energia = materialEtapa('electric-installation', '#d46c43', { roughness: .48, metalness: .12 });
  for (const [indice, room] of modelo.rooms.filter((item) => !item.isLot && item.points.length >= 3).entries()) {
    const elevacao = room.levelElevation || 0;
    const altura = room.levelHeight || modelo.wallHeight || 2.5;
    const centro = room.points.reduce((acc, ponto) => acc.add(new THREE.Vector3(ponto.x, 0, ponto.z)), new THREE.Vector3()).multiplyScalar(1 / room.points.length);
    const base = new THREE.Vector3(centro.x, elevacao + .08, centro.z);
    const topo = new THREE.Vector3(centro.x, elevacao + Math.min(altura * .72, 2.1), centro.z);
    const prumada = cilindroEntrePontos(base, topo, indice % 2 ? energia : agua, .035);
    if (prumada) grupo.add(prumada);
    for (const [pontoIndice, ponto] of room.points.entries()) {
      const destino = new THREE.Vector3(ponto.x, elevacao + Math.min(altura * .58, 1.7), ponto.z);
      const tubo = cilindroEntrePontos(new THREE.Vector3(centro.x, destino.y, centro.z), destino, pontoIndice % 2 ? energia : agua, .022);
      if (tubo) grupo.add(tubo);
    }
  }
  return grupo;
}

export function criarEtapasConstrucao(modelo, { parent, terrain, wallsGroup, interiorsGroup, objectsGroup }) {
  const foundation = criarFundacao(modelo);
  const structure = criarEstrutura(modelo);
  const roof = criarCobertura(modelo);
  const installations = criarInstalacoes(modelo);
  parent.add(foundation, structure, roof, installations);
  const generated = { foundation, structure, roof, installations };
  let etapaAtual = 'complete';

  function aplicar(id = 'complete') {
    const etapa = ETAPAS_CONSTRUCAO.find((item) => item.id === id) || ETAPAS_CONSTRUCAO.at(-1);
    const indice = INDICES.get(etapa.id);
    const casaPronta = etapa.id === 'complete';
    terrain.visible = true;
    foundation.visible = !casaPronta && indice >= INDICES.get('foundation');
    structure.visible = !casaPronta && indice >= INDICES.get('structure');
    wallsGroup.visible = indice >= INDICES.get('walls');
    roof.visible = !casaPronta && indice >= INDICES.get('roof');
    installations.visible = !casaPronta && indice >= INDICES.get('installations');
    interiorsGroup.visible = indice >= INDICES.get('finishes');
    objectsGroup.visible = indice >= INDICES.get('finishes');
    etapaAtual = etapa.id;
    return etapa;
  }

  aplicar('complete');
  return {
    etapas: ETAPAS_CONSTRUCAO,
    generated,
    aplicar,
    atual: () => etapaAtual,
  };
}
