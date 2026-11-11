import { accountState } from './account-state.mjs';
import { profileThemeVariables, badgeCss, awardCss } from './cosmetics.mjs?v=20261112-layout1';
import { profileCardCss } from './profile-cosmetics.mjs?v=20261112-layout1';
import { placement, layoutItems, itemRect, resizeItem, gridArea, renderProfileGrid, profileGridCss, validProfileLayout } from './profile-layout.mjs?v=20261112-canvas1';
import { levelProgress } from './levels.mjs';

const dialog = document.querySelector('#profile-editor');
const stage = dialog.querySelector('.editor-stage');
const list = dialog.querySelector('#editor-items');
const save = dialog.querySelector('#editor-save');
const reset = dialog.querySelector('#editor-reset');
const undo = dialog.querySelector('#editor-revert');
const status = dialog.querySelector('#editor-status');
const inputs = [...dialog.querySelectorAll('[data-coordinate]')];
const sizes = [...dialog.querySelectorAll('[data-object-scale]')];
const styles = document.createElement('style');
styles.textContent = badgeCss + awardCss + profileGridCss + profileCardCss;
document.head.append(styles);

let state = accountState.view(), userId, details, request, draft, saved, drag;
let selected = 'username';
const matches = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const changed = () => !matches(draft, saved);
const ready = () => Boolean(state.userId && state.record && !state.busy);
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));

function previewData() {
  const data = state.record?.data;
  const cosmetics = data?.cosmetics || {};
  const progress = levelProgress(data?.currentXp || 0);
  return {
    ...cosmetics,
    ...details,
    level: cosmetics.level || progress.level,
    xp: progress.intoLevel,
    required: progress.required
  };
}

function syncControls() {
  const [x, y, w, h, scale = 1] = itemRect(draft, selected);
  const limits = [
    [x + 1, placement.left + 1, placement.right - w + 1],
    [y + 1, placement.top + 1, placement.bottom - h + 1],
    [w, 1, Math.min(placement.maxWidth, placement.right - x)],
    [h, 1, Math.min(placement.maxHeight, placement.bottom - y)]
  ];
  for (const [index, input] of inputs.entries()) {
    const [value, min, max] = limits[index];
    input.value = value;
    input.min = min;
    input.max = max;
    input.disabled = !ready();
  }
  list.value = selected;
  for (const button of sizes) {
    button.disabled = !ready();
    button.setAttribute('aria-pressed', String(Number(button.dataset.objectScale) === scale));
  }
  for (const tile of stage.querySelectorAll('[data-item]')) {
    tile.classList.toggle('selected', tile.dataset.item === selected);
  }
  const handle = stage.querySelector('.editor-move-handle');
  if (handle) {
    const grid = handle.parentElement;
    handle.style.gridArea = gridArea(itemRect(draft, selected), Number(grid.dataset.left), Number(grid.dataset.top));
    handle.firstElementChild.title = 'Drag ' + layoutItems[selected][0].toLowerCase();
    handle.hidden = !ready();
  }
  save.disabled = !ready() || !changed();
  reset.disabled = !ready() || draft === null;
  undo.disabled = !ready() || !changed();
}

function render() {
  const profile = previewData();
  stage.removeAttribute('style');
  for (const [key, value] of Object.entries(profileThemeVariables(profile.profileTheme))) stage.style.setProperty(key, value);
  stage.innerHTML = renderProfileGrid(profile, draft || {}, true);
  stage.firstElementChild.insertAdjacentHTML('beforeend', '<div class="editor-move-handle" aria-hidden="true"><span data-move-selected>✥</span></div>');
  const tiles = [...stage.querySelectorAll('[data-item]')];
  if (!tiles.some(tile => tile.dataset.item === selected)) selected = 'username';
  list.replaceChildren(...tiles.map(tile => new Option(layoutItems[tile.dataset.item][0], tile.dataset.item)));
  syncControls();
}

function setRect(id, rect, repaint = true) {
  if (!ready() || matches(itemRect(draft, id), rect)) return;
  draft = { ...draft, [id]: rect };
  status.textContent = 'Unsaved changes';
  if (repaint) render();
  else {
    const tile = stage.querySelector('[data-item="' + id + '"]');
    tile.style.gridArea = gridArea(rect, drag.left, drag.top);
    syncControls();
  }
}

async function loadDetails() {
  request?.abort();
  details = null;
  if (!userId || !dialog.open) return;
  const controller = new AbortController();
  request = controller;
  try {
    const token = await window.WLNG_AUTH?.getAccessToken();
    if (!token || controller.signal.aborted) return;
    const response = await fetch('/api/account/profile', {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
    });
    if (!response.ok) throw new Error('Could not load profile text');
    const { profile } = await response.json();
    if (controller.signal.aborted || !dialog.open) return;
    details = profile;
    if (!drag) render();
  } catch {
    if (!controller.signal.aborted && dialog.open) status.textContent = 'Could not load your profile text. You can still edit the layout.';
  }
}

