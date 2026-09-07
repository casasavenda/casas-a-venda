import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Eye, ExternalLink, LogOut, Plus, Rocket, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { createHouseSchema, loginSchema, type House } from '@casas/schemas';
import { BrandMark } from '../../components/BrandMark';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { adminApi } from '../../lib/adminApi';
import { HouseForm } from './HouseForm';

const tokenKey = 'casas-a-venda.admin-token';
const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://casasavenda.github.io/casas-a-venda').replace(/\/+$/, '');

export function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  return token
    ? <AdminDashboard token={token} onLogout={() => { localStorage.removeItem(tokenKey); setToken(null); }} />
    : <Login onSuccess={(nextToken) => { localStorage.setItem(tokenKey, nextToken); setToken(nextToken); }} />;
}

function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) => adminApi.login(values.password),
    onSuccess: (result) => onSuccess(result.token),
  });

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-5 text-foreground">
      <Card className="w-full max-w-sm"><CardContent className="p-6">
        <div className="mb-6 flex items-center gap-3"><BrandMark /><div><p className="eyebrow text-primary">CASAS À VENDA</p><h1 className="font-serif text-2xl font-semibold">Painel administrativo</h1></div></div>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <label className="block space-y-1.5 text-xs font-semibold">Senha<Input autoFocus type="password" placeholder="Digite a senha" {...form.register('password')} />{form.formState.errors.password && <span className="font-normal text-red-300">{form.formState.errors.password.message}</span>}</label>
          {mutation.error && <p className="text-sm text-red-300">{mutation.error.message}</p>}
          <Button className="w-full" variant="primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Entrando...' : 'Entrar'}</Button>
        </form>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Este painel funciona somente no computador local. A senha vem de <code>ADMIN_PASSWORD</code> no arquivo da API.</p>
      </CardContent></Card>
    </main>
  );
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [editing, setEditing] = useState<House | 'new' | null>(null);
  const { data: houses = [], isPending, error } = useQuery({ queryKey: ['admin-houses'], queryFn: adminApi.listHouses });
  const save = useMutation({
    mutationFn: async (input: z.infer<typeof createHouseSchema> & { id?: string }) => input.id
      ? adminApi.updateHouse({ ...input, id: input.id }, token)
      : adminApi.createHouse(input, token),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-houses'] });
      client.invalidateQueries({ queryKey: ['houses'] });
      setEditing(null);
    },
  });
  const publish = useMutation({
    mutationFn: (house: House) => adminApi.publish(house.id, token),
    onMutate: (house) => {
      setPublishingHouseId(house.id);
      setPublishMessage('');
    },
    onSuccess: (result, house) => setPublishMessage(`${house.title}: ${result.message}`),
    onSettled: () => setPublishingHouseId(null),
  });
  const [publishMessage, setPublishMessage] = useState('');
  const [publishingHouseId, setPublishingHouseId] = useState<string | null>(null);

  function publicHouseLink(house: Pick<House, 'slug'>) {
    return `${publicSiteUrl}/#/casas/${house.slug}`;
  }

  async function copyLink(house: House) {
    const link = publicHouseLink(house);
    await navigator.clipboard?.writeText(link);
  }

  function handlePublish(house: House) {
    if (editing) {
      setPublishMessage(`Salve “${house.title}” antes de publicar.`);
      return;
    }
    publish.mutate(house);
  }

  return (
    <main className="min-h-screen bg-surface text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-5 py-3">
        <BrandMark /><h1 className="font-serif text-xl font-semibold">Painel de casas</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onLogout}><LogOut size={15} />Sair</Button>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-primary">CATÁLOGO LOCAL</p><h2 className="font-serif text-3xl font-semibold">Casas cadastradas</h2><p className="mt-1 text-sm text-muted-foreground">Edite, salve e publique quando estiver pronto.</p></div><Button variant="primary" onClick={() => setEditing('new')}><Plus size={16} />Nova casa</Button></div>
        {publishMessage && <p className="mb-4 rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">{publishMessage}</p>}
        {publish.error && <p className="mb-4 whitespace-pre-wrap rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{publish.error.message}</p>}
        {save.error && <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{save.error.message}</p>}
        {error && <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{error.message}</p>}
        {isPending ? <p className="text-sm text-muted-foreground">Carregando casas...</p> : houses.length ? <div className="space-y-3">{houses.map((house) => <Card key={house.id}><CardContent className="flex flex-wrap items-center gap-4"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">{house.coverUrl ? <img src={house.coverUrl} alt="" className="size-full object-cover" /> : <Settings2 size={23} />}</div><div className="min-w-0 flex-1"><strong className="block truncate">{house.title}</strong><span className="block truncate text-sm text-muted-foreground">{house.addr}</span><span className="mt-1 block font-mono text-xs text-muted-foreground">/casas/{house.slug}</span></div><Badge tone={house.status === 'ok' ? 'success' : 'warning'}>{house.status === 'ok' ? 'Publicada' : 'Rascunho'}</Badge><Button variant="outline" className="text-xs" onClick={() => handlePublish(house)} disabled={publish.isPending}><Rocket size={14} />{publishingHouseId === house.id ? 'Publicando...' : 'Publicar esta casa'}</Button><div className="flex gap-2"><button className="icon-button" aria-label={`Pré-visualizar ${house.title}`} onClick={() => navigate(`/casas/${house.slug}`)}><Eye size={16} /></button><a className="icon-button" href={publicHouseLink(house)} target="_blank" rel="noreferrer" aria-label={`Abrir site público de ${house.title}`}><ExternalLink size={16} /></a><button className="icon-button" aria-label={`Copiar link público de ${house.title}`} onClick={() => copyLink(house)}><Copy size={16} /></button><button className="icon-button" aria-label={`Editar ${house.title}`} onClick={() => setEditing(house)}><Settings2 size={16} /></button></div></CardContent></Card>)}</div> : <Card><CardContent>Nenhuma casa cadastrada.</CardContent></Card>}
      </div>
      {editing && <HouseForm house={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onUpload={async (files) => (await adminApi.uploadPhotos(files, token)).files} onUploadModel={(file) => adminApi.uploadModel(file, token)} onDeleteModel={async (url) => { await adminApi.deleteModel(url, token); }} submitError={save.error?.message} onSubmit={async (input) => { await save.mutateAsync(input); }} />}
    </main>
  );
}
