import { Box, ImagePlus, Pencil, Star, Trash2, Upload } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { UploadedModel, UploadedPhoto } from '../../lib/adminApi';
import { BrandMark } from '../../components/BrandMark';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ShowroomEmbed } from '../gallery/ShowroomEmbed';

export type DraftPhoto = { url: string; label: string };
export type EditableGalleryField = 'title' | 'addr' | 'area' | 'rooms' | 'highlight' | 'description';

type GalleryTemplatePreviewProps = {
  immersive?: boolean;
  title: string;
  addr: string;
  area: string;
  rooms: string;
  highlight: string;
  description: string;
  coverUrl: string;
  model3dUrl: string;
  model3dTitle: string;
  model3dDescription: string;
  photos: DraftPhoto[];
  onInfoChange: (field: EditableGalleryField, value: string) => void;
  onCoverChange: (url: string) => void;
  onLabelChange: (index: number, label: string) => void;
  onRemove: (index: number) => void;
  onUpload: (files: File[]) => Promise<UploadedPhoto[]>;
  onUploaded: (photos: UploadedPhoto[]) => void;
  onModelInfoChange: (field: 'model3dTitle' | 'model3dDescription', value: string) => void;
  onModelUpload: (file: File) => Promise<UploadedModel>;
  onModelRemove: () => Promise<void>;
  onModelChange: (model: UploadedModel | null) => void;
};

