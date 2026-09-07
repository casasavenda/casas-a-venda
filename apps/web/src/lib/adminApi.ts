import type { CreateHouse, House, UpdateHouse } from '@casas/schemas';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333/api/v1').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `A API respondeu com ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  login: (password: string) => request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  createHouse: (input: CreateHouse, token: string) => request<House>('/houses', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) }),
  updateHouse: (input: UpdateHouse, token: string) => request<House>(`/houses/${encodeURIComponent(input.id)}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) }),
};
