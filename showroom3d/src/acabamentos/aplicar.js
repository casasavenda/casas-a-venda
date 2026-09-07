import * as THREE from 'three';
import { catalogoPara } from './catalogo.js';

const texturas = new Map();

function ruido(x, y, semente = 1) {
  const valor = Math.sin(x * 12.9898 + y * 78.233 + semente * 37.719) * 43758.5453;
  return valor - Math.floor(valor);
}

function limitarCanal(valor) {
  return Math.max(0, Math.min(255, valor));
}

function adicionarRuido(canvas, intensidade = 10) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const variacao = (ruido(x, y, intensidade) - .5) * intensidade;
      pixels.data[index] = limitarCanal(pixels.data[index] + variacao);
      pixels.data[index + 1] = limitarCanal(pixels.data[index + 1] + variacao);
      pixels.data[index + 2] = limitarCanal(pixels.data[index + 2] + variacao);
    }
  }
  ctx.putImageData(pixels, 0, 0);
}

export function texturaProcedural(finish) {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (!finish.texture || typeof document === 'undefined' || /jsdom/i.test(userAgent)) return null;
  if (texturas.has(finish.id)) return texturas.get(finish.id);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = finish.color;
  ctx.fillRect(0, 0, 256, 256);
  if (finish.texture === 'wood') {
    adicionarRuido(canvas, 14);
    ctx.lineCap = 'round';
    for (let y = -24; y < 280; y += 18) {
      ctx.strokeStyle = `rgba(75,43,23,${.12 + (y % 3) * .025})`;
      ctx.lineWidth = 1 + (Math.abs(y) % 3) * .35;
      ctx.beginPath();
      ctx.moveTo(-8, y);
      ctx.bezierCurveTo(62, y - 6, 138, y + 7, 264, y - 3);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i += 1) {
      const x = 8 + ruido(i, 2, 4) * 240;
      const y = 8 + ruido(i, 3, 5) * 240;
      ctx.strokeStyle = 'rgba(65,35,18,.2)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + ruido(i, 4, 6) * 7, 1.5, ruido(i, 5, 7), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (finish.texture === 'tile') {
    ctx.strokeStyle = 'rgba(80,70,55,.34)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    for (let y = 0; y <= 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    for (let x = 4; x < 256; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    for (let y = 4; y < 256; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    adicionarRuido(canvas, 8);
  } else if (finish.texture === 'concrete') {
    adicionarRuido(canvas, 18);
    for (let i = 0; i < 650; i += 1) {
      const x = ruido(i, 1, 11) * 256;
      const y = ruido(i, 2, 12) * 256;
      ctx.fillStyle = `rgba(255,255,255,${.02 + ruido(i, 3, 13) * .06})`;
      ctx.fillRect(x, y, 1, 1);
    }
  } else if (finish.texture === 'plaster') {
    adicionarRuido(canvas, 9);
    for (let i = 0; i < 280; i += 1) {
      const x = ruido(i, 1, 21) * 256;
      const y = ruido(i, 2, 22) * 256;
      const raio = .25 + ruido(i, 3, 23) * 1.1;
      ctx.fillStyle = `rgba(255,255,255,${.025 + ruido(i, 4, 24) * .045})`;
      ctx.beginPath();
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (finish.texture === 'grass') {
    adicionarRuido(canvas, 16);
    ctx.strokeStyle = 'rgba(235,245,210,.09)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 420; i += 1) {
      const x = (i * 47) % 256;
      const y = (i * 83) % 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ((i % 5) - 2), y - 3 - (i % 4));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(24,45,20,.12)';
    for (let i = 0; i < 220; i += 1) {
      ctx.fillRect((i * 71) % 256, (i * 29) % 256, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  texturas.set(finish.id, texture);
  return texture;
}

function todosMateriais(objeto) {
  const saida = [];
  objeto.traverse((node) => {
    if (!node.isMesh) return;
    saida.push({ node, materials: Array.isArray(node.material) ? node.material : [node.material] });
  });
  return saida;
}

export function aplicarAcabamento(objeto, finish) {
  if (!objeto || !finish) return;
  for (const { node, materials } of todosMateriais(objeto)) {
    if (!node.userData.defaultMaterials) node.userData.defaultMaterials = materials.map((material) => material.clone());
    const novos = materials.map((material) => {
      const novo = material.clone();
      novo.color.set(finish.color);
      const texture = texturaProcedural(finish);
      if (texture) novo.map = texture;
      novo.needsUpdate = true;
      return novo;
    });
    node.material = Array.isArray(node.material) ? novos : novos[0];
  }
  objeto.userData.finish = finish;
}

export function restaurarAcabamento(objeto) {
  if (!objeto) return;
  objeto.traverse((node) => {
    if (!node.isMesh || !node.userData.defaultMaterials) return;
    node.material = Array.isArray(node.material) ? node.userData.defaultMaterials.map((material) => material.clone()) : node.userData.defaultMaterials[0].clone();
    node.material.needsUpdate = true;
  });
  delete objeto.userData.finish;
}

export function acabamentosDoObjeto(objeto) {
  return catalogoPara(objeto?.userData?.kind);
}