export function GalleryTemplatePreview({
  immersive = false,
  title,
  addr,
  area,
  rooms,
  highlight,
  description,
  coverUrl,
  model3dUrl,
  model3dTitle,
  model3dDescription,
  photos,
  onInfoChange,
  onCoverChange,
  onLabelChange,
  onRemove,
  onUpload,
  onUploaded,
  onModelInfoChange,
  onModelUpload,
  onModelRemove,
  onModelChange,
}: GalleryTemplatePreviewProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState('');
  const [uploadMode, setUploadMode] = useState<'gallery' | 'cover'>('gallery');
  const uploadInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);
  const cover = coverUrl || photos[0]?.url;

  function openUpload(mode: 'gallery' | 'cover') {
    setUploadMode(mode);
    uploadInput.current?.click();
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await onUpload(files);
      onUploaded(uploaded);
      if (uploadMode === 'cover' && uploaded[0]) onCoverChange(uploaded[0].url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível enviar as fotos.');
    } finally {
      setUploading(false);
    }
  }

  async function handleModelUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setModelBusy(true);
    setModelError('');
    try {
      onModelChange(await onModelUpload(file));
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Não foi possível enviar o modelo 3D.');
    } finally {
      setModelBusy(false);
    }
  }

  async function handleModelRemove() {
    setModelBusy(true);
    setModelError('');
    try {
      await onModelRemove();
      onModelChange(null);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Não foi possível remover o modelo 3D.');
    } finally {
      setModelBusy(false);
    }
  }

  return (
    <section className={`admin-gallery-preview ${immersive ? 'immersive' : 'space-y-3'}`}>
      {!immersive && <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-primary">MODELO DA GALERIA</p><h3 className="font-serif text-2xl font-semibold">Prévia ao vivo</h3></div><p className="max-w-xs text-right text-xs leading-5 text-muted-foreground">Clique nos textos para editar. Clique na capa ou em qualquer cartão para trocar a foto principal.</p></div>}
      <div className={immersive ? 'admin-preview-site' : 'overflow-hidden rounded-xl border border-border bg-background shadow-xl'}>
        {immersive && <header className="admin-preview-site-header"><div className="flex min-w-0 items-center gap-2.5"><BrandMark /><strong className="truncate text-sm">{title || 'Casa à venda'}</strong></div><span className="eyebrow text-primary">PRÉVIA EDITÁVEL</span></header>}
        <section className="admin-preview-hero">
          {cover ? <img className="admin-preview-hero-image" src={cover} alt="Prévia da capa" /> : <div className="admin-preview-empty"><ImagePlus size={30} /><span>Adicione uma foto de capa</span></div>}
          <button type="button" className="admin-preview-cover-action" onClick={() => openUpload('cover')} disabled={uploading}><Pencil size={14} />Trocar capa</button>
          <div className="admin-preview-hero-content">
            <Badge className="mb-3 border border-white/25 bg-white/15 text-white">Casa disponível</Badge>
            <InlineEdit value={title} placeholder="Título da casa" className="admin-inline-title" onChange={(value) => onInfoChange('title', value)} />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/90">
              <InlineEdit value={addr} placeholder="Endereço" className="admin-inline-meta" onChange={(value) => onInfoChange('addr', value)} />
              <InlineEdit value={rooms} placeholder="Quartos" className="admin-inline-meta" onChange={(value) => onInfoChange('rooms', value)} />
              <InlineEdit value={area} placeholder="Área" className="admin-inline-meta" onChange={(value) => onInfoChange('area', value)} />
              <InlineEdit value={highlight} placeholder="Destaque" className="admin-inline-meta" onChange={(value) => onInfoChange('highlight', value)} />
            </div>
            <Button type="button" variant="primary" className="mt-4 w-fit">Ver fotos</Button>
          </div>
        </section>
        <section className="space-y-3 p-4 sm:p-5"><InlineEdit value={description} placeholder="Clique para escrever a descrição da casa." multiline className="admin-inline-description" onChange={(value) => onInfoChange('description', value)} /><p className="border-t border-border pt-3 text-xs font-semibold text-primary">Imagens meramente ilustrativas. Consulte as condições e o padrão de acabamento proposto.</p></section>
        {model3dUrl ? <ShowroomEmbed title={title || 'casa'} modelUrl={model3dUrl} modelTitle={model3dTitle} modelDescription={model3dDescription} modelTitleContent={<InlineEdit value={model3dTitle} placeholder="Título do modelo 3D" className="admin-inline-model-title" onChange={(value) => onModelInfoChange('model3dTitle', value)} />} modelDescriptionContent={<InlineEdit value={model3dDescription} placeholder="Descrição do modelo 3D" multiline className="admin-inline-model-description" onChange={(value) => onModelInfoChange('model3dDescription', value)} />} /> : <section className="admin-model-editor"><div className="admin-model-copy"><span className="eyebrow text-primary">MODELO 3D</span><InlineEdit value={model3dTitle} placeholder="Título do modelo 3D" className="admin-inline-model-title" onChange={(value) => onModelInfoChange('model3dTitle', value)} /><InlineEdit value={model3dDescription} placeholder="Descrição do modelo 3D" multiline className="admin-inline-model-description" onChange={(value) => onModelInfoChange('model3dDescription', value)} /></div><div className="admin-model-empty"><Box size={38} className="text-primary" /><strong>Nenhum modelo 3D anexado</strong><span>Anexe um arquivo GLB para exibir o showroom nesta casa.</span></div></section>}
        <div className="admin-model-actions"><input ref={modelInput} className="sr-only" type="file" accept=".glb,model/gltf-binary,application/octet-stream" onChange={handleModelUpload} disabled={modelBusy} /><button type="button" className="button-base" onClick={() => modelInput.current?.click()} disabled={modelBusy}><Upload size={15} />{modelBusy ? 'Processando...' : model3dUrl ? 'Trocar modelo 3D' : 'Anexar modelo 3D'}</button>{model3dUrl && <button type="button" className="button-base admin-danger-button" onClick={handleModelRemove} disabled={modelBusy}><Trash2 size={15} />Excluir modelo</button>}<span className="truncate text-xs text-muted-foreground">{model3dUrl || 'Nenhum arquivo GLB selecionado'}</span></div>
        {modelError && <p className="px-4 text-xs text-red-300 sm:px-5">{modelError}</p>}
        <section className="space-y-3 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3"><div><h4 className="font-serif text-xl font-semibold">Galeria de fotos</h4><p className="mt-1 text-xs text-muted-foreground">{photos.length} fotos cadastradas</p></div><button type="button" className="button-base" onClick={() => openUpload('gallery')} disabled={uploading}><ImagePlus size={15} />Adicionar fotos</button></div>
          <input ref={uploadInput} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleUpload} disabled={uploading} />
          {uploading && <p className="text-xs text-primary">{<Upload size={13} className="mr-1 inline" />}Enviando imagens...</p>}
          {uploadError && <p className="text-xs text-red-300">{uploadError}</p>}
          {photos.length ? <div className="admin-preview-photo-grid">{photos.map((photo, index) => <article className={`admin-preview-photo ${cover === photo.url ? 'selected' : ''}`} key={`${photo.url}-${index}`}><button type="button" className="admin-preview-photo-image" onClick={() => onCoverChange(photo.url)} aria-label={`Usar ${photo.label || 'foto'} como capa`}>{photo.url ? <img src={photo.url} alt={photo.label} /> : <ImagePlus size={22} />}{cover === photo.url && <span className="admin-cover-badge"><Star size={12} />Capa</span>}</button><div className="flex items-center gap-1.5 p-2"><Input value={photo.label} onChange={(event) => onLabelChange(index, event.target.value)} aria-label={`Nome do cômodo da foto ${index + 1}`} placeholder="Nome do cômodo" /><button type="button" className="icon-button shrink-0" onClick={() => onRemove(index)} aria-label={`Remover foto ${photo.label}`}><Trash2 size={14} /></button></div></article>)}</div> : <button type="button" className="admin-upload-empty" onClick={() => openUpload('gallery')}><ImagePlus size={24} /><span>Clique aqui para anexar as fotos da casa</span><small>JPG, PNG ou WebP · até 10 MB por imagem</small></button>}
        </section>
      </div>
    </section>
  );
}

function InlineEdit({ value, placeholder, className, multiline = false, onChange }: { value: string; placeholder: string; className: string; multiline?: boolean; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function finishEditing() {
    onChange(draft);
    setEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!multiline && event.key === 'Enter') {
      event.preventDefault();
      finishEditing();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
    }
  }

  if (editing) {
    const commonProps = { autoFocus: true, value: draft, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value), onBlur: finishEditing, onKeyDown: handleKeyDown, placeholder, 'aria-label': `Editar ${placeholder.toLowerCase()}` };
    return multiline ? <textarea className={`field-control ${className}`} {...commonProps} /> : <input className={`field-control ${className}`} {...commonProps} />;
  }

  return <button type="button" className={`admin-inline-trigger ${className}`} onClick={startEditing} aria-label={`Editar ${placeholder.toLowerCase()}`}><span>{value || placeholder}</span><Pencil size={12} /></button>;
}
