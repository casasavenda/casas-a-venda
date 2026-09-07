import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { converterParaPbr, criarMaterial, prepararMaterialParaInteracao } from './materiais.js';

const textoCache = new Map();

function caminhoArquivo(arquivos, caminho) {
  if (!caminho) return null;
  const normalizado = caminho.replace(/^\.\//, '');
  return arquivos[normalizado] || arquivos[caminho] || null;
}

function lerObj(arquivos, caminho) {
  const bytes = caminhoArquivo(arquivos, caminho);
  if (!bytes) return null;
  if (!textoCache.has(caminho)) textoCache.set(caminho, new TextDecoder('utf-8').decode(bytes));
  return textoCache.get(caminho);
}

function prepararModelo(objeto, tipo) {
  objeto.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.material) node.material = criarMaterial('opening');
    const materiais = Array.isArray(node.material) ? node.material : [node.material];
    const pbr = materiais.map((material) => {
      const convertido = converterParaPbr(material, tipo);
      if (convertido.map && convertido.map.colorSpace !== undefined) convertido.map.colorSpace = THREE.SRGBColorSpace;
      return convertido;
    });
    node.material = Array.isArray(node.material) ? pbr : pbr[0];
    pbr.forEach((material) => {
      if (material.map && material.map.colorSpace !== undefined) material.map.colorSpace = THREE.SRGBColorSpace;
      prepararMaterialParaInteracao(material);
    });
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function materialApresentacao(cor, opcoes = {}) {
  return new THREE.MeshStandardMaterial({
    color: cor,
    roughness: opcoes.roughness ?? .62,
    metalness: opcoes.metalness ?? .02,
    envMapIntensity: opcoes.envMapIntensity ?? .65,
  });
}

function materialVidro() {
  return new THREE.MeshPhysicalMaterial({
    color: '#93aeb2',
    roughness: .12,
    metalness: .04,
    clearcoat: .8,
    clearcoatRoughness: .08,
    transmission: .16,
    thickness: .08,
    envMapIntensity: 1.35,
  });
}

function materialDeApresentacao(data, tipo, nome) {
  if (tipo === 'opening') {
    const catalogId = String(data.catalogId || '').toLowerCase();
    const janela = data.type === 'window';
    if (janela && /pane|glass|window_pane/.test(nome)) return materialVidro();
    if (janela && /frame|hinge|handle/.test(nome)) return materialApresentacao('#25282a', { roughness: .28, metalness: .34, envMapIntensity: .85 });
    if (catalogId.includes('garagedoor')) return materialApresentacao('#292b2c', { roughness: .34, metalness: .2 });
    if (/handle|hinge/.test(nome)) return materialApresentacao('#272a2a', { roughness: .24, metalness: .48, envMapIntensity: .9 });
    if (/frame/.test(nome)) return materialApresentacao('#f1eee7', { roughness: .52 });
    return materialApresentacao('#e8e4dc', { roughness: .58 });
  }
  if (/pillow|seat|shoulder/.test(nome)) return materialApresentacao('#d4ccc1', { roughness: .9, envMapIntensity: .42 });
  if (/base|bottom/.test(nome)) return materialApresentacao('#655b53', { roughness: .78, envMapIntensity: .45 });
  return materialApresentacao('#b49a7d', { roughness: .68, envMapIntensity: .58 });
}

function aplicarMaterialDeApresentacao(objeto, data, tipo) {
  objeto.traverse((node) => {
    if (!node.isMesh) return;
    const quantidade = Array.isArray(node.material) ? node.material.length : 1;
    const nome = String(node.name || '').toLowerCase();
    node.material = Array.from({ length: quantidade }, () => materialDeApresentacao(data, tipo, nome));
    if (node.material.length === 1) node.material = node.material[0];
    prepararMaterialParaInteracao(node.material);
  });
}

function placeholder(tipo, data) {
  const geometry = tipo === 'furniture'
    ? new THREE.BoxGeometry(Math.max(.2, data.width), Math.max(.2, data.height), Math.max(.2, data.depth))
    : new THREE.BoxGeometry(Math.max(.08, data.width), Math.max(.08, data.height), Math.max(.08, data.depth));
  const material = criarMaterial(tipo === 'furniture' ? 'furniture' : 'opening');
  prepararMaterialParaInteracao(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.placeholder = true;
  return mesh;
}

function posicionarModelo(objeto, data) {
  const box = new THREE.Box3().setFromObject(objeto);
  const size = box.getSize(new THREE.Vector3());
  const safeSize = { x: size.x || 1, y: size.y || 1, z: size.z || 1 };
  objeto.scale.set(data.width / safeSize.x, data.height / safeSize.y, data.depth / safeSize.z);
  objeto.rotation.y = -data.angle;
  objeto.position.set(data.position.x, (data.levelElevation || 0) + data.elevation, data.position.z);
  objeto.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(objeto);
  objeto.position.y += (data.levelElevation || 0) + data.elevation - scaledBox.min.y;
  objeto.updateMatrixWorld(true);
}

function criarObjeto(data, arquivos, tipo) {
  const loader = new OBJLoader();
  const texto = lerObj(arquivos, data.modelPath);
  let objeto = texto ? loader.parse(texto) : placeholder(tipo, data);
  if (!texto && typeof console !== 'undefined') console.warn(`[showroom3d] Modelo OBJ não encontrado: ${data.modelPath}`);
  prepararModelo(objeto, tipo);
  aplicarMaterialDeApresentacao(objeto, data, tipo);
  posicionarModelo(objeto, data);
  objeto.name = data.name;
  objeto.userData = {
    ...objeto.userData,
    selectable: true,
    kind: tipo,
    id: data.id,
    sourceName: data.name,
    dimensions: { width: data.width, depth: data.depth, height: data.height },
    levelId: data.levelId,
    levelName: data.levelName,
    stage: 'finishes',
    model: data,
  };
  return objeto;
}

export async function carregarObjetos(modelo, parent) {
  const group = new THREE.Group();
  group.name = 'Aberturas e móveis';
  const openings = [];
  const furniture = [];
  const arquivos = modelo.arquivos || {};
  for (const abertura of modelo.openings) {
    const object = criarObjeto(abertura, arquivos, 'opening');
    group.add(object);
    openings.push(object);
  }
  for (const item of modelo.furniture) {
    const object = criarObjeto(item, arquivos, 'furniture');
    group.add(object);
    furniture.push(object);
  }
  parent.add(group);
  return { group, openings, furniture };
}