function showEditor() {
  if (location.hash !== '#profile-editor') {
    if (dialog.open) dialog.close();
    return;
  }
  if (dialog.open) return;
  saved = state.record?.data.cosmetics?.profileLayout ?? null;
  draft = saved;
  status.textContent = state.userId ? 'Drag elements or use the position and size controls.' : 'Sign in to save a layout.';
  dialog.showModal();
  render();
  void loadDetails();
  if (state.userId && !state.record) void accountState.load();
}

window.addEventListener('hashchange', showEditor);
dialog.querySelector('#editor-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  request?.abort();
  drag = null;
  if (location.hash === '#profile-editor') history.replaceState(null, '', location.pathname + location.search);
});
accountState.subscribe(next => {
  const switched = userId !== next.userId;
  state = next;
  userId = next.userId;
  const updated = next.record?.data.cosmetics?.profileLayout ?? null;
  if (switched || !changed()) draft = updated;
  saved = updated;
  if (!dialog.open) return;
  if (switched) {
    status.textContent = userId ? 'Drag elements or use the position and size controls.' : 'Sign in to save a layout.';
    void loadDetails();
  }
  if (drag) syncControls();
  else render();
});

list.addEventListener('change', () => { selected = list.value; syncControls(); });
for (const button of sizes) {
  button.addEventListener('click', () => {
    const scale = Number(button.dataset.objectScale);
    if ((itemRect(draft, selected)[4] ?? 1) === scale) return;
    setRect(selected, resizeItem(draft, selected, scale));
  });
}
inputs.forEach((input, index) => input.addEventListener('change', () => {
  const rect = [...itemRect(draft, selected)];
  if (!Number.isInteger(input.valueAsNumber)) { syncControls(); return; }
  rect[index] = clamp(input.valueAsNumber, Number(input.min), Number(input.max)) - (index < 2 ? 1 : 0);
  setRect(selected, rect);
  syncControls();
}));
stage.addEventListener('pointerdown', event => {
  const tile = event.target.closest('[data-move-selected]')
    ? stage.querySelector('[data-item="' + selected + '"]')
    : event.target.closest('[data-item]');
  if (!tile || event.button !== 0 || !ready()) return;
  selected = tile.dataset.item;
  const grid = tile.parentElement;
  const { left, top, columns, rows } = Object.fromEntries(
    ['left', 'top', 'columns', 'rows'].map(key => [key, Number(grid.dataset[key])])
  );
  drag = {
    pointerId: event.pointerId, x: event.clientX, y: event.clientY, scroll: stage.scrollTop,
    left, top, right: left + columns, bottom: top + rows,
    cellWidth: grid.clientWidth / columns, cellHeight: grid.clientHeight / rows,
    rect: itemRect(draft, selected)
  };
  stage.setPointerCapture(event.pointerId);
  syncControls();
});
stage.addEventListener('pointermove', event => {
  if (drag?.pointerId !== event.pointerId) return;
  const [x, y, w, h, ...size] = drag.rect;
  const dx = Math.round((event.clientX - drag.x) / drag.cellWidth);
  const dy = Math.round((event.clientY - drag.y + stage.scrollTop - drag.scroll) / drag.cellHeight);
  setRect(selected, [clamp(x + dx, drag.left, drag.right - w), clamp(y + dy, drag.top, drag.bottom - h), w, h, ...size], false);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  stage.addEventListener(type, event => {
    if (drag?.pointerId !== event.pointerId) return;
    drag = null;
    render();
  });
}
reset.addEventListener('click', () => {
  draft = null;
  status.textContent = 'Default layout selected. Save to restore the standard profile.';
  render();
});
undo.addEventListener('click', () => {
  draft = saved;
  status.textContent = 'Unsaved changes discarded.';
  render();
});
save.addEventListener('click', async () => {
  if (!ready() || !changed() || !validProfileLayout(draft)) return;
  const owner = userId;
  const layout = draft;
  try {
    await accountState.saveCosmetics({ profileLayout: layout });
    if (userId !== owner || !dialog.open) return;
    if (!matches(state.record?.data.cosmetics?.profileLayout, layout)) throw new Error('Could not save the layout. Try again.');
    saved = layout;
    status.textContent = 'Layout saved.';
    syncControls();
  } catch (error) {
    if (userId === owner && dialog.open) status.textContent = error.message;
  }
});
showEditor();
