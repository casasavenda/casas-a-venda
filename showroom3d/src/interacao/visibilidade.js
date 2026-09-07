import { iterarMateriais } from '../engine/materiais.js';

function reduzirMovimento() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function alterarOpacidade(objeto, valor) {
  iterarMateriais(objeto, (material) => {
    if (!material) return;
    material.transparent = valor < .999 || material.userData?.baseOpacity < .999;
    material.opacity = valor * (material.userData?.baseOpacity ?? 1);
    material.depthWrite = valor > .5;
  });
}

export function criarControladorVisibilidade({ onChange } = {}) {
  const ocultosPeloUsuario = new Set();
  const ocultosPeloModo = new Set();
  const animacoes = new WeakMap();

  function animar(objeto, destino, duracao = 300) {
    const anterior = animacoes.get(objeto);
    if (anterior) cancelAnimationFrame(anterior);
    if (destino > 0) objeto.visible = true;
    const inicioValor = destino > 0 ? 0 : 1;
    if (reduzirMovimento() || duracao <= 0) {
      alterarOpacidade(objeto, destino);
      objeto.visible = destino > 0;
      return;
    }
    const inicio = performance.now();
    const frame = (agora) => {
      const progresso = Math.min(1, (agora - inicio) / duracao);
      const valor = inicioValor + (destino - inicioValor) * progresso;
      alterarOpacidade(objeto, valor);
      if (progresso < 1) {
        const id = requestAnimationFrame(frame);
        animacoes.set(objeto, id);
      } else {
        objeto.visible = destino > 0;
        animacoes.delete(objeto);
      }
    };
    const id = requestAnimationFrame(frame);
    animacoes.set(objeto, id);
  }

  function emitir() { onChange?.({ ocultos: [...ocultosPeloUsuario], modeHidden: [...ocultosPeloModo] }); }

  return {
    ocultar(objeto) {
      ocultosPeloUsuario.add(objeto);
      animar(objeto, 0);
      emitir();
    },
    mostrar(objeto) {
      ocultosPeloUsuario.delete(objeto);
      if (!ocultosPeloModo.has(objeto)) animar(objeto, 1);
      emitir();
    },
    mostrarTudo() {
      for (const objeto of ocultosPeloUsuario) {
        if (!ocultosPeloModo.has(objeto)) animar(objeto, 1);
      }
      ocultosPeloUsuario.clear();
      emitir();
    },
    setModeHidden(objetos, esconder) {
      for (const objeto of objetos) {
        if (esconder) ocultosPeloModo.add(objeto);
        else ocultosPeloModo.delete(objeto);
        const deveEstarVisivel = !ocultosPeloUsuario.has(objeto) && !ocultosPeloModo.has(objeto);
        animar(objeto, deveEstarVisivel ? 1 : 0, 260);
      }
      emitir();
    },
    isHidden(objeto) { return ocultosPeloUsuario.has(objeto) || ocultosPeloModo.has(objeto); },
    isUserHidden(objeto) { return ocultosPeloUsuario.has(objeto); },
    getUserHidden() { return [...ocultosPeloUsuario]; },
    getAllHidden() { return [...new Set([...ocultosPeloUsuario, ...ocultosPeloModo])]; },
    resetMode() {
      for (const objeto of ocultosPeloModo) {
        if (!ocultosPeloUsuario.has(objeto)) animar(objeto, 1, 260);
      }
      ocultosPeloModo.clear();
      emitir();
    },
  };
}
