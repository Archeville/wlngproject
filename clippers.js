import { ReplayBuffer } from './replay-mp4.mjs?v=20261119-clippers1';

const types = ['video/mp4;codecs=avc1,mp4a.40.2'];
const manualLimit = 512 * 1024 * 1024;
const preferenceKey = 'wlng-clipper-settings-v1';
const stopTracks = stream => stream?.getTracks().forEach(track => track.stop());

function preferences() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(preferenceKey)); } catch { /* storage is optional */ }
  return { enabled:stored?.enabled === true, length:[30,60,120].includes(stored?.length) ? stored.length : 60,
    manual:stored?.manual === true, resolution:[480,720,1080].includes(stored?.resolution) ? stored.resolution : 720,
    fps:[30,60].includes(stored?.fps) ? stored.fps : 30 };
}

const bitrate = settings => ({ 480:2000000,720:4000000,1080:6500000 })[settings.resolution] * (settings.fps === 60 ? 1.5 : 1);

function filename(item, kind) {
  const name = String(item?.title || 'WLNG').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g,' ').trim().slice(0,100).replace(/[ .]+$/,'') || 'WLNG';
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0,19);
  return `${name} - ${kind} - ${date}.mp4`;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Capture Handle distinguishes this exact WLNG tab from any other tab/window.
function sameTab(track, handle) {
  const actual = track.getCaptureHandle?.();
  return track.getSettings().displaySurface === 'browser' && actual?.origin === location.origin && actual.handle === handle;
}

function visiblePlayer(slot) {
  if (document.querySelector('dialog[open]:not(#player-dialog)')) return false;
  const rect = slot.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const points = [[.05,.05],[.95,.05],[.5,.5],[.05,.95],[.95,.95]];
  return points.every(([x,y]) => {
    const target = document.elementFromPoint(rect.left + x * rect.width, rect.top + y * rect.height);
    return target && slot.contains(target);
  });
}

async function fixedVideo(source, slot, isolated, quality) {
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.srcObject = source;
  const canvas = document.createElement('canvas');
  canvas.height = quality.resolution;
  canvas.width = Math.round(quality.resolution * 16 / 9 / 2) * 2;
  const ctx = canvas.getContext('2d', { alpha:false });
  let surface = canvas.captureStream(0);
  let canvasTrack = surface.getVideoTracks()[0];
  if (typeof canvasTrack.requestFrame !== 'function') {
    stopTracks(surface); surface = canvas.captureStream(quality.fps); canvasTrack = surface.getVideoTracks()[0];
  }
  canvasTrack.contentHint = 'motion';
  let stopped = false, timer, startupTimer;
  let lastWidth = 0, lastHeight = 0;
  const clean = () => {
    stopped = true;
    clearInterval(timer); clearTimeout(startupTimer); video.pause(); video.srcObject = null; stopTracks(surface);
  };
  try {
    await Promise.race([video.play(), new Promise((_,reject) => {
      startupTimer = setTimeout(() => reject(new Error('The selected tab did not provide video frames.')), 6000);
    })]);
    clearTimeout(startupTimer);
    const paint = () => {
      if (stopped) return;
      if (video.videoWidth && video.videoHeight && slot.querySelector('iframe') && (isolated || visiblePlayer(slot))) {
        const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const width = video.videoWidth * scale, height = video.videoHeight * scale;
        if (lastWidth !== width || lastHeight !== height) {
          ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
          lastWidth = width; lastHeight = height;
        }
        ctx.drawImage(video, (canvas.width-width)/2, (canvas.height-height)/2, width, height);
      } else { ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height); lastWidth = lastHeight = 0; }
      canvasTrack.requestFrame?.();
    };
    paint();
    // The output cadence follows the selected rate, even when the source
    // delivers fewer unique frames than the recording target.
    timer = setInterval(paint, 1000/quality.fps);
    const stream = new MediaStream([...surface.getVideoTracks(), ...source.getAudioTracks()]);
    return { stream, clean };
  } catch (error) { clean(); throw error; }
}

