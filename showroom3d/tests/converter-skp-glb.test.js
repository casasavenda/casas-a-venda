import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// openskp só funciona pela build CJS (a build ESM tem um require('fs') dentro de módulo ES).
const require = createRequire(import.meta.url);
const { SkpFile, buildScene } = require('openskp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skpPath = path.resolve(__dirname, '..', 'fontes', 'casa-geminada-bruno.skp');

function carregarCena() {
  const buf = fs.readFileSync(skpPath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return buildScene(arrayBuffer);
}

describe('conversor .skp -> glb (fonte real da casa geminada)', () => {
  it('abre e resolve a cena sem lançar exceção', () => {
    expect(() => carregarCena()).not.toThrow();
  });

  it('produz pelo menos um primitivo e um material', () => {
    const scene = carregarCena();
    expect(scene.glbPrimitives.length).toBeGreaterThan(0);
    expect(scene.gltfMaterials.length).toBeGreaterThan(0);
  });

  it('não tem nenhuma coordenada NaN ou infinita', () => {
    const scene = carregarCena();
    for (const prim of scene.glbPrimitives) {
      for (const valor of prim.positions) {
        expect(Number.isFinite(valor)).toBe(true);
      }
    }
  });

  it('tem uma altura de caixa delimitadora plausível para uma casa (em metros, não mm nem km)', () => {
    const scene = carregarCena();
    let minY = Infinity, maxY = -Infinity;
    for (const prim of scene.glbPrimitives) {
      const pos = prim.positions;
      for (let i = 1; i < pos.length; i += 3) {
        if (pos[i] < minY) minY = pos[i];
        if (pos[i] > maxY) maxY = pos[i];
      }
    }
    const altura = maxY - minY;
    expect(altura).toBeGreaterThan(2);
    expect(altura).toBeLessThan(30);
  });

  it('tem materiais com cores RGB diferentes entre si (não caiu tudo num cinza padrão)', () => {
    const scene = carregarCena();
    const cores = new Set(
      scene.gltfMaterials.map((m) => m.pbrMetallicRoughness.baseColorFactor.slice(0, 3).map((v) => Math.round(v * 255)).join(',')),
    );
    expect(cores.size).toBeGreaterThan(5);
  });

  it('a biblioteca de materiais do .skp tem pelo menos um vidro/translúcido com transparência real', () => {
    // Garante que a matéria-prima existe na fonte; a recuperação em si (feita no script de
    // conversão) é testada abaixo, lendo o casa.glb já publicado.
    const modelo = SkpFile.open(skpPath).parse();
    const materiaisNomeados = Object.values(modelo.materials);
    const materiaisVidro = materiaisNomeados.filter(
      (m) => /vidro|glass|translucent/i.test(m.name) && m.transparency < 0.98,
    );
    expect(materiaisVidro.length).toBeGreaterThan(0);
  });
});

describe('casa.glb publicado (public/modelos/casa.glb)', () => {
  function lerJsonDoGlb() {
    const glbPath = path.resolve(__dirname, '..', 'public', 'modelos', 'casa.glb');
    const buf = fs.readFileSync(glbPath);
    const jsonChunkLength = buf.readUInt32LE(12);
    const jsonBuf = buf.subarray(20, 20 + jsonChunkLength);
    return JSON.parse(jsonBuf.toString('utf8'));
  }

  it('existe e é um GLB binário válido (assinatura "glTF")', () => {
    const glbPath = path.resolve(__dirname, '..', 'public', 'modelos', 'casa.glb');
    const buf = fs.readFileSync(glbPath);
    expect(buf.toString('utf8', 0, 4)).toBe('glTF');
  });

  it('tem pelo menos um material com alphaMode BLEND e alfa real recuperado da fonte', () => {
    const json = lerJsonDoGlb();
    const materiaisTransparentes = (json.materials || []).filter(
      (m) => m.alphaMode === 'BLEND' && m.pbrMetallicRoughness?.baseColorFactor?.[3] < 0.98,
    );
    expect(materiaisTransparentes.length).toBeGreaterThan(0);
  });

  it('tem paredes/faces com material dois-lados (doubleSided) para evitar back-face culling', () => {
    const json = lerJsonDoGlb();
    const materiaisDoisLados = (json.materials || []).filter((m) => m.doubleSided === true);
    expect(materiaisDoisLados.length).toBeGreaterThan(0);
  });
});
