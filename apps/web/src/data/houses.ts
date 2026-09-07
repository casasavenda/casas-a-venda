import type { House } from '@casas/schemas';

const asset = (file: string) => `${import.meta.env.BASE_URL}fotos/${file}`;

export const staticHouses: House[] = [{
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
  coverUrl: asset('10.jpeg'),
  photos: [
    ['03.jpeg', 'Sala de estar'],
    ['06.jpeg', 'Sala de estar'],
    ['05.jpeg', 'Sala/cozinha'],
    ['04.jpeg', 'Cozinha'],
    ['07.jpeg', 'Quarto 1'],
    ['01.jpeg', 'Quarto 1'],
    ['08.jpeg', 'Quarto 2'],
    ['09.jpeg', 'Quarto 2'],
    ['02.jpeg', 'Banheiro'],
  ].map(([file, label]) => ({ file, url: asset(file), label })),
}];
