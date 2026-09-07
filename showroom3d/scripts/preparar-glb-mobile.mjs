import fs from 'node:fs';
import path from 'node:path';

const [entrada, saida] = process.argv.slice(2);

if (!entrada || !saida) {
  console.error('Uso: node scripts/preparar-glb-mobile.mjs origem.glb destino.glb');
  process.exit(1);
}

function alinhar4(valor) {
  return (valor + 3) & ~3;
}

function lerGlb(caminho) {
  const arquivo = fs.readFileSync(caminho);
  if (arquivo.toString('ascii', 0, 4) !== 'glTF' || arquivo.readUInt32LE(4) !== 2) {
    throw new Error('O arquivo de entrada não é um GLB 2.0 válido.');
  }

  const tamanhoJson = arquivo.readUInt32LE(12);
  const tipoJson = arquivo.readUInt32LE(16);
  if (tipoJson !== 0x4e4f534a) throw new Error('O primeiro chunk do GLB não é JSON.');

  const json = JSON.parse(arquivo.toString('utf8', 20, 20 + tamanhoJson).trim());
  let deslocamento = 20 + tamanhoJson;
  let bin = Buffer.alloc(0);

  while (deslocamento + 8 <= arquivo.length) {
    const tamanhoChunk = arquivo.readUInt32LE(deslocamento);
    const tipoChunk = arquivo.readUInt32LE(deslocamento + 4);
    const inicio = deslocamento + 8;
    if (tipoChunk === 0x004e4942) bin = arquivo.subarray(inicio, inicio + tamanhoChunk);
    deslocamento = inicio + tamanhoChunk;
  }

  return { json, bin };
}

function percorrerNos(json, indicesIniciais) {
  const manter = new Set([json.scene != null ? json.scenes[json.scene].nodes[0] : json.scenes[0].nodes[0]]);
  const visitar = [...indicesIniciais];

  while (visitar.length) {
    const indice = visitar.pop();
    if (manter.has(indice)) continue;
    manter.add(indice);
    for (const filho of json.nodes[indice]?.children ?? []) visitar.push(filho);
  }

  return manter;
}

function adicionarAcessor(json, indices, acessor) {
  if (!Number.isInteger(acessor)) return;
  indices.add(acessor);
  const sparse = json.accessors[acessor]?.sparse;
  if (sparse) {
    adicionarBufferView(json, new Set(), sparse.indices?.bufferView);
    adicionarBufferView(json, new Set(), sparse.values?.bufferView);
  }
}

function adicionarBufferView(json, indices, bufferView) {
  if (!Number.isInteger(bufferView)) return;
  indices.add(bufferView);
}

function acessarTexturas(valor, resultado) {
  if (!valor || typeof valor !== 'object') return;
  for (const [chave, item] of Object.entries(valor)) {
    if (chave.endsWith('Texture') && item && Number.isInteger(item.index)) resultado.add(item.index);
    acessarTexturas(item, resultado);
  }
}

function remapearTexturas(material, mapaTexturas) {
  if (!material || typeof material !== 'object') return;
  for (const [chave, item] of Object.entries(material)) {
    if (chave.endsWith('Texture') && item && Number.isInteger(item.index)) item.index = mapaTexturas.get(item.index);
    remapearTexturas(item, mapaTexturas);
  }
}

function escreverGlb(json, bin, caminho) {
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = Buffer.concat([jsonBuffer, Buffer.alloc(alinhar4(jsonBuffer.length) - jsonBuffer.length, 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc(alinhar4(bin.length) - bin.length)]);
  const total = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const saidaBuffer = Buffer.alloc(total);

  saidaBuffer.write('glTF', 0, 4, 'ascii');
  saidaBuffer.writeUInt32LE(2, 4);
  saidaBuffer.writeUInt32LE(total, 8);
  saidaBuffer.writeUInt32LE(jsonPadded.length, 12);
  saidaBuffer.writeUInt32LE(0x4e4f534a, 16);
  jsonPadded.copy(saidaBuffer, 20);

  const inicioBin = 20 + jsonPadded.length;
  saidaBuffer.writeUInt32LE(binPadded.length, inicioBin);
  saidaBuffer.writeUInt32LE(0x004e4942, inicioBin + 4);
  binPadded.copy(saidaBuffer, inicioBin + 8);

  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, saidaBuffer);
}

