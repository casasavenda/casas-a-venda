import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './ui/estilos.css';

document.body.classList.add('app-ready');

if (new URLSearchParams(window.location.search).has('embed')) {
  document.documentElement.dataset.embed = 'true';
}

const ehEmbed = document.documentElement.dataset.embed === 'true';
const ehTelaPequena = window.matchMedia?.('(max-width: 640px)').matches ?? false;
const usarModeloLeve = ehEmbed || ehTelaPequena;
const modeloArquivo = usarModeloLeve ? 'modelos/casa-direita-mobile.glb' : 'modelos/casa.glb';

const canvas = document.querySelector('#house-viewer');
const canvasFrame = document.querySelector('#canvas-frame');
const loadingOverlay = document.querySelector('#loading-overlay');
const loadingLabel = document.querySelector('#loading-label');
const errorOverlay = document.querySelector('#error-overlay');
const errorLabel = document.querySelector('#error-label');
const status = document.querySelector('#load-status');
const captureButton = document.querySelector('#capture-button');
const houseSelectionButton = document.querySelector('#house-selection-toggle');
const cutawayButton = document.querySelector('#cutaway-toggle');
const viewModeButton = document.querySelector('#view-mode-toggle');
const viewerHint = document.querySelector('#viewer-hint');
const viewerTitle = document.querySelector('.viewer-toolbar h1');
const internalControls = document.querySelector('#internal-controls');
const internalHouseButton = document.querySelector('#internal-house-toggle');
const internalRoomTitle = document.querySelector('#internal-room-title');
const internalRoomSelect = document.querySelector('#internal-room-select');
const internalRoomDetail = document.querySelector('#internal-room-detail');
const internalPreviousButton = document.querySelector('#internal-prev');
const internalNextButton = document.querySelector('#internal-next');
const measurements = document.querySelector('#model-measurements');
const retryButton = document.querySelector('#retry-button');

const dimensaoFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

let modeloCarregado = false;
let modoUmaCasa = false;
let modoCorteAtivo = false;
let modoInterior = false;
let olharInteriorAtivo = false;
let ultimoOlharInterior = { x: 0, y: 0 };
let yawInterior = 0;
let pitchInterior = 0;
let atualizarCameraInterior = () => {};
let atualizarTransicaoInterior = () => {};
let cancelarTransicaoInterior = () => {};
let selecionarPontoInteriorGlobal = () => {};
let alternarSelecaoCasa = () => {};
let alternarModoCorte = () => {};
let alternarModoInterior = () => {};

function atualizarStatus(texto, tipo = 'normal') {
  if (!status) return;
  status.textContent = texto;
  status.dataset.state = tipo;
}

function mostrarErro(mensagem) {
  loadingOverlay.hidden = true;
  errorOverlay.hidden = false;
  errorLabel.textContent = mensagem;
  atualizarStatus('Erro ao carregar', 'error');
}

// --- Cena Three.js ---------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// O modelo tem muitos elementos pequenos; manter a resolução nativa do
// dispositivo evita trocar nitidez por travamentos durante a navegação.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ehEmbed ? 1.25 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = ehEmbed ? 0.78 : 0.9;
renderer.localClippingEnabled = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// A luz e o modelo são estáticos; atualizar o mapa de sombras a cada frame
// causava instabilidade/piscadas durante o giro. Recalculamos somente quando
// o enquadramento ou a seleção de blocos realmente muda.
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const corFundo = '#2a231e';
scene.background = new THREE.Color(corFundo);
// O nevoeiro fazia as paredes perderem contraste e parecerem borradas quando
// o visitante afastava a câmera. O fundo sólido já fornece a ambientação sem
// sacrificar a nitidez do modelo e do terreno em qualquer distância.
scene.fog = null;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
camera.position.set(20, 14, 20);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = THREE.MathUtils.degToRad(12);
controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
controls.enabled = false; // habilitado quando o modelo carregar

// Iluminação de estúdio: ambiente (reflexos suaves em vidro/metal) + sol direcional com sombra.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const luzAmbiente = new THREE.HemisphereLight(0xf3ede1, 0x5d554b, ehEmbed ? 0.42 : 0.55);
scene.add(luzAmbiente);

const sol = new THREE.DirectionalLight(0xffe5c2, ehEmbed ? 1.35 : 1.8);
sol.castShadow = true;
sol.shadow.mapSize.set(ehEmbed ? 1024 : 2048, ehEmbed ? 1024 : 2048);
sol.shadow.bias = -0.0008;
sol.shadow.normalBias = 0.028;
sol.shadow.radius = 2;
scene.add(sol);
scene.add(sol.target);

const luzPreenchimento = new THREE.DirectionalLight(0xc7d9e8, ehEmbed ? 0.18 : 0.32);
scene.add(luzPreenchimento);
scene.add(luzPreenchimento.target);

// Uma luz curta e suave acompanha a câmera somente na vista interna. Ela é
// iluminação de apresentação, não um objeto inventado dentro da casa, e evita
// que a primeira pessoa fique escura quando o teto é ocultado para permitir a
// leitura dos ambientes.
const luzInterior = new THREE.PointLight(0xffe6c7, 0.55, 9, 2);
luzInterior.visible = false;
scene.add(luzInterior);

// Plano de apresentação neutro (recebe sombra); não é geometria arquitetônica nova.
const chaoMaterial = new THREE.ShadowMaterial({ opacity: 0.28 });
const chao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), chaoMaterial);
chao.rotation.x = -Math.PI / 2;
chao.receiveShadow = true;
scene.add(chao);

// Terreno de apresentação: não altera nem inventa elementos da casa; apenas cria
// uma base limpa para o modelo ficar apoiado e ganhar contraste visual.
const terreno = new THREE.Group();
terreno.name = 'terreno-de-apresentacao';
scene.add(terreno);

// Escala de apresentação: aumenta a maquete inteira (casa, terreno e piso de
// sombra) sem alterar as medidas reais exibidas nem o arquivo GLB. O fator é
// aplicado somente depois que as caixas do modelo são calculadas em metros.
const escalaApresentacao = 8;
const escalaVistaInterior = 2;
const palcoApresentacao = new THREE.Group();
palcoApresentacao.name = 'palco-de-apresentacao-8x';
scene.add(palcoApresentacao);
palcoApresentacao.add(chao, terreno);

