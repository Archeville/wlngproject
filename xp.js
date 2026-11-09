import { levelProgress } from './levels.mjs';
import { badgeStyle } from './cosmetics.mjs?v=20261106-pixelbadges1';
import { accountState } from './account-state.mjs';
(() => {
  const roots = [...document.querySelectorAll('[data-xp-widget]')];
  for (const [widgetIndex,root] of roots.entries()) root.innerHTML = `<div class="xp-summary"><span class="level-badge" data-level>1</span><div class="xp-summary-copy"><strong>Level <span data-level-text>1</span></strong></div><span data-xp-timer>Idle</span></div><div class="xp-progress" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100"><span class="xp-progress-fill"><span class="xp-sparkles" aria-hidden="true"></span></span><span class="xp-progress-label" data-xp-label>0 / 100 XP</span></div><div class="activity-row"><div class="activity-control"><input class="activity-slider" type="range" min="0" max="100" value="0" step="0.01" aria-label="Slide all the way right to start 30 minutes of activity XP" disabled><span class="slider-burst" aria-hidden="true"></span><span class="slider-direction" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="arrow-edge" d="M19 12H5m0 0 6-6m-6 6 6 6"/><path class="arrow-line" d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg></span></div><button class="xp-info" type="button" aria-label="How the XP slider works" aria-expanded="false" aria-controls="xp-info-${widgetIndex}">?</button></div><p id="xp-info-${widgetIndex}" class="xp-explainer" hidden>Refill the slider every 30 minutes to keep earning XP. You can activate it without watching a video. XP only unlocks cosmetics and badges; it grants no other rewards.</p><p class="xp-help">Sign in to earn XP.</p><span class="xp-error" role="status"></span>`;
  let state = null, receivedAt = 0, available = false, busy = false, userId = null, expiryNotified = true;
  let refillVisual=null,refillFrame=null;
  function stopRefill(){if(refillFrame!==null)cancelAnimationFrame(refillFrame);refillFrame=null;refillVisual=null;}
  function refillArrow(){
    stopRefill();if(reducedMotion())return;
    const started=performance.now();
    const segments=[[0,1],[.18,0],[.68,.93],[.82,.82],[1,1]];
    function tick(now){const t=Math.min(1,(now-started)/1700);let i=1;while(i<segments.length-1&&t>segments[i][0])i++;const [a,from]=segments[i-1],[b,to]=segments[i],p=(t-a)/(b-a);const eased=i===1?1-(1-p)**3:i===2? (p<.8?(p/.8)**2*.92:.92+(1-(1-(p-.8)/.2)**3)*.08):i===3?(1-Math.cos(p*Math.PI))/2:p*p;refillVisual=from+(to-from)*eased;draw();if(t<1)refillFrame=requestAnimationFrame(tick);else{stopRefill();draw();burst();for(const root of roots){const arrow=root.querySelector('.slider-direction'),distance=Math.max(0,root.querySelector('.activity-control').clientWidth-32);arrow.getAnimations().forEach(a=>a.cancel());arrow.animate([{opacity:0,transform:'translateX(0)'},{opacity:1,offset:.15},{opacity:0,transform:'translateX(-'+distance+'px)'}],{duration:850,easing:'ease-out'});}}}
    refillFrame=requestAnimationFrame(tick);
  }
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
  deleteButton.addEventListener('click', () => { if (dangerUnlocked && available && !busy && confirm('Delete all your WLNG activity XP and stop the active window? This cannot be undone. Your Google account and video playback are unaffected.')) void accountState.mutate('delete'); });
  const estimatedNow = () => state ? state.serverNow + Math.max(0, performance.now() - receivedAt) : 0;
  const error = text => { roots.forEach(root => { root.querySelector('.xp-error').textContent = text; }); document.querySelector('#danger-status').textContent = text; };
  function draw() {
    const now = estimatedNow();
    const active = available && state && now < state.endsAt;
    const projected = (state?.currentXp ?? state?.savedXp ?? 0) + (state?.endsAt ? Math.max(0, Math.min(now, state.endsAt) - state.serverNow) * state.xpPerMinute / 60000 : 0);
    const { level, intoLevel, required } = levelProgress(projected);
    if(window.WLNG_LEVEL!==level){window.WLNG_LEVEL=level;window.dispatchEvent(new CustomEvent('wlng-level',{detail:{level}}));}
    const remaining = active ? Math.max(0, state.endsAt - now) : 0;
    const ratio = remaining / (state?.windowMs || 1800000);
    for (const root of roots) {
      root.classList.toggle('earning', Boolean(active));
      root.dataset.tier = level >= 50 ? 'black' : level >= 25 ? 'red' : level >= 10 ? 'yellow' : 'blue';
      root.querySelector('[data-level]').className='level-badge level-icon badge-'+badgeStyle(window.WLNG_BADGE_PREVIEW??state?.cosmetics?.badge,level);
      root.querySelector('[data-level]').textContent = level;
      root.querySelector('[data-level]').dataset.digits = String(level).length;
      root.querySelector('[data-level-text]').textContent = level;
      root.querySelector('[data-xp-label]').textContent = `${intoLevel.toFixed(1)} / ${required} XP`;
      root.querySelector('[data-xp-timer]').textContent = active ? `${Math.floor(Math.ceil(remaining / 1000) / 60)}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, '0')} left` : '00:00';
      const progress = root.querySelector('.xp-progress');
      const percent = intoLevel / required * 100;
      progress.style.setProperty('--xp-progress', `${percent}%`); progress.setAttribute('aria-valuenow', percent.toFixed(1));
      const slider = root.querySelector('.activity-slider');
      const dragging = document.activeElement === slider && slider.matches(':active');
      if (!dragging) slider.value = (refillVisual??ratio) * 100;
      const displayRatio = dragging ? Number(slider.value) / 100 : (refillVisual??ratio);
      slider.disabled = !available || busy || refillVisual!==null;
      root.querySelector('.activity-control').style.setProperty('--charge', (displayRatio * 100) + '%');
      progress.title = `${intoLevel.toFixed(1)} / ${required} XP to level ${level + 1}`;
      slider.style.setProperty('--charge', `${displayRatio * 100}%`);
      slider.style.setProperty('--charge-color', dragging || ratio > .5 ? '#4aa7ff' : ratio > .2 ? '#eac44e' : '#ec646e');
      slider.setAttribute('aria-valuetext', active ? `${Math.ceil(remaining / 60000)} minutes remaining. Slide right to refill.` : 'Slide right to start 30 minutes.');
      const hint = !userId ? 'Sign in to earn XP.' : ''; root.querySelector('.xp-help').textContent = hint; root.querySelector('.xp-help').hidden = !hint;
    }
    if(available&&state?.endsAt&&now>=state.endsAt&&!expiryNotified){expiryNotified=true;burst();}
    dangerActions.disabled = !dangerUnlocked || !available || busy; deleteButton.disabled = dangerActions.disabled;
  }
  for (const root of roots) {
    const info=root.querySelector('.xp-info'),explainer=root.querySelector('.xp-explainer');
    info.addEventListener('click',()=>{explainer.hidden=!explainer.hidden;info.setAttribute('aria-expanded',String(!explainer.hidden));});
    const slider = root.querySelector('.activity-slider');
    slider.addEventListener('input', () => { slider.style.setProperty('--charge', `${slider.value}%`); root.querySelector('.activity-control').style.setProperty('--charge', `${slider.value}%`); });
    slider.addEventListener('change', () => { if (Number(slider.value) >= 99 && available && !busy) { void accountState.mutate('start'); } else draw(); });
  }
  let lastStart=null,lastRecord=null;
  accountState.subscribe(view=>{
    const changedUser=userId!==view.userId;
    if(changedUser){stopRefill();userId=view.userId;lastRecord=null;lastStart=null;lockDanger();}
    busy=view.busy;available=Boolean(view.record);state=view.record?.data||null;
    if(view.record&&view.record!==lastRecord){
      receivedAt=performance.now()-Math.max(0,Date.now()-view.record.receivedAt);
      if(lastRecord&&state.startedAt!==lastStart&&state.startedAt){if(!document.hidden){burst();refillArrow();}}
      lastRecord=view.record;lastStart=state.startedAt;expiryNotified=Boolean(!state.endsAt||state.endsAt<=state.serverNow);
    }
    error(view.error);if(!document.hidden)draw();
  });
  let drawTimer;
  function resumeDraw(){clearInterval(drawTimer);if(document.hidden)stopRefill();if(!document.hidden){draw();drawTimer=setInterval(draw,100);}}
  document.addEventListener('visibilitychange',resumeDraw);resumeDraw();
})();
