import { z } from 'zod';

export const houseStatusSchema = z.enum(['ok', 'draft']);

export const photoSchema = z.object({
  id: z.string().min(1).optional(),
  file: z.string().min(1).optional(),
  url: z.string().min(1),
  label: z.string().trim().min(1).default('Ambiente não informado'),
});

export const houseSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  addr: z.string().trim().min(1),
  area: z.string().trim().default(''),
  rooms: z.string().trim().default(''),
  highlight: z.string().trim().default(''),
  description: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido'),
  status: houseStatusSchema,
  coverUrl: z.string().trim().default(''),
  photos: z.array(photoSchema).default([]),
});

export const createHouseSchema = houseSchema.omit({ id: true });

export const updateHouseSchema = createHouseSchema.partial().extend({
  id: z.string().min(1),
});

export const houseListSchema = z.array(houseSchema);

export const listHousesQuerySchema = z.object({
  status: houseStatusSchema.optional(),
});

export const loginSchema = z.object({
  password: z.string().min(1, 'Informe a senha'),
});

export const loginResponseSchema = z.object({
  token: z.string().min(1),
});

export type House = z.infer<typeof houseSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type CreateHouse = z.infer<typeof createHouseSchema>;
export type UpdateHouse = z.infer<typeof updateHouseSchema>;
