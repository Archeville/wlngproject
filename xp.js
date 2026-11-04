import { levelProgress } from './levels.mjs';
(() => {
  const roots = [...document.querySelectorAll('[data-xp-widget]')];
  for (const root of roots) root.innerHTML = `<div class="xp-summary"><span class="level-badge" data-level>1</span><div class="xp-summary-copy"><strong>Level <span data-level-text>1</span></strong></div><span data-xp-timer>Idle</span></div><div class="xp-progress" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100"><span class="xp-progress-fill"><span class="xp-sparkles" aria-hidden="true"></span></span><span class="xp-progress-label" data-xp-label>0 / 100 XP</span></div><div class="activity-control"><input class="activity-slider" type="range" min="0" max="100" value="0" step="0.01" aria-label="Slide all the way right to start 30 minutes of activity XP" disabled><span class="slider-burst" aria-hidden="true"></span><span class="slider-direction" aria-hidden="true">←</span></div><p class="xp-help">Sign in to earn activity XP.</p><span class="xp-error" role="status"></span>`;
  let state = null, receivedAt = 0, available = false, busy = false, userId = null, generation = 0, expiryAttempted = false;
  const pendingIds = {};
  let hintExpiresAt = 0, hintMessage = "";
  function activityHint(refilled) { hintExpiresAt = performance.now() + 5000; hintMessage = refilled ? "Slide right to refill. Video playback is unrelated." : "Activity window ended. Slide right to refill."; }
  function refillArrow() { for (const root of roots) { const arrow = root.querySelector(".slider-direction"); const distance = Math.max(0, root.querySelector(".activity-control").clientWidth - 32); arrow.getAnimations().forEach(animation => animation.cancel()); arrow.animate(reducedMotion() ? [{opacity:1},{opacity:0}] : [{opacity:0,transform:"translateX(0)"},{opacity:1,offset:.15},{opacity:0,transform:"translateX(-"+distance+"px)"}],{duration:850,easing:"ease-out"}); } }
  const dangerZone = document.querySelector('#danger-zone'), dangerActions = document.querySelector('#danger-actions'), unlockButton = document.querySelector('#danger-unlock'), deleteButton = document.querySelector('#xp-delete');
  let dangerUnlocked = false, holdFrame = null, holdStartedAt = null;
  const reducedMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const root of roots) for (let i = 0; i < 4; i++) {
    const dot = document.createElement('i'); dot.style.top = (12 + Math.random() * 66) + '%'; dot.style.setProperty('--spark-time', (.65 + Math.random() * .85) + 's'); dot.style.setProperty('--spark-delay', (-Math.random() * 2) + 's'); dot.style.setProperty('--spark-size', (.8 + Math.random() * .6) + 'px'); root.querySelector('.xp-sparkles').append(dot);
  }
  function burst() {
    if (reducedMotion() || document.hidden) return;
    for (const root of roots) {
      if (!root.getClientRects().length) continue;
      const emitter = root.querySelector('.slider-burst');
      for (let i = 0; i < 9; i++) {
        const cube = document.createElement('i'); emitter.append(cube);
        const animation = cube.animate?.([{opacity:0,transform:'translate(0,0) scale(.5)'},{opacity:.8,offset:.12},{opacity:0,transform:'translate(' + (-25 + Math.random() * 50) + 'px,' + (-18 - Math.random() * 30) + 'px) rotate(' + (-50 + Math.random() * 100) + 'deg) scale(.2)'}],{duration:600+Math.random()*400,easing:'cubic-bezier(.15,.7,.3,1)'});
        if (animation) animation.finished.then(() => cube.remove(), () => cube.remove()); else cube.remove();
      }
    }
  }
  function cancelHold() { if (holdFrame !== null) cancelAnimationFrame(holdFrame); holdFrame = null; holdStartedAt = null; if (!dangerUnlocked) { unlockButton.style.setProperty('--hold', '0%'); unlockButton.querySelector('span').textContent = 'Hold to unlock'; } }
  function lockDanger() { dangerUnlocked = false; cancelHold(); dangerZone.classList.remove('unlocked'); dangerActions.inert = true; dangerActions.disabled = true; deleteButton.disabled = true; unlockButton.disabled = false; document.querySelector('#danger-instructions').textContent = 'Hold the red button for 2 seconds to unlock.'; }
  function beginHold() {
    if (dangerUnlocked || holdStartedAt !== null) return;
    holdStartedAt = performance.now();
    const tick = now => { const elapsed = now - holdStartedAt; unlockButton.style.setProperty('--hold', Math.min(100, elapsed / 20) + '%'); if (elapsed >= 2000) { dangerUnlocked = true; cancelHold(); dangerZone.classList.add('unlocked'); dangerActions.inert = false; unlockButton.disabled = true; unlockButton.querySelector('span').textContent = 'Unlocked'; document.querySelector('#danger-instructions').textContent = 'Unlocked until you close Settings.'; draw(); } else holdFrame = requestAnimationFrame(tick); };
    holdFrame = requestAnimationFrame(tick);
  }
  unlockButton.addEventListener('pointerdown', event => { if (event.button === 0) beginHold(); });
  for (const eventName of ['pointerup','pointerleave','pointercancel','lostpointercapture','blur']) unlockButton.addEventListener(eventName, cancelHold);
  unlockButton.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) beginHold(); } });
  unlockButton.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); cancelHold(); } });
  window.addEventListener('blur', cancelHold);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHold(); });
  document.querySelector('#settings-dialog').addEventListener('close', lockDanger);
  deleteButton.addEventListener('click', () => { if (dangerUnlocked && available && !busy && confirm('Delete all your WLNG activity XP and stop the active window? This cannot be undone. Your Google account and video playback are unaffected.')) void send('delete'); });
  let channel; try { channel = new BroadcastChannel('wlng-xp'); } catch { /* optional */ }
  const estimatedNow = () => state ? state.serverNow + Math.max(0, performance.now() - receivedAt) : 0;
  const error = text => { roots.forEach(root => { root.querySelector('.xp-error').textContent = text; }); document.querySelector('#danger-status').textContent = text; };
  function draw() {
    const now = estimatedNow();
    const active = available && state && now < state.endsAt;
    // On reload start at the last saved total, as requested. The authoritative
    // outstanding portion is reconciled when the window is settled/refilled.
    const projected = (state?.savedXp || 0) + (state?.endsAt ? Math.max(0, Math.min(now, state.endsAt) - state.serverNow) * state.xpPerMinute / 60000 : 0);
    const { level, intoLevel, required } = levelProgress(projected);
    if(window.WLNG_LEVEL!==level){window.WLNG_LEVEL=level;window.dispatchEvent(new CustomEvent('wlng-level',{detail:{level}}));}
    const remaining = active ? Math.max(0, state.endsAt - now) : 0;
    const ratio = remaining / (state?.windowMs || 1800000);
    for (const root of roots) {
      root.classList.toggle('earning', Boolean(active));
      root.dataset.tier = level >= 50 ? 'black' : level >= 25 ? 'red' : level >= 10 ? 'yellow' : 'blue';
      root.querySelector('[data-level]').textContent = level;
      root.querySelector('[data-level-text]').textContent = level;
      root.querySelector('[data-xp-label]').textContent = `${intoLevel.toFixed(1)} / ${required} XP`;
      root.querySelector('[data-xp-timer]').textContent = active ? `${Math.floor(Math.ceil(remaining / 1000) / 60)}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, '0')} left` : '00:00';
      const progress = root.querySelector('.xp-progress');
      const percent = intoLevel / required * 100;
      progress.style.setProperty('--xp-progress', `${percent}%`); progress.setAttribute('aria-valuenow', percent.toFixed(1));
      const slider = root.querySelector('.activity-slider');
      const dragging = document.activeElement === slider && slider.matches(':active');
      if (!dragging) slider.value = ratio * 100;
      const displayRatio = dragging ? Number(slider.value) / 100 : ratio;
      slider.disabled = !available || busy;
      root.querySelector('.activity-control').style.setProperty('--charge', (displayRatio * 100) + '%');
      progress.title = `${intoLevel.toFixed(1)} / ${required} XP to level ${level + 1}`;
      slider.style.setProperty('--charge', `${displayRatio * 100}%`);
      slider.style.setProperty('--charge-color', dragging || ratio > .5 ? '#4aa7ff' : ratio > .2 ? '#eac44e' : '#ec646e');
      slider.setAttribute('aria-valuetext', active ? `${Math.ceil(remaining / 60000)} minutes remaining. Slide right to refill.` : 'Slide right to start 30 minutes.');
      const hint = !userId ? 'Sign in to earn XP.' : performance.now() < hintExpiresAt ? hintMessage : ''; root.querySelector('.xp-help').textContent = hint; root.querySelector('.xp-help').hidden = !hint;
    }
    dangerActions.disabled = !dangerUnlocked || !available || busy; deleteButton.disabled = dangerActions.disabled;
    if (available && state?.endsAt && now >= state.endsAt && !expiryAttempted && !busy) { expiryAttempted = true; activityHint(false); burst(); void send('settle'); }
  }
  async function request(action, token) {
    const response = await fetch(new URL(`/api/xp/${action}`, window.WLNG_CONFIG.apiBase), {
      method: action === 'state' ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(action === 'state' ? {} : { 'Content-Type': 'application/json' }) },
      ...(action === 'state' ? {} : { body: JSON.stringify({ requestId: pendingIds[action] ||= crypto.randomUUID() }) }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Activity XP could not be saved.');
    return data;
  }
  async function send(action = 'state') {
    if (busy) return;
    const ownGeneration = generation; busy = true; draw(); error('');
    try {
      const token = await window.WLNG_AUTH?.getAccessToken();
      if (!token) throw new Error('Sign in to earn activity XP.');
      const data = await request(action, token);
      if (ownGeneration !== generation) return;
      state = data; receivedAt = performance.now(); available = true;
      if (action === 'start') { activityHint(true); draw(); burst(); refillArrow(); }
      if (action !== 'state') { delete pendingIds[action]; channel?.postMessage({ userId }); }
      expiryAttempted = Boolean(state.endsAt && state.endsAt <= state.serverNow);
    } catch (failure) { if (ownGeneration === generation) error(failure.message); }
    finally { busy = false; draw(); if (ownGeneration !== generation && userId) void send(); }
  }
  for (const root of roots) {
    const slider = root.querySelector('.activity-slider');
    slider.addEventListener('input', () => { slider.style.setProperty('--charge', `${slider.value}%`); root.querySelector('.activity-control').style.setProperty('--charge', `${slider.value}%`); });
    slider.addEventListener('change', () => { if (Number(slider.value) >= 99 && available && !busy) { expiryAttempted = false; void send('start'); } else draw(); });
  }
  function authChanged(event) {
    if (event.detail.userId === userId) return;
    userId = event.detail.userId; hintExpiresAt = 0; lockDanger(); generation++; state = null; available = false; expiryAttempted = false;
    for (const key of Object.keys(pendingIds)) delete pendingIds[key];
    draw(); if (userId) setTimeout(() => void send(), 0);
  }
  window.addEventListener('wlng-auth', authChanged);
  if (Object.hasOwn(window, 'WLNG_AUTH_USER')) authChanged({detail:{userId:window.WLNG_AUTH_USER}});
  if (channel) channel.onmessage = event => { if (userId && event.data.userId === userId) void send(); };
  setInterval(draw, 100); draw();
})();