// Mantém a mesma dimensão externa do terreno usado antes do filtro das casas:
// aproximadamente 43,37 m x 35,68 m. Assim, remover as casas da esquerda não
// faz o lote encolher junto com o modelo.
const dimensoesTerrenoReferencia = {
  largura: 43.37,
  profundidade: 35.68,
};

function redimensionar() {
  const largura = canvasFrame.clientWidth;
  const altura = canvasFrame.clientHeight;
  if (!largura || !altura) return;
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  renderer.setSize(largura, altura, false);
}

new ResizeObserver(redimensionar).observe(canvasFrame);
redimensionar();

function animar() {
  requestAnimationFrame(animar);
  atualizarTransicaoInterior();
  // OrbitControls continua recalculando a câmera mesmo quando `enabled` está
  // falso. Na primeira pessoa ele precisa ficar totalmente fora do ciclo para
  // não sobrescrever a posição do ambiente atual.
  if (!modoInterior) controls.update();
  renderer.render(scene, camera);
}
animar();

// --- Metadados (dimensões/enquadramento sugeridos) --------------------------

const metaPromise = fetch(`${import.meta.env.BASE_URL}modelos/casa-meta.json`, { cache: 'no-store' })
  .then((resposta) => {
    if (!resposta.ok) throw new Error(`Metadados indisponíveis (${resposta.status}).`);
    return resposta.json();
  })
  .catch((erro) => {
    console.warn('[showroom3d] Não foi possível carregar casa-meta.json.', erro);
    return null;
  });

function formatarDimensoes(caixa) {
  if (!measurements) return;
  const tamanho = new THREE.Vector3();
  caixa.getSize(tamanho);
  const valores = [tamanho.x, tamanho.z, tamanho.y].map((valor) => `${dimensaoFmt.format(valor)} m`);
  measurements.querySelectorAll('dd').forEach((elemento, indice) => {
    elemento.textContent = valores[indice];
  });
}

function alinharModeloNoCentro(modelo) {
  const caixaOriginal = new THREE.Box3().setFromObject(modelo);
  const centroOriginal = new THREE.Vector3();
  caixaOriginal.getCenter(centroOriginal);

  // O arquivo novo preserva as medidas em metros, mas vem deslocado no plano
  // horizontal. Reposicionar o nó raiz deixa o modelo centrado sem reescrever
  // vértices, materiais ou texturas do GLB.
  modelo.position.x -= centroOriginal.x;
  modelo.position.y -= caixaOriginal.min.y;
  modelo.position.z -= centroOriginal.z;
}

function obterRaizArquitetonica(modelo) {
  return modelo.children.length === 1 && !modelo.children[0].isMesh ? modelo.children[0] : modelo;
}

function manterCasasDaDireita(modelo) {
  // No GLB recebido, os quatro blocos principais aparecem como filhos raiz em
  // quatro pares: esquerda (3 e 4) e direita (5 e 6, na ordem arquitetônica
  // exportada). Os demais filhos raiz são câmeras/objetos auxiliares ou uma
  // faixa global que atravessa os quatro blocos. Mantemos o par da direita e
  // não removemos nada da geometria interna de cada casa.
  // O GLTFLoader envolve a cena exportada em um Group adicional; por isso o
  // índice é aplicado aos filhos do nó raiz exportado, e não ao wrapper da cena.
  const raiz = obterRaizArquitetonica(modelo);
  const indicesParaManter = new Set([5, 6, 11, 12, 13, 14]);
  // A versão mobile já contém somente esse conjunto. Não aplicar novamente
  // os índices do GLB completo sobre a lista compactada de seis filhos.
  if (raiz.children.length <= indicesParaManter.size) return;
  const remover = raiz.children.filter((filho, indice) => !indicesParaManter.has(indice));
  remover.forEach((filho) => raiz.remove(filho));
}

function descobrirCasas(modelo) {
  const raiz = obterRaizArquitetonica(modelo);
  const blocos = raiz.children
    .map((objeto) => {
      const caixa = new THREE.Box3().setFromObject(objeto);
      return { objeto, caixa, centro: caixa.getCenter(new THREE.Vector3()) };
    })
    .filter(({ caixa }) => !caixa.isEmpty());

  if (blocos.length < 2) return [blocos];

  // O export do SketchUp mantém cada casa como três blocos no eixo X. Usar a
  // maior lacuna entre os centros evita depender de IDs/números do GLB e
  // continua funcionando se a ordem dos nós mudar em uma nova exportação.
  const ordenados = [...blocos].sort((a, b) => a.centro.x - b.centro.x);
  let indiceDaMaiorLacuna = 0;
  let maiorLacuna = -Infinity;
  for (let indice = 1; indice < ordenados.length; indice += 1) {
    const lacuna = ordenados[indice].centro.x - ordenados[indice - 1].centro.x;
    if (lacuna > maiorLacuna) {
      maiorLacuna = lacuna;
      indiceDaMaiorLacuna = indice;
    }
  }

  if (indiceDaMaiorLacuna === 0 || indiceDaMaiorLacuna === ordenados.length) return [blocos];
  return [ordenados.slice(0, indiceDaMaiorLacuna), ordenados.slice(indiceDaMaiorLacuna)];
}

function compactarGeometriaParaRender(modelo) {
  modelo.updateMatrixWorld(true);
  const raiz = obterRaizArquitetonica(modelo);
  const grupos = new Map();

  modelo.traverse((filho) => {
    if (!filho.isMesh || Array.isArray(filho.material) || !filho.geometry?.attributes?.position) return;

    let destino = filho;
    while (destino.parent && destino.parent !== raiz && destino.parent !== modelo) {
      destino = destino.parent;
    }
    if (destino.parent !== raiz && destino.parent !== modelo) destino = modelo;

    const material = filho.material;
    const atributos = Object.keys(filho.geometry.attributes).sort().join(',');
    const indexado = filho.geometry.index ? 'indexed' : 'non-indexed';
    const chave = `${destino.uuid}|${material.uuid}|${atributos}|${indexado}`;
    const inversaDestino = destino.matrixWorld.clone().invert();
    const matrizLocal = inversaDestino.multiply(filho.matrixWorld);
    const geometria = filho.geometry.clone().applyMatrix4(matrizLocal);
    geometria.clearGroups();

    if (!grupos.has(chave)) grupos.set(chave, { material, destino, entradas: [] });
    grupos.get(chave).entradas.push({ geometria, origem: filho });
  });

  const compactados = [];
  const originaisCompactados = [];
  for (const grupo of grupos.values()) {
    if (grupo.entradas.length < 2) continue;
    let geometria;
    try {
      geometria = mergeGeometries(
        grupo.entradas.map((entrada) => entrada.geometria),
        false,
      );
    } catch (erro) {
      console.warn('[showroom3d] Não foi possível compactar um grupo de geometrias.', erro);
      geometria = null;
    }
    if (!geometria) continue;

    const malha = new THREE.Mesh(geometria, grupo.material);
    malha.name = `geometria-compactada-${compactados.length + 1}`;
    malha.castShadow = !grupo.material.transparent;
    malha.receiveShadow = true;
    grupo.destino.add(malha);
    compactados.push(malha);
    originaisCompactados.push(...grupo.entradas.map((entrada) => entrada.origem));
  }

  originaisCompactados.forEach((malha) => malha.parent?.remove(malha));
  return compactados.length;
}

