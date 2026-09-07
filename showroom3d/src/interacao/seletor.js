import * as THREE from 'three';
import { destacar } from '../engine/materiais.js';

function alvoSelecionavel(node) {
  let atual = node;
  while (atual) {
    if (atual.userData?.selectable) return atual;
    atual = atual.parent;
  }
  return null;
}

export function criarSeletor({ canvas, camera, objetos, onHover, onSelect }) {
  const raycaster = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let hover = null;
  let pressionado = null;

  function atualizarPonteiro(event) {
    const rect = canvas.getBoundingClientRect();
    ponteiro.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ponteiro.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function interseccao(event) {
    atualizarPonteiro(event);
    raycaster.setFromCamera(ponteiro, camera);
    const hits = raycaster.intersectObjects(objetos, true);
    for (const hit of hits) {
      const alvo = alvoSelecionavel(hit.object);
      if (alvo && alvo.visible) return alvo;
    }
    return null;
  }

  function setHover(alvo) {
    if (hover === alvo) return;
    if (hover) destacar(hover, false);
    hover = alvo;
    if (hover) destacar(hover, true);
    canvas.classList.toggle('is-selectable-hover', Boolean(hover));
    onHover?.(hover);
  }

  const onMove = (event) => setHover(interseccao(event));
  const onLeave = () => setHover(null);
  const onPointerDown = (event) => { pressionado = { id: event.pointerId, x: event.clientX, y: event.clientY }; };
  const onPointerUp = (event) => {
    if (!pressionado || (pressionado.id != null && event.pointerId !== pressionado.id)) return;
    const distancia = Math.hypot(event.clientX - pressionado.x, event.clientY - pressionado.y);
    pressionado = null;
    if (distancia > 6) return;
    const alvo = interseccao(event);
    if (alvo) onSelect?.(alvo);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);

  return {
    dispose() {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      setHover(null);
    },
    select(alvo) { onSelect?.(alvo); },
  };
}
