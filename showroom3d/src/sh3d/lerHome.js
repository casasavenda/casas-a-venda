import { abrirArquivoSh3d } from './abrirArquivo.js';
import {
  areaShoelace,
  booleanoXml,
  corAarrggbb,
  deduzirTopologia,
  distanciaPontoSegmento,
  numeroXml,
  validarModelo,
} from './modelo.js';
import { cmParaMetros, pontoParaThree } from './unidades.js';

function atributo(elemento, nome, padrao = null) {
  return elemento?.getAttribute(nome) ?? padrao;
}

function avisar(mensagem) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') console.warn(`[showroom3d] ${mensagem}`);
}

function parseSash(elemento) {
  return [...elemento.children]
    .filter((filho) => filho.tagName === 'sash')
    .map((sash) => ({
      xAxis: numeroXml(atributo(sash, 'xAxis')),
      yAxis: numeroXml(atributo(sash, 'yAxis')),
      width: numeroXml(atributo(sash, 'width')),
      startAngle: numeroXml(atributo(sash, 'startAngle')),
      endAngle: numeroXml(atributo(sash, 'endAngle')),
    }));
}

function parseNiveis(documento, wallHeightCm) {
  return [...documento.querySelectorAll('level')].map((level, indice) => ({
    id: atributo(level, 'id', `level-${indice + 1}`),
    name: atributo(level, 'name', `Nível ${indice}`),
    elevation: cmParaMetros(numeroXml(atributo(level, 'elevation'), 0)),
    height: cmParaMetros(numeroXml(atributo(level, 'height'), wallHeightCm)),
    floorThickness: cmParaMetros(numeroXml(atributo(level, 'floorThickness'), 0)),
  }));
}

function contextoDoNivel(elemento, niveis, wallHeightCm) {
  const levelId = atributo(elemento, 'level');
  const nivel = niveis.find((item) => item.id === levelId);
  return {
    levelId: levelId || null,
    levelName: nivel?.name || null,
    levelElevation: nivel?.elevation ?? 0,
    levelHeight: nivel?.height ?? cmParaMetros(wallHeightCm),
    floorThickness: nivel?.floorThickness ?? 0,
  };
}

function parseParedes(documento, wallHeight, niveis) {
  const paredes = [...documento.querySelectorAll('wall')].map((wall) => {
    const nivel = contextoDoNivel(wall, niveis, wallHeight);
    const heightCm = numeroXml(atributo(wall, 'height'), wallHeight);
    const heightAtEndCm = numeroXml(atributo(wall, 'heightAtEnd'), heightCm);
    const arcExtent = atributo(wall, 'arcExtent');
    if (arcExtent != null) avisar(`Parede ${atributo(wall, 'id', '(sem id)')} possui arcExtent; este showroom usa o trecho reto como fallback.`);
    return {
      id: atributo(wall, 'id', `wall-${Math.random().toString(36).slice(2)}`),
      start: pontoParaThree(atributo(wall, 'xStart'), atributo(wall, 'yStart')),
      end: pontoParaThree(atributo(wall, 'xEnd'), atributo(wall, 'yEnd')),
      height: cmParaMetros(heightCm),
      heightAtEnd: cmParaMetros(heightAtEndCm),
      thickness: cmParaMetros(numeroXml(atributo(wall, 'thickness'))),
      wallAtStart: atributo(wall, 'wallAtStart'),
      wallAtEnd: atributo(wall, 'wallAtEnd'),
      arcExtent: arcExtent == null ? null : numeroXml(arcExtent),
      pattern: atributo(wall, 'pattern'),
      ...nivel,
      colors: {
        left: corAarrggbb(atributo(wall, 'leftSideColor')),
        right: corAarrggbb(atributo(wall, 'rightSideColor')),
        top: corAarrggbb(atributo(wall, 'topColor')),
      },
    };
  });
  return deduzirTopologia(paredes);
}

