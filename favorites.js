import { defaultFavorites, maxFavoriteTabs, maxFavoriteChannels, validFavoriteChannel, validFavoriteTabs, matchesFavoriteTab } from './favorites-model.mjs?v=20261112-favorites1';

export function setupFavorites({ openDialog, closeDialog, onChange }) {
  const $ = id => document.getElementById(id);
  const picker = $('favorite-picker');
  const editor = $('favorite-editor');
  const pickerForm = $('favorite-picker-form');
  const editForm = $('favorite-edit-form');
  const newName = $('favorite-new-name');
  const viewStatus = $('favorite-view-status');
  const tabSelect = $('favorite-tab-select');
  const typeSelect = $('favorite-edit-type');
  let local;
  try { local = defaultFavorites(JSON.parse(localStorage.getItem('wlng-favorites') || '[]')); }
  catch { local = defaultFavorites(); }
  let tabs = local, activeId = 'favorites', revision = 0;
  let owner = window.WLNG_AUTH_USER || null, generation = 0, loaded = false, pending, busy = false;
  let channel, editing, editType, confirmDelete = false;
  const activeTab = () => tabs.find(tab => tab.id === activeId) ?? tabs[0];
  const canAdd = () => Boolean(owner && loaded && !busy && tabs.length < maxFavoriteTabs);

  function view() {
    const container = $('favorite-tabs');
    container.replaceChildren(...tabs.map(tab => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'favorite-rail-tab';
      const mark = document.createElement('span');
      mark.className = 'favorite-tab-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = tab.type === 'rules' ? '≡' : '♡';
      const label = document.createElement('span');
      label.textContent = tab.name;
      button.append(mark, label);
      button.setAttribute('aria-pressed', String(tab.id === activeId));
      button.addEventListener('click', () => {
        activeId = tab.id;
        refresh();
        container.querySelector('[aria-pressed="true"]')?.focus();
      });
      return button;
    }));
    tabSelect.replaceChildren(...tabs.map(tab => new Option(tab.name, tab.id)));
    tabSelect.value = activeId;
    $('favorite-new').disabled = !canAdd();
    $('favorite-edit').hidden = activeId === 'favorites';
    $('favorite-edit').disabled = !owner || !loaded || busy;
    if (!owner) viewStatus.textContent = 'Sign in to create tabs and sync Favorites across devices.';
    else if (loaded) viewStatus.textContent = tabs.length + ' of ' + maxFavoriteTabs + ' tabs';
  }
  function refresh() {
    activeId = activeTab().id;
    view();
    onChange();
  }
  tabSelect.addEventListener('change', () => {
    activeId = tabSelect.value;
    refresh();
  });
  async function request(input) {
    const own = generation;
    const token = await window.WLNG_AUTH?.getAccessToken();
    if (generation !== own || !token) throw new Error('Sign in to sync your favorites.');
    const response = await fetch('/api/account/favorites', {
      method: input ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, ...(input ? { 'Content-Type': 'application/json' } : {}) },
      ...(input ? { body: JSON.stringify(input) } : {}),
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json();
    if (!response.ok && response.status !== 409) throw new Error(data.error || 'Favorites are temporarily unavailable.');
    if (!Number.isSafeInteger(data.revision) || !validFavoriteTabs(data.tabs)) throw new Error('Favorites could not be loaded.');
    return data;
  }
  function load() {
    if (!owner || loaded) return Promise.resolve();
    if (pending) return pending;
    const own = generation;
    viewStatus.textContent = 'Loading your tabs…';
    pending = request().then(data => {
      if (own !== generation) return;
      revision = data.revision;
      // Include pre-existing browser favorites on the first account save.
      tabs = revision === 0 ? local : data.tabs;
      loaded = true;
      refresh();
    }).catch(error => {
      if (own !== generation) return;
      viewStatus.textContent = error.message + ' Open Favorites again to retry.';
      throw error;
    }).finally(() => { if (own === generation) pending = null; });
    return pending;
  }
  async function save(next) {
    if (!validFavoriteTabs(next)) throw new Error('Check the tab name, rules, and channel limit.');
    if (!owner) {
      if (next.length !== 1) throw new Error('Sign in to create a favorite tab.');
      try { localStorage.setItem('wlng-favorites', JSON.stringify(next[0].channels)); }
      catch { throw new Error('This browser could not save your favorites.'); }
      local = tabs = next;
      refresh();
      return;
    }
    if (busy || !loaded) throw new Error('Wait for your tabs to finish loading.');
    const own = generation;
    busy = true;
    refresh();
    try {
      const data = await request({ revision, tabs: next });
      if (own !== generation) throw new Error('Your account changed. Open Favorites again.');
      tabs = data.tabs;
      revision = data.revision;
      if (data.error) throw new Error(data.error);
    } finally {
      if (own === generation) { busy = false; refresh(); }
    }
  }
  window.addEventListener('wlng-auth', event => {
    const user = event.detail.userId || null;
    if (user === owner) return;
    owner = user;
    generation++;
    loaded = busy = false;
    pending = null;
    revision = 0;
    tabs = local;
    activeId = 'favorites';
    viewStatus.textContent = '';
    if (picker.open) closeDialog(picker);
    if (editor.open) closeDialog(editor);
    refresh();
    if (!$('favorites-panel').hidden) void load().catch(() => {});
  });

  function fillPicker() {
    $('favorite-picker-list').replaceChildren(...tabs.filter(tab => tab.type === 'channels').map(tab => {
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.value = tab.id;
      check.checked = tab.channels.includes(channel.id);
      check.disabled = !check.checked && tab.channels.length >= maxFavoriteChannels;
      label.append(check, document.createTextNode(tab.name + (check.disabled ? ' (full)' : '')));
      return label;
    }));
    $('favorite-new-section').hidden = !canAdd();
  }
  async function openPicker(item) {
    if (!validFavoriteChannel(item?.channel?.id) || picker.open) return;
    channel = { id: item.channel.id, name: item.channel.english_name || item.channel.name || 'This creator' };
    $('favorite-picker-name').textContent = channel.name;
    $('favorite-picker-status').textContent = owner && !loaded ? 'Loading your tabs…' : '';
    newName.value = '';
    $('favorite-new-section').open = false;
    $('favorite-picker-list').replaceChildren();
    $('favorite-new-section').hidden = true;
    $('favorite-picker-save').disabled = true;
    openDialog(picker);
    const own = generation;
    try {
      await load();
      if (!picker.open || own !== generation) return;
      fillPicker();
      $('favorite-picker-status').textContent = owner ? '' : 'Sign in to create and sync custom tabs.';
      $('favorite-picker-save').disabled = false;
    } catch (error) {
      if (own === generation && picker.open) $('favorite-picker-status').textContent = error.message;
    }
  }
  function uniqueName(name, except) {
    if (!name || name.length > 32) throw new Error('Enter a tab name of up to 32 characters.');
    if (tabs.some(tab => tab.id !== except && tab.name.toLowerCase() === name.toLowerCase())) throw new Error('A tab already has that name.');
    return name;
  }
  pickerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || $('favorite-picker-save').disabled) return;
    const status = $('favorite-picker-status');
    const selected = new Set([...$('favorite-picker-list').querySelectorAll('input:checked')].map(input => input.value));
    const name = $('favorite-new-section').open ? newName.value.trim() : '';
    const id = channel.id;
    $('favorite-picker-save').disabled = true;
    try {
      const next = tabs.map(tab => {
        if (tab.type !== 'channels' || selected.has(tab.id) === tab.channels.includes(id)) return tab;
        return { ...tab, channels: selected.has(tab.id) ? [...tab.channels, id] : tab.channels.filter(value => value !== id) };
      });
      if (name) {
        if (!canAdd()) throw new Error('You can have up to 10 favorite tabs.');
        next.push({ id: crypto.randomUUID(), name: uniqueName(name), type: 'channels', channels: [id] });
      }
      if (JSON.stringify(next) !== JSON.stringify(tabs) || owner && revision === 0 && next[0].channels.length) await save(next);
      closeDialog(picker);
    } catch (error) {
      status.textContent = error.message;
      if (loaded) fillPicker();
    } finally { $('favorite-picker-save').disabled = false; }
  });

  function openEditor(type, tab = null) {
    if (!owner || !loaded || busy || (!tab && !canAdd())) return;
    editing = tab?.id ?? null;
    editType = type;
    confirmDelete = false;
    $('favorite-editor-title').textContent = tab ? 'Edit favorite tab' : 'New favorite tab';
    $('favorite-type-field').hidden = Boolean(tab);
    typeSelect.value = type;
    $('favorite-edit-name').value = tab?.name || '';
    $('favorite-rules').hidden = type !== 'rules';
    $('favorite-rule-title').value = tab?.rules?.title ?? '';
    $('favorite-rule-agency').value = tab?.rules?.agency ?? '';
    $('favorite-rule-viewers').value = tab?.rules?.minViewers ?? '';
    $('favorite-delete').hidden = !tab;
    $('favorite-delete').textContent = 'Delete tab';
    $('favorite-editor-status').textContent = '';
    openDialog(editor);
  }
  typeSelect.addEventListener('change', () => {
    editType = typeSelect.value;
    $('favorite-rules').hidden = editType !== 'rules';
  });
  $('favorite-new').addEventListener('click', () => openEditor('channels'));
  $('favorite-edit').addEventListener('click', () => {
    const tab = activeTab();
    if (tab.id !== 'favorites') openEditor(tab.type, tab);
  });
  editForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const status = $('favorite-editor-status');
    try {
      const name = uniqueName($('favorite-edit-name').value.trim(), editing);
      const old = tabs.find(tab => tab.id === editing);
      if (editing && !old) throw new Error('This tab was deleted elsewhere.');
      if (!editing && !canAdd()) throw new Error('You can have up to 10 favorite tabs.');
      const id = editing ?? crypto.randomUUID();
      let tab = { id, name, type: editType, channels: old?.channels ?? [] };
      if (editType === 'rules') {
        const title = $('favorite-rule-title').value.trim();
        const agency = $('favorite-rule-agency').value;
        const minViewers = $('favorite-rule-viewers').valueAsNumber;
        const rules = { ...(title ? { title } : {}), ...(agency ? { agency } : {}), ...(minViewers ? { minViewers } : {}) };
        if (!Object.keys(rules).length) throw new Error('Add at least one rule.');
        tab = { id, name, type: 'rules', rules };
      }
      await save(editing ? tabs.map(existing => existing.id === id ? tab : existing) : [...tabs, tab]);
      activeId = id;
      refresh();
      closeDialog(editor);
    } catch (error) { status.textContent = error.message; }
  });
  $('favorite-delete').addEventListener('click', async event => {
    if (busy || !editing) return;
    if (!confirmDelete) {
      confirmDelete = true;
      event.currentTarget.textContent = 'Confirm delete';
      $('favorite-editor-status').textContent = 'Delete this tab and its settings?';
      return;
    }
    try { await save(tabs.filter(tab => tab.id !== editing)); closeDialog(editor); }
    catch (error) { $('favorite-editor-status').textContent = error.message; }
  });
  view();
  return {
    open() { refresh(); void load().catch(() => {}); },
    openPicker,
    matches: stream => matchesFavoriteTab(activeTab(), stream),
    contains: id => tabs.some(tab => tab.type === 'channels' && tab.channels.includes(id))
  };
}
