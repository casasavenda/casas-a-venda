export function cmParaMetros(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero / 100 : 0;
}

export function pontoParaThree(x, y, elevation = 0) {
  return {
    x: cmParaMetros(x),
    y: cmParaMetros(elevation),
    z: cmParaMetros(y),
  };
}

export function distancia2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function clamp(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}
