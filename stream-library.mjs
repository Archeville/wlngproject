const storageKey = 'wlng-stream-library-v1';
const historyLimit = 100;
const hiddenLimit = 500;
const creatorLimit = 1200;
export const validVideoId = id => typeof id === 'string' && /^[\w-]{11}$/.test(id);
const validChannelId = id => typeof id === 'string' && /^[\w-]{1,128}$/.test(id);
const shortText = (value, size) => typeof value === 'string' ? value.trim().slice(0, size) : '';
export const channelName = channel => shortText(channel?.english_name, 128) || shortText(channel?.name, 128);

export function safeChannelPhoto(value) {
  if (typeof value !== 'string' || value.length > 1024) return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname.endsWith('.googleusercontent.com') || url.hostname.endsWith('.ggpht.com'))) return url.href;
  } catch { /* the feed may omit an avatar */ }
  return '';
}

export function streamStatus(stream, now = Date.now()) {
  const scheduled = Date.parse(stream.start_scheduled);
  if (stream.status === 'live' && !stream.start_actual && Number.isFinite(scheduled) && scheduled > now) return 'upcoming';
  return stream.status;
}

export function creatorPlans(streams, now = Date.now()) {
  const plans = new Map();
  for (const stream of streams) {
    const id = stream.channel?.id;
    if (!validChannelId(id)) continue;
    const status = streamStatus(stream, now);
    const current = plans.get(id);
    if (current?.status === 'live' || !['live', 'upcoming'].includes(status)) continue;
    const scheduled = Date.parse(stream.start_scheduled || stream.available_at);
    const at = Number.isFinite(scheduled) ? scheduled : Infinity;
    if (status === 'live' || !current || at < current.at) plans.set(id, { stream, status, at });
  }
  return plans;
}

function streamEntry(stream) {
  const channel = stream.channel;
  return {
    id: stream.id,
    title: shortText(stream.title, 220) || 'YouTube stream',
    channelId: validChannelId(channel?.id) ? channel.id : '',
    channelName: channelName(channel)
  };
}

function readData() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey));
    if (data && typeof data === 'object') return data;
  } catch { /* storage may be unavailable */ }
  return {};
}

const entries = (value, valid, limit) => Array.isArray(value)
  ? value.filter(entry => entry && valid(entry.id)).slice(0, limit) : [];
let data;
function load() {
  const stored = readData();
  data = {
    history: entries(stored.history, validVideoId, historyLimit),
    hiddenStreams: entries(stored.hiddenStreams, validVideoId, hiddenLimit),
    hiddenCreators: entries(stored.hiddenCreators, validChannelId, hiddenLimit),
    creators: entries(stored.creators, validChannelId, creatorLimit)
  };
}
load();

function change(update, notify = true) {
  // Use the most recent browser data when another tab has saved a change.
  load();
  const next = update(data);
  if (!next) return true;
  try { localStorage.setItem(storageKey, JSON.stringify(next)); }
  catch { return false; }
  data = next;
  if (notify) window.dispatchEvent(new Event('wlng-library-change'));
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    load();
    window.dispatchEvent(new Event('wlng-library-change'));
  });
}

export const streamLibrary = {
  remember(streams) {
    const latest = new Map();
    for (const stream of streams) {
      const id = stream.channel?.id;
      if (!validChannelId(id)) continue;
      const previous = latest.get(id);
      const name = channelName(stream.channel) || previous?.name || '';
      const photo = safeChannelPhoto(stream.channel?.photo) || previous?.photo || '';
      if (name || photo) latest.set(id, { id, name, photo });
    }
    if (!latest.size) return;
    change(current => {
      const old = new Map(current.creators.map(item => [item.id, item]));
      const merged = [...latest.values()].map(item => ({
        id: item.id, name: item.name || shortText(old.get(item.id)?.name, 128),
        photo: item.photo || safeChannelPhoto(old.get(item.id)?.photo)
      }));
      if (merged.every(item => {
        const previous = old.get(item.id);
        return previous?.name === item.name && (previous.photo || '') === item.photo;
      })) return null;
      return { ...current, creators: [...merged, ...current.creators.filter(item => !latest.has(item.id))].slice(0, creatorLimit) };
    }, false);
  },
  creator(id) {
    const item = data.creators.find(item => item.id === id);
    return { name: shortText(item?.name, 128), photo: safeChannelPhoto(item?.photo) };
  },
  record(stream) {
    if (!validVideoId(stream?.id)) return false;
    const entry = streamEntry(stream);
    return change(current => ({
      ...current,
      history: [{ ...entry, openedAt: Date.now() }, ...current.history.filter(item => item.id !== entry.id)].slice(0, historyLimit)
    }), false);
  },
  history() { return [...data.history]; },
  clearHistory() { return change(current => ({ ...current, history: [] })); },
  creatorHidden(id) { return data.hiddenCreators.some(entry => entry.id === id); },
  isHidden(stream) {
    return data.hiddenStreams.some(entry => entry.id === stream.id) || this.creatorHidden(stream.channel?.id);
  },
  hide(type, stream) {
    const entry = streamEntry(stream);
    const creator = type === 'creator';
    const key = creator ? 'hiddenCreators' : 'hiddenStreams';
    const item = creator ? { id: entry.channelId, title: entry.channelName || entry.channelId } : entry;
    if (!(creator ? validChannelId(item.id) : validVideoId(item.id))) return false;
    return change(current => {
      if (current[key].some(existing => existing.id === item.id)) return null;
      if (current[key].length >= hiddenLimit) throw new Error('Your hidden list is full. Restore an item in Settings first.');
      return { ...current, [key]: [item, ...current[key]] };
    });
  },
  hidden() { return { streams: [...data.hiddenStreams], creators: [...data.hiddenCreators] }; },
  restore(type, id) {
    const key = type === 'creator' ? 'hiddenCreators' : 'hiddenStreams';
    return change(current => ({ ...current, [key]: current[key].filter(item => item.id !== id) }));
  }
};
