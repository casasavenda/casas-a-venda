import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Settings2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { createHouseSchema, type House } from '@casas/schemas';
import type { UploadedModel, UploadedPhoto } from '../../lib/adminApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { GalleryTemplatePreview, type EditableGalleryField } from './GalleryTemplatePreview';

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
  coverUrl: z.string(),
  model3dUrl: z.string(),
  model3dTitle: z.string(),
  model3dDescription: z.string(),
  photosText: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

function photosFromText(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, label] = line.split('|').map((part) => part.trim());
      return { url, label: label || 'Ambiente não informado' };
    })
    .filter((photo) => photo.url);
}

function readableFileName(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) || 'Ambiente';
}

type HouseFormProps = {
  house?: House;
  onClose: () => void;
  onSubmit: (values: z.infer<typeof createHouseSchema> & { id?: string }) => Promise<void>;
  onUpload: (files: File[]) => Promise<UploadedPhoto[]>;
  onUploadModel: (file: File) => Promise<UploadedModel>;
  onDeleteModel: (url: string) => Promise<void>;
  submitError?: string;
};

export function HouseForm({ house, onClose, onSubmit, onUpload, onUploadModel, onDeleteModel, submitError }: HouseFormProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [validationError, setValidationError] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: house?.title || '',
      addr: house?.addr || '',
      area: house?.area || '',
      rooms: house?.rooms || '',
      highlight: house?.highlight || '',
      description: house?.description || '',
      phone: house?.phone || '',
      slug: house?.slug || '',
      status: house?.status || 'draft',
      coverUrl: house?.coverUrl || '',
      model3dUrl: house?.model3dUrl || '',
      model3dTitle: house?.model3dTitle || 'Explore a casa',
      model3dDescription: house?.model3dDescription || 'Gire o modelo, aproxime e veja a fachada e a implantação da casa em outra escala.',
      photosText: house?.photos.map((photo) => `${photo.url} | ${photo.label}`).join('\n') || '',
    },
  });
  const values = form.watch();
  const previewPhotos = photosFromText(values.photosText);

  function updatePhotos(nextPhotos: Array<{ url: string; label: string }>) {
    form.setValue('photosText', nextPhotos.map((photo) => `${photo.url} | ${photo.label}`).join('\n'), { shouldDirty: true });
  }

  function appendUploaded(uploaded: UploadedPhoto[]) {
    const current = photosFromText(form.getValues('photosText'));
    const next = [...uploaded.map((photo) => ({ url: photo.url, label: readableFileName(photo.label || photo.file) })), ...current];
    updatePhotos(next);
    if (!form.getValues('coverUrl') && uploaded[0]) {
      form.setValue('coverUrl', uploaded[0].url, { shouldDirty: true });
    }
  }

  function updatePhotoLabel(index: number, label: string) {
    const next = previewPhotos.map((photo) => ({ ...photo }));
    if (!next[index]) return;
    next[index] = { ...next[index], label };
    updatePhotos(next);
  }

  function removePhoto(index: number) {
    const next = previewPhotos.map((photo) => ({ ...photo }));
    const [removed] = next.splice(index, 1);
    updatePhotos(next);
    if (removed?.url === form.getValues('coverUrl')) {
      form.setValue('coverUrl', next[0]?.url || '', { shouldDirty: true });
    }
  }

  function updateInfo(field: EditableGalleryField, value: string) {
    form.setValue(field, value, { shouldDirty: true, shouldValidate: field === 'title' || field === 'addr' });
  }

  function updateModelInfo(field: 'model3dTitle' | 'model3dDescription', value: string) {
    form.setValue(field, value, { shouldDirty: true });
  }

  function updateModel(model: UploadedModel | null) {
    form.setValue('model3dUrl', model?.url || '', { shouldDirty: true });
  }

  async function deleteModel() {
    const currentUrl = form.getValues('model3dUrl');
    if (currentUrl) await onDeleteModel(currentUrl);
  }

  const submit = form.handleSubmit(async (currentValues) => {
    setValidationError('');
    const parsed = createHouseSchema.safeParse({
      ...currentValues,
      photosText: undefined,
      photos: photosFromText(currentValues.photosText),
      phone: currentValues.phone.replace(/\D/g, ''),
      slug: currentValues.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      coverUrl: currentValues.coverUrl.trim(),
    });
    if (!parsed.success) {
      setShowSettings(true);
      setValidationError(parsed.error.issues[0]?.message || 'Confira os dados obrigatórios da casa.');
      return;
    }
    await onSubmit(house ? { ...parsed.data, id: house.id } : parsed.data);
  }, () => {
    setShowSettings(true);
    setValidationError('Preencha os campos obrigatórios antes de salvar a casa.');
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <aside className="drawer-panel admin-editor-panel">
        <div className="flex items-center border-b border-border bg-background p-5">
          <div><p className="eyebrow text-primary">EDITOR VISUAL</p><h2 className="font-serif text-xl font-semibold">{house ? 'Editar casa' : 'Montar nova casa'}</h2></div>
          <div className="ml-auto flex gap-2"><Button type="button" variant="ghost" onClick={() => setShowSettings((current) => !current)} aria-pressed={showSettings}><Settings2 size={15} />{showSettings ? 'Ocultar ajustes' : 'Mostrar ajustes'}</Button><button className="icon-button" onClick={onClose} aria-label="Fechar" type="button"><X size={17} /></button></div>
        </div>
        {(validationError || submitError) && <div className="border-b border-red-900 bg-red-950/40 px-5 py-3 text-sm text-red-200">{validationError || submitError}</div>}
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className={`admin-editor-grid min-h-0 flex-1 overflow-y-auto ${showSettings ? '' : 'without-settings'}`}>
            {showSettings && <div className="admin-editor-fields space-y-4 p-5">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm leading-6"><strong>Como vai funcionar</strong><p className="mt-1 text-xs text-muted-foreground">Preencha os dados à esquerda e monte a galeria clicando em <strong className="text-foreground">Adicionar fotos</strong> na prévia. O resultado será publicado no mesmo layout do site.</p></div>
              <Field label="Título da casa" error={form.formState.errors.title?.message}><Input {...form.register('title')} placeholder="Ex: Casa Recanto do Bosque" /></Field>
              <Field label="Endereço / bairro / cidade" error={form.formState.errors.addr?.message}><Input {...form.register('addr')} placeholder="Ex: Feitoria, São Leopoldo/RS" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Área"><Input {...form.register('area')} placeholder="69,81 m²" /></Field><Field label="Quartos"><Input {...form.register('rooms')} placeholder="2 quartos" /></Field></div>
              <Field label="Destaque principal"><Input {...form.register('highlight')} placeholder="Quiosque privativo" /></Field>
              <Field label="Descrição"><Textarea {...form.register('description')} placeholder="Metragem, quartos, diferenciais..." /></Field>
              <Field label="WhatsApp"><Input {...form.register('phone')} placeholder="(51) 98247-2740" /></Field>
              <Field label="Identificador do endereço" hint="Mantenha este valor para preservar o QR Code." error={form.formState.errors.slug?.message}><Input {...form.register('slug')} placeholder="casa-feitoria" /></Field>
              <Field label="Status" hint="Rascunho não aparece no catálogo público."><select className="field-control" {...form.register('status')}><option value="ok">Publicada</option><option value="draft">Rascunho</option></select></Field>
              <div className="rounded-lg border border-border p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Foto de capa</strong><p>Clique em qualquer foto na prévia para escolhê-la como imagem inicial. A foto selecionada fica marcada com “Capa”.</p><p className="mt-1 truncate font-mono text-[11px]">{values.coverUrl || 'Nenhuma foto selecionada'}</p></div>
              <input type="hidden" {...form.register('coverUrl')} />
              <input type="hidden" {...form.register('model3dUrl')} />
              <input type="hidden" {...form.register('model3dTitle')} />
              <input type="hidden" {...form.register('model3dDescription')} />
              <input type="hidden" {...form.register('photosText')} />
            </div>}
            <div className={`admin-editor-preview ${showSettings ? 'p-5' : 'p-0'}`}><GalleryTemplatePreview immersive={!showSettings} title={values.title} addr={values.addr} area={values.area} rooms={values.rooms} highlight={values.highlight} description={values.description} coverUrl={values.coverUrl} model3dUrl={values.model3dUrl} model3dTitle={values.model3dTitle} model3dDescription={values.model3dDescription} photos={previewPhotos} onInfoChange={updateInfo} onCoverChange={(url) => form.setValue('coverUrl', url, { shouldDirty: true })} onLabelChange={updatePhotoLabel} onRemove={removePhoto} onUpload={onUpload} onUploaded={appendUploaded} onModelInfoChange={updateModelInfo} onModelUpload={onUploadModel} onModelRemove={deleteModel} onModelChange={updateModel} /></div>
          </div>
          <div className="flex gap-2 border-t border-border bg-background p-4"><Button type="button" className="flex-1" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" className="flex-1"><Save size={16} />Salvar casa</Button></div>
        </form>
      </aside>
    </>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-semibold">{label}{children}{error ? <span className="block font-normal text-red-300">{error}</span> : hint ? <span className="block font-normal text-muted-foreground">{hint}</span> : null}</label>;
}
