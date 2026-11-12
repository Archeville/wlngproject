import { maxFavoriteChannels, validYouTubeId, youtubeChannelId, youtubeHandle } from './favorites-model.mjs?v=20261112-channel1';
import { streamLibrary } from './stream-library.mjs?v=20261112-discovery1';

export function setupFavoriteManager({ openDialog, closeDialog, getTabs, activeTab, save, canReorder }) {
  const $ = id => document.getElementById(id);
  const dialog = $('favorite-manager');
  const tabSelect = $('manager-channel-tab');
  const list = $('manager-creators');
  const order = $('manager-tab-order');
  const status = $('manager-status');
  const addStatus = $('manager-add-status');
  const add = $('manager-add');
  const submit = $('manager-save');
  const input = $('manager-creator-input');
  let draft = [], original = '', loading = false, saving = false, dragged = null;
  let lookup = null;
  const dirty = () => JSON.stringify(draft) !== original;
  const current = () => draft.find(tab => tab.id === tabSelect.value && tab.type === 'channels');
  const nameOf = id => streamLibrary.creator(id).name || id;

  function button(label, action, accessibleName = label) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'watch-button';
    control.textContent = label;
    control.setAttribute('aria-label', accessibleName);
    control.addEventListener('click', action);
    return control;
  }

  function moveTab(id, index) {
    if (!canReorder() || saving || index < 0 || index >= draft.length) return;
    const from = draft.findIndex(tab => tab.id === id);
    if (from < 0 || from === index) return;
    const [tab] = draft.splice(from, 1);
    draft.splice(index, 0, tab);
    render();
    [...order.children].find(row => row.dataset.id === id)?.querySelector('button:not(:disabled)')?.focus();
  }

  function renderOrder() {
    order.replaceChildren(...draft.map((tab, index) => {
      const row = document.createElement('li');
      row.dataset.id = tab.id;
      const label = document.createElement('span');
      label.className = 'manager-tab-name';
      label.textContent = tab.name;
      row.append(label);
      if (canReorder() && draft.length > 1) {
        label.draggable = !saving;
        label.title = 'Drag to reorder ' + tab.name;
        label.addEventListener('dragstart', event => {
          dragged = tab.id;
          event.dataTransfer.setData('text/plain', tab.id);
          event.dataTransfer.effectAllowed = 'move';
        });
        label.addEventListener('dragend', () => {
          dragged = null;
          order.querySelector('.drop-target')?.classList.remove('drop-target');
        });
        row.addEventListener('dragover', event => {
          if (!dragged || dragged === tab.id) return;
          event.preventDefault();
          order.querySelector('.drop-target')?.classList.remove('drop-target');
          row.classList.add('drop-target');
        });
        row.addEventListener('drop', event => {
          event.preventDefault();
          const id = dragged;
          dragged = null;
          row.classList.remove('drop-target');
          if (id) moveTab(id, index);
        });
        const up = button('↑', () => moveTab(tab.id, index - 1), 'Move ' + tab.name + ' up');
        const down = button('↓', () => moveTab(tab.id, index + 1), 'Move ' + tab.name + ' down');
        up.disabled = saving || index === 0;
        down.disabled = saving || index === draft.length - 1;
        row.append(up, down);
      }
      return row;
    }));
  }

  function renderCreators() {
    const selected = current();
    const query = $('manager-creator-search').value.trim().toLowerCase();
    const channels = selected?.channels.filter(id => (nameOf(id) + ' ' + id).toLowerCase().includes(query)) || [];
    list.replaceChildren(...channels.map(id => {
      const row = document.createElement('li');
      const label = document.createElement('strong');
      label.textContent = nameOf(id);
      row.append(label);
      const actions = document.createElement('div');
      actions.className = 'manager-row-actions';
      const others = draft.filter(tab => tab.type === 'channels' && tab.id !== selected.id);
      if (others.length) {
        const target = document.createElement('select');
        target.setAttribute('aria-label', 'Destination for ' + label.textContent);
        target.append(new Option('Move to…', ''));
        for (const tab of others) {
          const option = new Option(tab.name, tab.id);
          option.disabled = tab.channels.length >= maxFavoriteChannels && !tab.channels.includes(id);
          target.append(option);
        }
        const move = button('Move', () => {
          const destination = others.find(tab => tab.id === target.value);
          if (!destination || saving) return;
          if (!destination.channels.includes(id)) {
            if (destination.channels.length >= maxFavoriteChannels) return;
            destination.channels.push(id);
          }
          selected.channels = selected.channels.filter(channel => channel !== id);
          renderCreators();
          status.textContent = 'Moved ' + label.textContent + ' to ' + destination.name + '.';
        }, 'Move ' + label.textContent);
        move.disabled = true;
        target.disabled = saving;
        target.addEventListener('change', () => { move.disabled = saving || !target.value; });
        actions.append(target, move);
      }
      const remove = button('Remove', () => {
        selected.channels = selected.channels.filter(channel => channel !== id);
        renderCreators();
        status.textContent = 'Removed ' + label.textContent + ' from ' + selected.name + '.';
      }, 'Remove ' + label.textContent);
      remove.disabled = saving;
      actions.append(remove);
      row.append(actions);
      return row;
    }));
    $('manager-empty').hidden = channels.length > 0 || !selected;
    $('manager-empty').textContent = query ? 'No creators match your search.' : 'This tab has no creators yet.';
    tabSelect.disabled = loading || saving || Boolean(lookup);
    add.disabled = !selected || saving || Boolean(lookup) || selected.channels.length >= maxFavoriteChannels;
    input.disabled = !selected || saving || Boolean(lookup);
    submit.disabled = loading || saving || Boolean(lookup) || !draft.length || !dirty();
  }

  function render(preferred = tabSelect.value) {
    const channelTabs = draft.filter(tab => tab.type === 'channels');
    tabSelect.replaceChildren(...channelTabs.map(tab => new Option(tab.name, tab.id)));
    tabSelect.value = channelTabs.some(tab => tab.id === preferred) ? preferred : 'favorites';
    renderOrder();
    renderCreators();
  }

  $('favorite-manage').addEventListener('click', async () => {
    if (dialog.open || loading || saving) return;
    draft = [];
    loading = true;
    input.value = $('manager-creator-search').value = '';
    addStatus.textContent = '';
    status.textContent = 'Loading Favorites…';
    render();
    openDialog(dialog);
    try {
      const tabs = await getTabs();
      if (!dialog.open) return;
      draft = structuredClone(tabs);
      original = JSON.stringify(draft);
      $('manager-known-creators').replaceChildren(...streamLibrary.knownCreators().map(creator => new Option(creator.name, creator.id)));
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loading = false;
      if (dialog.open) render(activeTab().id);
    }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    lookup?.abort();
    lookup = null;
  });
  tabSelect.addEventListener('change', () => {
    addStatus.textContent = '';
    renderCreators();
  });
  input.addEventListener('input', () => { addStatus.textContent = ''; });
  $('manager-creator-search').addEventListener('input', renderCreators);
  $('manager-add-form').addEventListener('submit', async event => {
    event.preventDefault();
    const tab = current();
    if (!tab || saving || lookup || tab.channels.length >= maxFavoriteChannels) return;
    const value = input.value.trim();
    const known = streamLibrary.knownCreators().filter(item => item.id === value || item.name.toLowerCase() === value.toLowerCase());
    let id = youtubeChannelId(value) || (known.length === 1 ? known[0].id : '');
    const handle = id ? '' : youtubeHandle(value);
    if (handle) {
      const controller = new AbortController();
      lookup = controller;
      addStatus.textContent = 'Looking up @' + handle + '…';
      renderCreators();
      try {
        const params = new URLSearchParams({ handle });
        const response = await fetch('/api/channels/resolve?' + params, { signal: controller.signal });
        const channel = await response.json();
        if (lookup !== controller || !dialog.open || !draft.includes(tab)) return;
        if (!response.ok || !validYouTubeId(channel?.id)) {
          addStatus.textContent = channel?.error || 'Couldn’t look up that handle. Paste the channel ID or try again.';
          return;
        }
        id = channel.id;
        streamLibrary.remember([{ channel }]);
      } catch {
        if (lookup === controller && dialog.open) addStatus.textContent = 'Couldn’t look up that handle. Paste the channel ID or try again.';
        return;
      } finally {
        if (lookup === controller) {
          lookup = null;
          if (dialog.open) renderCreators();
        }
      }
    }
    if (!id) {
      addStatus.textContent = 'Choose a known creator or paste a YouTube channel link or ID.';
      return;
    }
    if (tab.channels.includes(id)) {
      addStatus.textContent = 'That creator is already in ' + tab.name + '.';
      return;
    }
    if (tab.channels.length >= maxFavoriteChannels) return;
    tab.channels.push(id);
    input.value = $('manager-creator-search').value = '';
    renderCreators();
    addStatus.textContent = 'Added ' + nameOf(id) + ' to ' + tab.name + '. Select Save changes to keep it.';
  });
  submit.addEventListener('click', async () => {
    if (saving || loading || lookup || !dirty()) return;
    saving = true;
    render();
    try {
      await save(draft);
      closeDialog(dialog);
    } catch (error) {
      status.textContent = error.message;
      if (error.message.includes('changed elsewhere')) {
        draft = structuredClone(await getTabs());
        original = JSON.stringify(draft);
      }
    } finally {
      saving = false;
      render();
    }
  });
}
