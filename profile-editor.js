import { accountState } from './account-state.mjs';
import { profileThemeVariables, badgeCss, awardCss } from './cosmetics.mjs?v=20261112-layout1';
import { profileCardCss } from './profile-cosmetics.mjs?v=20261112-layout1';
import { columns, rows, rowHeight, layoutItems, itemRect, renderProfileGrid, profileGridCss, validProfileLayout } from './profile-layout.mjs?v=20261112-layout1';
import { levelProgress } from './levels.mjs';

const dialog = document.querySelector('#profile-editor');
const stage = dialog.querySelector('.editor-stage');
const list = dialog.querySelector('#editor-items');
const save = dialog.querySelector('#editor-save');
const reset = dialog.querySelector('#editor-reset');
const undo = dialog.querySelector('#editor-revert');
const status = dialog.querySelector('#editor-status');
const inputs = [...dialog.querySelectorAll('[data-coordinate]')];
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
  const [x, y, w, h] = itemRect(draft, selected);
  const limits = [[x + 1, columns - w + 1], [y + 1, rows - h + 1], [w, columns - x], [h, rows - y]];
  for (const [index, input] of inputs.entries()) {
    input.value = limits[index][0];
    input.max = limits[index][1];
    input.disabled = !ready();
  }
  list.value = selected;
  for (const tile of stage.querySelectorAll('[data-item]')) {
    tile.classList.toggle('selected', tile.dataset.item === selected);
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
    const [x, y, w, h] = rect;
    tile.style.gridArea = `${y + 1}/${x + 1}/span ${h}/span ${w}`;
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
    render();
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
inputs.forEach((input, index) => input.addEventListener('change', () => {
  const rect = [...itemRect(draft, selected)];
  if (!Number.isInteger(input.valueAsNumber)) { syncControls(); return; }
  rect[index] = clamp(input.valueAsNumber, 1, Number(input.max)) - (index < 2 ? 1 : 0);
  setRect(selected, rect);
  syncControls();
}));
stage.addEventListener('pointerdown', event => {
  const tile = event.target.closest('[data-item]');
  if (!tile || event.button !== 0 || !ready()) return;
  selected = tile.dataset.item;
  const grid = tile.parentElement;
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cellWidth: grid.clientWidth / columns, scroll: stage.scrollTop, rect: itemRect(draft, selected) };
  stage.setPointerCapture(event.pointerId);
  syncControls();
});
stage.addEventListener('pointermove', event => {
  if (drag?.pointerId !== event.pointerId) return;
  const [x, y, w, h] = drag.rect;
  const dx = Math.round((event.clientX - drag.x) / drag.cellWidth);
  const dy = Math.round((event.clientY - drag.y + stage.scrollTop - drag.scroll) / rowHeight);
  setRect(selected, [clamp(x + dx, 0, columns - w), clamp(y + dy, 0, rows - h), w, h], false);
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