function parseAmbientes(documento, niveis, wallHeight, paredes) {
  const niveisComParedes = new Set(paredes.map((parede) => parede.levelId).filter(Boolean));
  return [...documento.querySelectorAll('room')].map((room, indice) => {
    const nivel = contextoDoNivel(room, niveis, wallHeight);
    const name = atributo(room, 'name');
    const points = [...room.querySelectorAll(':scope > point')].map((point) => pontoParaThree(atributo(point, 'x'), atributo(point, 'y')));
    const area = areaShoelace(points);
    const nomeNivel = String(nivel.levelName || '').toLowerCase();
    const isRoofRoom = nomeNivel.includes('telhado');
    const isLegacyUnnamedRoom = !name && niveis.length === 0;
    const isLevelWithoutWalls = Boolean(nivel.levelId && !niveisComParedes.has(nivel.levelId));
    const isLot = !name && (isLegacyUnnamedRoom || isRoofRoom || isLevelWithoutWalls);
    return {
      id: atributo(room, 'id', `room-${indice + 1}`),
      name: name || null,
      displayName: name || (isLot ? 'Lote' : `Ambiente ${indice + 1}${nivel.levelName ? ` · ${nivel.levelName}` : ''}`),
      isLot,
      points,
      area,
      floorVisible: booleanoXml(atributo(room, 'floorVisible'), true),
      ceilingVisible: booleanoXml(atributo(room, 'ceilingVisible'), true),
      areaVisible: booleanoXml(atributo(room, 'areaVisible'), true),
      ceilingFlat: booleanoXml(atributo(room, 'ceilingFlat'), true),
      ...nivel,
    };
  });
}

function paredeMaisProxima(ponto, paredes) {
  let melhor = null;
  let menorDistancia = Number.POSITIVE_INFINITY;
  for (const parede of paredes) {
    const distancia = distanciaPontoSegmento(ponto, parede.start, parede.end);
    if (distancia < menorDistancia) {
      melhor = parede;
      menorDistancia = distancia;
    }
  }
  return melhor?.id ?? null;
}

function parseAberturas(documento, paredes, niveis, wallHeight) {
  return [...documento.querySelectorAll('doorOrWindow')].map((opening, indice) => {
    const nivel = contextoDoNivel(opening, niveis, wallHeight);
    const model = atributo(opening, 'model');
    if (!model) avisar(`Abertura ${atributo(opening, 'id', indice)} não possui modelo OBJ.`);
    const cutOutShape = atributo(opening, 'cutOutShape', 'M0,0 v1 h1 v-1 z');
    if (cutOutShape !== 'M0,0 v1 h1 v-1 z') {
      avisar(`Abertura ${atributo(opening, 'id', indice)} usa cutOutShape não retangular; usando retângulo como fallback.`);
    }
    const position = pontoParaThree(atributo(opening, 'x'), atributo(opening, 'y'), atributo(opening, 'elevation', 0));
    return {
      id: atributo(opening, 'id', `opening-${indice + 1}`),
      catalogId: atributo(opening, 'catalogId'),
      name: atributo(opening, 'name', 'Abertura'),
      type: (atributo(opening, 'catalogId', '').toLowerCase().includes('door') ? 'door' : 'window'),
      modelPath: model,
      position,
      angle: numeroXml(atributo(opening, 'angle')),
      width: cmParaMetros(numeroXml(atributo(opening, 'width'))),
      depth: cmParaMetros(numeroXml(atributo(opening, 'depth'))),
      height: cmParaMetros(numeroXml(atributo(opening, 'height'))),
      elevation: cmParaMetros(numeroXml(atributo(opening, 'elevation'), 0)),
      ...nivel,
      wallThicknessFraction: numeroXml(atributo(opening, 'wallThickness')),
      wallDistanceFraction: numeroXml(atributo(opening, 'wallDistance')),
      cutOutShape,
      wallCutOutOnBothSides: booleanoXml(atributo(opening, 'wallCutOutOnBothSides'), true),
      sash: parseSash(opening),
      wallId: paredeMaisProxima(position, paredes),
    };
  });
}