const { json, bin } = lerGlb(entrada);
const raiz = json.scenes[json.scene ?? 0].nodes[0];
const filhosRaiz = json.nodes[raiz]?.children ?? [];
const posicoesMantidas = new Set([5, 6, 11, 12, 13, 14]);
const filhosMantidos = filhosRaiz.filter((_, indice) => posicoesMantidas.has(indice));

if (filhosMantidos.length !== posicoesMantidas.size) {
  throw new Error(`A estrutura do GLB mudou: esperados 6 filhos selecionados, encontrados ${filhosMantidos.length}.`);
}

const nosMantidos = percorrerNos(json, filhosMantidos);
const mapas = {
  nodes: new Map(),
  meshes: new Map(),
  accessors: new Map(),
  bufferViews: new Map(),
  materials: new Map(),
  textures: new Map(),
  images: new Map(),
  samplers: new Map(),
};

const meshesMantidos = new Set();
const materiaisMantidos = new Set();
const acessoresMantidos = new Set();
for (const indiceNo of nosMantidos) {
  const no = json.nodes[indiceNo];
  if (Number.isInteger(no?.mesh)) meshesMantidos.add(no.mesh);
}
for (const indiceMesh of meshesMantidos) {
  for (const primitivo of json.meshes[indiceMesh]?.primitives ?? []) {
    if (Number.isInteger(primitivo.material)) materiaisMantidos.add(primitivo.material);
    for (const indiceAcessor of Object.values(primitivo.attributes ?? {})) adicionarAcessor(json, acessoresMantidos, indiceAcessor);
    adicionarAcessor(json, acessoresMantidos, primitivo.indices);
    for (const alvo of primitivo.targets ?? []) {
      for (const indiceAcessor of Object.values(alvo)) adicionarAcessor(json, acessoresMantidos, indiceAcessor);
    }
  }
}

const texturasMantidas = new Set();
for (const indiceMaterial of materiaisMantidos) acessarTexturas(json.materials[indiceMaterial], texturasMantidas);
const imagensMantidas = new Set();
const samplersMantidos = new Set();
for (const indiceTextura of texturasMantidas) {
  const textura = json.textures[indiceTextura];
  if (Number.isInteger(textura?.source)) imagensMantidas.add(textura.source);
  if (Number.isInteger(textura?.sampler)) samplersMantidos.add(textura.sampler);
}

const bufferViewsMantidos = new Set();
for (const indiceAcessor of acessoresMantidos) {
  adicionarBufferView(json, bufferViewsMantidos, json.accessors[indiceAcessor]?.bufferView);
  const sparse = json.accessors[indiceAcessor]?.sparse;
  if (sparse) {
    adicionarBufferView(json, bufferViewsMantidos, sparse.indices?.bufferView);
    adicionarBufferView(json, bufferViewsMantidos, sparse.values?.bufferView);
  }
}
for (const indiceImagem of imagensMantidas) adicionarBufferView(json, bufferViewsMantidos, json.images[indiceImagem]?.bufferView);

function criarMapa(indices, mapa) {
  [...indices].sort((a, b) => a - b).forEach((indice, novoIndice) => mapa.set(indice, novoIndice));
}

criarMapa(nosMantidos, mapas.nodes);
criarMapa(meshesMantidos, mapas.meshes);
criarMapa(acessoresMantidos, mapas.accessors);
criarMapa(bufferViewsMantidos, mapas.bufferViews);
criarMapa(materiaisMantidos, mapas.materials);
criarMapa(texturasMantidas, mapas.textures);
criarMapa(imagensMantidas, mapas.images);
criarMapa(samplersMantidos, mapas.samplers);

const novoBinPartes = [];
let novoBinTamanho = 0;
for (const indice of [...bufferViewsMantidos].sort((a, b) => a - b)) {
  const view = json.bufferViews[indice];
  const inicio = view.byteOffset ?? 0;
  const fim = inicio + view.byteLength;
  const alinhado = alinhar4(novoBinTamanho);
  novoBinPartes.push(Buffer.alloc(alinhado - novoBinTamanho));
  novoBinPartes.push(bin.subarray(inicio, fim));
  mapas.bufferViews.set(indice, { indice: mapas.bufferViews.get(indice), byteOffset: alinhado });
  novoBinTamanho = alinhado + view.byteLength;
}
const novoBin = Buffer.concat(novoBinPartes);

