export const CATALOGO = {
  wall: [
    { id: 'wall-white', name: 'Branco Neve', color: '#f7f4ee' },
    { id: 'wall-sand', name: 'Areia', color: '#d9c7a9' },
    { id: 'wall-gray', name: 'Cinza Claro', color: '#c9c9c3' },
    { id: 'wall-terracotta', name: 'Terracota Suave', color: '#c8876c' },
    { id: 'wall-sage', name: 'Verde Sálvia', color: '#aebb9e' },
    { id: 'wall-blue', name: 'Azul Sereno', color: '#a7c2ca' },
  ],
  floor: [
    { id: 'floor-white', name: 'Porcelanato Branco', color: '#dedbd2', texture: 'tile' },
    { id: 'floor-concrete', name: 'Cimento Queimado', color: '#9f9b94', texture: 'concrete' },
    { id: 'floor-light-wood', name: 'Madeira Clara', color: '#cda77a', texture: 'wood' },
    { id: 'floor-dark-wood', name: 'Madeira Escura', color: '#79543e', texture: 'wood' },
    { id: 'floor-beige', name: 'Cerâmica Bege', color: '#c9ad85', texture: 'tile' },
  ],
  ceiling: [
    { id: 'ceiling-white', name: 'Branco', color: '#fbfaf7' },
    { id: 'ceiling-plaster', name: 'Branco Gesso', color: '#f1eee7' },
    { id: 'ceiling-wood', name: 'Madeira Clara', color: '#cda77a', texture: 'wood' },
  ],
};

export function catalogoPara(tipo) { return CATALOGO[tipo] || []; }
