import { channelName, creatorPlans, streamLibrary, validVideoId } from './stream-library.mjs?v=20261112-streamtools1';

export function setupStreamTools({ openDialog, closeDialog, play, onVisibilityChange, time }) {
  const $ = id => document.getElementById(id);
  const historyDialog = $('stream-history');
  const hiddenDialog = $('hidden-content');
  const hideDialog = $('stream-hide-dialog');
  let hideTarget;

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
      panel.hidden = tab.type !== 'channels' || !tab.channels.length;
      if (panel.hidden) return;
      const plans = creatorPlans(streams.filter(stream => !streamLibrary.isHidden(stream)));
      const names = new Map(streams.map(stream => [stream.channel?.id, channelName(stream.channel)]));
      $('favorite-creator-count').textContent = String(tab.channels.length);
      $('favorite-creator-list').replaceChildren(...tab.channels.map(id => {
        const plan = plans.get(id);
        const name = names.get(id) || streamLibrary.creator(id) || 'Channel …' + id.slice(-7);
        const state = streamLibrary.creatorHidden(id) ? 'Hidden in this browser'
          : plan?.status === 'live' ? 'Live now'
          : plan ? 'Scheduled · ' + time(plan.stream.start_scheduled || plan.stream.available_at)
          : loaded ? 'Nothing in the schedule' : 'Waiting for the stream feed';
        const row = listRow(name, state);
        row.dataset.creatorStatus = plan?.status || 'offline';
        if (plan) row.append(action('Open', () => play(plan.stream.id)));
        return row;
      }));
    }
  };
}
