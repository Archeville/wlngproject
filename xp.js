import { levelProgress } from './levels.mjs';
(() => {
  const roots = [...document.querySelectorAll('[data-xp-widget]')];
  for (const root of roots) root.innerHTML = `<div class="xp-summary"><span class="level-badge" data-level>1</span><div class="xp-summary-copy"><strong>Activity level <span data-level-text>1</span></strong><span data-xp-total>0 XP saved</span></div><span data-xp-timer>Idle</span></div><div class="xp-progress" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100"><span class="xp-progress-fill"></span><i></i><i></i><i></i></div><label class="activity-label">Activity window <span>5 XP / min</span></label><input class="activity-slider" type="range" min="0" max="100" value="0" step="1" aria-label="Slide all the way right to start 30 minutes of activity XP" disabled><p class="xp-help">Sign in to earn activity XP.</p><span class="xp-error" role="status"></span><button class="xp-delete" type="button" disabled>Delete my activity data</button>`;
  let state = null, receivedAt = 0, available = false, busy = false, userId = null, generation = 0, expiryAttempted = false;
  const pendingIds = {};
  let channel; try { channel = new BroadcastChannel('wlng-xp'); } catch { /* optional */ }
  const estimatedNow = () => state ? state.serverNow + Math.max(0, performance.now() - receivedAt) : 0;
  const error = text => roots.forEach(root => { root.querySelector('.xp-error').textContent = text; });
  function draw() {
    const now = estimatedNow();
    const active = available && state && now < state.endsAt;
    // On reload start at the last saved total, as requested. The authoritative
    // outstanding portion is reconciled when the window is settled/refilled.
    const projected = (state?.savedXp || 0) + (state?.endsAt ? Math.max(0, Math.min(now, state.endsAt) - state.serverNow) * state.xpPerMinute / 60000 : 0);
    const { level, intoLevel, required } = levelProgress(projected);
    const remaining = active ? Math.max(0, state.endsAt - now) : 0;
    const ratio = remaining / (state?.windowMs || 1800000);
    for (const root of roots) {
      root.classList.toggle('earning', Boolean(active));
      root.dataset.tier = level >= 50 ? 'black' : level >= 25 ? 'red' : level >= 10 ? 'yellow' : 'blue';
      root.querySelector('[data-level]').textContent = level;
      root.querySelector('[data-level-text]').textContent = level;
      root.querySelector('[data-xp-total]').textContent = `${projected.toFixed(1)} XP${active ? '' : ' saved'}`;
      root.querySelector('[data-xp-timer]').textContent = active ? `${Math.ceil(remaining / 60000)}m left` : 'Idle';
      const progress = root.querySelector('.xp-progress');
      const percent = intoLevel / required * 100;
      progress.style.setProperty('--xp-progress', `${percent}%`); progress.setAttribute('aria-valuenow', percent.toFixed(1));
      const slider = root.querySelector('.activity-slider');
      if (document.activeElement !== slider || !slider.matches(':active')) slider.value = ratio * 100;
      slider.disabled = !available || busy;
      root.querySelector('.xp-delete').disabled = !available || busy;
      progress.title = `${intoLevel.toFixed(1)} / ${required} XP to level ${level + 1}`;
      slider.style.setProperty('--charge', `${ratio * 100}%`);
      slider.style.setProperty('--charge-color', ratio > .5 ? '#4aa7ff' : ratio > .2 ? '#eac44e' : '#ec646e');
      slider.setAttribute('aria-valuetext', active ? `${Math.ceil(remaining / 60000)} minutes remaining. Slide right to refill.` : 'Slide right to start 30 minutes.');
      root.querySelector('.xp-help').textContent = !userId ? 'Sign in to earn activity XP.' : !available ? 'Activity XP is unavailable. Try signing in again or refresh.' : active ? 'Slide right to refill. Video playback is unrelated.' : 'Slide right for 30 minutes. No video needed.';
    }
    if (available && state?.endsAt && now >= state.endsAt && !expiryAttempted && !busy) { expiryAttempted = true; void send('settle'); }
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
      if (action !== 'state') { delete pendingIds[action]; channel?.postMessage({ userId }); }
      expiryAttempted = Boolean(state.endsAt && state.endsAt <= state.serverNow);
    } catch (failure) { if (ownGeneration === generation) error(failure.message); }
    finally { busy = false; draw(); if (ownGeneration !== generation && userId) void send(); }
  }
  for (const root of roots) {
    const slider = root.querySelector('.activity-slider');
    slider.addEventListener('input', () => slider.style.setProperty('--charge', `${slider.value}%`));
    slider.addEventListener('change', () => { if (Number(slider.value) >= 99 && available && !busy) { expiryAttempted = false; void send('start'); } else draw(); });
    root.querySelector('.xp-delete').addEventListener('click', () => { if (confirm('Delete all your WLNG activity XP and stop the active window? This cannot be undone. Your Google account and video playback are unaffected.')) void send('delete'); });
  }
  window.addEventListener('wlng-auth', event => {
    if (event.detail.userId === userId) return;
    userId = event.detail.userId; generation++; state = null; available = false; expiryAttempted = false;
    for (const key of Object.keys(pendingIds)) delete pendingIds[key];
    draw(); if (userId) setTimeout(() => void send(), 0);
  });
  if (channel) channel.onmessage = event => { if (userId && event.data.userId === userId) void send(); };
  setInterval(draw, 100); draw();
})();