function criarTerreno(caixa) {
  terreno.clear();

  const tamanho = new THREE.Vector3();
  const centro = new THREE.Vector3();
  caixa.getSize(tamanho);
  caixa.getCenter(centro);

  const margemGrama = 2;
  const borda = 0.28;
  const espessuraGrama = 0.06;
  const espessuraBase = 0.16;
  const topoGrama = caixa.min.y - 0.02;
  const baseTop = topoGrama - espessuraGrama;
  const larguraGrama = Math.max(
    tamanho.x + margemGrama * 2,
    dimensoesTerrenoReferencia.largura - borda * 2,
  );
  const profundidadeGrama = Math.max(
    tamanho.z + margemGrama * 2,
    dimensoesTerrenoReferencia.profundidade - borda * 2,
  );
  const larguraBase = larguraGrama + borda * 2;
  const profundidadeBase = profundidadeGrama + borda * 2;

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(larguraBase, espessuraBase, profundidadeBase),
    new THREE.MeshStandardMaterial({
      color: 0x5f5d57,
      roughness: 0.86,
      metalness: 0.02,
    }),
  );
  base.name = 'base-cinza-do-terreno';
  base.position.set(centro.x, baseTop - espessuraBase / 2, centro.z);
  base.castShadow = true;
  base.receiveShadow = true;
  terreno.add(base);

  const grama = new THREE.Mesh(
    new THREE.BoxGeometry(larguraGrama, espessuraGrama, profundidadeGrama),
    new THREE.MeshStandardMaterial({
      color: 0x476841,
      roughness: 1,
      metalness: 0,
    }),
  );
  grama.name = 'grama-do-terreno';
  grama.position.set(centro.x, topoGrama - espessuraGrama / 2, centro.z);
  grama.receiveShadow = true;
  terreno.add(grama);

  return new THREE.Box3(
    new THREE.Vector3(
      centro.x - larguraBase / 2,
      baseTop - espessuraBase,
      centro.z - profundidadeBase / 2,
    ),
    new THREE.Vector3(centro.x + larguraBase / 2, topoGrama, centro.z + profundidadeBase / 2),
  );
}

function posicionarCameraECena(caixa, direcaoConfigurada = null) {
  const tamanho = new THREE.Vector3();
  const centroLocal = new THREE.Vector3();
  caixa.getSize(tamanho);
  caixa.getCenter(centroLocal);

  // A caixa recebida continua em metros originais. A câmera, as luzes e os
  // controles trabalham no espaço já ampliado do palco.
  palcoApresentacao.updateMatrixWorld(true);
  const centro = centroLocal.clone().applyMatrix4(palcoApresentacao.matrixWorld);
  const escalaPalco = palcoApresentacao.scale.x || 1;
  const maiorLadoMundo = Math.max(tamanho.x, tamanho.z) * escalaPalco;
  const alturaMundo = tamanho.y * escalaPalco;

  const maiorLado = Math.max(tamanho.x, tamanho.z);

  // Enquadramento exato pelos 8 cantos da caixa delimitadora, não por uma esfera:
  // Esta casa é alongada e baixa (aprox. 39 x 31 x 5,2 m) — usar a esfera delimitadora
  // (raio = metade da diagonal 3D inteira) sobra distância demais e deixa a casa
  // minúscula no quadro. Calculamos a menor distância, ao longo de uma direção de
  // câmera fixa, que ainda mantém todos os 8 cantos dentro do campo de visão.
  const direcao = (direcaoConfigurada || new THREE.Vector3(0.68, 0.36, 0.62)).normalize();
  const frente = direcao.clone().negate();
  const cima = new THREE.Vector3(0, 1, 0).sub(frente.clone().multiplyScalar(frente.y)).normalize();
  const direita = new THREE.Vector3().crossVectors(frente, cima).normalize();

  const meioFovVertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const margem = 0.95; // usa mais do FOV, mantendo a borda do terreno no enquadramento
  const tanV = Math.tan(meioFovVertical) * margem;
  const tanH = tanV * camera.aspect;

  let distanciaMinima = 0;
  for (const x of [caixa.min.x, caixa.max.x]) {
    for (const y of [caixa.min.y, caixa.max.y]) {
      for (const z of [caixa.min.z, caixa.max.z]) {
        const relativo = new THREE.Vector3(x, y, z).sub(centro);
        const compCima = relativo.dot(cima);
        const compDireita = relativo.dot(direita);
        const compFrente = relativo.dot(frente);
        const exigidaV = Math.abs(compCima) / tanV - compFrente;
        const exigidaH = Math.abs(compDireita) / tanH - compFrente;
        distanciaMinima = Math.max(distanciaMinima, exigidaV, exigidaH);
      }
    }
  }
  // A maquete é 8x maior que as coordenadas métricas, mas não queremos que a
  // câmera fique colada na fachada. A compensação preserva a escala do palco e
  // devolve uma folga de enquadramento semelhante à apresentação anterior.
  const fatorDistanciaCamera = Math.max(1, escalaPalco / 2);
  const distancia = Math.max(distanciaMinima * fatorDistanciaCamera, maiorLado * 0.1);

  camera.near = Math.max(distancia / 200, 0.05);
  camera.far = Math.max(distancia * 8, maiorLadoMundo * 8, alturaMundo * 16);
  camera.updateProjectionMatrix();

  camera.position.copy(centro).addScaledVector(direcao, distancia);
  controls.target.copy(centro);
  controls.minDistance = distancia * 0.2;
  controls.maxDistance = distancia * 3;
  controls.update();

  sol.position.set(centro.x + maiorLadoMundo * 0.9, centro.y + maiorLadoMundo * 1.1, centro.z + maiorLadoMundo * 0.4);
  sol.target.position.copy(centro);
  luzPreenchimento.position.set(centro.x - maiorLadoMundo * 0.7, centro.y + maiorLadoMundo * 0.8, centro.z - maiorLadoMundo * 0.5);
  luzPreenchimento.target.position.copy(centro);
  sol.shadow.camera.left = -maiorLadoMundo * 0.75;
  sol.shadow.camera.right = maiorLadoMundo * 0.75;
  sol.shadow.camera.top = maiorLadoMundo * 0.75;
  sol.shadow.camera.bottom = -maiorLadoMundo * 0.75;
  sol.shadow.camera.near = 0.5;
  sol.shadow.camera.far = maiorLadoMundo * 4 + alturaMundo * 4;
  sol.shadow.camera.updateProjectionMatrix();

  chao.scale.set(maiorLado * 4, maiorLado * 4, 1);
  chao.position.set(centroLocal.x, caixa.min.y - 0.02, centroLocal.z);
  renderer.shadowMap.needsUpdate = true;
}

