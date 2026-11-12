import { relatedLives, isOperaGXBrowser } from './watch-utils.mjs?v=20261105-profilecolors1';
import { setupFavorites } from './favorites.js?v=20261112-favoriteviewers1';
(() => {
  const $ = (s) => document.querySelector(s);
  const state = { tab: 'live', org: 'Hololive', streams: [], updated: null, favoritesOnly: false, playerId: null };
  const pref = (key, value) => { try { if (value !== undefined) localStorage.setItem(key, value); return localStorage.getItem(key); } catch { return null; } };
  const validOrgs = ['Hololive', 'Nijisanji', 'Independents', 'all'];
  state.org = validOrgs.includes(pref('wlng-default-org')) ? pref('wlng-default-org') : 'Hololive';
  const creatorId = item => typeof item.channel?.id === 'string' ? item.channel.id : '';
  const streamStatus = item => { const scheduled = Date.parse(item.start_scheduled); return item.status === 'live' && !item.start_actual && Number.isFinite(scheduled) && scheduled > Date.now() ? 'upcoming' : item.status; };
  function updatePlayerFavorite() {
    const item = state.streams.find(x => x.id === state.playerId);
    const button = $('#player-favorite');
    button.disabled = !item || !creatorId(item);
    button.textContent = item && favorites.contains(creatorId(item)) ? '♥ Favorited' : '♡ Favorite creator';
  }
  const reducedMotion = () => document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = (element, frames, options = {}) => {
    if (reducedMotion() || !element.animate) return null;
    return element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
  };
  const closingDialogs = new WeakSet();
  function openDialog(dialog) {
    if (dialog.open) return;
    closeMobileNavigation();
    dialog.showModal();
    if(dialog.id==='settings-dialog')window.dispatchEvent(new Event('wlng-settings-open'));
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
  function extraFilters(){return !state.favoritesOnly && ['all','Independents'].includes(state.org);}
  function updateFilters(){$('#stream-filters').hidden=!extraFilters();}
  updateFilters();
  for(const id of ['filter-name','filter-viewers'])$('#'+id).addEventListener('input',()=>{if(state.updated)render();});
  $('#filters-clear').addEventListener('click',()=>{$('#filter-name').value='';$('#filter-viewers').value='0';if(state.updated)render();});
  function render() {
    updateAgencyNavigation();
    const query = $('#search').value.trim().toLocaleLowerCase();
    const nameQuery=extraFilters()?$('#filter-name').value.trim().toLocaleLowerCase():'';const minViewers=extraFilters()?Math.max(0,Math.min(1e9,Number($('#filter-viewers').value)||0)):0;
    const viewStreams = state.streams.filter(x => state.favoritesOnly ? favorites.matches(x, streamStatus(x)) : state.org === 'all' || x.channel?.org === state.org);
    const items = viewStreams.filter(x => (!nameQuery||((x.channel?.name||'')+' '+(x.channel?.english_name||'')).toLocaleLowerCase().includes(nameQuery)) && (minViewers===0||(Number.isFinite(x.live_viewers)&&x.live_viewers>=minViewers)) && streamStatus(x) === state.tab && `${x.title} ${x.channel?.name} ${x.channel?.english_name}`.toLocaleLowerCase().includes(query));
    $('#live-count').textContent = viewStreams.filter(x => streamStatus(x) === 'live').length;
    $('#upcoming-count').textContent = viewStreams.filter(x => streamStatus(x) === 'upcoming').length;
    $('#list-label').textContent = state.tab === 'live' ? 'LIVE RIGHT NOW' : 'COMING UP';
    $('#result-label').innerHTML = `${items.length} STREAM${items.length === 1 ? '' : 'S'} <b>✧</b>`;
    $('#grid').innerHTML = items.map(x => {
      const name = x.channel?.english_name || x.channel?.name || 'Unknown channel';
      const photo = safeImage(x.channel?.photo); const label = streamStatus(x) === 'live' ? '● LIVE' : esc(time(x.start_scheduled || x.available_at));
      const viewers = Number.isFinite(x.live_viewers) ? `${new Intl.NumberFormat().format(x.live_viewers)} watching` : '';
      return `<article class="card" tabindex="0" role="button" data-id="${esc(x.id)}" aria-label="Watch ${esc(x.title)}"><div class="thumbnail"><img loading="lazy" src="https://i.ytimg.com/vi/${esc(x.id)}/hqdefault.jpg" alt=""><span class="badge ${streamStatus(x) === 'upcoming' ? 'upcoming' : ''}">${label}</span></div><div class="card-body">${photo ? `<img class="avatar" loading="lazy" src="${esc(photo)}" alt="">` : '<span class="avatar"></span>'}<div class="card-text"><h3>${esc(x.title)}</h3><p>${esc(name)}</p><span class="extra">${esc(viewers)}</span></div></div></article>`;
    }).join('');
    if (!items.length) message(state.favoritesOnly ? '<strong>No streams match this tab right now.</strong><br>Try the other stream status or choose another tab.' : query ? '<strong>No matches found.</strong><br>Try a different search.' : '<strong>Nothing here just yet.</strong><br>Check back soon or explore the other tab.'); else $('#status').hidden = true;
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
      window.WLNG_STREAMS=state.streams;window.dispatchEvent(new CustomEvent('wlng-streams',{detail:state.streams}));
      const stamp = data.updatedAt ? new Date(data.updatedAt) : null;
      $('#updated').textContent = stamp && !Number.isNaN(stamp.valueOf()) ? `${data.stale ? 'CACHED · ' : ''}UPDATED ${stamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'STREAM FEED CONNECTED'; render();
    } catch { $('#updated').textContent = 'CONNECTION INTERRUPTED'; message('<strong>We couldn’t load the stream feed.</strong><br>Please try again in a little while.'); }
  }
  function play(id, fromShare = false) {
    if (!validId(id)) return;
    const item = state.streams.find(x => x.id === id) ?? (fromShare ? { id, title: 'YouTube stream' } : null);
    if (!item) return;
    if (playerDialog.classList.contains('is-mini')) {
      if (state.playerId === id) { restoreMini(); return; }
      playerDialog.close();
      playerDialog.classList.remove('is-mini');
      miniControls.hidden = true;
      miniAnimation?.cancel();
    }
    closePip(false);pipStatus('');
    $('#player-dialog').classList.add('is-large'); $('#watch-large').textContent = 'Popup'; $('#watch-large').setAttribute('aria-pressed','true'); state.playerId = id; updatePlayerFavorite(); renderRelated(item); $('#chat-slot').replaceChildren(); showWatchPanel('activity'); $('#watch-main').scrollTop = 0; $('#watch-message').textContent = 'If playback is unavailable, open the stream on YouTube.';
    const viewers=$('#player-viewers');const hasViewers=streamStatus(item)==='live'&&Number.isFinite(item.live_viewers)&&item.live_viewers>=0;viewers.hidden=!hasViewers;viewers.textContent=hasViewers?new Intl.NumberFormat().format(item.live_viewers)+' watching':'';
    $('#player-title').textContent = item.title || 'YouTube stream'; $('#player-channel').textContent = item.channel?.english_name || item.channel?.name || 'YouTube';
    shareStatus.hidden = true;
    clearTimeout(shareTimer);
    $('#youtube-link').href = `https://www.youtube.com/watch?v=${id}`;
    $('#chat-youtube-link').href = $('#youtube-link').href;
    const frame = document.createElement('iframe'); frame.src = new URL('player-embed.html?video='+encodeURIComponent(id),location.href).href; frame.title = item.title || 'YouTube stream'; frame.allow = 'autoplay; encrypted-media; picture-in-picture; web-share'; frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin'; $('#player-slot').replaceChildren(frame); openDialog($('#player-dialog')); void loadDescription(item);
  }
  const playerDialog = $('#player-dialog');
  const miniControls = $('.mini-controls');
  const miniResize = $('#mini-resize');
  const miniSetting = $('#mini-on-close');
  const shareStatus = $('#watch-share-status');
  const watchClose = $('#watch-close');
  let shareTimer, miniAnimation, miniDrag, watchScroll;
  let miniWidth = Number(pref('wlng-mini-width')) || 340;
  miniSetting.checked = pref('wlng-mini-on-close') !== 'false';
  function labelPlayerClose() {
    const label = miniSetting.checked ? 'Minimize player' : 'Close player';
    watchClose.setAttribute('aria-label', label);
    watchClose.title = label;
  }
  labelPlayerClose();
  miniSetting.addEventListener('change', () => {
    pref('wlng-mini-on-close', String(miniSetting.checked));
    labelPlayerClose();
  });
  $('#watch-share').addEventListener('click', async () => {
    const id = state.playerId;
    if (!validId(id)) return;
    const link = new URL('./', location.href);
    link.searchParams.set('watch', id);
    try {
      await navigator.clipboard.writeText(link.href);
      if (state.playerId !== id) return;
      shareStatus.textContent = 'WLNG link copied';
      shareStatus.hidden = false;
      clearTimeout(shareTimer);
      shareTimer = setTimeout(() => { shareStatus.hidden = true; }, 2500);
    } catch {
      window.prompt('Copy the WLNG stream link', link.href);
    }
  });
  function applyMiniWidth(width = miniWidth) {
    const max = Math.max(1, Math.floor(Math.min(640, innerWidth - 24, (innerHeight - 80) * 16 / 9)));
    const min = Math.min(220, max);
    const actual = Math.round(Math.max(min, Math.min(max, width)));
    playerDialog.style.setProperty('--mini-width', actual + 'px');
    miniResize.setAttribute('aria-valuemin', String(min));
    miniResize.setAttribute('aria-valuemax', String(max));
    miniResize.setAttribute('aria-valuenow', String(actual));
    miniResize.setAttribute('aria-valuetext', actual + ' pixels');
    return actual;
  }
  function animatePlayerMove(before) {
    const after = $('#player-slot').getBoundingClientRect();
    if (!before.width || !before.height || !after.width || !after.height) return;
    miniAnimation = animate(playerDialog, [
      { transformOrigin: 'top left', transform: `translate(${before.left - after.left}px,${before.top - after.top}px) scale(${before.width / after.width},${before.height / after.height})` },
      { transformOrigin: 'top left', transform: 'none' }
    ], { duration: 320 });
  }
  async function minimizePlayer() {
    if (!playerDialog.open || playerDialog.classList.contains('is-mini') || closingDialogs.has(playerDialog)) return;
    if (!miniSetting.checked) { closeDialog(playerDialog); return; }
    if (document.fullscreenElement && playerDialog.contains(document.fullscreenElement)) {
      try { await document.exitFullscreen(); } catch { closeDialog(playerDialog); return; }
      if (!playerDialog.open || playerDialog.classList.contains('is-mini')) return;
    }
    if (operaPipDialog.open) operaPipDialog.close();
    closePip();
    miniAnimation?.cancel();
    const before = $('#player-slot').getBoundingClientRect();
    watchScroll = [$('#watch-main').scrollTop, $('#watch-shell').scrollTop];
    playerDialog.close();
    playerDialog.classList.add('is-mini');
    miniControls.hidden = false;
    applyMiniWidth();
    // Keep the iframe in the same DOM node when switching modal modes.
    playerDialog.show();
    $('#mini-restore').focus({ preventScroll: true });
    animatePlayerMove(before);
  }
  function restoreMini() {
    if (!playerDialog.open || !playerDialog.classList.contains('is-mini')) return;
    miniAnimation?.cancel();
    const before = $('#player-slot').getBoundingClientRect();
    playerDialog.close();
    playerDialog.classList.remove('is-mini');
    miniControls.hidden = true;
    closeMobileNavigation();
    playerDialog.showModal();
    if (watchScroll) {
      $('#watch-main').scrollTop = watchScroll[0];
      $('#watch-shell').scrollTop = watchScroll[1];
    }
    watchClose.focus({ preventScroll: true });
    animatePlayerMove(before);
  }
  watchClose.addEventListener('click', () => { void minimizePlayer(); });
  $('#mini-restore').addEventListener('click', restoreMini);
  $('#mini-close').addEventListener('click', () => {
    miniAnimation?.cancel();
    playerDialog.close();
  });
  miniResize.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    miniAnimation?.cancel();
    miniDrag = { id: event.pointerId, x: event.clientX, width: Number(miniResize.getAttribute('aria-valuenow')) };
    miniResize.setPointerCapture(event.pointerId);
  });
  miniResize.addEventListener('pointermove', event => {
    if (miniDrag?.id === event.pointerId) applyMiniWidth(miniDrag.width + miniDrag.x - event.clientX);
  });
  function saveMiniWidth(width) {
    miniWidth = applyMiniWidth(width);
    pref('wlng-mini-width', String(miniWidth));
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    miniResize.addEventListener(type, event => {
      if (miniDrag?.id !== event.pointerId) return;
      miniDrag = null;
      saveMiniWidth(Number(miniResize.getAttribute('aria-valuenow')));
    });
  }
  miniResize.addEventListener('keydown', event => {
    const size = Number(miniResize.getAttribute('aria-valuenow'));
    const next = { ArrowLeft:size + 20, ArrowUp:size + 20, ArrowRight:size - 20, ArrowDown:size - 20, Home:0, End:640 }[event.key];
    if (!Number.isFinite(next)) return;
    event.preventDefault();
    saveMiniWidth(next);
  });
  window.addEventListener('resize', () => { if (playerDialog.classList.contains('is-mini')) applyMiniWidth(); });
  function renderRelated(item) {
    const label=item.channel?.org==='Independents'?'Indie':item.channel?.org;
    $('#related-heading').textContent=label?label+' · Other live streams':'Other live streams';
    const matches=relatedLives(state.streams,item);
    $('#related-lives-list').innerHTML=matches.map(x=>'<button type="button" class="related-live" data-related-id="'+esc(x.id)+'"><img loading="lazy" src="https://i.ytimg.com/vi/'+esc(x.id)+'/mqdefault.jpg" alt=""><span><strong>'+esc(x.channel?.english_name||x.channel?.name||'Unknown channel')+'</strong><span>'+esc(x.title)+'</span><small>● LIVE'+(Number.isFinite(x.live_viewers)?' · '+new Intl.NumberFormat().format(x.live_viewers)+' watching':'')+'</small></span></button>').join('');
    $('#related-lives-empty').hidden=matches.length>0;
  }
  $('#related-lives-list').addEventListener('click',event=>{const button=event.target.closest('[data-related-id]');if(button)play(button.dataset.relatedId);});
  const panelResizer=$('#watch-resizer'),watchLayout=$('.watch-layout');
  let preferredPanelWidth=Number(pref('wlng-panel-width'))||310,draggingPanel=false;
  function panelBounds(){const width=watchLayout.clientWidth||innerWidth;return {min:240,max:Math.max(240,Math.min(640,width*.6,width-330))};}
  function applyPanelWidth(width=preferredPanelWidth){const {min,max}=panelBounds();const actual=Math.round(Math.max(min,Math.min(max,width)));$('#player-dialog').style.setProperty('--side-width',actual+'px');panelResizer.setAttribute('aria-valuenow',String(actual));panelResizer.setAttribute('aria-valuemax',String(Math.floor(max)));return actual;}
  function savePanelWidth(width){preferredPanelWidth=applyPanelWidth(width);pref('wlng-panel-width',String(preferredPanelWidth));}
  function stopPanelDrag(){if(!draggingPanel)return;draggingPanel=false;$('#player-dialog').classList.remove('resizing-panel');savePanelWidth(Number(panelResizer.getAttribute('aria-valuenow')));}
  panelResizer.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();draggingPanel=true;panelResizer.setPointerCapture(event.pointerId);$('#player-dialog').classList.add('resizing-panel');});
  panelResizer.addEventListener('pointermove',event=>{if(draggingPanel)applyPanelWidth(watchLayout.getBoundingClientRect().right-event.clientX-5);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])panelResizer.addEventListener(event,stopPanelDrag);
  window.addEventListener('blur',stopPanelDrag);
  panelResizer.addEventListener('dblclick',()=>savePanelWidth(310));
  panelResizer.addEventListener('keydown',event=>{const width=Number(panelResizer.getAttribute('aria-valuenow'));if(event.key==='ArrowLeft'){event.preventDefault();savePanelWidth(width+24);}else if(event.key==='ArrowRight'){event.preventDefault();savePanelWidth(width-24);}else if(event.key==='Home'){event.preventDefault();savePanelWidth(240);}else if(event.key==='End'){event.preventDefault();savePanelWidth(panelBounds().max);}});
  new ResizeObserver(()=>{if(innerWidth>1024&&!draggingPanel)applyPanelWidth();}).observe(watchLayout);applyPanelWidth();
  let pipSession=null,pipGeneration=0,pipOpening=false,pipFallbackNext=false;
  const pipButton=$('#watch-pip');
  const operaGX=isOperaGXBrowser(navigator.userAgent,navigator.userAgentData?.brands||[]);
  const operaPipDialog=$('#opera-pip-dialog');
  const pipStatus=text=>{const status=$('#pip-status');status.textContent=text;status.hidden=!text;};
  function restorePip(session){if($('#player-dialog').open&&state.playerId===session.id)$('#player-slot').replaceChildren(session.frame);}
  function closePip(restore=true){pipGeneration++;const session=pipSession;pipSession=null;if(session){if(restore){restorePip(session);pipStatus('Player returned to WLNG.');}session.window.close();}pipButton.setAttribute('aria-pressed','false');pipButton.textContent='PIP';}
  async function togglePip(){
    if(!$('#player-dialog').open)return;
    if(pipSession){closePip();return;}if(pipOpening)return;
    const frame=$('#player-slot iframe');if(!frame)return;
    const id=state.playerId,generation=++pipGeneration;let openingWindow;pipOpening=true;pipButton.disabled=true;
    try{
      const native=Boolean(window.documentPictureInPicture?.requestWindow)&&!pipFallbackNext;
      const floating=native?await window.documentPictureInPicture.requestWindow({width:640,height:400}):window.open('about:blank','wlng-video-popout','popup,width=640,height=400,resizable=yes,scrollbars=no');
      openingWindow=floating;
      if(!floating){pipStatus('The browser blocked the pop-out. Allow pop-ups for WLNG and click PIP again.');return;}
      if(!native)floating.opener=null;
      if(generation!==pipGeneration||!$('#player-dialog').open){floating.close();return;}
      if(floating.closed)throw Error('Window closed');
      const doc=floating.document;doc.title='WLNG · '+($('#player-title').textContent||'Player');
      const style=doc.createElement('style');style.textContent='html,body{margin:0;width:100%;height:100%;background:#09090b;color:#eee;font:12px system-ui}body{display:flex;flex-direction:column}header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;min-height:28px}header span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{background:#25252c;border:1px solid #555;color:white;border-radius:5px;padding:5px 9px;cursor:pointer;flex-shrink:0}iframe{width:100%;min-height:200px;flex:1;border:0}';doc.head.append(style);
      const header=doc.createElement('header'),title=doc.createElement('span'),back=doc.createElement('button');title.textContent=$('#player-title').textContent;back.textContent='Return to WLNG';back.addEventListener('click',()=>closePip());header.append(title,back);doc.body.replaceChildren(header,frame);
      const session={window:floating,frame,id,native};pipSession=session;
      const note=document.createElement('p');note.className='pip-placeholder';note.textContent=native?'Playing in PIP. Click PIP to return.':'Playing in a pop-out window. Click PIP to return.';$('#player-slot').replaceChildren(note);
      pipButton.textContent='PIP';pipButton.setAttribute('aria-pressed','true');pipStatus(native?'PIP opened. You may need to press Play again.':'Pop-out opened. For always-on-top in Opera/GX, hover the video and click Opera’s Video Popout button.');
      floating.addEventListener('pagehide',event=>{if(event.target!==doc||pipSession!==session)return;pipSession=null;restorePip(session);pipStatus('Player returned to WLNG.');pipButton.textContent='PIP';pipButton.setAttribute('aria-pressed','false');},{once:true});
    }catch{if(openingWindow){try{if(frame.ownerDocument!==document&&$('#player-dialog').open&&state.playerId===id)$('#player-slot').replaceChildren(frame);openingWindow.close();}catch{}}pipSession=null;pipButton.setAttribute('aria-pressed','false');pipFallbackNext=true;pipStatus('PIP could not open. Click PIP again to try a resizable pop-out window.');}
    finally{pipOpening=false;pipButton.disabled=false;}
  }
  pipButton.addEventListener('click',()=>{
    if(!pipSession&&!pipOpening&&$('#player-slot iframe')){showPipHelp(operaGX);openDialog(operaPipDialog);return;}
    void togglePip();
  });
  function showPipHelp(gx){$('#opera-pip-heading').textContent=gx?'Opera GX PIP':'Picture in Picture';$('#opera-pip-description').textContent=gx?'Please use Opera GX’s PIP button. Here’s how:':'For a smoother experience, please use a Picture in Picture extension directly. Website PIP has limitations we can’t fully control.';$('#opera-pip-steps').hidden=!gx;$('#opera-gx-help').hidden=gx;}
  $('#opera-gx-help').addEventListener('click',()=>showPipHelp(true));
  $('#opera-pip-continue').addEventListener('click',()=>{operaPipDialog.close();void togglePip();});
  const descriptionCache = new Map();
  async function loadDescription(item) {
    $('#player-description').textContent = 'Loading description…';
    try {
      let description = item.description;
      if (typeof description !== 'string' || !description) {
        if (!descriptionCache.has(item.id)) {
          if (descriptionCache.size >= 30) descriptionCache.delete(descriptionCache.keys().next().value);
          const pending = fetch(new URL('/api/videos/' + item.id, window.WLNG_CONFIG.apiBase), {signal:AbortSignal.timeout(10000)}).then(async response => { if (!response.ok) throw new Error('Details unavailable'); const data = await response.json(); if (data.video?.id !== item.id || typeof data.video.description !== 'string') throw new Error('Invalid details'); return data.video.description; }).catch(error => { descriptionCache.delete(item.id); throw error; });
          descriptionCache.set(item.id, pending);
        }
        description = await descriptionCache.get(item.id);
      }
      if (state.playerId === item.id && $('#player-dialog').open) $('#player-description').textContent = description || 'No description is available for this stream.';
    } catch { if (state.playerId === item.id && $('#player-dialog').open) $('#player-description').textContent = 'The description could not be loaded. You can read it on YouTube.'; }
  }
  document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => { if (state.tab === button.dataset.tab) return; state.tab = button.dataset.tab; document.querySelectorAll('.tab').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-selected', String(active)); }); $('#list-label').textContent = state.tab === 'live' ? 'LIVE RIGHT NOW' : 'COMING UP'; updateTabIndicator(); if (state.updated) render(); else animateResults(); }));
  new ResizeObserver(updateTabIndicator).observe($('.tabs'));
  document.fonts?.ready.then(updateTabIndicator);
  updateTabIndicator();
  $('#search').addEventListener('input', () => { if (state.updated) render(); });
  function updateAgencyNavigation(){
    $('#hub-agency').textContent=state.favoritesOnly?'Saved streams':state.org==='all'?'All agencies':state.org==='Independents'?'Indie':state.org;
    for(const link of document.querySelectorAll('.agency-link')){
      if(!state.favoritesOnly&&link.dataset.org===state.org)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');
      const name=link.dataset.org==='all'?'All':link.dataset.org==='Independents'?'Indie':link.dataset.org;
      const live=state.streams.filter(x=>streamStatus(x)==='live'&&(link.dataset.org==='all'||x.channel?.org===link.dataset.org));
      const count=new Set(live.map(x=>x.channel?.id||x.id)).size;
      link.querySelector('.agency-live-count').textContent=state.updated?String(count):'—';
      link.setAttribute('aria-label',state.updated?name+', '+count+' live channel'+(count===1?'':'s'):name);
    }
    $('#hub-toggle').title='Stream hub · '+(state.org==='all'?'All agencies':state.org==='Independents'?'Indie':state.org);
  }
  updateAgencyNavigation();
  function setFavoritesMode(enabled) {
    state.favoritesOnly = enabled;
    $('#favorites-panel').hidden = !enabled;
    $('#hub-title').textContent = enabled ? 'Favorites' : 'Stream hub';
    $('#favorites-open').classList.toggle('selected', enabled);
    $('#favorites-open').setAttribute('aria-pressed', String(enabled));
    $('#hub-toggle').classList.toggle('selected', !enabled);
    updateFilters();
    updateAgencyNavigation();
  }
  $('#hub-toggle').addEventListener('click',()=>{
    const returning = state.favoritesOnly || !$('#multiview').hidden;
    const expanded = returning || $('#hub-toggle').getAttribute('aria-expanded') !== 'true';
    $('#hub-toggle').setAttribute('aria-expanded', String(expanded));
    $('#agency-nav').hidden = !expanded;
    if (returning) { setFavoritesMode(false); if (state.updated) render(); }
  });
  $('#default-org').value = state.org;
  $('#default-org').addEventListener('change', e => pref('wlng-default-org', e.target.value));
  $('#favorites-open').addEventListener('click', () => { setFavoritesMode(true); favorites.open(); closeMobileNavigation(); });
  $('#player-favorite').addEventListener('click', () => { const item = state.streams.find(x => x.id === state.playerId); if (item) void favorites.openPicker(item); });
  document.querySelectorAll('.agency-link').forEach(link=>link.addEventListener('click',()=>{
    closeMobileNavigation();
    if(state.org===link.dataset.org&&!state.favoritesOnly)return;
    setFavoritesMode(false);
    state.org=link.dataset.org;updateFilters();updateAgencyNavigation();
    if(state.updated)render();
  }));
  $('#grid').addEventListener('click', e => { const card = e.target.closest('[data-id]'); if (card) play(card.dataset.id); });
  $('#grid').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) { e.preventDefault(); play(e.target.dataset.id); } });
  $('#skins-open').addEventListener('click',()=>openDialog($('#skins-dialog')));
  $('#settings-open').addEventListener('click', () => openDialog($('#settings-dialog')));
  $('#sidebar-settings').addEventListener('click', () => openDialog($('#settings-dialog')));
  const mobile = window.matchMedia('(max-width: 1024px)');
  function closeMobileNavigation(returnFocus=false){
    if(!mobile.matches||!document.body.classList.contains('nav-collapsed'))return;
    document.body.classList.remove('nav-collapsed');updateNavigation();
    if(returnFocus)$('#menu-toggle').focus();
  }
  const updateNavigation = () => {
    const expanded = mobile.matches ? document.body.classList.contains('nav-collapsed') : !document.body.classList.contains('nav-collapsed');
    $('#menu-toggle').setAttribute('aria-expanded', String(expanded));
    $('#sidebar').inert = !expanded;
    document.body.classList.toggle('mobile-nav-open',mobile.matches&&expanded);
    $('.workspace').inert=mobile.matches&&expanded;
    const auth=$('#auth-button');
    if(mobile.matches)$('#mobile-account').append(auth);
    else $('.header-right').insertBefore(auth,$('#settings-open'));
  };
  $('#menu-toggle').addEventListener('click', () => { document.body.classList.toggle('nav-collapsed'); updateNavigation(); if(mobile.matches&&document.body.classList.contains('nav-collapsed'))$('#hub-toggle').focus(); });
  $('#multiview-open').addEventListener('click',()=>{if(state.favoritesOnly){setFavoritesMode(false);if(state.updated)render();}closeMobileNavigation();});
  $('#nav-shade').addEventListener('click',()=>closeMobileNavigation(true));
  $('#search').addEventListener('focus',()=>closeMobileNavigation());
  document.addEventListener('keydown',event=>{
    if(!mobile.matches||!document.body.classList.contains('nav-collapsed')||document.querySelector('dialog[open]:not(.is-mini)'))return;
    if(event.key==='Escape'){event.preventDefault();closeMobileNavigation(true);return;}
    if(event.key!=='Tab')return;
    const stops=[$('#menu-toggle'),...[...$('#sidebar').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'))];
    const index=stops.indexOf(document.activeElement),next=index<0?(event.shiftKey?stops.length-1:0):(index+(event.shiftKey?-1:1)+stops.length)%stops.length;
    event.preventDefault();stops[next].focus();
  });
  mobile.addEventListener('change', () => { document.body.classList.remove('nav-collapsed'); updateNavigation(); });
  updateNavigation();
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(document.getElementById(b.dataset.close))));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('click', event => {
      if (dialog.classList.contains('is-mini')) return;
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog);
    });
  });
  playerDialog.addEventListener('close', () => {
    // Switching between modal and corner mode closes and immediately reopens the dialog.
    if (playerDialog.open) return;
    if (operaPipDialog.open) operaPipDialog.close();
    stopPanelDrag();
    closePip(false);
    playerDialog.classList.remove('is-mini');
    miniControls.hidden = true;
    miniDrag = null;
    state.playerId = null;
    $('#player-slot').replaceChildren();
    $('#chat-slot').replaceChildren();
    if (document.fullscreenElement && playerDialog.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
  });
  function showWatchPanel(panel) {
    $('#watch-activity').hidden = panel !== 'activity'; $('#watch-chat').hidden = panel !== 'chat';
    document.querySelectorAll('[data-watch-panel]').forEach(button => { const active = button.dataset.watchPanel === panel; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
    if (panel === 'chat' && !$('#chat-slot').children.length && validId(state.playerId)) {
      const chat = document.createElement('iframe'); chat.title = 'YouTube live chat'; chat.src = 'https://www.youtube.com/live_chat?v=' + state.playerId + '&embed_domain=' + encodeURIComponent(location.hostname) + ($('#chat-theme').value === 'dark' ? '&dark_theme=1' : '&dark_theme=0'); chat.referrerPolicy = 'strict-origin-when-cross-origin'; chat.style.colorScheme = 'only light'; $('#chat-slot').replaceChildren(chat);
    }
  }
  $('#chat-theme').value = pref('wlng-chat-theme') === 'light' ? 'light' : 'dark';
  $('#chat-theme').addEventListener('change', () => { pref('wlng-chat-theme', $('#chat-theme').value); $('#chat-slot').replaceChildren(); showWatchPanel('chat'); });
  document.querySelectorAll('[data-watch-panel]').forEach(button => button.addEventListener('click', () => showWatchPanel(button.dataset.watchPanel)));
  $('#watch-theater').addEventListener('click', event => { const active = $('#player-dialog').classList.toggle('theater'); event.currentTarget.setAttribute('aria-pressed', String(active)); });
  $('#watch-large').addEventListener('click', event => { const large = $('#player-dialog').classList.toggle('is-large'); event.currentTarget.textContent = large ? 'Popup' : 'Large'; event.currentTarget.setAttribute('aria-pressed', String(large)); });
  const fullscreenButton = $('#watch-fullscreen'), watchShell = $('#watch-shell');
  const narrowWatch = matchMedia('(max-width: 1024px)');
  function placeDescription() { (narrowWatch.matches ? $('.watch-layout') : $('#watch-main')).append($('.watch-description')); }
  narrowWatch.addEventListener('change', placeDescription); placeDescription();
  if (!document.fullscreenEnabled || !watchShell.requestFullscreen) { fullscreenButton.disabled = true; fullscreenButton.title = 'Native fullscreen is unavailable here. Use Large to fill the browser page.'; }
  fullscreenButton.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await watchShell.requestFullscreen(); }
    catch { $('#watch-message').textContent = 'Your browser could not enter fullscreen. Use Large to fill the browser page.'; }
  });
  document.addEventListener('fullscreenchange', () => { const active = document.fullscreenElement === watchShell; fullscreenButton.textContent = active ? 'Exit fullscreen' : 'Fullscreen'; fullscreenButton.setAttribute('aria-pressed', String(active)); });
  $('#watch-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#youtube-link').href); $('#watch-message').textContent = 'YouTube link copied.'; } catch { $('#watch-message').textContent = 'Copy the link using Open on YouTube.'; } });
  $('#watch-dim').addEventListener('input',event=>{const value=Number(event.target.value);$('#player-dialog').style.setProperty('--watch-shade','rgba(0,0,0,'+value/100+')');event.target.style.setProperty('--dim-fill',value/90*100+'%');$('#watch-dim-value').value=value+'%';event.target.setAttribute('aria-valuetext',value+'% darker');});
  document.addEventListener('keydown', e => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName) && !document.querySelector('dialog[open]:not(.is-mini)')) { e.preventDefault(); $('#search').focus(); } });
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
  let lastFeedRequest=0,feedPending=false;
  window.addEventListener('wlng-refresh-streams',()=>{if(feedPending||Date.now()-lastFeedRequest<30000){window.dispatchEvent(new Event('wlng-feed-refreshed'));return;}lastFeedRequest=Date.now();feedPending=true;load().finally(()=>{feedPending=false;window.dispatchEvent(new Event('wlng-feed-refreshed'));});});
  const favorites = setupFavorites({ openDialog, closeDialog, onChange: () => {
    updatePlayerFavorite();
    if (state.favoritesOnly && state.updated) render();
  } });
  lastFeedRequest=Date.now();
  const sharedId = new URLSearchParams(location.search).get('watch');
  void load().then(() => {
    if (validId(sharedId) && !state.playerId) play(sharedId, true);
  });
})();
