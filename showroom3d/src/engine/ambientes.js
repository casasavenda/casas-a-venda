import * as THREE from 'three';
import { texturaProcedural } from '../acabamentos/aplicar.js';
import { criarMaterial, prepararMaterialParaInteracao } from './materiais.js';

function formaDoAmbiente(room) {
  const shape = new THREE.Shape();
  if (!room.points.length) return shape;
  shape.moveTo(room.points[0].x, room.points[0].z);
  for (const point of room.points.slice(1)) shape.lineTo(point.x, point.z);
  shape.closePath();
  return shape;
}

function criarSuperficie(room, kind, y, height) {
  const geometry = new THREE.ExtrudeGeometry(formaDoAmbiente(room), { depth: .04, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  const sala = room.displayName === 'SALA/COZINHA';
  const acabamentoBase = kind === 'floor'
    ? { id: `base-${room.id}-${sala ? 'porcelain' : 'tile'}`, color: '#cfc9be', texture: 'tile' }
    : { id: `base-${room.id}-ceiling-plaster`, color: '#f3f0e8', texture: 'plaster' };
  const material = criarMaterial(kind, {
    color: acabamentoBase?.color,
    roughness: kind === 'floor' ? .68 : .88,
    unique: true,
  });
  if (acabamentoBase) {
    material.map = texturaProcedural(acabamentoBase);
    material.map.repeat.set(kind === 'floor' ? 2.4 : 2.4, kind === 'floor' ? 2.4 : 2.4);
    const relevo = texturaProcedural({ ...acabamentoBase, id: `${acabamentoBase.id}-bump`, color: '#808080' });
    if (relevo) {
      relevo.repeat.copy(material.map.repeat);
      material.bumpMap = relevo;
      material.bumpScale = kind === 'floor' ? .026 : .012;
    }
    material.needsUpdate = true;
  }
  prepararMaterialParaInteracao(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.castShadow = kind === 'ceiling';
  mesh.name = `${room.displayName} · ${kind === 'floor' ? 'Piso' : 'Forro'}`;
  mesh.userData = {
    selectable: true,
    kind,
    id: `${room.id}-${kind}`,
    sourceName: room.displayName,
    roomId: room.id,
    dimensions: { area: room.area },
    model: room,
    levelId: room.levelId,
    levelName: room.levelName,
    stage: 'finishes',
  };
  return mesh;
}

export function construirAmbientes(modelo, parent) {
  const group = new THREE.Group();
  group.name = 'Ambientes';
  const floors = [];
  const ceilings = [];
  for (const room of modelo.rooms.filter((item) => !item.isLot)) {
    if (room.floorVisible && room.points.length >= 3) {
      const floor = criarSuperficie(room, 'floor', (room.levelElevation || 0) + .02, .04);
      group.add(floor);
      floors.push(floor);
    }
    if (room.ceilingVisible && room.points.length >= 3) {
      const ceiling = criarSuperficie(room, 'ceiling', (room.levelElevation || 0) + (room.levelHeight || modelo.wallHeight), .04);
      group.add(ceiling);
      ceilings.push(ceiling);
    }
  }
  parent.add(group);
  return { group, floors, ceilings };
}
