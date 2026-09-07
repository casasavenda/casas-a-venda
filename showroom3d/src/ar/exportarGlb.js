import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function suporteAr(viewer) {
  const ponteiro = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return Boolean(viewer && (ponteiro || navigator.xr));
}

export async function exportarEstadoAtual(root, viewer) {
  if (!root || !viewer) throw new Error('Cena ou visualizador AR indisponível.');
  const exporter = new GLTFExporter();
  const data = await new Promise((resolve, reject) => exporter.parse(root, resolve, reject, { binary: true, onlyVisible: true }));
  const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  const anterior = viewer.dataset.objectUrl;
  if (anterior) URL.revokeObjectURL(anterior);
  viewer.dataset.objectUrl = url;
  viewer.src = url;
  viewer.removeAttribute('hidden');
  if (typeof viewer.activateAR === 'function') await viewer.activateAR();
  return { url, bytes: data.byteLength };
}
