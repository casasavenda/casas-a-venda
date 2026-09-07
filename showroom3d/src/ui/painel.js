import { acabamentosDoObjeto, aplicarAcabamento, restaurarAcabamento } from '../acabamentos/aplicar.js';

const formatar = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function metros(valor) { return `${formatar.format(valor ?? 0)} m`; }
function area(valor) { return `${formatar.format(valor ?? 0)} m²`; }
function tituloDoObjeto(objeto) {
  if (!objeto) return 'Selecione um elemento';
  if (objeto.userData.kind === 'wall') return 'Parede';
  if (objeto.userData.kind === 'floor' || objeto.userData.kind === 'ceiling') return objeto.userData.sourceName;
  return objeto.userData.sourceName || 'Elemento';
}

function medidasDoObjeto(objeto) {
  const medidas = objeto?.userData?.dimensions;
  if (!medidas) return [];
  if (objeto.userData.kind === 'wall') return [['Comprimento', metros(medidas.length)], ['Espessura', metros(medidas.thickness)], ['Altura', metros(medidas.height)]];
  if (objeto.userData.kind === 'floor' || objeto.userData.kind === 'ceiling') return [['Área', area(medidas.area)]];
  return [['Largura', metros(medidas.width)], ['Profundidade', metros(medidas.depth)], ['Altura', metros(medidas.height)]];
}

export function criarPainel({ rooms, onSelectRoom, onHide, onShowAll, onVisibilityChange }) {
  const title = document.getElementById('selection-title');
  const description = document.getElementById('selection-description');
  const measurements = document.getElementById('selection-measurements');
  const actions = document.getElementById('selection-actions');
  const finishPicker = document.getElementById('finish-picker');
  const finishGrid = document.getElementById('finish-grid');
  const roomList = document.getElementById('room-list');
  const roomSummary = document.getElementById('room-summary-list');
  const roomCount = document.getElementById('room-count');
  const hiddenList = document.getElementById('hidden-list');
  const hiddenCount = document.getElementById('hidden-count');
  const hideButton = document.getElementById('hide-selected-button');
  const finishButton = document.getElementById('finish-selected-button');
  const restoreFinishButton = document.getElementById('restore-finish-button');
  const selected = { value: null };

  function renderRooms() {
    roomCount.textContent = String(rooms.length);
    roomList.replaceChildren();
    roomSummary.replaceChildren();
    for (const room of rooms) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'room-button';
      button.innerHTML = `<span><strong>${room.displayName}</strong><small>Explorar ambiente</small></span><span class="room-area">${area(room.area)}</span>`;
      button.addEventListener('click', () => onSelectRoom(room, button));
      roomList.append(button);
      const item = document.createElement('li');
      item.innerHTML = `<span>${room.displayName}</span><span>${area(room.area)}</span>`;
      roomSummary.append(item);
    }
  }

  function renderFinishes() {
    finishGrid.replaceChildren();
    for (const finish of acabamentosDoObjeto(selected.value)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'finish-option';
      button.innerHTML = `<span class="finish-swatch" style="background:${finish.color}"></span><span>${finish.name}</span>`;
      button.addEventListener('click', () => aplicarAcabamento(selected.value, finish));
      finishGrid.append(button);
    }
  }

  function renderSelection(objeto) {
    selected.value = objeto;
    title.textContent = tituloDoObjeto(objeto);
    if (!objeto) {
      description.textContent = 'Passe o cursor sobre a planta e clique em uma parede, piso, forro ou móvel.';
      measurements.hidden = true;
      actions.hidden = true;
      finishPicker.hidden = true;
      return;
    }
    description.textContent = objeto.userData.kind === 'wall' ? 'Elemento estrutural da planta' : `Origem: ${objeto.userData.sourceName || 'modelo'}`;
    measurements.replaceChildren();
    for (const [label, value] of medidasDoObjeto(objeto)) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
      measurements.append(wrapper);
    }
    measurements.hidden = false;
    actions.hidden = false;
    finishPicker.hidden = true;
    finishButton.disabled = acabamentosDoObjeto(objeto).length === 0;
  }

  function renderHidden({ ocultos = [] } = {}) {
    hiddenCount.textContent = String(ocultos.length);
    hiddenList.replaceChildren();
    if (!ocultos.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Nada oculto no momento.';
      hiddenList.append(empty);
      return;
    }
    for (const objeto of ocultos) {
      const item = document.createElement('div');
      item.className = 'hidden-item';
      const label = document.createElement('span');
      label.textContent = tituloDoObjeto(objeto);
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Restaurar ${tituloDoObjeto(objeto)}`);
      button.textContent = '+';
      button.addEventListener('click', () => onVisibilityChange?.(objeto));
      item.append(label, button);
      hiddenList.append(item);
    }
  }

  hideButton.addEventListener('click', () => { if (selected.value) onHide(selected.value); });
  finishButton.addEventListener('click', () => { if (selected.value) { finishPicker.hidden = !finishPicker.hidden; renderFinishes(); } });
  restoreFinishButton.addEventListener('click', () => { if (selected.value) restaurarAcabamento(selected.value); });
  document.getElementById('show-all-button').addEventListener('click', onShowAll);
  renderRooms();

  return {
    select: renderSelection,
    renderHidden,
    getSelected: () => selected.value,
    setRoomActive(button) {
      roomList.querySelectorAll('.room-button').forEach((item) => item.classList.remove('is-active'));
      button?.classList.add('is-active');
    },
  };
}
