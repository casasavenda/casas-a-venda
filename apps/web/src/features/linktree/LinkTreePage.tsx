import { ArrowRight, Images, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BrandMark } from '../../components/BrandMark';
import { api } from '../../lib/api';

export function LinkTreePage() {
  const { data: houses, isPending } = useQuery({ queryKey: ['houses'], queryFn: api.listHouses });
  const publishedHouses = (houses || []).filter((house) => house.status === 'ok');

  if (isPending) return <main className="grid min-h-screen place-items-center bg-surface text-muted-foreground">Carregando perfil...</main>;
  if (!publishedHouses.length) return <main className="grid min-h-screen place-items-center bg-surface text-muted-foreground">Nenhuma casa publicada.</main>;

  return (
    <main className="grid min-h-screen place-items-start bg-surface px-5 py-14 text-foreground sm:place-items-center sm:py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <BrandMark />
        <div><p className="eyebrow mb-2 text-primary">CASAS À VENDA</p><h1 className="font-serif text-3xl font-semibold">Encontre seu próximo lar</h1><p className="mt-1.5 text-sm text-muted-foreground">Conheça nossas casas disponíveis</p></div>
        <div className="flex w-full flex-col gap-3 pt-2">
          {publishedHouses.map((house) => {
            const whatsappMessage = `Olá, Cleber! Tenho interesse na ${house.title}, em ${house.addr}, e gostaria de receber mais informações e agendar uma visita.`;
            const whatsapp = house.phone ? `https://wa.me/${house.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}` : undefined;
            return <div key={house.id} className="space-y-2 rounded-xl border border-border bg-background p-2 text-left shadow-sm"><Link className="linktree-link primary" to={`/casas/${house.slug}`}><Images size={17} /><span className="min-w-0 flex-1"><strong className="block truncate">{house.title}</strong><small className="mt-0.5 block truncate font-normal opacity-80">{[house.addr, house.highlight, house.area].filter(Boolean).join(' · ')}</small></span><ArrowRight size={16} /></Link>{whatsapp && <a className="linktree-link" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar sobre esta casa no WhatsApp</a>}</div>;
          })}
        </div>
        <p className="pt-1 text-xs text-muted-foreground/80">Um jeito simples de conhecer seu próximo lar.</p>
      </div>
    </main>
  );
}
