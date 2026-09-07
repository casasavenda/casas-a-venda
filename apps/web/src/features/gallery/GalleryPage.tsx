import { ArrowLeft, Download, Images, MapPin, MessageCircle, Moon, Share2, Sun } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BrandMark } from '../../components/BrandMark';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { api } from '../../lib/api';
import { ShowroomEmbed } from './ShowroomEmbed';
import { PhotoLightbox } from './PhotoLightbox';

export function GalleryPage() {
  const { slug = 'casa-feitoria' } = useParams();
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [light, setLight] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const { data: house, isPending, error } = useQuery({ queryKey: ['house', slug], queryFn: () => api.getHouse(slug) });

  if (isPending) return <PageState message="Carregando a galeria..." />;
  if (error || !house) return <PageState message={error instanceof Error ? error.message : 'Casa não encontrada.'} />;

  const currentHouse = house;
  const whatsapp = currentHouse.phone
    ? `https://wa.me/${currentHouse.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse na ${currentHouse.title}, em ${currentHouse.addr}, e gostaria de receber mais informações e agendar uma visita.`)}`
    : undefined;
  const coverPhoto = currentHouse.coverUrl || currentHouse.photos[0]?.url || '/fotos/10.jpeg';

  async function shareGallery() {
    const galleryUrl = new URL(window.location.href);
    galleryUrl.search = '';
    galleryUrl.hash = `/casas/${currentHouse.slug}`;
    const shareData = { title: currentHouse.title, text: `Galeria da ${currentHouse.title}`, url: galleryUrl.toString() };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareFeedback('Link compartilhado');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(galleryUrl.toString());
        setShareFeedback('Link copiado');
      } else {
        window.prompt('Copie o link da galeria:', galleryUrl.toString());
        return;
      }
      window.setTimeout(() => setShareFeedback(''), 2400);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setShareFeedback('Não foi possível compartilhar');
      window.setTimeout(() => setShareFeedback(''), 2400);
    }
  }

  return (
    <main className={light ? 'theme-light min-h-screen bg-background text-foreground' : 'min-h-screen bg-background text-foreground'}>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-lg sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <BrandMark /><strong className="truncate text-sm">{house.title}</strong>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link className="button-base hidden sm:inline-flex" to="/">Linktree</Link>
          <button className="icon-button" aria-label="Alternar tema" onClick={() => setLight((current) => !current)}>{light ? <Moon size={16} /> : <Sun size={16} />}</button>
        </div>
      </header>

      <section className="gallery-hero">
        <img className="gallery-hero-image" src={coverPhoto} alt={`Fachada da ${house.title}`} />
        <div className="gallery-hero-content relative z-10 max-w-3xl px-5 pb-10 sm:px-8 sm:pb-12">
          <Badge className="mb-4 border border-white/25 bg-white/15 text-white">Casa disponível</Badge>
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-6xl">{house.title}</h1>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{house.addr}</span><span>{house.rooms}</span><span>{house.area}</span><span>{house.highlight}</span>
          </div>
          <a className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href="#fotos"><Images size={16} />Ver fotos</a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-8 sm:px-5">
        <Card><CardContent className="space-y-4"><p className="text-sm leading-7 text-muted-foreground">{house.description}</p><p className="border-t border-border pt-3 text-sm font-semibold text-primary">Imagens meramente ilustrativas. Consulte as condições e o padrão de acabamento proposto.</p>{whatsapp && <a className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#25d366] px-4 text-sm font-semibold text-[#102518] hover:brightness-95" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar no WhatsApp</a>}</CardContent></Card>
      </section>

      <ShowroomEmbed title={house.title} />

      <section id="fotos" className="mx-auto max-w-6xl px-4 py-10 sm:px-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold">Galeria de fotos</h2><p className="mt-1 text-sm text-muted-foreground">{house.photos.length} fotos</p></div><div className="flex flex-wrap gap-2"><button className="button-base" type="button" onClick={shareGallery}><Share2 size={15} />{shareFeedback || 'Compartilhar galeria'}</button><Link className="button-base" to="/"><ArrowLeft size={15} />Voltar ao perfil</Link></div></div>
        {house.photos.length ? <div className="photo-grid">{house.photos.map((photo, index) => <button className="photo-card text-left" key={photo.id || `${photo.url}-${index}`} onClick={() => setPhotoIndex(index)}><span className="photo-image"><img src={photo.url} alt={photo.label} loading="lazy" /></span><span className="flex items-center justify-between gap-2 p-2.5"><strong className="truncate text-xs font-semibold">{photo.label}</strong><Download size={14} className="shrink-0 text-muted-foreground" /></span></button>)}</div> : <Card><CardContent className="text-sm text-muted-foreground">Ainda não há fotos cadastradas para esta casa.</CardContent></Card>}
      </section>
      <footer className="pb-12 text-center text-xs text-muted-foreground">CASAS À VENDA · {house.slug}</footer>
      {photoIndex !== null && <PhotoLightbox photos={house.photos} initialIndex={photoIndex} onClose={() => setPhotoIndex(null)} />}
    </main>
  );
}

function PageState({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center bg-background px-5 text-center text-foreground"><Card><CardContent><p className="text-sm text-muted-foreground">{message}</p><Link className="button-base mt-4" to="/"><ArrowLeft size={15} />Voltar</Link></CardContent></Card></main>;
}
