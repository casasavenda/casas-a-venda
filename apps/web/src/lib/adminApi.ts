import type { CreateHouse, House, UpdateHouse } from '@casas/schemas';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333/api/v1').replace(/\/$/, '');

export type UploadedPhoto = { file: string; url: string; label: string };
export type UploadedModel = { file: string; url: string };
export type PublishResult = { published: boolean; message: string };

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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Não foi possível ler a imagem “${file.name}”.`));
    reader.readAsDataURL(file);
  });
}

export const adminApi = {
  listHouses: () => request<House[]>('/houses'),
  login: (password: string) => request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  createHouse: (input: CreateHouse, token: string) => request<House>('/houses', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) }),
  updateHouse: (input: UpdateHouse, token: string) => request<House>(`/houses/${encodeURIComponent(input.id)}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) }),
  publish: (houseId: string, token: string) => request<PublishResult>('/admin/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ houseId }),
  }),
  uploadPhotos: async (files: File[], token: string) => request<{ files: UploadedPhoto[] }>('/admin/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ files: await Promise.all(files.map(async (file) => ({ name: file.name, data: await fileToDataUrl(file) }))) }),
  }),
  uploadModel: async (file: File, token: string) => request<UploadedModel>('/admin/model3d', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ file: { name: file.name, data: await fileToDataUrl(file) } }),
  }),
  deleteModel: (url: string, token: string) => request<{ deleted: boolean }>('/admin/model3d', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  }),
};
