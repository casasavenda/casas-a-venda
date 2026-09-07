import type { CreateHouse, House, UpdateHouse } from '@casas/schemas';
import { staticHouses } from '../data/houses';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333/api/v1').replace(/\/$/, '');
const isStaticSite = import.meta.env.VITE_STATIC_SITE === 'true';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `A API respondeu com ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listHouses: () => isStaticSite ? Promise.resolve(staticHouses.map(cloneHouse)) : request<House[]>('/houses'),
  getHouse: (slug: string) => isStaticSite
    ? Promise.resolve(staticHouses.find((house) => house.slug === slug)).then((house) => {
      if (!house) throw new Error('Casa não encontrada.');
      return cloneHouse(house);
    })
    : request<House>(`/houses/${encodeURIComponent(slug)}`),
  login: (password: string) => isStaticSite ? Promise.reject(new Error('O painel administrativo online ainda não está ativo no site estático.')) : request<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
  createHouse: (input: CreateHouse, token: string) => isStaticSite ? Promise.reject(new Error('Cadastros devem ser publicados pelo repositório nesta versão estática.')) : request<House>('/houses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }),
  updateHouse: (input: UpdateHouse, token: string) => isStaticSite ? Promise.reject(new Error('Alterações devem ser publicadas pelo repositório nesta versão estática.')) : request<House>(`/houses/${encodeURIComponent(input.id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }),
};

function cloneHouse(house: House): House {
  return { ...house, photos: house.photos.map((photo) => ({ ...photo })) };
}
