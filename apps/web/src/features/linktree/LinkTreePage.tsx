import { ArrowRight, Images, MessageCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BrandMark } from '../../components/BrandMark';
import { api } from '../../lib/api';

export function LinkTreePage() {
  const { data: houses, isPending } = useQuery({ queryKey: ['houses'], queryFn: api.listHouses });
  const house = houses?.[0];
  const whatsapp = house?.phone ? `https://wa.me/${house.phone.replace(/\D/g, '')}` : undefined;

  if (isPending) return <main className="grid min-h-screen place-items-center bg-surface text-muted-foreground">Carregando perfil...</main>;
  if (!house) return <main className="grid min-h-screen place-items-center bg-surface text-muted-foreground">Nenhuma casa publicada.</main>;

  return <main className="grid min-h-screen place-items-start bg-surface px-5 py-14 text-foreground sm:place-items-center sm:py-10"><div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center"><BrandMark /><div><p className="eyebrow mb-2 text-primary">CASAS À VENDA</p><h1 className="font-serif text-3xl font-semibold">{house.title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{[house.addr, house.highlight, house.area].filter(Boolean).join(' · ')}</p></div><div className="flex w-full flex-col gap-2.5 pt-2"><Link className="linktree-link primary" to={`/casas/${house.slug}`}><Images size={17} />Ver galeria da casa<ArrowRight className="ml-auto" size={16} /></Link>{whatsapp && <a className="linktree-link" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} />Falar no WhatsApp</a>}<Link className="linktree-link" to={`/casas/${house.slug}#fotos`}>Conhecer fotos e detalhes</Link></div><Link className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" to="/admin"><Settings size={13} />Acesso administrativo</Link><p className="pt-1 text-xs text-muted-foreground/80">Um jeito simples de conhecer seu próximo lar.</p></div></main>;
}
