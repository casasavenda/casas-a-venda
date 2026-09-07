export const TIPOS_SELECIONAVEIS = new Set(['wall', 'floor', 'ceiling', 'opening', 'furniture']);

export function booleanoXml(valor, padrao = true) {
  if (valor == null || valor === '') return padrao;
  return String(valor).toLowerCase() !== 'false';
}

export function numeroXml(valor, padrao = 0) {
  const numero = Number.parseFloat(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

export function corAarrggbb(valor) {
  if (!valor) return null;
  const bruto = String(valor).replace(/^#/, '').trim();
  if (!/^[\da-f]{6,8}$/i.test(bruto)) return null;
  const completo = bruto.length === 6 ? `FF${bruto}` : bruto.padStart(8, '0');
  return {
    hex: `#${completo.slice(2).toUpperCase()}`,
    alpha: Number.parseInt(completo.slice(0, 2), 16) / 255,
    source: String(valor),
  };
}

export function areaShoelace(pontos) {
  let soma = 0;
  for (let i = 0; i < pontos.length; i += 1) {
    const atual = pontos[i];
    const proximo = pontos[(i + 1) % pontos.length];
    soma += atual.x * proximo.z - proximo.x * atual.z;
  }
  return Math.abs(soma) / 2;
}

export function distanciaPontoSegmento(ponto, inicio, fim) {
  const dx = fim.x - inicio.x;
  const dz = fim.z - inicio.z;
  const comprimentoQuadrado = dx * dx + dz * dz;
  if (comprimentoQuadrado === 0) return Math.hypot(ponto.x - inicio.x, ponto.z - inicio.z);
  const t = Math.min(1, Math.max(0, ((ponto.x - inicio.x) * dx + (ponto.z - inicio.z) * dz) / comprimentoQuadrado));
  return Math.hypot(ponto.x - (inicio.x + t * dx), ponto.z - (inicio.z + t * dz));
}

export function deduzirTopologia(paredes, tolerancia = 0.01) {
  const extremos = paredes.flatMap((parede) => [
    { wallId: parede.id, side: 'start', point: parede.start },
    { wallId: parede.id, side: 'end', point: parede.end },
  ]);

  return paredes.map((parede) => {
    const connections = {
      start: new Set(parede.wallAtStart ? [parede.wallAtStart] : []),
      end: new Set(parede.wallAtEnd ? [parede.wallAtEnd] : []),
    };

    for (const endpoint of extremos) {
      if (endpoint.wallId === parede.id) continue;
      if (Math.hypot(endpoint.point.x - parede.start.x, endpoint.point.z - parede.start.z) <= tolerancia) {
        connections.start.add(endpoint.wallId);
      }
      if (Math.hypot(endpoint.point.x - parede.end.x, endpoint.point.z - parede.end.z) <= tolerancia) {
        connections.end.add(endpoint.wallId);
      }
    }

    return {
      ...parede,
      connections: {
        start: [...connections.start],
        end: [...connections.end],
      },
      inferredTopology: {
        start: !parede.wallAtStart && connections.start.size > 0,
        end: !parede.wallAtEnd && connections.end.size > 0,
      },
    };
  });
}

export function validarModelo(modelo) {
  const erros = [];
  if (!modelo || typeof modelo !== 'object') erros.push('Modelo ausente.');
  if (!Array.isArray(modelo?.walls)) erros.push('Modelo sem paredes.');
  if (!Array.isArray(modelo?.rooms)) erros.push('Modelo sem ambientes.');
  if (!Array.isArray(modelo?.openings)) erros.push('Modelo sem aberturas.');
  if (!Array.isArray(modelo?.furniture)) erros.push('Modelo sem móveis.');
  if (erros.length) throw new Error(erros.join(' '));
  return modelo;
}
