export const maxFavoriteTabs = 10;
export const maxFavoriteChannels = 100;
export const favoriteAgencies = ['all', 'Hololive', 'Nijisanji', 'Independents'];
export const validFavoriteChannel = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(id);
export const defaultFavorites = (channels = []) => [{
  id: 'favorites', type: 'channels', name: 'Favorites',
  channels: [...new Set(Array.isArray(channels) ? channels.filter(validFavoriteChannel) : [])].slice(0, maxFavoriteChannels)
}];

function validText(value, limit) {
  return typeof value === 'string' && value.length >= 1 && value.length <= limit &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function validFavoriteTabs(tabs) {
  if (!Array.isArray(tabs) || tabs.length < 1 || tabs.length > maxFavoriteTabs) return false;
  const defaultTab = tabs.find(tab => tab?.id === 'favorites');
  if (defaultTab?.type !== 'channels' || defaultTab.name !== 'Favorites') return false;
  const ids = new Set(), names = new Set();
  return tabs.every(tab => {
    if (!tab || typeof tab !== 'object' || Array.isArray(tab) ||
        !(tab.id === 'favorites' || (typeof tab.id === 'string' && /^[a-f0-9-]{36}$/.test(tab.id))) ||
        !validText(tab.name, 32) || ids.has(tab.id) || names.has(tab.name.toLowerCase())) return false;
    ids.add(tab.id);
    names.add(tab.name.toLowerCase());
    if (tab.type === 'channels') {
      return Object.keys(tab).length === 4 && Array.isArray(tab.channels) &&
        tab.channels.length <= maxFavoriteChannels && new Set(tab.channels).size === tab.channels.length &&
        tab.channels.every(validFavoriteChannel);
    }
    if (tab.type !== 'rules' || Object.keys(tab).length !== 4 || !tab.rules ||
        typeof tab.rules !== 'object' || Array.isArray(tab.rules)) return false;
    const rules = Object.entries(tab.rules);
    return rules.length > 0 && rules.every(([key, value]) => {
      if (key === 'title') return validText(value, 120);
      if (key === 'agency') return favoriteAgencies.includes(value);
      if (key === 'minViewers') return Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000_000;
      return false;
    });
  });
}

export function matchesFavoriteTab(tab, stream, status = stream.status) {
  if (tab.type === 'channels') return tab.channels.includes(stream.channel?.id);
  const { title, agency, minViewers } = tab.rules;
  return (!title || (typeof stream.title === 'string' && stream.title.toLowerCase().includes(title.toLowerCase()))) &&
    (!agency || agency === 'all' || stream.channel?.org === agency) &&
    (status !== 'live' || !minViewers || (Number.isFinite(stream.live_viewers) && stream.live_viewers >= minViewers));
}
