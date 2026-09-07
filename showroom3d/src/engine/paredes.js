import * as THREE from 'three';
import { corDaParede, criarMaterial, prepararMaterialParaInteracao } from './materiais.js';
import { texturaProcedural } from '../acabamentos/aplicar.js';

function aberturaNaParede(abertura, parede) {
  if (abertura.wallId !== parede.id) return null;
  const dx = parede.end.x - parede.start.x;
  const dz = parede.end.z - parede.start.z;
  const comprimento = Math.hypot(dx, dz);
  if (!comprimento) return null;
  const eixoX = dx / comprimento;
  const eixoZ = dz / comprimento;
  const centro = (abertura.position.x - parede.start.x) * eixoX + (abertura.position.z - parede.start.z) * eixoZ;
  if (centro + abertura.width / 2 < 0 || centro - abertura.width / 2 > comprimento) return null;
  return {
    center: centro,
    width: abertura.width,
    bottom: abertura.elevation,
    top: abertura.elevation + abertura.height,
    type: abertura.type,
    catalogId: abertura.catalogId,
    id: abertura.id,
  };
}

function materialAcabamentoAbertura(vao) {
  const catalogId = String(vao.catalogId || '').toLowerCase();
  if (catalogId.includes('garagedoor')) {
    return criarMaterial('opening', { color: '#2a2b2b', roughness: .34, metalness: .18, unique: true });
  }
  if (vao.type === 'window') {
    return criarMaterial('opening', { color: '#25282a', roughness: .3, metalness: .28, unique: true });
  }
  return criarMaterial('opening', { color: '#eeeae2', roughness: .54, unique: true });
}

function adicionarMolduraAbertura(parent, vao, espessuraParede) {
  const altura = vao.top - vao.bottom;
  if (vao.width <= 0 || altura <= .08) return;
  const larguraMoldura = vao.type === 'window' ? .045 : .065;
  const profundidade = espessuraParede + .055;
  const material = materialAcabamentoAbertura(vao);
  const grupo = new THREE.Group();
  grupo.name = `Acabamento do vão ${vao.id || ''}`.trim();
  grupo.userData = { selectable: false, kind: 'opening-finish', openingId: vao.id };

  const criarBarra = (nome, largura, alturaBarra, x, y) => {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(largura, alturaBarra, profundidade), material);
    barra.position.set(x, y, 0);
    barra.name = nome;
    barra.castShadow = true;
    barra.receiveShadow = true;
    barra.userData = { selectable: false, kind: 'opening-finish', openingId: vao.id };
    grupo.add(barra);
  };

  criarBarra('Moldura superior', vao.width + larguraMoldura * 2, larguraMoldura, vao.center, vao.top - larguraMoldura / 2);
  criarBarra('Moldura inferior', vao.width + larguraMoldura * 2, larguraMoldura, vao.center, vao.bottom + larguraMoldura / 2);
  const alturaVertical = Math.max(.02, altura - larguraMoldura * 2);
  criarBarra('Moldura esquerda', larguraMoldura, alturaVertical, vao.center - vao.width / 2 - larguraMoldura / 2, vao.bottom + altura / 2);
  criarBarra('Moldura direita', larguraMoldura, alturaVertical, vao.center + vao.width / 2 + larguraMoldura / 2, vao.bottom + altura / 2);

  parent.add(grupo);
}

function criarParede(parede, aberturas) {
  const dx = parede.end.x - parede.start.x;
  const dz = parede.end.z - parede.start.z;
  const comprimento = Math.hypot(dx, dz);
  const altura = Math.max(parede.height, parede.heightAtEnd || parede.height);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(comprimento, 0);
  shape.lineTo(comprimento, altura);
  shape.lineTo(0, altura);
  shape.closePath();

  const vãos = aberturas.map((abertura) => aberturaNaParede(abertura, parede)).filter(Boolean);
  for (const vao of vãos) {
    const left = Math.max(0.001, vao.center - vao.width / 2);
    const right = Math.min(comprimento - 0.001, vao.center + vao.width / 2);
    const bottom = Math.max(0, vao.bottom);
    const top = Math.min(altura - 0.001, vao.top);
    if (right <= left || top <= bottom) continue;
    const hole = new THREE.Path();
    hole.moveTo(left, bottom);
    hole.lineTo(right, bottom);
    hole.lineTo(right, top);
    hole.lineTo(left, top);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: parede.thickness, bevelEnabled: false, curveSegments: 2 });
  geometry.translate(0, 0, -parede.thickness / 2);
  geometry.computeVertexNormals();
  const cor = corDaParede(parede);
  const material = criarMaterial('wall', { color: cor, roughness: .86, unique: true });
  const textura = texturaProcedural({ id: `wall-plaster-${cor}`, color: cor, texture: 'plaster' });
  const relevo = texturaProcedural({ id: `wall-plaster-bump-${cor}`, color: '#808080', texture: 'plaster' });
  if (textura) {
    textura.repeat.set(Math.max(1.2, comprimento / 2.4), Math.max(1.2, altura / 2.4));
    material.map = textura;
  }
  if (relevo) {
    relevo.repeat.copy(textura?.repeat || new THREE.Vector2(2, 2));
    material.bumpMap = relevo;
    material.bumpScale = .018;
  }
  material.needsUpdate = true;
  prepararMaterialParaInteracao(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.position.set(parede.start.x, parede.levelElevation || 0, parede.start.z);
  mesh.name = `Parede ${parede.id}`;
  mesh.userData = {
    selectable: true,
    kind: 'wall',
    id: parede.id,
    sourceName: 'Parede',
    dimensions: { length: comprimento, thickness: parede.thickness, height: altura },
    levelId: parede.levelId,
    levelName: parede.levelName,
    stage: 'walls',
    openingIds: aberturas.filter((abertura) => abertura.wallId === parede.id).map((abertura) => abertura.id),
    model: parede,
  };
  for (const vao of vãos) adicionarMolduraAbertura(mesh, vao, parede.thickness);
  return mesh;
}

export function construirParedes(modelo, parent) {
  const group = new THREE.Group();
  group.name = 'Paredes';
  for (const parede of modelo.walls) group.add(criarParede(parede, modelo.openings));
  parent.add(group);
  return group;
}
