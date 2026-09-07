import * as THREE from 'three';
import { moverCamera } from '../engine/camera.js';

export function criarModos(cena, visibilidade) {
  const todasParedes = cena.walls;
  const todosForros = cena.ceilings;

  function esconderForros(esconder = true) { visibilidade.setModeHidden(todosForros, esconder); }

  return {
    aplicar(modo, roomId = null) {
      visibilidade.resetMode();
      if (modo === 'facade') {
        cena.limparLimiteAmbiente?.();
        visibilidade.setModeHidden(todosForros, false);
        visibilidade.setModeHidden(todasParedes, false);
        cena.enquadrarCasa();
        return;
      }
      if (modo === 'interior') {
        cena.camera.up.set(0, 1, 0);
        esconderForros(true);
        const sala = cena.floors.find((floor) => floor.userData.sourceName === 'SALA/COZINHA');
        if (sala) cena.entrarNoAmbiente?.(sala);
        else moverCamera(cena.camera, cena.controls, new THREE.Vector3(7, 4.5, 9), new THREE.Vector3(0, 1.1, 0), 420);
        return;
      }
      if (modo === 'top') {
        cena.limparLimiteAmbiente?.();
        esconderForros(true);
        visibilidade.setModeHidden(todasParedes, false);
        cena.enquadrarTopo?.();
        return;
      }
      if (modo === 'no-walls') {
        cena.limparLimiteAmbiente?.();
        cena.camera.up.set(0, 1, 0);
        esconderForros(true);
        visibilidade.setModeHidden(todasParedes, true);
        moverCamera(cena.camera, cena.controls, new THREE.Vector3(8.5, 8.5, 8.5), new THREE.Vector3(0, 0, 0), 420);
        return;
      }
      if (modo === 'explore' && roomId) {
        esconderForros(true);
        visibilidade.setModeHidden(todasParedes, false);
        const roomObject = cena.floors.find((floor) => floor.userData.roomId === roomId);
        if (roomObject) cena.entrarNoAmbiente?.(roomObject);
      }
    },
  };
}
