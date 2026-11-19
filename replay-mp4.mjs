// MP4 fragments from the native browser recorder. No media is sent off-device.
const bytesLimit = 96 * 1024 * 1024;
const pendingLimit = 32 * 1024 * 1024;
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const text = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

function atoms(bytes, complete = true) {
  const result = [];
  let offset = 0;
  const data = view(bytes);
  while (offset + 8 <= bytes.length) {
    let size = data.getUint32(offset), header = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) break;
      size = Number(data.getBigUint64(offset + 8));
      header = 16;
    }
    if (size < header || !Number.isSafeInteger(size) || size > pendingLimit) throw new Error('Unsupported MP4 box');
    if (offset + size > bytes.length) break;
    result.push({ type:text(bytes, offset + 4), bytes:bytes.subarray(offset, offset + size), header });
    offset += size;
  }
  if (complete && offset !== bytes.length) throw new Error('Incomplete MP4 metadata');
  return { result, used:offset };
}

const payload = box => box.bytes.subarray(box.header);
const children = box => atoms(payload(box)).result;
const child = (box, type) => children(box).find(item => item.type === type);
const flags = data => data.getUint32(0) & 0xffffff;

function durationField(data, offset, value) {
  if (data.getUint8(0) === 1) data.setBigUint64(offset, BigInt(Math.round(value)));
  else data.setUint32(offset, Math.min(0xffffffff, Math.round(value)));
}

function finalizeHeader(header, fragments, origin) {
  const bytes = header[1].slice(), moov = atoms(bytes).result[0];
  const mvhd = child(moov, 'mvhd');
  if (!mvhd) return [header[0], bytes];
  const movie = view(payload(mvhd)), movieLong = movie.getUint8(0) === 1;
  const scale = movie.getUint32(movieLong ? 20 : 12);
  const ends = new Map();
  for (const fragment of fragments) for (const track of fragment.timeline) {
    ends.set(track.id, Math.max(ends.get(track.id) || 0, track.end - origin));
  }
  const duration = Math.max(...ends.values());
  durationField(movie, movieLong ? 24 : 16, duration * scale);
  for (const track of children(moov).filter(box => box.type === 'trak')) {
    const tkhd = view(payload(child(track,'tkhd'))), long = tkhd.getUint8(0) === 1;
    const end = ends.get(tkhd.getUint32(long ? 20 : 12)) || 0;
    durationField(tkhd, long ? 28 : 20, end * scale);
    const mdhd = view(payload(child(child(track,'mdia'),'mdhd'))), mediaLong = mdhd.getUint8(0) === 1;
    durationField(mdhd, mediaLong ? 24 : 16, end * mdhd.getUint32(mediaLong ? 20 : 12));
  }
  const mvex = child(moov,'mvex'), mehd = mvex && child(mvex,'mehd');
  if (mehd) durationField(view(payload(mehd)), 4, duration * scale);
  return [header[0], bytes];
}

function readTracks(moov) {
  const tracks = new Map();
  for (const track of children(moov).filter(box => box.type === 'trak')) {
    const tkhd = view(payload(child(track, 'tkhd')));
    const media = child(track, 'mdia');
    const mdhd = view(payload(child(media, 'mdhd')));
    const type = text(payload(child(media, 'hdlr')), 8);
    const id = tkhd.getUint32(tkhd.getUint8(0) === 1 ? 20 : 12);
    const scale = mdhd.getUint32(mdhd.getUint8(0) === 1 ? 20 : 12);
    if (!scale) throw new Error('Invalid track timescale');
    tracks.set(id, { scale, type, duration:0, flags:0 });
  }
  const mvex = child(moov, 'mvex');
  if (!mvex) throw new Error('Recording does not contain reusable MP4 fragments');
  for (const trex of children(mvex).filter(box => box.type === 'trex')) {
    const data = view(payload(trex));
    const track = tracks.get(data.getUint32(4));
    if (track) Object.assign(track, { duration:data.getUint32(12), flags:data.getUint32(20) });
  }
  if (![...tracks.values()].some(track => track.type === 'vide')) throw new Error('Missing video track');
  return tracks;
}

