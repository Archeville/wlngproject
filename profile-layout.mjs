import { badgeStyle, profileAwards, profileIcons, skinPaint } from './cosmetics.mjs';
import { profileFrames, profileTitles } from './profile-cosmetics.mjs';

export const columns = 12;
export const rows = 15;
export const placement = { left: -6, top: -6, right: 18, bottom: 26, maxWidth: 12, maxHeight: 20 };
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
    if (!Object.hasOwn(layoutItems, id) || !Array.isArray(rect) || ![4, 5].includes(rect.length) || !rect.every(Number.isInteger)) return false;
    const [x, y, w, h, scale = 1] = rect;
    return x >= placement.left && y >= placement.top &&
      w >= 1 && w <= placement.maxWidth && h >= 1 && h <= placement.maxHeight &&
      x + w <= placement.right && y + h <= placement.bottom && scale >= 1 && scale <= 3;
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
export function resizeItem(layout, id, scale) {
  const [x, y] = itemRect(layout, id);
  const [, , width, height] = layoutItems[id][1];
  const w = Math.min(width * scale, placement.maxWidth);
  const h = Math.min(height * scale, placement.maxHeight);
  return [Math.min(x, placement.right - w), Math.min(y, placement.bottom - h), w, h, scale];
}

export function gridArea([x, y, w, h], left, top) {
  return `${y - top + 1}/${x - left + 1}/span ${h}/span ${w}`;
}

export function layoutBounds(rectangles) {
  return {
    left: Math.min(0, ...rectangles.map(([x]) => x)),
    top: Math.min(0, ...rectangles.map(([, y]) => y)),
    right: Math.max(columns, ...rectangles.map(([x, , w]) => x + w)),
    bottom: Math.max(rows, ...rectangles.map(([, y, , h]) => y + h))
  };
}
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
    if (editing) return `<span class="profile-award-item">${image}</span>`;
    return `<button type="button" class="profile-award-item" aria-label="${escape(name)}" aria-describedby="award-tip-${id}">${image}<span class="award-tooltip" id="award-tip-${id}" role="tooltip">${escape(description)}</span></button>`;
  };
  const content = {
    box: `<div class="profile-card-frame" data-frame="${frame}"><div class="profile-top"></div></div>`,
    username: `<h1>@${escape(profile.username || 'preview')}</h1>`,
    level: `<span class="badge level-icon badge-${badgeStyle(profile.badge, level)}" data-digits="${String(level).length}">${level}</span><small>Level ${level}</small>`,
    title: title || editing ? `<p class="profile-title">${escape(title || 'Title')}</p>` : '',
    xp: `<div class="progress" role="progressbar" aria-label="XP for this level" aria-valuemin="0" aria-valuemax="${required}" aria-valuenow="${Math.max(0, Math.min(xp, required))}"><div class="fill" style="width:${percent}%"></div><span class="progress-label">${xp.toFixed(1)} / ${required} XP</span></div>`,
    description: profile.description || editing ? `<p class="description"${editing ? '' : ' tabindex="0"'}>${escape(profile.description || 'Description')}</p>` : '',
    agency: agency ? `<img class="grid-agency" src="/assets/profile-icons/${agency[0]}.png" alt="${agency[1]}">` : editing ? '<span class="grid-placeholder">Agency logo</span>' : ''
  };
  for (const badge of profileAwards) {
    if (profile.profileBadges?.includes(badge[0])) content['badge-' + badge[0]] = renderBadge(badge);
  }
  const items = Object.entries(content).filter(([, html]) => html);
  const rectangles = items.map(([id]) => itemRect(layout, id));
  const bounds = layoutBounds(rectangles);
  const margin = editing ? 2 : 0;
  const left = Math.max(placement.left, bounds.left - margin);
  const top = Math.max(placement.top, bounds.top - margin);
  const right = Math.min(placement.right, bounds.right + margin);
  const bottom = Math.min(placement.bottom, bounds.bottom + margin);
  const width = right - left;
  const height = bottom - top;
  const markup = items.map(([id, html], index) => {
    const rect = rectangles[index];
    const [x, y] = rect;
    const scale = rect[4] ?? 1;
    const mirrored = frame === 'reversed' && ['username', 'level', 'title'].includes(id) && within(rect, itemRect(layout, 'box'));
    const tooltipPlacement = !editing && id.startsWith('badge-')
      ? ` data-tip-vertical="${y - top < height / 2 ? 'below' : 'above'}" data-tip-horizontal="${x - left < width / 2 ? 'left' : 'right'}"`
      : '';
    return `<div class="layout-item${mirrored ? ' layout-mirror' : ''}" data-item="${id}" style="grid-area:${gridArea(rect, left, top)};--object-scale:${scale}"${tooltipPlacement}>${html}</div>`;
  }).join('');
  const guide = editing ? `<div class="canvas-outline" aria-hidden="true" style="grid-area:${gridArea([0, 0, columns, rows], left, top)}"></div><div class="layout-expansion-outline" aria-hidden="true" hidden></div>` : '';
  // Cell proportions make the central columns × rows rectangle exactly 16:9.
  const aspect = `${width * 16 * rows}/${height * 9 * columns}`;
  // Leave room below the grid for artwork taller than the cells it occupies.
  const artSizes = { level:'var(--level-size) + 15px', agency:'var(--agency-size)', xp:'var(--progress-size)' };
  const overhangs = editing ? [] : items.flatMap(([id], index) => {
    const size = id.startsWith('badge-') ? 'var(--award-size)' : artSizes[id];
    if (!size) return [];
    const [, y, , , scale = 1] = rectangles[index];
    return [`calc((${size}) * ${scale} - var(--cell-height) * ${bottom - y})`];
  });
  const tail = overhangs.length ? `;--grid-tail:max(0px,${overhangs.join(',')})` : '';
  const grid = `<section class="profile-grid${editing ? ' editing' : ''}" aria-label="Profile layout" data-left="${left}" data-top="${top}" data-columns="${width}" data-rows="${height}" style="--layout-columns:${width};--layout-rows:${height};aspect-ratio:${aspect};--skin:${skinPaint(profile.skin, level)}${tail}">${guide}${markup}</section>`;
  return editing ? grid : `<div class="profile-grid-viewport"${width > columns ? ' tabindex="0" role="region" aria-label="Scrollable profile layout"' : ''}>${grid}</div>`;
}

