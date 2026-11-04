(() => {
  const $ = (s) => document.querySelector(s);
  const state = { tab: 'live', streams: [], updated: null };
  const reducedMotion = () => document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (element, frames, options = {}) => {
    if (reducedMotion() || !element.animate) return null;
    return element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
  };
  const closingDialogs = new WeakSet();
  function openDialog(dialog) {
    if (dialog.open) return;
    dialog.showModal();
    animate(dialog, [{ opacity: 0, transform: 'translateY(20px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 340 });
  }
  function closeDialog(dialog) {
    if (!dialog.open || closingDialogs.has(dialog)) return;
    closingDialogs.add(dialog);
    const animation = animate(dialog, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.97)' }], { duration: 200 });
    const finish = () => { dialog.close(); closingDialogs.delete(dialog); };
    if (animation) animation.finished.then(finish, finish); else finish();
  }
  function animateResults() {
    if (!$('#status').hidden) animate($('#status'), [{ opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }]);
    $('#grid').querySelectorAll('.card').forEach((card, index) => animate(card, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { delay: Math.min(index, 7) * 18, fill: 'backwards' }));
  }
  function updateTabIndicator() {
    const tabs = $('.tabs'); const selected = $('.tab.active');
    tabs.style.setProperty('--tab-x', `${selected.offsetLeft}px`);
    tabs.style.setProperty('--tab-width', `${selected.offsetWidth}px`);
  }
  const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
  const safeImage = (url) => { try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname.endsWith('.googleusercontent.com') || u.hostname.endsWith('.ggpht.com')) ? u.href : ''; } catch { return ''; } };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = (value) => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Time to be announced' : new Intl.DateTimeFormat(undefined, { weekday:'short', hour:'numeric', minute:'2-digit', month:'short', day:'numeric' }).format(d); };
  const message = (html) => { $('#status').innerHTML = html; $('#status').hidden = false; };
  function render() {
    const query = $('#search').value.trim().toLocaleLowerCase();
    const items = state.streams.filter(x => x.status === state.tab && `${x.title} ${x.channel?.name} ${x.channel?.english_name}`.toLocaleLowerCase().includes(query));
    $('#live-count').textContent = state.streams.filter(x => x.status === 'live').length;
    $('#upcoming-count').textContent = state.streams.filter(x => x.status === 'upcoming').length;
    $('#list-label').textContent = state.tab === 'live' ? 'LIVE RIGHT NOW' : 'COMING UP';
    $('#result-label').innerHTML = `${items.length} STREAM${items.length === 1 ? '' : 'S'} <b>✧</b>`;
    $('#grid').innerHTML = items.map(x => {
      const name = x.channel?.english_name || x.channel?.name || 'Unknown channel';
      const photo = safeImage(x.channel?.photo); const label = x.status === 'live' ? '● LIVE' : esc(time(x.start_scheduled || x.available_at));
      const viewers = Number.isFinite(x.live_viewers) ? `${new Intl.NumberFormat().format(x.live_viewers)} watching` : '';
      return `<article class="card" tabindex="0" role="button" data-id="${esc(x.id)}" aria-label="Watch ${esc(x.title)}"><div class="thumbnail"><img loading="lazy" src="https://i.ytimg.com/vi/${esc(x.id)}/hqdefault.jpg" alt=""><span class="badge ${x.status === 'upcoming' ? 'upcoming' : ''}">${label}</span></div><div class="card-body">${photo ? `<img class="avatar" loading="lazy" src="${esc(photo)}" alt="">` : '<span class="avatar"></span>'}<div class="card-text"><h3>${esc(x.title)}</h3><p>${esc(name)}</p><span class="extra">${esc(viewers)}</span></div></div></article>`;
    }).join('');
    if (!items.length) message(query ? '<strong>No matches found.</strong><br>Try a different search.' : '<strong>Nothing here just yet.</strong><br>Check back soon or explore the other tab.'); else $('#status').hidden = true;
    animateResults();
  }
  async function load() {
    const base = window.WLNG_CONFIG?.apiBase?.trim();
    if (!base) { message('<strong>Streams will be here soon.</strong><br>The stream feed is not connected yet. Come back once WLNG is ready to go live.'); $('#updated').textContent = 'Feed not connected'; return; }
    try {
      const url = new URL('/api/streams', base); const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Feed unavailable'); const data = await response.json();
      if (!Array.isArray(data.streams)) throw new Error('Invalid feed');
      state.streams = data.streams.filter(x => validId(x.id) && ['live','upcoming'].includes(x.status)); state.updated = data.updatedAt;
      const stamp = data.updatedAt ? new Date(data.updatedAt) : null;
      $('#updated').textContent = stamp && !Number.isNaN(stamp.valueOf()) ? `${data.stale ? 'CACHED · ' : ''}UPDATED ${stamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'STREAM FEED CONNECTED'; render();
    } catch { $('#updated').textContent = 'CONNECTION INTERRUPTED'; message('<strong>We couldn’t load the stream feed.</strong><br>Please try again in a little while.'); }
  }
  function play(id) {
    const item = state.streams.find(x => x.id === id); if (!item || !validId(id)) return;
    $('#player-title').textContent = item.title || 'YouTube stream'; $('#player-channel').textContent = item.channel?.english_name || item.channel?.name || '';
    $('#youtube-link').href = `https://www.youtube.com/watch?v=${id}`;
    const frame = document.createElement('iframe'); frame.src = `https://www.youtube.com/embed/${id}?playsinline=1`; frame.title = item.title || 'YouTube stream'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin'; $('#player-slot').replaceChildren(frame); openDialog($('#player-dialog'));
  }
  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => { if (state.tab === button.dataset.tab) return; state.tab = button.dataset.tab; document.querySelectorAll('.tab').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); }); $('#list-label').textContent = state.tab === 'live' ? 'LIVE RIGHT NOW' : 'COMING UP'; updateTabIndicator(); if (state.updated) render(); else animateResults(); }));
  new ResizeObserver(updateTabIndicator).observe($('.tabs'));
  document.fonts?.ready.then(updateTabIndicator);
  updateTabIndicator();
  $('#search').addEventListener('input', () => { if (state.updated) render(); });
  $('#grid').addEventListener('click', e => { const card = e.target.closest('[data-id]'); if (card) play(card.dataset.id); });
  $('#grid').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) { e.preventDefault(); play(e.target.dataset.id); } });
  $('#settings-open').addEventListener('click', () => openDialog($('#settings-dialog')));
  $('#sidebar-settings').addEventListener('click', () => openDialog($('#settings-dialog')));
  const mobile = window.matchMedia('(max-width: 780px)');
  const updateNavigation = () => {
    const expanded = mobile.matches ? document.body.classList.contains('nav-collapsed') : !document.body.classList.contains('nav-collapsed');
    $('#menu-toggle').setAttribute('aria-expanded', String(expanded));
    $('#sidebar').inert = !expanded;
  };
  $('#menu-toggle').addEventListener('click', () => { document.body.classList.toggle('nav-collapsed'); updateNavigation(); });
  mobile.addEventListener('change', () => { document.body.classList.remove('nav-collapsed'); updateNavigation(); });
  updateNavigation();
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(document.getElementById(b.dataset.close))));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog);
    });
  });
  $('#player-dialog').addEventListener('close', () => $('#player-slot').replaceChildren());
  document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('#search').focus(); } });
  const pref = (key, value) => { try { if (value !== undefined) localStorage.setItem(key, value); return localStorage.getItem(key); } catch { return null; } };
  function setTheme(value) {
    const theme = ['white', 'black', 'black-purple'].includes(value) ? value : 'black';
    document.documentElement.dataset.theme = theme;
    $('#theme').value = theme;
    pref('wlng-theme-v2', theme);
  }
  setTheme(pref('wlng-theme-v2'));
  $('#theme').addEventListener('change', event => setTheme(event.target.value));
  $('#reduce-motion').checked = pref('wlng-motion') === 'true'; document.body.classList.toggle('reduce-motion', $('#reduce-motion').checked);
  $('#reduce-motion').addEventListener('change', e => { document.body.classList.toggle('reduce-motion', e.target.checked); pref('wlng-motion', String(e.target.checked)); });
  function setDensity(value) {
    const cards = [...$('#grid').querySelectorAll('.card')];
    const positions = cards.map(card => card.getBoundingClientRect());
    const compact = value === 'compact';
    $('#density').value = compact ? 'compact' : 'comfortable';
    document.body.classList.toggle('compact', compact);
    $('#density-toggle').setAttribute('aria-label', compact ? 'Switch to comfortable grid' : 'Switch to compact grid');
    pref('wlng-density', $('#density').value);
    cards.forEach((card, index) => {
      const after = card.getBoundingClientRect(); const before = positions[index];
      animate(card, [{ transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` }, { transform: 'none' }], { duration: 280 });
    });
  }
  setDensity(pref('wlng-density'));
  $('#density').addEventListener('change', e => setDensity(e.target.value));
  $('#density-toggle').addEventListener('click', () => setDensity(document.body.classList.contains('compact') ? 'comfortable' : 'compact'));
  load();
})();
