import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { converterParaPbr, prepararMaterialParaInteracao } from './materiais.js';

const loader = new GLTFLoader();

function centroDoAmbiente(room) {
  if (!room?.points?.length) return { x: 0, y: 0, z: 0 };
  const centro = room.points.reduce((acc, ponto) => {
    acc.x += ponto.x;
    acc.z += ponto.z;
    return acc;
  }, { x: 0, y: 0, z: 0 });
  return { x: centro.x / room.points.length, y: 0, z: centro.z / room.points.length };
}

function prepararModelo(gltfScene, item) {
  gltfScene.traverse((node) => {
    if (!node.isMesh) return;
    const materiais = Array.isArray(node.material) ? node.material : [node.material];
    const pbr = materiais.map((material) => converterParaPbr(material, 'furniture'));
    node.material = Array.isArray(node.material) ? pbr : pbr[0];
    pbr.forEach((material) => {
      material.envMapIntensity = item.material?.envMapIntensity ?? .8;
      if (item.material?.roughness !== undefined) material.roughness = item.material.roughness;
      if (item.material?.metalness !== undefined) material.metalness = item.material.metalness;
      prepararMaterialParaInteracao(material);
    });
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function posicionarModelo(gltfScene, item, rooms) {
  const room = rooms.find((ambiente) => ambiente.id === item.roomId || ambiente.displayName === item.room);
  const anchor = item.position || centroDoAmbiente(room);
  const dimensoes = item.dimensions || null;
  const caixaOriginal = new THREE.Box3().setFromObject(gltfScene);
  const tamanhoOriginal = caixaOriginal.getSize(new THREE.Vector3());
  if (dimensoes) {
    gltfScene.scale.set(
      dimensoes.width / Math.max(tamanhoOriginal.x, .001),
      dimensoes.height / Math.max(tamanhoOriginal.y, .001),
      dimensoes.depth / Math.max(tamanhoOriginal.z, .001),
    );
  } else if (item.scale) {
    gltfScene.scale.setScalar(item.scale);
  }
  gltfScene.rotation.y = item.rotationY || 0;
  gltfScene.position.set(anchor.x, anchor.y || 0, anchor.z);
  gltfScene.updateMatrixWorld(true);
  const caixaFinal = new THREE.Box3().setFromObject(gltfScene);
  gltfScene.position.y += (anchor.y || 0) - caixaFinal.min.y;
  gltfScene.updateMatrixWorld(true);
}

async function carregarItem(item, baseUrl, rooms) {
  if (!item?.model) return null;
  const gltf = await loader.loadAsync(new URL(item.model, baseUrl).href);
  const objeto = gltf.scene;
  prepararModelo(objeto, item);
  posicionarModelo(objeto, item, rooms);
  objeto.name = item.name || item.id || 'Modelo de apresentação';
  objeto.userData = {
    selectable: true,
    kind: 'presentation-furniture',
    id: item.id || objeto.name,
    sourceName: item.name || objeto.name,
    dimensions: item.dimensions || null,
    roomId: item.roomId || rooms.find((room) => room.displayName === item.room)?.id || null,
    model: item,
  };
  return objeto;
}

export async function carregarModelosApresentacao({ baseUrl, manifestoUrl, rooms, parent }) {
  let manifesto;
  try {
    const resposta = await fetch(manifestoUrl, { cache: 'no-store' });
    if (!resposta.ok) return [];
    manifesto = await resposta.json();
  } catch (erro) {
    console.warn('[showroom3d] Manifesto de modelos de apresentação indisponível.', erro);
    return [];
  }
  const itens = Array.isArray(manifesto) ? manifesto : manifesto.models;
  if (!Array.isArray(itens)) return [];
  const carregados = [];
  for (const item of itens) {
    try {
      const objeto = await carregarItem(item, baseUrl, rooms);
      if (!objeto) continue;
      parent.add(objeto);
      carregados.push(objeto);
    } catch (erro) {
      console.warn(`[showroom3d] Não foi possível carregar o modelo ${item.id || item.model}.`, erro);
    }
  }
  return carregados;
}