function trackFragment(traf, tracks) {
  const boxes = children(traf), tfhd = view(payload(boxes.find(box => box.type === 'tfhd')));
  const trackId = tfhd.getUint32(4), track = tracks.get(trackId);
  if (!track) throw new Error('Unknown MP4 track');
  const mask = flags(tfhd);
  // Chromium fragments use offsets relative to the moof. Absolute offsets
  // would require rewriting sample locations as well as timestamps.
  if ((mask & 1) || !(mask & 0x020000)) throw new Error('Unsupported recording layout');
  let offset = 8;
  if (mask & 2) offset += 4;
  const durationDefault = mask & 8 ? tfhd.getUint32(offset) : track.duration;
  if (mask & 8) offset += 4;
  if (mask & 16) offset += 4;
  const flagsDefault = mask & 32 ? tfhd.getUint32(offset) : track.flags;
  const timeBox = boxes.find(box => box.type === 'tfdt'), timing = view(payload(timeBox));
  const long = timing.getUint8(0) === 1;
  const time = long ? Number(timing.getBigUint64(4)) : timing.getUint32(4);
  if (!Number.isSafeInteger(time)) throw new Error('Unsupported recording timestamp');
  let duration = 0, samples = 0, keyframe = false, hasSamples = false;
  for (const runBox of boxes.filter(box => box.type === 'trun')) {
    const run = view(payload(runBox)), runMask = flags(run), count = run.getUint32(4);
    let cursor = 8 + (runMask & 1 ? 4 : 0);
    const firstFlags = runMask & 4 ? run.getUint32(cursor) : undefined;
    if (runMask & 4) cursor += 4;
    if (count > 100000) throw new Error('Invalid recording sample count');
    for (let i = 0; i < count; i++) {
      const sampleDuration = runMask & 0x100 ? run.getUint32(cursor) : durationDefault;
      if (runMask & 0x100) cursor += 4;
      if (runMask & 0x200) cursor += 4;
      const sampleFlags = runMask & 0x400 ? run.getUint32(cursor) : (i === 0 ? firstFlags ?? flagsDefault : flagsDefault);
      if (runMask & 0x400) cursor += 4;
      if (runMask & 0x800) cursor += 4;
      if (cursor > run.byteLength || (!(runMask & 0x100) && !durationDefault)) throw new Error('Invalid recording sample');
      if (!hasSamples) keyframe = (sampleFlags & 0x10000) === 0 && ((sampleFlags >>> 24) & 3) !== 1;
      hasSamples = true;
      duration += sampleDuration;
      samples++;
    }
  }
  return { id:trackId, scale:track.scale, type:track.type, time, start:time / track.scale,
    end:(time + duration) / track.scale, keyframe:hasSamples && keyframe, timeBox, long, samples };
}

function describe(moof, mdat, tracks) {
  const timeline = children(moof).filter(box => box.type === 'traf').map(box => trackFragment(box, tracks));
  if (!timeline.length) throw new Error('Empty MP4 fragment');
  const video = timeline.find(track => track.type === 'vide');
  return { moof:moof.bytes, header:moof.header, mdat:mdat.bytes, timeline, keyframe:Boolean(video?.keyframe),
    start:video?.start ?? Math.min(...timeline.map(track => track.start)),
    end:video?.end ?? Math.max(...timeline.map(track => track.end)),
    bytes:moof.bytes.length + mdat.bytes.length };
}

export class ReplayBuffer {
  constructor(maxBytes = bytesLimit) {
    this.pending = new Uint8Array();
    this.header = [];
    this.tracks = null;
    this.moof = null;
    this.fragments = [];
    this.bytes = 0;
    this.end = 0;
    this.maxBytes = maxBytes;
  }

  append(chunk) {
    const input = new Uint8Array(this.pending.length + chunk.length);
    input.set(this.pending); input.set(chunk, this.pending.length);
    const { result, used } = atoms(input, false);
    this.pending = input.slice(used);
    if (this.pending.length > pendingLimit) throw new Error('Recording buffer exceeded its limit');
    const added = [];
    for (const box of result) {
      // Copy each retained box so dropping an older fragment releases its bytes.
      const own = { ...box, bytes:box.bytes.slice() };
      if (box.type === 'ftyp') this.header = [own.bytes];
      if (box.type === 'moov') { this.tracks = readTracks(own); this.header.push(own.bytes); }
      if (box.type === 'moof') this.moof = own;
      if (box.type === 'mdat' && this.moof && this.tracks) {
        const fragment = describe(this.moof, own, this.tracks);
        this.moof = null;
        added.push(fragment);
        this.fragments.push(fragment);
        this.bytes += fragment.bytes;
        this.end = Math.max(this.end, fragment.end);
      }
    }
    this.trim();
    return added;
  }

  trim() {
    const earliest = this.fragments.findLastIndex(fragment => fragment.keyframe && fragment.start <= this.end - 125);
    const discard = count => {
      for (const item of this.fragments.splice(0, count)) this.bytes -= item.bytes;
    };
    if (earliest > 0) discard(earliest);
    while (this.bytes > this.maxBytes && this.fragments.length) {
      const next = this.fragments.findIndex((fragment, i) => i > 0 && fragment.keyframe);
      discard(next > 0 ? next : this.fragments.length);
    }
  }

  get seconds() {
    const first = this.fragments.find(fragment => fragment.keyframe);
    return first ? Math.max(0, this.end - first.start) : 0;
  }

  recent(seconds) {
    let index = this.fragments.findLastIndex(fragment => fragment.keyframe && fragment.start <= this.end - seconds);
    if (index < 0) index = this.fragments.findIndex(fragment => fragment.keyframe);
    return index < 0 ? [] : this.fragments.slice(index);
  }

  export(fragments) {
    const first = fragments.findIndex(fragment => fragment.keyframe);
    if (first < 0 || this.header.length !== 2) return null;
    const selected = fragments.slice(first);
    let origin = Infinity;
    for (const fragment of selected) for (const track of fragment.timeline) origin = Math.min(origin, track.start);
    const parts = finalizeHeader(this.header, selected, origin);
    for (const [index, fragment] of selected.entries()) {
      const moof = { type:'moof', bytes:fragment.moof.slice(), header:fragment.header };
      const sequence = child(moof, 'mfhd');
      if (sequence) view(payload(sequence)).setUint32(4, index + 1);
      for (const traf of children(moof).filter(box => box.type === 'traf')) {
        const track = trackFragment(traf, this.tracks);
        const time = Math.max(0, track.time - Math.round(origin * track.scale));
        const timing = view(payload(track.timeBox));
        if (track.long) timing.setBigUint64(4, BigInt(time)); else timing.setUint32(4, time);
      }
      parts.push(moof.bytes, fragment.mdat);
    }
    return new Blob(parts, { type:'video/mp4' });
  }
}