// --- Carregamento do modelo --------------------------------------------------

const loader = new GLTFLoader();

loader.load(
  `${import.meta.env.BASE_URL}${modeloArquivo}`,
  async (gltf) => {
    const modelo = gltf.scene;
    const materiaisAjustados = new Set();
    const materiaisModelo = new Set();
    modelo.traverse((filho) => {
      if (filho.isMesh) {
        filho.castShadow = true;
        filho.receiveShadow = true;
        const materiais = Array.isArray(filho.material) ? filho.material : [filho.material];
        materiais.filter(Boolean).forEach((material) => {
          materiaisModelo.add(material);
          // O .skp de origem tem faces com normal invertida em vários volumes
          // arquitetônicos (documentado já no pipeline anterior). Sem DoubleSide,
          // back-face culling faz a maior parte da casa desaparecer.
          material.side = THREE.DoubleSide;
          material.envMapIntensity = ehEmbed ? 0.45 : 0.65;
          // No embed, reduzir discretamente materiais neutros muito claros dá
          // separação entre paredes, piso e fundo escuro, sem repintar madeira,
          // vidro ou materiais que usam textura.
          if (ehEmbed && !material.map && material.color && !materiaisAjustados.has(material.uuid)) {
            materiaisAjustados.add(material.uuid);
            const hsl = {};
            material.color.getHSL(hsl);
            if (hsl.s < 0.12 && hsl.l > 0.72) {
              material.color.lerp(new THREE.Color('#d4c5b5'), 0.2).multiplyScalar(0.9);
            }
          }
          if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
          if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        });
      }
    });
    palcoApresentacao.add(modelo);
    manterCasasDaDireita(modelo);
    alinharModeloNoCentro(modelo);
    modelo.updateMatrixWorld(true);
    const casasApresentacao = descobrirCasas(modelo);
    const gruposCompactados = compactarGeometriaParaRender(modelo);

    const caixaModelo = new THREE.Box3().setFromObject(modelo);
    const caixasDasCasas = casasApresentacao.map((casa) =>
      casa.reduce((caixa, bloco) => caixa.union(bloco.caixa), new THREE.Box3()),
    );
    const caixaCasasApresentacao = caixasDasCasas.reduce(
      (caixa, caixaCasa) => caixa.union(caixaCasa),
      new THREE.Box3(),
    );
    const caixaTerreno = criarTerreno(caixaModelo);
    // O GLB e o terreno são ampliados juntos, como uma maquete 8x maior. A
    // caixa acima e a ficha de medidas continuam no sistema original em metros.
    palcoApresentacao.scale.setScalar(escalaApresentacao);
    palcoApresentacao.updateMatrixWorld(true);
    // O terreno continua com suas dimensões reais, mas não deve ser usado para
    // definir o zoom: enquadrar o lote inteiro deixava as casas pequenas demais.
    const caixaEnquadramentoNormal = caixaCasasApresentacao.clone().expandByVector(new THREE.Vector3(1.1, 0.4, 1.1));
    posicionarCameraECena(caixaEnquadramentoNormal);
    formatarDimensoes(caixaModelo);

    const alturaModelo = caixaModelo.max.y - caixaModelo.min.y;
    const alturaCorte = THREE.MathUtils.clamp(
      caixaModelo.min.y + Math.min(2.55, alturaModelo * 0.5),
      caixaModelo.min.y + 1.8,
      caixaModelo.max.y - 0.15,
    );
    const indiceCasaDaDireita = casasApresentacao.reduce((indiceMaisADireita, casa, indice) => {
      if (indiceMaisADireita === -1) return indice;
      const centroAtual = casa.reduce((soma, bloco) => soma + bloco.centro.x, 0) / casa.length;
      const casaAnterior = casasApresentacao[indiceMaisADireita];
      const centroAnterior = casaAnterior.reduce((soma, bloco) => soma + bloco.centro.x, 0) / casaAnterior.length;
      return centroAtual > centroAnterior ? indice : indiceMaisADireita;
    }, -1);
    const caixaCasaDaDireita = caixasDasCasas[indiceCasaDaDireita] || caixaModelo;
    const caixaEnquadramentoUmaCasa = caixaCasaDaDireita.clone().expandByVector(new THREE.Vector3(1.1, 0.4, 1.1));
    const direcaoVistaSuperior = new THREE.Vector3(0.52, 1.15, 0.48);

    const alturaOlhosInterior = 1.65;
    const alturaGlobalInterior = 2.65;
    const ambientesInterior = [
      // O eixo Z do GLB aponta do acesso/garagem para o quiosque. As posições
      // seguem a ordem espacial observada na planta, e não uma nova planta
      // desenhada pelo showroom.
      { id: 'garagem', nome: 'Garagem', fracaoProfundidade: 0.93, deslocamentoLateral: 0, sentido: -1, detalhe: 'Ponto inicial junto ao acesso da casa.' },
      { id: 'varanda', nome: 'Varanda', fracaoProfundidade: 0.79, deslocamentoLateral: 0, sentido: -1, detalhe: 'Transição entre o acesso e a área social.' },
      { id: 'jantar-estar', nome: 'Jantar e estar', fracaoProfundidade: 0.66, deslocamentoLateral: 0, sentido: -1, detalhe: 'Área social principal.' },
      { id: 'dormitorio-1', nome: 'Dormitório 1', fracaoProfundidade: 0.54, deslocamentoLateral: -0.14, sentido: -1, detalhe: 'Primeiro ponto de dormitório.' },
      { id: 'banheiro', nome: 'Banheiro', fracaoProfundidade: 0.46, deslocamentoLateral: 0.14, sentido: -1, detalhe: 'Ambiente molhado da casa.' },
      { id: 'cozinha', nome: 'Cozinha', fracaoProfundidade: 0.35, deslocamentoLateral: 0, sentido: -1, detalhe: 'Cozinha junto ao núcleo de serviço.' },
      { id: 'servico', nome: 'Serviço', fracaoProfundidade: 0.27, deslocamentoLateral: 0.14, sentido: -1, detalhe: 'Área de serviço e apoio.' },
      { id: 'dormitorio-2', nome: 'Dormitório 2', fracaoProfundidade: 0.18, deslocamentoLateral: -0.14, sentido: -1, detalhe: 'Segundo ponto de dormitório.' },
      { id: 'quiosque', nome: 'Quiosque', fracaoProfundidade: 0.08, deslocamentoLateral: 0, sentido: 1, detalhe: 'Área de lazer no fundo do lote.' },
    ];

    let pontosInteriores = [];
    let pontosInterioresVisiveis = [];
    let indicePontoInterior = 0;
    let transicaoInterior = null;
    const raycasterInterior = new THREE.Raycaster();
    raycasterInterior.far = 14;

    function interpolarAngulo(origem, destino, fator) {
      const diferenca = THREE.MathUtils.euclideanModulo(destino - origem + Math.PI, Math.PI * 2) - Math.PI;
      return origem + diferenca * fator;
    }

    function limitarPontoInterior(caixa, x, z) {
      const tamanho = caixa.getSize(new THREE.Vector3());
      const margemX = Math.min(0.65, Math.max(0.25, tamanho.x * 0.18));
      const margemZ = Math.min(0.8, Math.max(0.3, tamanho.z * 0.035));
      return new THREE.Vector3(
        THREE.MathUtils.clamp(x, caixa.min.x + margemX, caixa.max.x - margemX),
        caixa.min.y + Math.min(alturaOlhosInterior, Math.max(1.2, tamanho.y - 0.35)),
        THREE.MathUtils.clamp(z, caixa.min.z + margemZ, caixa.max.z - margemZ),
      );
    }

    function medirEspacoLivreInterior(posicao, direcao) {
      raycasterInterior.set(posicao, direcao);
      const intersecoes = raycasterInterior.intersectObjects(modelo.children, true);
      return intersecoes[0]?.distance ?? raycasterInterior.far;
    }

    function encontrarPontoInteriorSeguro(caixa, x, z) {
      const candidatoBase = limitarPontoInterior(caixa, x, z);
      const deslocamentos = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].flatMap((dx) =>
        [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8].map((dz) => [dx, dz]),
      );
      const direcoes = [
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
      ];
      let melhor = candidatoBase;
      let melhorPontuacao = -Infinity;

      deslocamentos.forEach(([dx, dz]) => {
        const candidato = limitarPontoInterior(caixa, candidatoBase.x + dx, candidatoBase.z + dz);
        const distancias = direcoes.map((direcao) => medirEspacoLivreInterior(candidato, direcao));
        // Um ponto que caiu dentro de um volume sólido tem uma interseção
        // praticamente na origem. Rejeitar esse ponto elimina a tela branca
        // causada pela câmera nascer dentro de uma parede.
        if (Math.min(...distancias) < 0.22) return;
        const pontuacao = Math.min(...distancias) * 1.2 + Math.max(...distancias) * 0.08 - Math.hypot(dx, dz) * 0.22;
        if (pontuacao > melhorPontuacao) {
          melhor = candidato;
          melhorPontuacao = pontuacao;
        }
      });
      return melhor;
    }

    function criarAlvoInterior(posicao, sentidoPreferido) {
      const direcoes = [
        new THREE.Vector3(0, 0, sentidoPreferido),
        new THREE.Vector3(0, 0, -sentidoPreferido),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
      ];
      const melhorDirecao = direcoes.reduce((melhor, direcao) => {
        const distanciaAtual = medirEspacoLivreInterior(posicao, direcao);
        return distanciaAtual > melhor.distancia ? { direcao, distancia: distanciaAtual } : melhor;
      }, { direcao: direcoes[0], distancia: -Infinity });
      const distancia = Math.min(Math.max(2.4, melhorDirecao.distancia * 0.7), 4.5);
      return posicao.clone().addScaledVector(melhorDirecao.direcao, distancia).add(new THREE.Vector3(0, 0.05, 0));
    }

    function criarPontosInteriores() {
      return caixasDasCasas.flatMap((caixa, indiceCasa) => {
        const tamanho = caixa.getSize(new THREE.Vector3());
        const centro = caixa.getCenter(new THREE.Vector3());
        const nomeCasa = indiceCasa === indiceCasaDaDireita ? 'Casa da direita' : 'Casa da esquerda';

        return ambientesInterior.map((ambiente, indiceAmbiente) => {
          const x = centro.x + tamanho.x * ambiente.deslocamentoLateral;
          const z = caixa.min.z + tamanho.z * ambiente.fracaoProfundidade;
          const posicao = encontrarPontoInteriorSeguro(caixa, x, z);
          const alvo = criarAlvoInterior(posicao, ambiente.sentido);

          return {
            ...ambiente,
            id: `${indiceCasa}-${ambiente.id}`,
            indiceCasa,
            indiceAmbiente,
            posicao,
            alvo,
            rotulo: `${nomeCasa} · ${ambiente.nome}`,
          };
        });
      });
    }

    function atualizarRotacaoInterior() {
      camera.rotation.order = 'YXZ';
      camera.rotation.set(
        THREE.MathUtils.clamp(pitchInterior, -1.15, 1.15),
        yawInterior,
        0,
      );
    }

    atualizarCameraInterior = ({ posicao, yaw, pitch }) => {
      camera.position.copy(posicao);
      yawInterior = yaw;
      pitchInterior = THREE.MathUtils.clamp(pitch, -1.15, 1.15);
      atualizarRotacaoInterior();
      luzInterior.position.copy(posicao).add(new THREE.Vector3(0, 0.75, 0));
    };

    atualizarTransicaoInterior = () => {
      if (!transicaoInterior) return;
      const tempo = (performance.now() - transicaoInterior.inicio) / transicaoInterior.duracao;
      const fator = THREE.MathUtils.smoothstep(Math.min(tempo, 1), 0, 1);
      const posicao = new THREE.Vector3().lerpVectors(transicaoInterior.origem, transicaoInterior.destino, fator);
      atualizarCameraInterior({
        posicao,
        yaw: interpolarAngulo(transicaoInterior.yawOrigem, transicaoInterior.yawDestino, fator),
        pitch: THREE.MathUtils.lerp(transicaoInterior.pitchOrigem, transicaoInterior.pitchDestino, fator),
      });
      if (tempo >= 1) transicaoInterior = null;
    };

    cancelarTransicaoInterior = () => {
      transicaoInterior = null;
    };

    function irParaPontoInterior(ponto, comTransicao = true) {
      if (!ponto) return;

      const posicaoDestino = ponto.posicao.clone().applyMatrix4(palcoApresentacao.matrixWorld);
      const alvoDestino = ponto.alvo.clone().applyMatrix4(palcoApresentacao.matrixWorld);
      const origem = camera.position.clone();
      const yawOrigem = yawInterior;
      const pitchOrigem = pitchInterior;

      camera.position.copy(posicaoDestino);
      camera.rotation.order = 'YXZ';
      camera.lookAt(alvoDestino);
      const yawDestino = camera.rotation.y;
      const pitchDestino = camera.rotation.x;
      camera.position.copy(origem);
      camera.rotation.set(pitchOrigem, yawOrigem, 0);

      if (!comTransicao) {
        transicaoInterior = null;
        atualizarCameraInterior({ posicao: ponto.posicao, yaw: yawDestino, pitch: pitchDestino });
      } else {
        transicaoInterior = {
          inicio: performance.now(),
          duracao: 520,
          origem,
          destino: posicaoDestino,
          yawOrigem,
          yawDestino,
          pitchOrigem,
          pitchDestino,
        };
      }

      luzInterior.position.copy(posicaoDestino).add(new THREE.Vector3(0, 0.75 * escalaVistaInterior, 0));
      sol.position.set(posicaoDestino.x + 8 * escalaVistaInterior, posicaoDestino.y + 10 * escalaVistaInterior, posicaoDestino.z + 6 * escalaVistaInterior);
      sol.target.position.copy(posicaoDestino);
      luzPreenchimento.position.set(posicaoDestino.x - 6 * escalaVistaInterior, posicaoDestino.y + 6 * escalaVistaInterior, posicaoDestino.z - 5 * escalaVistaInterior);
      luzPreenchimento.target.position.copy(posicaoDestino);
      renderer.shadowMap.needsUpdate = true;
    }

    function atualizarVisibilidadeInterior() {
      const casasVisiveis = modoUmaCasa
        ? [casasApresentacao[indiceCasaDaDireita] || casasApresentacao[0] || []]
        : casasApresentacao;
      const blocosDaSelecao = new Set(casasVisiveis.flat());
      casasApresentacao.flat().forEach((bloco) => {
        bloco.objeto.visible = blocosDaSelecao.has(bloco)
          && bloco.centro.y <= caixaModelo.min.y + alturaGlobalInterior;
      });
    }

    function atualizarPainelInterior() {
      if (!internalControls || !internalRoomSelect) return;
      internalControls.hidden = !modoInterior;
      canvasFrame.classList.toggle('is-interior', modoInterior);
      viewModeButton?.classList.toggle('is-active', modoInterior);
      viewModeButton?.setAttribute('aria-pressed', String(modoInterior));
      const textoCasas = modoUmaCasa ? '1 casa' : '2 casas';
      houseSelectionButton.textContent = textoCasas;
      houseSelectionButton.setAttribute('aria-pressed', String(modoUmaCasa));
      if (internalHouseButton) {
        internalHouseButton.textContent = textoCasas;
        internalHouseButton.setAttribute('aria-pressed', String(modoUmaCasa));
        internalHouseButton.title = modoUmaCasa ? 'Mostrar as duas casas' : 'Mostrar somente uma casa';
      }
      if (!modoInterior) {
        if (viewerHint) viewerHint.textContent = 'Arraste para girar · roda ou pinça para aproximar';
        return;
      }

      pontosInterioresVisiveis = pontosInteriores.filter(
        (ponto) => !modoUmaCasa || ponto.indiceCasa === indiceCasaDaDireita,
      );
      internalRoomSelect.replaceChildren();
      pontosInterioresVisiveis.forEach((ponto, indice) => {
        const option = document.createElement('option');
        option.value = String(indice);
        option.textContent = ponto.rotulo;
        internalRoomSelect.append(option);
      });
      indicePontoInterior = Math.min(indicePontoInterior, Math.max(0, pontosInterioresVisiveis.length - 1));
      internalRoomSelect.value = String(indicePontoInterior);
      const pontoAtual = pontosInterioresVisiveis[indicePontoInterior];
      if (internalRoomTitle) internalRoomTitle.textContent = pontoAtual?.rotulo || 'Selecione um ambiente';
      if (internalRoomDetail) internalRoomDetail.textContent = pontoAtual
        ? `${pontoAtual.detalhe} · câmera a ${dimensaoFmt.format(alturaOlhosInterior)} m do piso`
        : 'Câmera na altura dos olhos · escala real';
      internalRoomSelect.disabled = pontosInterioresVisiveis.length === 0;
      if (internalPreviousButton) internalPreviousButton.disabled = pontosInterioresVisiveis.length < 2;
      if (internalNextButton) internalNextButton.disabled = pontosInterioresVisiveis.length < 2;
      if (viewerHint) viewerHint.textContent = 'Arraste para olhar · use o seletor para trocar de cômodo';
    }

    function selecionarPontoInterior(indice, comTransicao = true) {
      if (!pontosInterioresVisiveis.length) return;
      indicePontoInterior = (indice + pontosInterioresVisiveis.length) % pontosInterioresVisiveis.length;
      const ponto = pontosInterioresVisiveis[indicePontoInterior];
      if (internalRoomSelect) internalRoomSelect.value = String(indicePontoInterior);
      if (internalRoomTitle) internalRoomTitle.textContent = ponto.rotulo;
      if (internalRoomDetail) internalRoomDetail.textContent = `${ponto.detalhe} · câmera a ${dimensaoFmt.format(alturaOlhosInterior)} m do piso`;
      irParaPontoInterior(ponto, comTransicao);
    }

    selecionarPontoInteriorGlobal = selecionarPontoInterior;

    function entrarNaVistaInterior() {
      modoInterior = true;
      modoCorteAtivo = false;
      // A busca dos pontos usa as coordenadas métricas originais. Gerar os
      // pontos com o palco em 1x evita que a escala de apresentação contamine
      // a leitura da planta; depois o palco e a câmera são transformados juntos.
      palcoApresentacao.scale.setScalar(1);
      palcoApresentacao.updateMatrixWorld(true);
      terreno.visible = true;
      chao.visible = false;
      luzInterior.visible = true;
      luzInterior.distance = 18;
      renderer.toneMappingExposure = ehEmbed ? 0.72 : 0.84;
      camera.fov = 68;
      camera.near = 0.05;
      camera.far = 180;
      camera.updateProjectionMatrix();
      controls.enabled = false;
      indicePontoInterior = 0;
      atualizarVisibilidadeInterior();
      pontosInteriores = criarPontosInteriores();
      palcoApresentacao.scale.setScalar(escalaVistaInterior);
      palcoApresentacao.updateMatrixWorld(true);
      atualizarPainelInterior();
      selecionarPontoInterior(0, false);
      viewModeButton.textContent = 'Vista externa';
      viewModeButton.title = 'Voltar à vista externa';
      viewModeButton.setAttribute('aria-label', 'Voltar à vista externa');
      cutawayButton.disabled = true;
      if (viewerTitle) viewerTitle.textContent = 'Explore a casa por dentro';
      canvas.setAttribute('aria-label', `Vista interna guiada de ${modoUmaCasa ? 'uma casa' : 'duas casas'}, em primeira pessoa`);
      atualizarStatus(`Vista interna · ${modoUmaCasa ? 'uma casa' : 'duas casas'}`, 'ready');
    }

    function sairDaVistaInterior() {
      modoInterior = false;
      transicaoInterior = null;
      terreno.visible = true;
      chao.visible = true;
      luzInterior.visible = false;
      luzInterior.distance = 9;
      palcoApresentacao.scale.setScalar(escalaApresentacao);
      palcoApresentacao.updateMatrixWorld(true);
      renderer.toneMappingExposure = ehEmbed ? 0.78 : 0.9;
      camera.fov = 35;
      camera.updateProjectionMatrix();
      controls.enabled = true;
      cutawayButton.disabled = false;
      viewModeButton.textContent = 'Vista interna';
      viewModeButton.title = 'Entrar na vista interna em primeira pessoa';
      viewModeButton.setAttribute('aria-label', 'Entrar na vista interna em primeira pessoa');
      if (viewerTitle) viewerTitle.textContent = 'Conheça a casa por fora';
      atualizarSelecaoVisual();
    }

    function caixaDosBlocosVisiveis(casasVisiveis, somenteBase) {
      const blocosVisiveis = casasVisiveis.flat().filter((bloco) => {
        // O modelo exportado separa a base e a cobertura/volumes altos em
        // grupos fechados. Mantemos o grupo inteiro para não deixar paredes
        // ocas nem criar faces abertas no plano de corte.
        return !somenteBase || bloco.centro.y <= alturaCorte + 0.25;
      });
      const caixa = blocosVisiveis.reduce(
        (resultado, bloco) => resultado.union(bloco.caixa),
        new THREE.Box3(),
      );
      if (caixa.isEmpty()) return caixaModelo.clone();
      caixa.min.y = caixaModelo.min.y;
      return caixa;
    }

    function atualizarSelecaoVisual() {
      if (modoInterior) {
        atualizarVisibilidadeInterior();
        atualizarPainelInterior();
        return;
      }

      const casasVisiveis = modoUmaCasa
        ? [casasApresentacao[indiceCasaDaDireita] || casasApresentacao[0] || []]
        : casasApresentacao;
      const blocosDaSelecao = new Set(casasVisiveis.flat());

      casasApresentacao.flat().forEach((bloco) => {
        bloco.objeto.visible = blocosDaSelecao.has(bloco)
          && (!modoCorteAtivo || bloco.centro.y <= alturaCorte + 0.25);
      });

      // Não usa clipping de fragmentos: grupos fechados são ocultados inteiros
      // para que o topo das paredes continue sólido e estável ao girar.
      renderer.localClippingEnabled = false;
      materiaisModelo.forEach((material) => {
        material.clippingPlanes = [];
        material.clipShadows = false;
      });

      const caixaBase = caixaDosBlocosVisiveis(casasVisiveis, modoCorteAtivo);
      const caixaEnquadramento = modoCorteAtivo
        ? caixaBase.clone().expandByVector(new THREE.Vector3(1.4, 0, 1.4))
        : modoUmaCasa
          ? caixaEnquadramentoUmaCasa
          : caixaEnquadramentoNormal;
      posicionarCameraECena(caixaEnquadramento, modoCorteAtivo ? direcaoVistaSuperior : null);

      houseSelectionButton.textContent = modoUmaCasa ? '1 casa' : '2 casas';
      houseSelectionButton.setAttribute('aria-pressed', String(modoUmaCasa));
      houseSelectionButton.classList.toggle('is-active', modoUmaCasa);
      houseSelectionButton.title = modoUmaCasa ? 'Mostrar as duas casas' : 'Mostrar somente uma casa';

      cutawayButton.textContent = modoCorteAtivo ? 'Vista externa' : 'Vista de cima';
      cutawayButton.setAttribute('aria-pressed', String(modoCorteAtivo));
      cutawayButton.classList.toggle('is-active', modoCorteAtivo);
      cutawayButton.title = modoCorteAtivo ? 'Voltar à vista externa com cobertura' : 'Mostrar a vista de cima sem cobertura';

      viewModeButton.textContent = 'Vista interna';
      viewModeButton.setAttribute('aria-pressed', 'false');
      viewModeButton.setAttribute('aria-label', 'Entrar na vista interna em primeira pessoa');
      viewModeButton.title = 'Entrar na vista interna em primeira pessoa';
      viewModeButton.classList.remove('is-active');
      atualizarPainelInterior();

      const descricaoCasas = modoUmaCasa ? 'uma casa' : 'duas casas';
      canvas.setAttribute(
        'aria-label',
        modoCorteAtivo
          ? `Vista de cima de ${descricaoCasas}, sem cobertura e com paredes inteiras`
          : `Modelo 3D externo de ${descricaoCasas}`,
      );
      atualizarStatus(modoCorteAtivo ? `Vista de cima · ${descricaoCasas}` : 'Modelo pronto', 'ready');
    }

    alternarSelecaoCasa = () => {
      if (!modeloCarregado) return;
      modoUmaCasa = !modoUmaCasa;
      if (modoInterior) {
        indicePontoInterior = 0;
        atualizarVisibilidadeInterior();
        atualizarPainelInterior();
        selecionarPontoInterior(0, false);
        houseSelectionButton.textContent = modoUmaCasa ? '1 casa' : '2 casas';
        canvas.setAttribute('aria-label', `Vista interna guiada de ${modoUmaCasa ? 'uma casa' : 'duas casas'}, em primeira pessoa`);
        atualizarStatus(`Vista interna · ${modoUmaCasa ? 'uma casa' : 'duas casas'}`, 'ready');
        return;
      }
      atualizarSelecaoVisual();
    };

    alternarModoCorte = () => {
      if (!modeloCarregado || modoInterior) return;
      modoCorteAtivo = !modoCorteAtivo;
      atualizarSelecaoVisual();
    };

    alternarModoInterior = () => {
      if (!modeloCarregado) return;
      if (modoInterior) {
        sairDaVistaInterior();
      } else {
        entrarNaVistaInterior();
      }
    };

    await metaPromise;

    modeloCarregado = true;
    controls.enabled = true;
    loadingOverlay.hidden = true;
    captureButton.disabled = false;
    houseSelectionButton.disabled = false;
    cutawayButton.disabled = false;
    viewModeButton.disabled = false;
    atualizarSelecaoVisual();
    console.info(`[showroom3d] ${gruposCompactados} grupos de geometria compactados para a apresentação (${modeloArquivo}).`);
  },
  (evento) => {
    if (modeloCarregado) return;
    if (evento.total) {
      const progresso = Math.round((evento.loaded / evento.total) * 100);
      loadingLabel.textContent = `Carregando modelo 3D… ${progresso}%`;
    }
  },
  (erro) => {
    console.error(`[showroom3d] Falha ao carregar ${modeloArquivo}.`, erro);
    mostrarErro(`O arquivo ${modeloArquivo.split('/').pop()} não pôde ser lido. Confira o arquivo de entrega do modelo.`);
  },
);