const novoJson = {
  ...json,
  scene: 0,
  scenes: [{ ...json.scenes[json.scene ?? 0], nodes: [mapas.nodes.get(raiz)] }],
  nodes: [...nosMantidos].sort((a, b) => a - b).map((indice) => {
    const no = { ...json.nodes[indice] };
    if (Number.isInteger(no.mesh)) no.mesh = mapas.meshes.get(no.mesh);
    if (Array.isArray(no.children)) no.children = no.children.filter((filho) => mapas.nodes.has(filho)).map((filho) => mapas.nodes.get(filho));
    return no;
  }),
  meshes: [...meshesMantidos].sort((a, b) => a - b).map((indice) => ({
    ...json.meshes[indice],
    primitives: json.meshes[indice].primitives.map((primitivo) => ({
      ...primitivo,
      attributes: Object.fromEntries(Object.entries(primitivo.attributes ?? {}).map(([chave, valor]) => [chave, mapas.accessors.get(valor)])),
      ...(Number.isInteger(primitivo.indices) ? { indices: mapas.accessors.get(primitivo.indices) } : {}),
      ...(Number.isInteger(primitivo.material) ? { material: mapas.materials.get(primitivo.material) } : {}),
      ...(primitivo.targets ? { targets: primitivo.targets.map((alvo) => Object.fromEntries(Object.entries(alvo).map(([chave, valor]) => [chave, mapas.accessors.get(valor)]))) } : {}),
    })),
  })),
  accessors: [...acessoresMantidos].sort((a, b) => a - b).map((indice) => {
    const acessor = { ...json.accessors[indice] };
    if (Number.isInteger(acessor.bufferView)) acessor.bufferView = mapas.bufferViews.get(acessor.bufferView).indice;
    return acessor;
  }),
  bufferViews: [...bufferViewsMantidos].sort((a, b) => a - b).map((indice) => {
    const view = { ...json.bufferViews[indice] };
    const novo = mapas.bufferViews.get(indice);
    view.byteOffset = novo.byteOffset;
    return view;
  }),
  buffers: [{ ...json.buffers[0], byteLength: novoBin.length }],
  materials: [...materiaisMantidos].sort((a, b) => a - b).map((indice) => {
    const material = structuredClone(json.materials[indice]);
    remapearTexturas(material, mapas.textures);
    return material;
  }),
  textures: [...texturasMantidas].sort((a, b) => a - b).map((indice) => {
    const textura = { ...json.textures[indice] };
    if (Number.isInteger(textura.source)) textura.source = mapas.images.get(textura.source);
    if (Number.isInteger(textura.sampler)) textura.sampler = mapas.samplers.get(textura.sampler);
    return textura;
  }),
  images: [...imagensMantidas].sort((a, b) => a - b).map((indice) => {
    const imagem = { ...json.images[indice] };
    if (Number.isInteger(imagem.bufferView)) imagem.bufferView = mapas.bufferViews.get(imagem.bufferView).indice;
    return imagem;
  }),
  samplers: [...samplersMantidos].sort((a, b) => a - b).map((indice) => json.samplers[indice]),
};

escreverGlb(novoJson, novoBin, saida);

const originalBytes = fs.statSync(entrada).size;
const novoBytes = fs.statSync(saida).size;
console.log(JSON.stringify({
  entrada,
  saida,
  tamanhoOriginal: originalBytes,
  tamanhoNovo: novoBytes,
  reducaoPercentual: Number(((1 - novoBytes / originalBytes) * 100).toFixed(1)),
  nos: novoJson.nodes.length,
  meshes: novoJson.meshes.length,
  accessors: novoJson.accessors.length,
  bufferViews: novoJson.bufferViews.length,
  materials: novoJson.materials.length,
  textures: novoJson.textures.length,
  images: novoJson.images.length,
}, null, 2));
