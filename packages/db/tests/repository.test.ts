import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src';

describe('repositório de casas', () => {
  it('lista a casa inicial e clona os dados', async () => {
    const db = createDatabase();
    const houses = await db.list('ok');

    expect(houses).toHaveLength(1);
    houses[0].photos[0].label = 'alterado';
    expect((await db.findBySlug('casa-feitoria'))?.photos[0].label).toBe('Sala de estar');
  });

  it('cria e atualiza uma casa sem expor mutações internas', async () => {
    const db = createDatabase([]);
    const created = await db.create({
      title: 'Casa Teste',
      addr: 'Centro',
      area: '',
      rooms: '',
      highlight: '',
      description: '',
      phone: '',
      slug: 'casa-teste',
      status: 'draft',
      coverUrl: '',
      model3dUrl: '',
      model3dTitle: 'Explore a casa',
      model3dDescription: '',
      photos: [],
    });
    const updated = await db.update(created.id, { status: 'ok' });

    expect(updated).toMatchObject({ id: created.id, status: 'ok' });
    expect(await db.findBySlug('casa-teste')).toMatchObject({ title: 'Casa Teste' });
  });
});