// --- Interações da interface --------------------------------------------------

async function salvarImagem() {
  if (!modeloCarregado) return;
  captureButton.disabled = true;
  captureButton.textContent = 'Gerando imagem…';
  try {
    renderer.render(scene, camera);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem.'))), 'image/png');
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const data = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `casa-3d-${data}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    atualizarStatus('Imagem salva', 'ready');
  } catch (erro) {
    console.error(erro);
    atualizarStatus('Não foi possível salvar', 'error');
  } finally {
    captureButton.disabled = false;
    captureButton.textContent = 'Salvar imagem';
  }
}

function iniciarTema() {
  const button = document.querySelector('#theme-toggle');
  button?.addEventListener('click', () => {
    const root = document.documentElement;
    const escuro = root.dataset.theme === 'dark';
    root.dataset.theme = escuro ? 'light' : 'dark';
    button.setAttribute('aria-pressed', String(!escuro));
  });
}

captureButton.addEventListener('click', salvarImagem);
houseSelectionButton.addEventListener('click', () => alternarSelecaoCasa());
internalHouseButton?.addEventListener('click', () => alternarSelecaoCasa());
cutawayButton.addEventListener('click', () => alternarModoCorte());
viewModeButton.addEventListener('click', () => alternarModoInterior());
internalRoomSelect?.addEventListener('change', (evento) => {
  const indice = Number(evento.target.value);
  if (Number.isInteger(indice)) {
    // A troca pelo seletor deve ser imediata para facilitar a conferência de
    // todos os ambientes; os botões anterior/próximo usam uma transição curta.
    selecionarPontoInteriorGlobal(indice, false);
  }
});
internalPreviousButton?.addEventListener('click', () => {
  if (!modoInterior) return;
  selecionarPontoInteriorGlobal(Number(internalRoomSelect.value || 0) - 1, true);
});
internalNextButton?.addEventListener('click', () => {
  if (!modoInterior) return;
  selecionarPontoInteriorGlobal(Number(internalRoomSelect.value || 0) + 1, true);
});
retryButton.addEventListener('click', () => window.location.reload());
iniciarTema();

// Na vista interna o arraste controla somente o olhar, sem deslocar a câmera
// através das paredes. O deslocamento entre ambientes fica restrito ao seletor
// de pontos, o que evita atravessar geometrias incompletas do GLB.
canvas.addEventListener('pointerdown', (evento) => {
  if (!modoInterior || evento.button !== 0) return;
  olharInteriorAtivo = true;
  ultimoOlharInterior = { x: evento.clientX, y: evento.clientY };
  canvas.setPointerCapture?.(evento.pointerId);
  evento.preventDefault();
});

canvas.addEventListener('pointermove', (evento) => {
  if (!modoInterior || !olharInteriorAtivo) return;
  const deltaX = evento.clientX - ultimoOlharInterior.x;
  const deltaY = evento.clientY - ultimoOlharInterior.y;
  ultimoOlharInterior = { x: evento.clientX, y: evento.clientY };
  cancelarTransicaoInterior();
  yawInterior -= deltaX * 0.0032;
  pitchInterior -= deltaY * 0.0028;
  atualizarCameraInterior({ posicao: camera.position, yaw: yawInterior, pitch: pitchInterior });
  evento.preventDefault();
});

function pararOlharInterior(evento) {
  if (!olharInteriorAtivo) return;
  olharInteriorAtivo = false;
  canvas.releasePointerCapture?.(evento.pointerId);
}

canvas.addEventListener('pointerup', pararOlharInterior);
canvas.addEventListener('pointercancel', pararOlharInterior);

window.addEventListener('keydown', (evento) => {
  if (!modoInterior) return;
  const tecla = evento.key.toLowerCase();
  const passo = 0.12;
  if (tecla === 'arrowleft' || tecla === 'a') yawInterior += passo;
  else if (tecla === 'arrowright' || tecla === 'd') yawInterior -= passo;
  else if (tecla === 'arrowup' || tecla === 'w') pitchInterior = Math.max(-1.15, pitchInterior - passo * 0.7);
  else if (tecla === 'arrowdown' || tecla === 's') pitchInterior = Math.min(1.15, pitchInterior + passo * 0.7);
  else return;
  cancelarTransicaoInterior();
  atualizarCameraInterior({ posicao: camera.position, yaw: yawInterior, pitch: pitchInterior });
  evento.preventDefault();
});