export function setupClippers() {
  const $ = id => document.getElementById(id);
  const enabled = $('clipper-enabled'), options = $('clipper-options'), length = $('clipper-length'), manualButtonOption = $('clipper-manual');
  const resolution = $('clipper-resolution'), fps = $('clipper-fps');
  const controls = $('clipper-controls'), clip = $('clipper-save'), record = $('clipper-record');
  const status = $('clipper-status'), progress = $('clipper-progress'), supportNote = $('clipper-support');
  const slot = $('player-slot'), player = $('player-dialog');
  const mimeType = types.find(type => globalThis.MediaRecorder?.isTypeSupported?.(type));
  const supported = Boolean(mimeType && navigator.mediaDevices?.getDisplayMedia && navigator.mediaDevices?.setCaptureHandleConfig &&
    HTMLCanvasElement.prototype.captureStream && (globalThis.RestrictionTarget || globalThis.CropTarget));
  let settings = preferences(), item = null, eligible = false, capture = null, session = null, request = null, generation = 0;

  function message(value) { if (status.textContent !== value) status.textContent = value; }
  function saveSettings() {
    try { localStorage.setItem(preferenceKey, JSON.stringify(settings)); } catch { /* storage is optional */ }
  }
  function renderSettings() {
    enabled.checked = settings.enabled;
    enabled.disabled = !supported;
    options.disabled = !settings.enabled || !supported;
    length.value = String(settings.length);
    resolution.value = String(settings.resolution);
    fps.value = String(settings.fps);
    manualButtonOption.checked = settings.manual;
    supportNote.hidden = supported;
    supportNote.textContent = supported ? '' : 'Local MP4 capture is unavailable in this browser. Try an updated Chrome or Edge.';
  }
  function hasPlayer() { return eligible && player.open && Boolean(slot.querySelector('iframe')); }
  function render() {
    controls.hidden = !settings.enabled;
    clip.textContent = `Clip last ${settings.length}s`;
    clip.disabled = !supported || !hasPlayer() || Boolean(request) || Boolean(session && session.buffer.seconds < .5);
    record.hidden = !settings.manual;
    record.disabled = !supported || !hasPlayer() || Boolean(request);
    record.textContent = session?.manual ? 'Stop & save recording' : 'Begin recording';
    record.classList.toggle('recording', Boolean(session?.manual));
    const seconds = Math.min(settings.length, Math.floor(session?.buffer.seconds || 0));
    const video = session?.buffer.fragments.slice(-3).flatMap(fragment => fragment.timeline.filter(track => track.type === 'vide')) || [];
    const duration = video.reduce((sum,track) => sum + track.end - track.start, 0);
    const actualFps = duration > 0 ? Math.round(video.reduce((sum,track) => sum + track.samples, 0) / duration) : 0;
    progress.textContent = session ? `● ${seconds}/${settings.length}s${actualFps ? ` · ${actualFps} FPS` : ''}${session.manual ? ' · REC' : ''}` : '';
  }

  function saveManual(current) {
    if (!current?.manual) return;
    const fragments = current.manual.fragments;
    current.manual = null;
    try {
      const file = current.buffer.export(fragments);
      if (file) { download(file, filename(current.item,'recording')); message('Recording saved.'); }
      else message('Recording was too short to save.');
    } catch { message('Could not finish this recording.'); }
    render();
  }
  function stopRecording(save = true) {
    const current = session;
    if (!current) return;
    session = null;
    if (save) saveManual(current);
    current.recorder.ondataavailable = null;
    if (current.recorder.state !== 'inactive') current.recorder.stop();
    render();
  }
  function releaseCapture(save = true) {
    generation++;
    stopRecording(save);
    stopTracks(request?.source);
    const current = capture; capture = null;
    if (current) { current.fixed.clean(); stopTracks(current.source); }
    try { navigator.mediaDevices?.setCaptureHandleConfig?.({ permittedOrigins:[] }); } catch { /* optional API cleanup */ }
    render();
  }

  function collect(current, fragments) {
    if (!current.manual) return;
    for (const fragment of fragments) {
      if (!current.manual.fragments.length && !fragment.keyframe) continue;
      current.manual.fragments.push(fragment);
      current.manual.bytes += fragment.bytes;
      if (current.manual.bytes >= manualLimit) { saveManual(current); message('Recording saved at the local memory limit.'); break; }
    }
  }
  function startRecording() {
    if (session || !capture || !settings.enabled || !hasPlayer()) return;
    const videoBitsPerSecond = bitrate(settings);
    const recorder = new MediaRecorder(capture.fixed.stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond:128000, videoKeyFrameIntervalDuration:1000 });
    // Keep enough compressed media for 125 seconds at the selected bitrate,
    // with headroom for keyframes and encoder bitrate variation.
    const maxBytes = Math.max(96 * 1024 * 1024, Math.ceil((videoBitsPerSecond + 128000) * 125 / 8 * 1.4));
    const current = { recorder, buffer:new ReplayBuffer(maxBytes), item, manual:null, queue:Promise.resolve() };
    session = current;
    recorder.ondataavailable = event => {
      if (!event.data.size || session !== current) return;
      current.queue = current.queue.then(async () => {
        if (session !== current) return;
        const data = new Uint8Array(await event.data.arrayBuffer());
        if (session !== current) return;
        collect(current, current.buffer.append(data));
        render();
      }).catch(error => {
        if (session !== current) return;
        console.warn('WLNG replay buffer stopped:', error.message);
        releaseCapture(); message('MP4 buffering failed. Click the clip button to try again.');
      });
    };
    recorder.onerror = () => {
      if (session === current) { releaseCapture(); message('Recording stopped. Click the clip button to retry.'); }
    };
    recorder.onstop = () => {
      if (session === current) { releaseCapture(); message('Recording stopped. Click the clip button to retry.'); }
    };
    recorder.start(500);
    message(''); render();
  }

  async function permitCapture() {
    if (!settings.enabled || !supported || !hasPlayer()) return false;
    if (capture) { startRecording(); return Boolean(session); }
    if (request) return false;
    if (!navigator.userActivation?.isActive) { message('Click Clip last to allow recording.'); render(); return false; }
    const attempt = {}, ownGeneration = generation, handle = crypto.randomUUID();
    request = attempt;
    message('Select this WLNG tab and share tab audio.'); render();
    let source, fixed;
    try {
      navigator.mediaDevices.setCaptureHandleConfig({ handle, exposeOrigin:true, permittedOrigins:[location.origin] });
      const quality = { resolution:settings.resolution, fps:settings.fps };
      source = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:{ ideal:quality.fps,max:quality.fps } }, audio:{ suppressLocalAudioPlayback:false },
        preferCurrentTab:true, selfBrowserSurface:'include', surfaceSwitching:'exclude', monitorTypeSurfaces:'exclude', systemAudio:'exclude' });
      attempt.source = source;
      const track = source.getVideoTracks()[0];
      if (!track || !sameTab(track,handle)) throw new Error('Select this exact WLNG tab to record.');
      if (!source.getAudioTracks().length) throw new Error('Select the WLNG tab with Share tab audio enabled.');
      if (ownGeneration !== generation || !settings.enabled || !hasPlayer()) return false;
      let isolated = false;
      if (globalThis.RestrictionTarget && track.restrictTo) {
        try { await track.restrictTo(await RestrictionTarget.fromElement(slot)); isolated = true; } catch { /* Try bounded region capture. */ }
      }
      if (!isolated) {
        if (!globalThis.CropTarget || !track.cropTo) throw new Error('This browser cannot isolate the stream player.');
        await track.cropTo(await CropTarget.fromElement(slot));
      }
      if (!sameTab(track,handle) || ownGeneration !== generation || !hasPlayer()) return false;
      fixed = await fixedVideo(source,slot,isolated,quality);
      if (!sameTab(track,handle) || ownGeneration !== generation || !settings.enabled || !hasPlayer()) return false;
      capture = { source, fixed };
      const ended = () => {
        if (capture?.source !== source) return;
        releaseCapture(); message('Tab sharing ended. Click Clip last to restart.');
      };
      for (const mediaTrack of source.getTracks()) mediaTrack.addEventListener('ended',ended,{once:true});
      track.addEventListener('capturehandlechange', () => { if (!sameTab(track,handle)) ended(); });
      startRecording();
      return Boolean(session);
    } catch (error) {
      if (ownGeneration === generation) {
        if (capture?.source === source) releaseCapture();
        message(error.name === 'NotAllowedError' ? 'Recording permission was declined. Click Clip last to retry.' :
          error.message || 'Recording is unavailable in this browser.');
      }
      return false;
    } finally {
      if (capture?.source !== source) { fixed?.clean(); stopTracks(source); }
      if (request === attempt) {
        request = null;
        if (!capture) { try { navigator.mediaDevices.setCaptureHandleConfig({ permittedOrigins:[] }); } catch { /* optional API cleanup */ } }
      }
      render();
    }
  }

  enabled.addEventListener('change', () => {
    settings.enabled = enabled.checked;
    saveSettings(); renderSettings();
    if (!settings.enabled) { releaseCapture(); message(''); }
    else if (hasPlayer()) void permitCapture();
    render();
  });
  length.addEventListener('change', () => {
    settings.length = [30,60,120].includes(Number(length.value)) ? Number(length.value) : 60;
    saveSettings(); render();
  });
  function updateQuality() {
    settings.resolution = [480,720,1080].includes(Number(resolution.value)) ? Number(resolution.value) : 720;
    settings.fps = [30,60].includes(Number(fps.value)) ? Number(fps.value) : 30;
    saveSettings();
    if (capture || request || session) { releaseCapture(); message('Quality changed. Return to the player to start a new buffer.'); }
    render();
  }
  resolution.addEventListener('change',updateQuality);
  fps.addEventListener('change',updateQuality);
  manualButtonOption.addEventListener('change', () => {
    settings.manual = manualButtonOption.checked;
    if (!settings.manual) saveManual(session);
    saveSettings(); render();
  });
  clip.addEventListener('click', async () => {
    if (!session) { await permitCapture(); return; }
    const buffer = session.buffer;
    try {
      const file = buffer.export(buffer.recent(settings.length));
      if (file) { download(file,filename(session.item,`clip-${Math.min(settings.length,Math.round(buffer.seconds))}s`)); message('Clip saved.'); }
      else message('Buffering your first few seconds…');
    } catch { message('Could not save this clip.'); }
  });
  record.addEventListener('click', async () => {
    if (!session && !(await permitCapture())) return;
    if (!session || !settings.manual) return;
    if (session.manual) { saveManual(session); return; }
    session.manual = { fragments:[],bytes:0 };
    message('Recording started.'); render();
  });

  // The player wrapper stays in place when switching streams or minimizing.
  // Removing its iframe (pop-out PIP) pauses capture until playback returns.
  new MutationObserver(() => {
    if (!settings.enabled || !eligible) return;
    if (!hasPlayer()) { releaseCapture(); message('Return the video to WLNG to resume clipping.'); }
    else if (capture && !session) { try { startRecording(); } catch { releaseCapture(); message('Click Clip last to retry.'); } }
    else if (!capture && !request && !session && player.open) message('Click Clip last to allow recording.');
    render();
  }).observe(slot,{ childList:true });
  window.addEventListener('pagehide', () => releaseCapture(false));
  window.addEventListener('beforeunload', event => { if (session?.manual) { event.preventDefault(); event.returnValue = ''; } });

  renderSettings(); render();
  return {
    openStream(next, live) {
      if (item?.id !== next.id) stopRecording();
      item = next; eligible = live;
      if (!settings.enabled || !supported) { render(); return; }
      if (!eligible) { releaseCapture(); message('Clipping is available on live streams.'); }
      else if (capture) { try { startRecording(); } catch { releaseCapture(); message('Click Clip last to retry.'); } }
      else void permitCapture();
      render();
    },
    closeStream() { item = null; eligible = false; releaseCapture(); message(''); },
  };
}
