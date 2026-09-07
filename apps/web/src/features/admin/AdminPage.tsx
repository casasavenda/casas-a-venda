import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Eye, LogOut, Plus, Settings2 } from 'lucide-react';
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
import { api } from '../../lib/api';
import { HouseForm } from './HouseForm';

const tokenKey = 'casas-a-venda.admin-token';

export function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  return token ? <AdminDashboard token={token} onLogout={() => { localStorage.removeItem(tokenKey); setToken(null); }} /> : <Login onSuccess={(nextToken) => { localStorage.setItem(tokenKey, nextToken); setToken(nextToken); }} />;
}

function Login({ onSuccess }: { onSuccess: (token: string) => void }) {
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({ mutationFn: (values: z.infer<typeof loginSchema>) => api.login(values.password), onSuccess: (result) => onSuccess(result.token) });
  return <main className="grid min-h-screen place-items-center bg-surface px-5 text-foreground"><Card className="w-full max-w-sm"><CardContent className="p-6"><div className="mb-6 flex items-center gap-3"><BrandMark /><div><p className="eyebrow text-primary">CASAS À VENDA</p><h1 className="font-serif text-2xl font-semibold">Painel administrativo</h1></div></div><form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><label className="block space-y-1.5 text-xs font-semibold">Senha<Input autoFocus type="password" placeholder="Digite a senha" {...form.register('password')} />{form.formState.errors.password && <span className="font-normal text-red-300">{form.formState.errors.password.message}</span>}</label>{mutation.error && <p className="text-sm text-red-300">{mutation.error.message}</p>}<Button className="w-full" variant="primary" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Entrando...' : 'Entrar'}</Button></form><p className="mt-4 text-xs leading-5 text-muted-foreground">Em desenvolvimento, a senha vem de <code>ADMIN_PASSWORD</code>. Troque-a antes de publicar.</p></CardContent></Card></main>;
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [editing, setEditing] = useState<House | 'new' | null>(null);
  const { data: houses = [], isPending, error } = useQuery({ queryKey: ['houses'], queryFn: api.listHouses });
  const save = useMutation({ mutationFn: async (input: z.infer<typeof createHouseSchema> & { id?: string }) => {
    if (input.id) return api.updateHouse({ ...input, id: input.id }, token);
    return api.createHouse(input, token);
  }, onSuccess: () => { client.invalidateQueries({ queryKey: ['houses'] }); setEditing(null); } });

  async function copyLink(house: House) {
    const link = `${window.location.origin}/casas/${house.slug}`;
    await navigator.clipboard?.writeText(link);
  }

  return <main className="min-h-screen bg-surface text-foreground"><header className="flex items-center gap-3 border-b border-border bg-background px-5 py-3"><BrandMark /><h1 className="font-serif text-xl font-semibold">Painel de casas</h1><Button className="ml-auto" variant="ghost" onClick={onLogout}><LogOut size={15} />Sair</Button></header><div className="mx-auto max-w-4xl px-5 py-7"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="eyebrow text-primary">CATÁLOGO</p><h2 className="font-serif text-3xl font-semibold">Casas cadastradas</h2></div><Button variant="primary" onClick={() => setEditing('new')}><Plus size={16} />Nova casa</Button></div>{error && <p className="mb-4 rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{error.message}</p>}{isPending ? <p className="text-sm text-muted-foreground">Carregando casas...</p> : houses.length ? <div className="space-y-3">{houses.map((house) => <Card key={house.id}><CardContent className="flex flex-wrap items-center gap-4"><div className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Settings2 size={23} /></div><div className="min-w-0 flex-1"><strong className="block truncate">{house.title}</strong><span className="block truncate text-sm text-muted-foreground">{house.addr}</span><span className="mt-1 block font-mono text-xs text-muted-foreground">/casas/{house.slug}</span></div><Badge tone={house.status === 'ok' ? 'success' : 'warning'}>{house.status === 'ok' ? 'Publicada' : 'Rascunho'}</Badge><div className="flex gap-2"><button className="icon-button" aria-label={`Pré-visualizar ${house.title}`} onClick={() => navigate(`/casas/${house.slug}`)}><Eye size={16} /></button><button className="icon-button" aria-label={`Copiar link de ${house.title}`} onClick={() => copyLink(house)}><Copy size={16} /></button><button className="icon-button" aria-label={`Editar ${house.title}`} onClick={() => setEditing(house)}><Settings2 size={16} /></button></div></CardContent></Card>)}</div> : <Card><CardContent>Nenhuma casa cadastrada.</CardContent></Card>}</div>{editing && <HouseForm house={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSubmit={async (input) => { await save.mutateAsync(input); }} />}</main>;
}
