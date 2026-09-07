import type { House } from '@casas/schemas';
import records from './houses.json';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

function publicAsset(value: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return asset(value);
}

export const staticHouses: House[] = (records as House[]).map((house) => ({
  ...house,
  coverUrl: publicAsset(house.coverUrl),
  model3dUrl: publicAsset(house.model3dUrl),
  photos: house.photos.map((photo) => ({ ...photo, url: publicAsset(photo.url) })),
}));
