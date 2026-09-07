import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { construirAmbientes } from './ambientes.js';
import { criarLimiteAmbiente, entrarNoAmbiente, enquadrarCasa, enquadrarTopo, limitarCamera, limitarCameraAoAmbiente } from './camera.js';
import { criarMaterial, prepararMaterialParaInteracao } from './materiais.js';
import { construirParedes } from './paredes.js';
import { carregarObjetos } from './objetos.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { texturaProcedural } from '../acabamentos/aplicar.js';
import { carregarModelosApresentacao } from './modelosApresentacao.js';

function corAmbiente(valor, fallback) {
  const bruto = String(valor || fallback).replace('#', '');
  return new THREE.Color(`#${bruto.slice(-6)}`);
}

function criarFundoAtmosferico(modelo) {
  if (typeof document === 'undefined') return corAmbiente(modelo.environment.skyColor, '#cce4fc');
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return corAmbiente(modelo.environment.skyColor, '#cce4fc');
  const gradiente = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradiente.addColorStop(0, '#a9d0ee');
  gradiente.addColorStop(.48, '#dce8ed');
  gradiente.addColorStop(1, '#f3e8d8');
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function criarTerreno(modelo) {
  const maior = Math.max(modelo.extents.width, modelo.extents.depth, 8);
  const geometry = new THREE.PlaneGeometry(maior * 4.4, maior * 4.4);
  geometry.rotateX(-Math.PI / 2);
  const groundColor = corAmbiente(modelo.environment.groundColor, '#38623a');
  groundColor.lerp(new THREE.Color('#66775a'), .86);
  const material = criarMaterial('terrain', { color: groundColor.getHexString(), roughness: 1, unique: true });
  material.map = texturaProcedural({ id: 'presentation-grass', color: `#${groundColor.getHexString()}`, texture: 'grass' });
  if (material.map) material.map.repeat.set(10, 10);
  const relevo = texturaProcedural({ id: 'presentation-grass-bump', color: '#808080', texture: 'grass' });
  if (relevo) {
    relevo.repeat.set(10, 10);
    material.bumpMap = relevo;
    material.bumpScale = .055;
  }
  material.needsUpdate = true;
  prepararMaterialParaInteracao(material);
  const terrain = new THREE.Mesh(geometry, material);
  terrain.position.y = -.065;
  terrain.receiveShadow = true;
  terrain.name = 'Terreno';
  terrain.userData = { kind: 'terrain', selectable: false };
  return terrain;
}

function centralizarCasa(houseRoot, extents) {
  houseRoot.position.x = -((extents.minX + extents.maxX) / 2);
  houseRoot.position.z = -((extents.minZ + extents.maxZ) / 2);
  houseRoot.position.y = 0;
}

function configurarIluminacao(scene, modelo) {
  scene.add(new THREE.HemisphereLight(corAmbiente(modelo.environment.skyColor, '#cce4fc'), corAmbiente(modelo.environment.groundColor, '#38623a'), 1.15));
  const luzCor = corAmbiente(modelo.environment.lightColor, '#d0d0d0').lerp(new THREE.Color('#ffe1bd'), .16);
  const luz = new THREE.DirectionalLight(luzCor, 2.85);
  luz.position.set(8, 13, 9);
  luz.castShadow = true;
  luz.shadow.bias = -0.00035;
  luz.shadow.normalBias = 0.035;
  luz.shadow.mapSize.set(1536, 1536);
  luz.shadow.camera.near = .1;
  luz.shadow.camera.far = 45;
  luz.shadow.camera.left = -18;
  luz.shadow.camera.right = 18;
  luz.shadow.camera.top = 18;
  luz.shadow.camera.bottom = -18;
  scene.add(luz);
}

function adicionarLuzesInternas(scene, modelo, houseRoot) {
  for (const room of modelo.rooms.filter((item) => !item.isLot && item.points.length >= 3)) {
    const centro = room.points.reduce((acc, ponto) => acc.add(new THREE.Vector3(ponto.x, 0, ponto.z)), new THREE.Vector3()).multiplyScalar(1 / room.points.length);
    const luz = new THREE.PointLight('#ffd7b0', .24, 5.2, 2);
    luz.position.set(centro.x + houseRoot.position.x, (room.levelElevation || 0) + Math.min((room.levelHeight || modelo.wallHeight) - .35, 2.35), centro.z + houseRoot.position.z);
    luz.castShadow = false;
    scene.add(luz);
  }
}

export async function montarCena(modelo, canvas, opcoes = {}) {
  const modoEmbed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');
  const margemEnquadramento = modoEmbed ? .92 : .98;
  const scene = new THREE.Scene();
  const fundo = criarFundoAtmosferico(modelo);
  scene.background = fundo;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(38, 1, .03, 100);
  camera.position.set(11, 7, 11);
  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI / 2 - .025;

  const houseRoot = new THREE.Group();
  houseRoot.name = 'Casa';
  const terrain = criarTerreno(modelo);
  scene.add(houseRoot, terrain);
  construirParedes(modelo, houseRoot);
  const ambientes = construirAmbientes(modelo, houseRoot);
  const objetos = await carregarObjetos(modelo, houseRoot);
  const modelosApresentacao = await carregarModelosApresentacao({
    baseUrl: opcoes.baseUrl || window.location.href,
    manifestoUrl: opcoes.manifestoUrl || new URL('assets/modelos.json', window.location.href).href,
    rooms: modelo.rooms.filter((room) => !room.isLot),
    parent: objetos.group,
  });
  centralizarCasa(houseRoot, modelo.extents);
  configurarIluminacao(scene, modelo);
  adicionarLuzesInternas(scene, modelo, houseRoot);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = new RoomEnvironment(renderer);
  scene.environment = pmrem.fromScene(ambiente).texture;
  scene.environmentIntensity = .46;
  ambiente.dispose();
  pmrem.dispose();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, 512, 512, 24);
  ssao.kernelRadius = 5;
  ssao.minDistance = .004;
  ssao.maxDistance = .16;
  composer.addPass(ssao);
  composer.addPass(new OutputPass());
  limitarCamera(camera, controls, houseRoot);
  enquadrarCasa(camera, controls, houseRoot, margemEnquadramento);

  let limiteAmbiente = null;
  let ajustandoLimite = false;
  const aplicarLimiteAmbiente = () => {
    if (!limiteAmbiente || ajustandoLimite) return;
    ajustandoLimite = true;
    limitarCameraAoAmbiente(camera, controls, limiteAmbiente);
    controls.update();
    ajustandoLimite = false;
  };
  controls.addEventListener('change', aplicarLimiteAmbiente);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.parentElement?.clientWidth || 640);
    const height = Math.max(1, rect.height || canvas.parentElement?.clientHeight || 480);
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (limiteAmbiente) {
      aplicarLimiteAmbiente();
    } else {
      enquadrarCasa(camera, controls, houseRoot, margemEnquadramento);
    }
  };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  resizeObserver?.observe(canvas.parentElement || canvas);
  resize();

  let animationFrame;
  const render = () => {
    controls.update();
    composer.render();
    animationFrame = requestAnimationFrame(render);
  };
  render();

  return {
    scene,
    renderer,
    camera,
    controls,
    houseRoot,
    terrain,
    walls: [...houseRoot.getObjectByName('Paredes').children],
    floors: ambientes.floors,
    ceilings: ambientes.ceilings,
    openings: objetos.openings,
    furniture: [...objetos.furniture, ...modelosApresentacao],
    rooms: modelo.rooms.filter((room) => !room.isLot),
    resize,
    enquadrarCasa: (margem = margemEnquadramento) => enquadrarCasa(camera, controls, houseRoot, margem),
    enquadrarTopo: (margem = 1.08) => enquadrarTopo(camera, controls, houseRoot, margem),
    entrarNoAmbiente: (objeto) => {
      limiteAmbiente = criarLimiteAmbiente(objeto);
      controls.minDistance = .35;
      controls.maxDistance = Math.max(2.4, Math.max(limiteAmbiente.largura, limiteAmbiente.profundidade) * .72);
      limitarCameraAoAmbiente(camera, controls, limiteAmbiente);
      entrarNoAmbiente(camera, controls, objeto);
    },
    limparLimiteAmbiente: () => {
      limiteAmbiente = null;
      limitarCamera(camera, controls, houseRoot);
    },
    dispose: () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      controls.removeEventListener('change', aplicarLimiteAmbiente);
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      scene.environment?.dispose?.();
      if (fundo?.isTexture) fundo.dispose();
    },
  };
}
