import { ChevronLeft, ChevronRight, Download, Pause, Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Photo } from '@casas/schemas';
import { Button } from '../../components/ui/button';

function downloadName(photo: Photo) {
  const label = photo.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'foto';
  const source = photo.file || photo.url.split(/[?#]/)[0];
  const extension = source.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${label}.${extension}`;
}

export function PhotoLightbox({ photos, initialIndex, onClose }: { photos: Photo[]; initialIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const photo = photos[index];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % photos.length);
      if (event.key === 'ArrowLeft') setIndex((current) => (current - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.classList.add('lightbox-open');
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.classList.remove('lightbox-open'); };
  }, [onClose, photos.length]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % photos.length), 2400);
    return () => window.clearInterval(timer);
  }, [photos.length, playing]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 p-4 text-white" role="dialog" aria-modal="true" aria-label="Visualizador de fotos">
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <span className="font-mono text-xs opacity-80">{index + 1} / {photos.length}</span>
        <div className="flex gap-2">
          <button className="icon-button-on-dark" onClick={() => setPlaying((current) => !current)} aria-label={playing ? 'Pausar apresentação' : 'Iniciar apresentação'}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <a className="icon-button-on-dark" href={photo.url} download={downloadName(photo)} aria-label={`Baixar foto: ${photo.label}`}><Download size={16} /></a>
          <Button variant="outline" onClick={onClose} aria-label="Fechar visualizador"><X size={17} /></Button>
        </div>
      </div>
      <div className="flex h-full items-center justify-center">
        <button className="icon-button-on-dark absolute left-4 top-1/2 -translate-y-1/2" onClick={() => setIndex((current) => (current - 1 + photos.length) % photos.length)} aria-label="Foto anterior"><ChevronLeft /></button>
        <img className="max-h-full max-w-full object-contain" src={photo.url} alt={photo.label} />
        <button className="icon-button-on-dark absolute right-4 top-1/2 -translate-y-1/2" onClick={() => setIndex((current) => (current + 1) % photos.length)} aria-label="Próxima foto"><ChevronRight /></button>
      </div>
      <p className="absolute inset-x-0 bottom-5 text-center text-sm text-white/80">{photo.label}</p>
    </div>
  );
}
