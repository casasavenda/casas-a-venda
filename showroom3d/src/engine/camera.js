import * as THREE from 'three';

function boxVisivel(root) {
  const box = new THREE.Box3();
  root.traverse((node) => {
    if (!node.visible || !node.isMesh || node.userData?.kind === 'terrain') return;
    box.expandByObject(node);
  });
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 3, 4)) : box;
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function moverCamera(camera, controls, posicao, alvo, duracao = 460) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inicioPos = camera.position.clone();
  const inicioAlvo = controls.target.clone();
  const fimPos = posicao.clone();
  const fimAlvo = alvo.clone();
  if (reduced || duracao <= 0) {
    camera.position.copy(fimPos);
    controls.target.copy(fimAlvo);
    controls.update();
    return;
  }
  const inicio = performance.now();
  const animar = (agora) => {
    const progresso = Math.min(1, (agora - inicio) / duracao);
    const suave = progresso < .5 ? 2 * progresso * progresso : 1 - ((-2 * progresso + 2) ** 2) / 2;
    camera.position.lerpVectors(inicioPos, fimPos, suave);
    controls.target.lerpVectors(inicioAlvo, fimAlvo, suave);
    controls.update();
    if (progresso < 1) requestAnimationFrame(animar);
  };
  requestAnimationFrame(animar);
}

export function enquadrarCasa(camera, controls, root, margem = 1.22) {
  camera.up.set(0, 1, 0);
  const box = boxVisivel(root);
  const centro = box.getCenter(new THREE.Vector3());
  const tamanho = box.getSize(new THREE.Vector3());
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(camera.aspect, .1));
  const eixoLongo = Math.max(tamanho.x, tamanho.z);
  const eixoCurto = Math.max(Math.min(tamanho.x, tamanho.z), .01);
  const plantaAlongada = eixoLongo > eixoCurto * 2.2;
  const olhandoPeloEixoZ = plantaAlongada && tamanho.z >= tamanho.x;
  const olhandoPeloEixoX = plantaAlongada && tamanho.x > tamanho.z;
  const direcao = olhandoPeloEixoZ
    ? new THREE.Vector3(.24, .42, 1)
    : olhandoPeloEixoX
      ? new THREE.Vector3(1, .42, .24)
      : new THREE.Vector3(.9, .64, .9);
  direcao.normalize();

  // Calcula o encaixe pela projeção da caixa na direção escolhida. Isso evita
  // afastar demais a câmera quando a planta é muito comprida e estreita.
  const halfSize = tamanho.multiplyScalar(.5);
  const frente = direcao.clone().negate();
  const direita = frente.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const cima = direita.clone().cross(frente).normalize();
  const metadeHorizontal = Math.abs(halfSize.x * direita.x) + Math.abs(halfSize.y * direita.y) + Math.abs(halfSize.z * direita.z);
  const metadeVertical = Math.abs(halfSize.x * cima.x) + Math.abs(halfSize.y * cima.y) + Math.abs(halfSize.z * cima.z);
  const metadeProfundidade = Math.abs(halfSize.x * direcao.x) + Math.abs(halfSize.y * direcao.y) + Math.abs(halfSize.z * direcao.z);
  const distanciaHorizontal = metadeHorizontal / Math.tan(horizontalHalfFov);
  const distanciaVertical = metadeVertical / Math.tan(verticalHalfFov);
  const distancia = (Math.max(distanciaVertical, distanciaHorizontal) + metadeProfundidade) * margem;
  moverCamera(camera, controls, centro.clone().add(direcao.multiplyScalar(Math.max(distancia, 1))), centro, 380);
}

export function enquadrarTopo(camera, controls, root, margem = 1.08) {
  const box = boxVisivel(root);
  const centro = box.getCenter(new THREE.Vector3());
  const tamanho = box.getSize(new THREE.Vector3());
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(camera.aspect, .1));
  const metadeHorizontal = Math.max(tamanho.x, 1) / 2;
  const metadeVertical = Math.max(tamanho.z, 1) / 2;
  const metadeProfundidade = Math.max(tamanho.y, 1) / 2;
  const distanciaHorizontal = metadeHorizontal / Math.tan(horizontalHalfFov);
  const distanciaVertical = metadeVertical / Math.tan(verticalHalfFov);
  const distancia = (Math.max(distanciaHorizontal, distanciaVertical) + metadeProfundidade) * margem;
  camera.up.set(0, 0, -1);
  moverCamera(
    camera,
    controls,
    centro.clone().add(new THREE.Vector3(0, Math.max(distancia, 1), 0)),
    centro,
    480,
  );
}

export function enquadrarAmbiente(camera, controls, objeto, cameraDistance = 2.8) {
  const box = new THREE.Box3().setFromObject(objeto);
  const centro = box.getCenter(new THREE.Vector3());
  moverCamera(camera, controls, centro.clone().add(new THREE.Vector3(cameraDistance, cameraDistance * .62, cameraDistance)), centro, 500);
}

export function criarLimiteAmbiente(objeto, margem = .3) {
  const box = new THREE.Box3().setFromObject(objeto);
  const largura = Math.max(.8, box.max.x - box.min.x);
  const profundidade = Math.max(.8, box.max.z - box.min.z);
  const margemX = Math.min(margem, largura * .35);
  const margemZ = Math.min(margem, profundidade * .35);
  return {
    minX: box.min.x + margemX,
    maxX: box.max.x - margemX,
    minZ: box.min.z + margemZ,
    maxZ: box.max.z - margemZ,
    minY: box.min.y + .55,
    maxY: Math.max(box.min.y + 1.1, box.max.y - .45),
    centro: box.getCenter(new THREE.Vector3()),
    largura,
    profundidade,
  };
}

export function limitarCameraAoAmbiente(camera, controls, limite) {
  if (!limite) return;
  camera.position.x = limitar(camera.position.x, limite.minX, limite.maxX);
  camera.position.y = limitar(camera.position.y, limite.minY, limite.maxY);
  camera.position.z = limitar(camera.position.z, limite.minZ, limite.maxZ);
  controls.target.x = limitar(controls.target.x, limite.minX, limite.maxX);
  controls.target.y = limitar(controls.target.y, limite.minY + .45, limite.maxY);
  controls.target.z = limitar(controls.target.z, limite.minZ, limite.maxZ);
}

export function entrarNoAmbiente(camera, controls, objeto, duracao = 680, foco = null) {
  camera.up.set(0, 1, 0);
  const limite = criarLimiteAmbiente(objeto);
  const menorLado = Math.min(limite.largura, limite.profundidade);
  const deslocamento = Math.min(1.15, Math.max(.65, menorLado * .22));
  const posicao = new THREE.Vector3(
    limitar(limite.centro.x + deslocamento, limite.minX, limite.maxX),
    limitar(limite.minY + .92, limite.minY, limite.maxY),
    limitar(limite.centro.z + deslocamento, limite.minZ, limite.maxZ),
  );
  const alvo = new THREE.Vector3(limite.centro.x, limitar(limite.minY + .68, limite.minY + .45, limite.maxY), limite.centro.z);
  moverCamera(camera, controls, posicao, alvo, duracao);
  return limite;
}

export function limitarCamera(camera, controls, root) {
  const box = boxVisivel(root);
  const maior = Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1);
  controls.minDistance = Math.max(1.2, maior * .16);
  controls.maxDistance = Math.max(18, maior * 2.2);
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI / 2 - .025;
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.target.y = Math.min(1.2, maior * .16);
  camera.near = .03;
  camera.far = Math.max(100, maior * 10);
  camera.updateProjectionMatrix();
}
