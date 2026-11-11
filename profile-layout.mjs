import { badgeStyle, profileAwards, profileIcons, skinPaint } from './cosmetics.mjs';
import { profileFrames, profileTitles } from './profile-cosmetics.mjs';

export const columns = 12;
export const rows = 20;
export const rowHeight = 36;
const baseItems = {
  box: ['Card frame', [0, 2, 9, 4]],
  username: ['Username', [2, 2, 7, 2]],
  level: ['Level icon and text', [0, 2, 2, 4]],
  title: ['Title', [2, 4, 7, 2]],
  xp: ['XP bar', [0, 6, 9, 1]],
  description: ['Description', [0, 7, 9, 2]],
  agency: ['Agency logo', [9, 2, 3, 5]]
};
export const layoutItems = {
  ...baseItems,
  ...Object.fromEntries(profileAwards.map(([id, name], index) => [
    'badge-' + id, [name + ' badge', [2 * (index % 6), Math.floor(index / 6), 2, 2]]
  ]))
};

export function validProfileLayout(value) {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, rect]) => {
    if (!Object.hasOwn(layoutItems, id) || !Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isInteger)) return false;
    const [x, y, w, h] = rect;
    return x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= columns && y + h <= rows;
  });
}

export function readProfileLayout(value) {
  try {
    const layout = JSON.parse(value ?? 'null');
    return validProfileLayout(layout) ? layout : null;
  } catch {
    return null;
  }
}

export const itemRect = (layout, id) => layout?.[id] ?? layoutItems[id][1];
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const within = ([x, y, w, h], [bx, by, bw, bh]) => x >= bx && y >= by && x + w <= bx + bw && y + h <= by + bh;

export function renderProfileGrid(profile, layout, editing = false) {
  if (!layout || !validProfileLayout(layout)) return '';
  const frame = profileFrames.find(([id]) => id === profile.profileFrame)?.[0] ?? 'classic';
  const title = profileTitles.find(option => option.id === profile.profileTitle && option.id !== 'none')?.name;
  const agency = profileIcons.find(([id]) => id === profile.profileIcon && id !== 'none');
  const level = Number.isSafeInteger(profile.level) && profile.level > 0 ? profile.level : 1;
  const xp = Number.isFinite(profile.xp) ? profile.xp : 0;
  const required = Number.isFinite(profile.required) && profile.required > 0 ? profile.required : 100;
  const percent = Math.max(0, Math.min(100, xp / required * 100));
  const renderBadge = ([id, name, description]) => {
    const image = `<img class="profile-award" src="/assets/profile-badges/${id}.png?v=20261111-badges2" alt="">`;
    if (editing) return image;
    return `<button type="button" class="profile-award-item" aria-label="${escape(name)}" aria-describedby="award-tip-${id}">${image}<span class="award-tooltip" id="award-tip-${id}" role="tooltip">${escape(description)}</span></button>`;
  };
  const content = {
    box: `<div class="profile-card-frame" data-frame="${frame}"><div class="profile-top"></div></div>`,
    username: `<h1>@${escape(profile.username || 'preview')}</h1>`,
    level: `<span class="badge level-icon badge-${badgeStyle(profile.badge, level)}" data-digits="${String(level).length}">${level}</span><small>Level ${level}</small>`,
    title: title || editing ? `<p class="profile-title">${escape(title || 'Title')}</p>` : '',
    xp: `<div class="progress" role="progressbar" aria-label="XP for this level" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${Math.max(0, Math.min(xp, required))}"><div class="fill" style="width:${percent}%"></div><span class="progress-label">${xp.toFixed(1)} / ${required} XP</span></div>`,
    description: profile.description || editing ? `<p class="description">${escape(profile.description || 'Description')}</p>` : '',
    agency: agency ? `<img class="grid-agency" src="/assets/profile-icons/${agency[0]}.png" alt="${agency[1]}">` : editing ? '<span class="grid-placeholder">Agency logo</span>' : ''
  };
  for (const badge of profileAwards) {
    if (profile.profileBadges?.includes(badge[0])) content['badge-' + badge[0]] = renderBadge(badge);
  }
  let usedRows = editing ? rows : 1;
  const markup = Object.entries(content).map(([id, html]) => {
    if (!html) return '';
    const [x, y, w, h] = itemRect(layout, id);
    usedRows = Math.max(usedRows, y + h);
    const mirrored = frame === 'reversed' && ['username', 'level', 'title'].includes(id) && within([x, y, w, h], itemRect(layout, 'box'));
    return `<div class="layout-item${mirrored ? ' layout-mirror' : ''}" data-item="${id}" style="grid-area:${y + 1}/${x + 1}/span ${h}/span ${w}">${html}</div>`;
  }).join('');
  return `<section class="profile-grid${editing ? ' editing' : ''}" aria-label="Profile layout" style="--layout-rows:${usedRows};--layout-cell:${rowHeight}px;--skin:${skinPaint(profile.skin, level)}">${markup}</section>`;
}

export const profileGridCss = `
.profile-grid{display:grid;position:relative;isolation:isolate;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:repeat(var(--layout-rows),minmax(var(--layout-cell),auto))}
.layout-item{min-width:0;position:relative;display:flex;align-items:center;justify-content:flex-start;overflow-wrap:anywhere;z-index:2}
.layout-item[data-item="box"]{z-index:0;display:block;pointer-events:none}
.layout-item[data-item="box"] .profile-card-frame,.layout-item[data-item="box"] .profile-top{height:100%}
.layout-item[data-item="box"] .profile-top{position:relative;isolation:isolate;padding:0;background-color:var(--profile-front,#19191e);border:1px solid var(--profile-border,#35353e)}
.layout-item[data-item="box"] .profile-top::before{content:"";position:absolute;z-index:-1;inset:4px -4px -4px 4px;transform:rotate(-1deg);background:var(--profile-back,#111116);border:1px solid var(--profile-border,#30303b)}
.layout-item[data-item="agency"]{z-index:1;pointer-events:none}
.grid-agency{max-width:100%;max-height:100%;height:100%;width:100%;object-fit:contain;opacity:.3}
.layout-item[data-item="username"] h1,.layout-item[data-item="title"] .profile-title,.layout-item .description{margin:0;padding:0 5px}
.layout-item[data-item="username"] h1{font-size:clamp(16px,4vw,30px);line-height:1.2;color:var(--profile-accent,inherit)}
.layout-item[data-item="level"]{flex-direction:column;justify-content:center;text-align:center;gap:3px}
.layout-item[data-item="level"] .badge{width:min(100%,52px);height:auto;aspect-ratio:1;display:grid;place-items:center}
.layout-item .progress{width:100%;height:24px;margin:0;position:relative;border:1px solid var(--profile-border,#34343b);background:#252529;overflow:hidden}
.layout-item .fill{height:100%;background:var(--skin)}
.layout-item .progress-label{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;color:white;text-shadow:0 1px 2px #000,0 0 3px #000}
.layout-item .profile-award-item,.layout-item .profile-award{width:min(100%,64px);height:auto;aspect-ratio:1;flex:auto}
.layout-item .profile-award-item{flex:none}
.layout-item:has(.profile-award-item:is(:focus,:hover)){z-index:4}
.layout-mirror{transform:scaleX(-1)}
main:has(.profile-grid){width:auto;max-width:960px;margin-inline:clamp(18px,6vw,90px)}
`;
