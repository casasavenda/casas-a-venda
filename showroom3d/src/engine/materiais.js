import * as THREE from 'three';

export const CORES_PADRAO = {
  wall: '#d9d1c4',
  floor: '#d6c2a7',
  ceiling: '#f7f5f0',
  opening: '#a69e91',
  furniture: '#9b6f4d',
  terrain: '#38623a',
};

const cache = new Map();

function normalizarHex(valor, fallback) {
  if (!valor) return fallback;
  const string = String(valor).replace('#', '');
  return /^[0-9a-f]{6}$/i.test(string) ? `#${string}` : fallback;
}

export function criarMaterial(tipo, opcoes = {}) {
  const color = normalizarHex(opcoes.color, CORES_PADRAO[tipo] || '#bcb5ab');
  const opacity = opcoes.opacity ?? 1;
  const key = `${tipo}:${color}:${opacity}:${opcoes.transparent ? 't' : 'o'}`;
  if (!opcoes.unique && cache.has(key)) return cache.get(key);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opcoes.roughness ?? (tipo === 'opening' ? .7 : .88),
    metalness: opcoes.metalness ?? 0,
    side: THREE.DoubleSide,
    transparent: opacity < 1 || opcoes.transparent === true,
    opacity,
    depthWrite: opacity > .5,
  });
  if (!opcoes.unique) cache.set(key, material);
  return material;
}

export function converterParaPbr(material, tipo = 'furniture') {
  if (!material || material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) return material;
  const pbr = new THREE.MeshStandardMaterial({
    color: material.color?.getHex?.() ?? (CORES_PADRAO[tipo] || '#bcb5ab'),
    map: material.map || null,
    alphaMap: material.alphaMap || null,
    transparent: material.transparent === true,
    opacity: material.opacity ?? 1,
    side: material.side ?? THREE.FrontSide,
    roughness: tipo === 'opening' ? .42 : .64,
    metalness: tipo === 'opening' ? .08 : .02,
  });
  if (material.emissive) pbr.emissive.copy(material.emissive);
  if (material.emissiveIntensity !== undefined) pbr.emissiveIntensity = material.emissiveIntensity;
  if (material.normalMap) pbr.normalMap = material.normalMap;
  if (material.roughnessMap) pbr.roughnessMap = material.roughnessMap;
  if (material.metalnessMap) pbr.metalnessMap = material.metalnessMap;
  return pbr;
}

export function corDaParede(wall, lado = 'left') {
  return wall.colors?.[lado]?.hex || CORES_PADRAO.wall;
}

export function prepararMaterialParaInteracao(material) {
  const materiais = Array.isArray(material) ? material : [material];
  for (const item of materiais) {
    if (!item) continue;
    item.userData = item.userData || {};
    item.userData.baseOpacity = item.opacity;
    item.userData.baseColor = item.color?.getHex?.();
    item.userData.baseEmissive = item.emissive?.getHex?.() ?? 0;
  }
}

export function materialUnico(material) {
  const copia = material.clone();
  prepararMaterialParaInteracao(copia);
  return copia;
}

export function iterarMateriais(objeto, callback) {
  objeto.traverse((node) => {
    if (!node.isMesh) return;
    const materiais = Array.isArray(node.material) ? node.material : [node.material];
    materiais.forEach(callback);
  });
}

export function destacar(objeto, ativo) {
  iterarMateriais(objeto, (material) => {
    if (!material) return;
    if (material.emissive) {
      material.emissive.set(ativo ? '#6e472a' : material.userData?.baseEmissive ?? 0);
      material.emissiveIntensity = ativo ? .18 : 0;
    }
  });
}
