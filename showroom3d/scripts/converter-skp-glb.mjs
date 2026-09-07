// Converte fontes/casa-geminada-bruno.skp diretamente para public/modelos/casa.glb + casa-meta.json.
// Usa a biblioteca openskp (build CJS — a build ESM tem um bug de "require('fs')" dentro de módulo ES).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { SkpFile, buildScene, toGLB } = require('openskp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, '..');
const skpPath = path.join(raiz, 'fontes', 'casa-geminada-bruno.skp');
const glbPath = path.join(raiz, 'public', 'modelos', 'casa.glb');
const metaPath = path.join(raiz, 'public', 'modelos', 'casa-meta.json');

if (!fs.existsSync(skpPath)) {
  throw new Error(`Arquivo de origem não encontrado: ${skpPath}`);
}

const buf = fs.readFileSync(skpPath);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const scene = buildScene(arrayBuffer);

if (!scene.glbPrimitives.length) {
  throw new Error('A cena resolvida não tem nenhum primitivo — verifique o arquivo de origem.');
}

// Correção de espec glTF: o openskp resolve a cor/alfa real do material do SketchUp em
// baseColorFactor (incluindo o canal alfa quando o material tem transparência), mas não marca
// alphaMode. Sem "alphaMode: BLEND", um visualizador conforme ao glTF ignora o alfa e renderiza
// opaco. Aplicamos aqui, sem alterar as cores.
let materiaisTransparentes = 0;
for (const material of scene.gltfMaterials) {
  const alfa = material?.pbrMetallicRoughness?.baseColorFactor?.[3];
  if (typeof alfa === 'number' && alfa < 0.98) {
    material.alphaMode = 'BLEND';
    materiaisTransparentes += 1;
  }
}

// scene.gltfMaterials já não carrega mais o nome original do material do SketchUp (é uma cor
// PBR anônima). Mas o parse() bruto do modelo ainda tem a biblioteca de materiais nomeados, com
// a transparência real de cada um. Como a cor RGB é um valor determinístico (não aproximado) que
// passa direto do material nomeado para o baseColorFactor resolvido, dá para recuperar a
// transparência real comparando a cor exata — mas só quando existe exatamente UM material
// nomeado com aquela cor exata (evita aplicar transparência a um material ambíguo, ex.: cinza
// 128,128,128 bate tanto com "Translucent_Glass_Gray" quanto com "CROMADO" — nesse caso não
// mexemos, para não repetir o erro do pipeline anterior de esconder geometria real por engano).
const modelo = SkpFile.open(skpPath).parse();
const materiaisNomeados = Object.values(modelo.materials);

// Heurística de acabamento (metalness/roughness) por nome do material real, só aplicada quando
// existe exatamente um candidato (mesma regra conservadora da transparência acima): reduz o
// risco de aplicar um acabamento errado num material ambíguo.
const PADRAO_METAL = /cromad|metal|alumin|inox|steel|silver/i;
const PADRAO_VIDRO = /vidro|glass|translucent/i;
const PADRAO_MADEIRA = /wood|madeira|bambu/i;

let materiaisRecuperados = 0;
for (const material of scene.gltfMaterials) {
  const [r, g, b] = material.pbrMetallicRoughness.baseColorFactor;
  const r255 = Math.round(r * 255), g255 = Math.round(g * 255), b255 = Math.round(b * 255);
  const candidatos = materiaisNomeados.filter(
    (m) => m.color && Math.abs(m.color.r - r255) <= 1 && Math.abs(m.color.g - g255) <= 1 && Math.abs(m.color.b - b255) <= 1,
  );
  if (candidatos.length !== 1) continue;
  const nome = candidatos[0].name;

  if (candidatos[0].transparency < 0.98) {
    material.pbrMetallicRoughness.baseColorFactor[3] = candidatos[0].transparency;
    material.alphaMode = 'BLEND';
    materiaisTransparentes += 1;
    materiaisRecuperados += 1;
  }

  if (PADRAO_METAL.test(nome)) {
    material.pbrMetallicRoughness.metallicFactor = 0.85;
    material.pbrMetallicRoughness.roughnessFactor = 0.32;
  } else if (PADRAO_VIDRO.test(nome)) {
    material.pbrMetallicRoughness.metallicFactor = 0;
    material.pbrMetallicRoughness.roughnessFactor = 0.06;
  } else if (PADRAO_MADEIRA.test(nome)) {
    material.pbrMetallicRoughness.metallicFactor = 0;
    material.pbrMetallicRoughness.roughnessFactor = 0.55;
  }
}

const glb = toGLB(scene, { embedTextures: true });
fs.mkdirSync(path.dirname(glbPath), { recursive: true });
fs.writeFileSync(glbPath, Buffer.from(glb));

// Bounding box real da geometria já resolvida (sem geometria inventada).
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
let totalTriangulos = 0;
for (const prim of scene.glbPrimitives) {
  const pos = prim.positions;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  totalTriangulos += prim.indices.length / 3;
}

const dimensoes = {
  width: Number((maxX - minX).toFixed(3)),
  height: Number((maxY - minY).toFixed(3)),
  depth: Number((maxZ - minZ).toFixed(3)),
};

const alvo = {
  x: Number(((minX + maxX) / 2).toFixed(3)),
  y: Number(((minY + maxY) / 2).toFixed(3)),
  z: Number(((minZ + maxZ) / 2).toFixed(3)),
};

const diagonalHorizontal = Math.hypot(dimensoes.width, dimensoes.depth);
const distanciaCamera = Number((diagonalHorizontal * 0.9 + dimensoes.height).toFixed(3));

const meta = {
  generatedAt: new Date().toISOString(),
  sourceFile: 'fontes/casa-geminada-bruno.skp',
  sourceUnits: 'meters',
  houseDimensionsMeters: dimensoes,
  boundsMinMeters: { x: Number(minX.toFixed(3)), y: Number(minY.toFixed(3)), z: Number(minZ.toFixed(3)) },
  boundsMaxMeters: { x: Number(maxX.toFixed(3)), y: Number(maxY.toFixed(3)), z: Number(maxZ.toFixed(3)) },
  cameraTargetMeters: alvo,
  cameraDistanceMeters: distanciaCamera,
  primitiveCount: scene.glbPrimitives.length,
  materialCount: scene.gltfMaterials.length,
  transparentMaterialCount: materiaisTransparentes,
  transparentMaterialsRecoveredFromSource: materiaisRecuperados,
  triangleCount: totalTriangulos,
  textureCount: scene.textures.length,
};

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

console.log('casa.glb gerado:', glbPath, `(${(glb.length / 1024 / 1024).toFixed(2)} MB)`);
console.log('casa-meta.json gerado:', metaPath);
console.log(meta);
