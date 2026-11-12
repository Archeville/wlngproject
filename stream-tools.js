import { channelName, creatorPlans, safeChannelPhoto, streamLibrary, validVideoId } from './stream-library.mjs?v=20261112-discovery1';

export function setupStreamTools({ openDialog, closeDialog, play, onVisibilityChange, time, liveCandidates }) {
  const $ = id => document.getElementById(id);
  const historyDialog = $('stream-history');
  const hiddenDialog = $('hidden-content');
  const hideDialog = $('stream-hide-dialog');
  const surprise = $('surprise-dialog');
  let hideTarget;
  let picked, surpriseRound = 0, seen = new Set();

  async function pickStream() {
    const round = ++surpriseRound;
    const previous = picked?.id;
    picked = null;
    $('surprise-preview').hidden = true;
    $('surprise-watch').disabled = $('surprise-again').disabled = true;
    $('surprise-status').textContent = 'Looking for a live stream…';
    try {
      const candidates = await liveCandidates();
      if (round !== surpriseRound || !surprise.open) return;
      let available = candidates.filter(item => !seen.has(item.id));
      if (!available.length && candidates.length > 1) {
        seen = new Set(previous ? [previous] : []);
        available = candidates.filter(item => item.id !== previous);
      }
      if (!available.length) {
        $('surprise-status').textContent = 'No live streams match this view.';
        return;
      }
      picked = available[Math.floor(Math.random() * available.length)];
      seen.add(picked.id);
      $('surprise-image').src = 'https://i.ytimg.com/vi/' + picked.id + '/hqdefault.jpg';
      $('surprise-name').textContent = picked.title || 'YouTube stream';
      $('surprise-channel').textContent = channelName(picked.channel) || 'YouTube';
      $('surprise-status').textContent = '';
      $('surprise-preview').hidden = false;
      $('surprise-watch').disabled = false;
      $('surprise-again').disabled = candidates.length < 2;
    } catch (error) {
      if (round === surpriseRound && surprise.open) $('surprise-status').textContent = error.message;
    }
  }
  $('surprise-open').addEventListener('click', () => {
    if (surprise.open) return;
    picked = null;
    seen = new Set();
    openDialog(surprise);
    void pickStream();
  });
  $('surprise-again').addEventListener('click', () => { void pickStream(); });
  $('surprise-watch').addEventListener('click', () => {
    if (!picked) return;
    if (streamLibrary.isHidden(picked)) { void pickStream(); return; }
    const id = picked.id;
    surprise.close();
    play(id);
  });

  function action(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'watch-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function listRow(title, description) {
    const row = document.createElement('li');
    const info = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = title;
    const detail = document.createElement('span');
    detail.textContent = description;
    info.append(label, detail);
    row.append(info);
    return row;
  }

  function drawHistory() {
    const items = streamLibrary.history();
    const format = new Intl.DateTimeFormat(undefined, { dateStyle:'medium', timeStyle:'short' });
    $('stream-history-list').replaceChildren(...items.map(item => {
      const openedAt = Number.isFinite(item.openedAt) ? format.format(item.openedAt) : '';
      const row = listRow(item.title || 'YouTube stream', [item.channelName, openedAt].filter(Boolean).join(' · '));
      row.append(action('Open', () => {
        // Close the top-layer history dialog before opening the player.
        historyDialog.close();
        play(item.id, { id:item.id, title:item.title, channel:{ id:item.channelId, name:item.channelName } });
      }));
      return row;
    }));
    $('stream-history-empty').hidden = items.length > 0;
    $('stream-history-clear').disabled = items.length === 0;
  }

  function drawHidden() {
    const hidden = streamLibrary.hidden();
    for (const [type, entries] of [['creator', hidden.creators], ['stream', hidden.streams]]) {
      $('hidden-' + type + '-list').replaceChildren(...entries.map(item => {
        const row = listRow(item.title || item.id, item.channelName || '');
        row.append(action('Restore', () => {
          $('hidden-content-status').textContent = streamLibrary.restore(type, item.id)
            ? 'Restored ' + (item.title || 'item') + '.' : 'The browser could not save that change.';
        }));
        return row;
      }));
      $('hidden-' + type + '-empty').hidden = entries.length > 0;
    }
  }

  $('stream-history-open').addEventListener('click', () => {
    drawHistory();
    $('stream-history-confirm').hidden = true;
    $('stream-history-status').textContent = '';
    openDialog(historyDialog);
  });
  $('stream-history-clear').addEventListener('click', () => { $('stream-history-confirm').hidden = false; });
  $('stream-history-keep').addEventListener('click', () => { $('stream-history-confirm').hidden = true; });
  $('stream-history-delete').addEventListener('click', () => {
    $('stream-history-confirm').hidden = true;
    $('stream-history-status').textContent = streamLibrary.clearHistory()
      ? 'History cleared.' : 'The browser could not clear your history.';
  });
  $('hidden-content-open').addEventListener('click', () => {
    drawHidden();
    $('hidden-content-status').textContent = '';
    openDialog(hiddenDialog);
  });
  window.addEventListener('wlng-library-change', () => {
    if (historyDialog.open) drawHistory();
    if (hiddenDialog.open) drawHidden();
    onVisibilityChange();
  });

  for (const type of ['stream', 'creator']) {
    $('hide-' + type).addEventListener('click', () => {
      if (!hideTarget) return;
      try {
        if (!streamLibrary.hide(type, hideTarget)) throw new Error('The browser could not save that change.');
        closeDialog(hideDialog);
        if ($('player-dialog').open) $('watch-message').textContent = 'Hidden from the feed. Restore it in Settings.';
        else $('stream-tool-notice').textContent = 'Hidden from the feed. Restore it in Settings.';
      } catch (error) { $('stream-hide-status').textContent = error.message; }
    });
  }

  return {
    hidePicker(stream) {
      if (!validVideoId(stream?.id)) return;
      hideTarget = stream;
      $('stream-hide-name').textContent = stream.title || 'YouTube stream';
      $('hide-stream').disabled = streamLibrary.hidden().streams.some(item => item.id === stream.id);
      $('hide-creator').disabled = !stream.channel?.id || streamLibrary.creatorHidden(stream.channel.id);
      $('stream-hide-status').textContent = '';
      openDialog(hideDialog);
    },
    renderCreators(tab, streams, loaded) {
      const panel = $('favorite-creators');
      const ids = tab.id === 'favorites' ? tab.channels.filter(id => !streamLibrary.creatorHidden(id)) : [];
      panel.hidden = ids.length === 0;
      if (!ids.length) return;
      const plans = creatorPlans(streams.filter(stream => !streamLibrary.isHidden(stream)));
      ids.sort((a, b) => Number(plans.get(b)?.status === 'live') - Number(plans.get(a)?.status === 'live'));
      $('favorite-creator-list').replaceChildren(...ids.map(id => {
        const plan = plans.get(id);
        const cached = streamLibrary.creator(id);
        const name = channelName(plan?.stream.channel) || cached.name || 'Channel …' + id.slice(-7);
        const photo = safeChannelPhoto(plan?.stream.channel?.photo) || cached.photo;
        const state = plan?.status === 'live' ? 'Live now'
          : plan ? 'Scheduled · ' + time(plan.stream.start_scheduled || plan.stream.available_at)
          : loaded ? 'Offline' : 'Waiting for the stream feed';
        const row = document.createElement('li');
        row.dataset.creatorStatus = plan?.status || 'offline';
        const control = document.createElement(plan ? 'button' : 'a');
        control.className = 'creator-avatar';
        control.title = name + ' · ' + state;
        control.setAttribute('aria-label', control.title + (plan ? ' · Open stream' : ' · Open YouTube channel'));
        if (plan) {
          control.type = 'button';
          control.addEventListener('click', () => play(plan.stream.id));
        } else {
          control.href = 'https://www.youtube.com/channel/' + encodeURIComponent(id);
          control.target = '_blank';
          control.rel = 'noopener';
        }
        const placeholder = document.createElement('span');
        placeholder.className = 'creator-avatar-initial';
        placeholder.textContent = cached.name || channelName(plan?.stream.channel) ? [...name][0].toUpperCase() : '♡';
        placeholder.setAttribute('aria-hidden', 'true');
        control.append(placeholder);
        if (photo) {
          const image = document.createElement('img');
          image.alt = '';
          image.loading = 'lazy';
          image.addEventListener('error', () => image.remove(), { once: true });
          image.src = photo;
          control.append(image);
        }
        const dot = document.createElement('span');
        dot.className = 'creator-avatar-dot';
        dot.setAttribute('aria-hidden', 'true');
        control.append(dot);
        row.append(control);
        return row;
      }));
    }
  };
}
