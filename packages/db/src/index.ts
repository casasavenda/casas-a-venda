import type { CreateHouse, House, UpdateHouse } from '@casas/schemas';

export interface HouseRepository {
  list(status?: House['status']): Promise<House[]>;
  findBySlug(slug: string): Promise<House | null>;
  findById(id: string): Promise<House | null>;
  create(input: CreateHouse): Promise<House>;
  update(id: string, input: Omit<UpdateHouse, 'id'>): Promise<House | null>;
}

const fotosFeitoria = [
  ['03.jpeg', 'Sala de estar'],
  ['06.jpeg', 'Sala de estar'],
  ['05.jpeg', 'Sala/cozinha'],
  ['04.jpeg', 'Cozinha'],
  ['07.jpeg', 'Quarto 1'],
  ['01.jpeg', 'Quarto 1'],
  ['08.jpeg', 'Quarto 2'],
  ['09.jpeg', 'Quarto 2'],
  ['02.jpeg', 'Banheiro'],
].map(([file, label]) => ({ file, url: `/fotos/${file}`, label }));

const casaFeitoria: House = {
  id: 'casa-feitoria',
  title: 'Casa Feitoria',
  addr: 'Feitoria, São Leopoldo/RS',
  area: '69,81 m²',
  rooms: '2 quartos',
  highlight: 'Quiosque privativo com churrasqueira',
  description: 'Casa térrea, 2 quartos, cozinha integrada e quiosque privativo com churrasqueira. As imagens desta galeria são meramente ilustrativas e representam apenas o padrão de acabamento proposto. A casa é entregue sem móveis.',
  phone: '5551982472740',
  status: 'ok',
  slug: 'casa-feitoria',
  photos: fotosFeitoria,
};

function cloneHouse(house: House): House {
  return { ...house, photos: house.photos.map((photo) => ({ ...photo })) };
}

/**
 * Adaptador temporário de persistência. A API fala com esta interface, então
 * trocar o Map por PostgreSQL/Drizzle não exige alterar os contratos HTTP.
 */
export function createDatabase(seed: House[] = [casaFeitoria]): HouseRepository {
  const houses = new Map(seed.map((house) => [house.id, cloneHouse(house)]));

  return {
    async list(status) {
      return [...houses.values()]
        .filter((house) => !status || house.status === status)
        .map(cloneHouse);
    },
    async findBySlug(slug) {
      const house = [...houses.values()].find((item) => item.slug === slug);
      return house ? cloneHouse(house) : null;
    },
    async findById(id) {
      const house = houses.get(id);
      return house ? cloneHouse(house) : null;
    },
    async create(input) {
      const house = { ...input, id: `house-${Date.now()}` };
      houses.set(house.id, cloneHouse(house));
      return cloneHouse(house);
    },
    async update(id, input) {
      const current = houses.get(id);
      if (!current) return null;
      const updated = { ...current, ...input, id };
      houses.set(id, cloneHouse(updated));
      return cloneHouse(updated);
    },
  };
}

export { casaFeitoria };
