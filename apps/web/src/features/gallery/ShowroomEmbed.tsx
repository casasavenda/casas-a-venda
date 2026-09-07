import { Box } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';

const showroomUrl = import.meta.env.VITE_SHOWROOM_URL || `${import.meta.env.BASE_URL}showroom3d/index.html?embed=1`;

export function ShowroomEmbed({ title }: { title: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <section className="mx-auto max-w-6xl px-4 pt-6" aria-labelledby="showroom-title">
      <div className="grid gap-5 overflow-hidden rounded-xl border border-border bg-card p-5 lg:grid-cols-[0.75fr_1.25fr] lg:p-6">
        <div className="flex flex-col items-start justify-center gap-3">
          <span className="eyebrow text-primary">MODELO 3D</span>
          <h2 id="showroom-title" className="font-serif text-3xl font-semibold">Explore a casa</h2>
          <p className="text-sm leading-7 text-muted-foreground">Gire o modelo, aproxime e entre nos ambientes para conhecer a proposta em outra escala.</p>
          {!opened && <Button variant="primary" onClick={() => setOpened(true)}><Box size={16} />Abrir showroom 3D</Button>}
        </div>
        <div className="showroom-slot">
          {opened ? (
            <iframe className="showroom-frame" title={`Showroom 3D da ${title}`} src={showroomUrl} allow="fullscreen" />
          ) : (
            <div className="grid min-h-64 place-items-center bg-[#171311] p-8 text-center text-white/75">
              <div><Box className="mx-auto mb-3 text-primary" size={44} strokeWidth={1.2} /><strong className="block text-sm">Modelo 3D da {title}</strong><span className="mt-1 block text-xs text-white/55">Abra quando quiser explorar.</span></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