export const profileGridCss = `
.profile-grid-viewport{container-type:inline-size;overflow-x:auto;overflow-y:hidden;padding:24px 8px;max-width:1740px}
.profile-grid-viewport,.profile-grid .description{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--profile-border,#55555d) 80%,#aaa) transparent}
:root:has(.profile-grid-viewport){scrollbar-width:thin;scrollbar-color:var(--profile-scroll-thumb,#626268) transparent}
.profile-grid{--canvas-width:min(100cqw,860px);--cell-height:calc(var(--canvas-width) * 9 / 240);--award-size:64px;--level-size:65px;--username-size:30px;--progress-size:24px;--agency-size:min(34vw,420px);display:grid;position:relative;isolation:isolate;grid-template-columns:repeat(var(--layout-columns),minmax(0,1fr));grid-template-rows:repeat(var(--layout-rows),minmax(0,1fr));width:calc(var(--canvas-width) * var(--layout-columns) / 12);margin-bottom:var(--grid-tail,0px)}
.layout-item{min-width:0;position:relative;display:flex;align-items:center;justify-content:flex-start;overflow-wrap:anywhere;z-index:2}
.profile-grid-viewport .layout-item{align-items:safe center}
.layout-item[data-item="box"]{z-index:0;display:block;pointer-events:none}
.layout-item[data-item="box"] .profile-card-frame,.layout-item[data-item="box"] .profile-top{height:100%}
.layout-item[data-item="box"] .profile-top{position:relative;isolation:isolate;padding:0;background-color:var(--profile-front,#19191e);border:1px solid var(--profile-border,#35353e)}
.layout-item[data-item="box"] .profile-top::before{content:"";position:absolute;z-index:-1;inset:4px -4px -4px 4px;transform:rotate(-1deg);background:var(--profile-back,#111116);border:1px solid var(--profile-border,#30303b)}
.layout-item[data-item="agency"]{z-index:1;pointer-events:none}
.grid-agency{width:calc(var(--agency-size) * var(--object-scale));height:calc(var(--agency-size) * var(--object-scale));max-width:none;flex:none;object-fit:contain;opacity:.3}
.layout-item[data-item="username"] h1,.layout-item[data-item="title"] .profile-title,.layout-item .description{margin:0;padding:0 5px;min-width:0}
.layout-item[data-item="username"] h1{overflow:visible;overflow-wrap:anywhere;font-size:calc(var(--username-size) * var(--object-scale));line-height:1.2;color:var(--profile-accent,inherit)}
.layout-item[data-item="title"] .profile-title{font-size:calc(14px * var(--object-scale));line-height:1.3}
.layout-item .description{white-space:pre-wrap;font-size:calc(15px * var(--object-scale));line-height:1.45;max-height:100%;overflow:auto}
.layout-item[data-item="level"]{flex-direction:column;justify-content:center;text-align:center;gap:3px}
.profile-grid-viewport .layout-item[data-item="level"]{justify-content:safe center}
.layout-item[data-item="level"] .badge{width:calc(var(--level-size) * var(--object-scale));height:calc(var(--level-size) * var(--object-scale));flex:none;display:grid;place-items:center}
.layout-item[data-item="level"] small{font-size:calc(12.5px * var(--object-scale));line-height:1.2}
.profile-grid .layout-item .badge.level-icon{font-size:calc(15px * var(--object-scale))!important}
.profile-grid .layout-item .badge.level-icon[data-digits="3"]{font-size:calc(11px * var(--object-scale))!important}
.profile-grid .layout-item .badge.level-icon[data-digits="4"]{font-size:calc(9px * var(--object-scale))!important}
.profile-grid .layout-item .badge.level-icon[data-digits="5"]{font-size:calc(8px * var(--object-scale))!important}
.layout-item .progress{width:100%;height:calc(var(--progress-size) * var(--object-scale));margin:0;position:relative;border:1px solid var(--profile-border,#34343b);background:#252529;overflow:hidden}
.layout-item .fill{height:100%;background:var(--skin)}
.layout-item .progress-label{position:absolute;inset:0;display:grid;place-items:center;font-size:calc(11px * var(--object-scale));color:white;text-shadow:0 1px 2px #000,0 0 3px #000}
.layout-item .profile-award-item{width:calc(var(--award-size) * var(--object-scale));height:calc(var(--award-size) * var(--object-scale));flex:none}
.layout-item .profile-award-item .profile-award{width:100%;height:100%;object-fit:contain}
.profile-grid .award-tooltip{position:absolute;inset:auto!important;max-width:min(210px,40cqw)}
.profile-grid [data-tip-vertical="below"] .award-tooltip{top:calc(100% + 6px)!important}
.profile-grid [data-tip-vertical="above"] .award-tooltip{bottom:calc(100% + 6px)!important}
.profile-grid [data-tip-horizontal="left"] .award-tooltip{left:0!important}
.profile-grid [data-tip-horizontal="right"] .award-tooltip{right:0!important}
.layout-item:has(.profile-award-item:is(:focus,:hover)){z-index:4}
.layout-mirror{transform:scaleX(-1)}
main:has(.profile-grid){width:auto;max-width:none;margin-inline:clamp(18px,6vw,90px)}
@media(max-width:780px){.profile-grid{--level-size:54px;--username-size:clamp(21px,5.7vw,28px);--progress-size:28px;--agency-size:min(44vw,240px)}}
@media(max-width:360px){.profile-grid{--level-size:46px;--award-size:56px}}
`;