function parseMoveis(documento, niveis, wallHeight, indiceInicial = 0) {
  return [...documento.querySelectorAll('pieceOfFurniture')].map((piece, indice) => {
    const nivel = contextoDoNivel(piece, niveis, wallHeight);
    const position = pontoParaThree(atributo(piece, 'x'), atributo(piece, 'y'), atributo(piece, 'elevation', 0));
    return {
      id: atributo(piece, 'id', `furniture-${indiceInicial + indice + 1}`),
      catalogId: atributo(piece, 'catalogId'),
      name: atributo(piece, 'name', 'Móvel'),
      modelPath: atributo(piece, 'model'),
      position,
      angle: numeroXml(atributo(piece, 'angle')),
      width: cmParaMetros(numeroXml(atributo(piece, 'width'))),
      depth: cmParaMetros(numeroXml(atributo(piece, 'depth'))),
      height: cmParaMetros(numeroXml(atributo(piece, 'height'))),
      elevation: cmParaMetros(numeroXml(atributo(piece, 'elevation'), 0)),
      ...nivel,
    };
  });
}

function parseAmbiente(documento) {
  const environment = documento.querySelector('environment');
  const texture = environment?.querySelector('texture');
  return {
    skyColor: atributo(environment, 'skyColor', 'CCE4FC'),
    groundColor: atributo(environment, 'groundColor', '087300'),
    lightColor: atributo(environment, 'lightColor', 'D0D0D0'),
    groundTexture: texture ? {
      image: atributo(texture, 'image'),
      width: cmParaMetros(numeroXml(atributo(texture, 'width'))),
      height: cmParaMetros(numeroXml(atributo(texture, 'height'))),
    } : null,
  };
}

function extensaoPlanta(paredes, rooms) {
  const pontos = [
    ...paredes.flatMap((wall) => [wall.start, wall.end]),
    ...rooms.filter((room) => !room.isLot).flatMap((room) => room.points),
  ];
  if (!pontos.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, depth: 0 };
  const xs = pontos.map((ponto) => ponto.x);
  const zs = pontos.map((ponto) => ponto.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

export function parseHomeXml(homeXml) {
  if (typeof DOMParser === 'undefined') throw new Error('DOMParser não está disponível neste ambiente.');
  const documento = new DOMParser().parseFromString(homeXml, 'application/xml');
  const parserError = documento.querySelector('parsererror');
  if (parserError) throw new Error(`Home.xml inválido: ${parserError.textContent}`);
  const home = documento.documentElement;
  if (!home || home.tagName !== 'home') throw new Error('Home.xml não possui <home> como elemento raiz.');

  const wallHeight = numeroXml(atributo(home, 'wallHeight'), 250);
  const levels = parseNiveis(documento, wallHeight);
  const walls = parseParedes(documento, wallHeight, levels);
  const rooms = parseAmbientes(documento, levels, wallHeight, walls);
  const openings = parseAberturas(documento, walls, levels, wallHeight);
  const furniture = parseMoveis(documento, levels, wallHeight);
  if (levels.length > 1) avisar(`Foram encontrados ${levels.length} níveis; o showroom renderizará as elevações declaradas em cada elemento.`);
  const modelo = {
    formatVersion: atributo(home, 'version'),
    wallHeight: cmParaMetros(wallHeight),
    walls,
    rooms,
    openings,
    furniture,
    sashes: openings.flatMap((opening) => opening.sash),
    levels,
    environment: parseAmbiente(documento),
    extents: extensaoPlanta(walls, rooms),
  };
  return validarModelo(modelo);
}

export async function carregarSh3d(arquivoOuUrl) {
  const { homeXml, arquivos } = await abrirArquivoSh3d(arquivoOuUrl);
  const modelo = parseHomeXml(homeXml);
  Object.defineProperty(modelo, 'arquivos', { value: arquivos, enumerable: false, configurable: false });
  return modelo;
}
