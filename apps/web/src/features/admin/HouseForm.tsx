import { zodResolver } from '@hookform/resolvers/zod';
import { Save, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createHouseSchema, type House } from '@casas/schemas';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título'),
  addr: z.string().trim().min(1, 'Informe o endereço'),
  area: z.string(),
  rooms: z.string(),
  highlight: z.string(),
  description: z.string(),
  phone: z.string(),
  slug: z.string().trim().min(1, 'Informe o identificador'),
  status: z.enum(['ok', 'draft']),
  photosText: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

function photosFromText(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [url, label] = line.split('|').map((part) => part.trim());
    return { url, label: label || 'Ambiente não informado' };
  });
}

export function HouseForm({ house, onClose, onSubmit }: { house?: House; onClose: () => void; onSubmit: (values: z.infer<typeof createHouseSchema> & { id?: string }) => Promise<void> }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: house?.title || '', addr: house?.addr || '', area: house?.area || '', rooms: house?.rooms || '', highlight: house?.highlight || '', description: house?.description || '', phone: house?.phone || '', slug: house?.slug || '', status: house?.status || 'draft', photosText: house?.photos.map((photo) => `${photo.url} | ${photo.label}`).join('\n') || '',
    },
  });

  const submit = form.handleSubmit(async (values) => {
    const payload = createHouseSchema.parse({ ...values, photosText: undefined, photos: photosFromText(values.photosText), phone: values.phone.replace(/\D/g, ''), slug: values.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') });
    await onSubmit(house ? { ...payload, id: house.id } : payload);
  });

  return <><div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} /><aside className="drawer-panel"><div className="flex items-center border-b border-border p-5"><h2 className="font-serif text-xl font-semibold">{house ? 'Editar casa' : 'Nova casa'}</h2><button className="icon-button ml-auto" onClick={onClose} aria-label="Fechar"><X size={17} /></button></div><form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><div className="flex-1 space-y-4 overflow-y-auto p-5"><Field label="Título da casa" error={form.formState.errors.title?.message}><Input {...form.register('title')} placeholder="Ex: Casa Recanto do Bosque" /></Field><Field label="Endereço / bairro / cidade" error={form.formState.errors.addr?.message}><Input {...form.register('addr')} placeholder="Ex: Feitoria, São Leopoldo/RS" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Área"><Input {...form.register('area')} placeholder="69,81 m²" /></Field><Field label="Quartos"><Input {...form.register('rooms')} placeholder="2 quartos" /></Field></div><Field label="Destaque principal"><Input {...form.register('highlight')} placeholder="Quiosque privativo" /></Field><Field label="Descrição"><Textarea {...form.register('description')} placeholder="Metragem, quartos, diferenciais..." /></Field><Field label="WhatsApp"><Input {...form.register('phone')} placeholder="(51) 98247-2740" /></Field><Field label="Identificador do endereço" hint="Esse valor vira o caminho do QR code."><Input {...form.register('slug')} placeholder="casa-feitoria" /></Field><Field label="Status"><select className="field-control" {...form.register('status')}><option value="ok">Publicada</option><option value="draft">Rascunho</option></select></Field><Field label="Fotos" hint="Uma por linha, no formato URL | legenda."><Textarea className="min-h-32 font-mono text-xs" {...form.register('photosText')} placeholder="/fotos/10.jpeg | Fachada" /></Field></div><div className="flex gap-2 border-t border-border p-4"><Button type="button" className="flex-1" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" className="flex-1"><Save size={16} />Salvar</Button></div></form></aside></>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}{children}{error ? <span className="block font-normal text-red-300">{error}</span> : hint ? <span className="block font-normal text-muted-foreground">{hint}</span> : null}</label>;
}
