import type { Track } from './tracks';

export type RadioState =
  | 'off' // powered down
  | 'silent' // Sound is off in Settings
  | 'idle' // powered, but the visitor is not in the basement
  | 'loading'
  | 'playing'
  | 'blocked' // the browser has not allowed audio yet
  | 'unavailable'; // the track could not be fetched or decoded

export interface Channel {
  context: AudioContext;
  output: AudioNode;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

const FADE = 0.25;
const STOP_AFTER_MS = 1500;

// Fetches the first source this browser can play.
async function fetchTrack(track: Track) {
  const probe = document.createElement('audio');
  const choice =
    track.sources.find((entry) => probe.canPlayType(entry.type) !== '') ??
    track.sources[0];
  if (!choice) throw new Error('The radio track has no sources.');
  const response = await fetch(new URL(choice.url, document.baseURI));
  if (!response.ok)
    throw new Error(`The radio track returned ${response.status}.`);
  return response.arrayBuffer();
}

// Trims encoder padding some decoders keep, so the loop is exactly the
// track's musical length.
function loopPoints(buffer: AudioBuffer, seconds?: number) {
  if (!seconds || buffer.duration <= seconds) return [0, buffer.duration];
  const extra = buffer.duration - seconds;
  const data = buffer.getChannelData(0);
  const limit = Math.floor(extra * buffer.sampleRate);
  // shortcut: assumes the padding is leading near-silence (true of AAC
  // priming); a track that opens on silence plays from its first sound.
  let start = 0;
  while (start < limit && Math.abs(data[start] ?? 0) < 0.01) start++;
  return [start / buffer.sampleRate, start / buffer.sampleRate + seconds];
}

// The basement radio: one looping source, positioned at the set, under the
// ambience's master gain (so Sound, Mute and Volume apply). Async results
// from a superseded request are ignored, and at most one source is live.
export function createRadio(
  track: Track,
  channel: () => Channel | undefined,
  report: (state: RadioState, sources: number) => void,
  loadTrack: (track: Track) => Promise<ArrayBuffer> = fetchTrack,
) {
  let sound = false;
  let power = true;
  let inZone = false;
  let hidden = false;
  let emitter: Point | undefined;
  let buffer: AudioBuffer | undefined;
  let loading = false;
  let failed = false;
  let generation = 0;
  let watched: AudioContext | undefined;
  let live:
    | { source: AudioBufferSourceNode; fade: GainNode; panner: PannerNode }
    | undefined;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let sources = 0;
  let state: RadioState = 'off';

  function wanted() {
    return sound && power && inZone && emitter !== undefined;
  }

  function publish(next: RadioState) {
    state = next;
    report(state, sources);
  }

  function stopLive() {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    if (!live) return;
    live.source.stop();
    live.source.disconnect();
    live.fade.disconnect();
    live.panner.disconnect();
    live = undefined;
    sources--;
    report(state, sources);
  }

  async function load(ch: Channel) {
    const request = ++generation;
    loading = true;
    failed = false;
    publish('loading');
    try {
      const decoded = await ch.context.decodeAudioData(await loadTrack(track));
      if (request !== generation) return;
      buffer = decoded;
    } catch (error) {
      if (request !== generation) return;
      console.warn('The radio track could not be played.', error);
      failed = true;
    } finally {
      if (request === generation) loading = false;
    }
    sync();
  }

  function sync() {
    const ch = channel();
    if (ch && watched !== ch.context) {
      // Resuming in a later gesture reaches the radio through this event.
      watched = ch.context;
      watched.addEventListener('statechange', sync);
    }
    // Prefetch once the basement is in and Sound is on, so the loop is ready
    // by the foot of the stairs.
    if (ch && sound && emitter && !buffer && !loading && !failed) void load(ch);

    if (!wanted() || !ch || !buffer) {
      if (live && !stopTimer) {
        live.fade.gain.setTargetAtTime(0, ch?.context.currentTime ?? 0, FADE);
        // Leaving fades the loop, then stops and disconnects it.
        stopTimer = setTimeout(stopLive, STOP_AFTER_MS);
      }
    } else {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = undefined;
      if (!live) {
        const { context } = ch;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const [start, end] = loopPoints(buffer, track.loopSeconds);
        source.loopStart = start ?? 0;
        source.loopEnd = end ?? buffer.duration;
        const fade = context.createGain();
        fade.gain.value = 0;
        const panner = context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.8;
        panner.rolloffFactor = 1.6;
        panner.maxDistance = 20;
        setPosition(panner, emitter!);
        source.connect(fade).connect(panner).connect(ch.output);
        source.start(0, start);
        live = { source, fade, panner };
        sources++;
      }
      // A hidden tab fades the radio out; the same source returns with it.
      live.fade.gain.setTargetAtTime(
        hidden ? 0 : track.level,
        ch.context.currentTime,
        FADE,
      );
    }

    if (!power) publish('off');
    else if (!sound) publish('silent');
    else if (failed) publish('unavailable');
    else if (!inZone || !emitter) publish('idle');
    else if (!buffer) publish(ch ? 'loading' : 'blocked');
    else if (!ch || ch.context.state !== 'running') publish('blocked');
    else publish('playing');
  }

  function setPosition(panner: PannerNode, at: Point) {
    if (panner.positionX) {
      panner.positionX.value = at.x;
      panner.positionY.value = at.y;
      panner.positionZ.value = at.z;
    } else panner.setPosition(at.x, at.y, at.z);
  }

  sync();
  return {
    get state() {
      return state;
    },
    get power() {
      return power;
    },
    setSound(on: boolean) {
      sound = on;
      sync();
    },
    // The basement has loaded; the set's emitter is at this world position.
    setReady(at: Point) {
      emitter = { x: at.x, y: at.y, z: at.z };
      sync();
    },
    setZone(on: boolean) {
      if (on === inZone) return;
      inZone = on;
      sync();
    },
    setHidden(on: boolean) {
      hidden = on;
      sync();
    },
    // Call from the click/E gesture on the power switch. A blocked or failed
    // radio retries instead of switching off.
    press() {
      if (power && state === 'unavailable') failed = false;
      else if (!(power && state === 'blocked')) power = !power;
      sync();
    },
    // Keeps the listener on the visitor's head, facing where they look.
    listen(position: Point, forward: Point, up: Point) {
      const ch = channel();
      if (!ch || !live) return;
      const listener = ch.context.listener;
      if (listener.positionX) {
        const now = ch.context.currentTime;
        listener.positionX.setValueAtTime(position.x, now);
        listener.positionY.setValueAtTime(position.y, now);
        listener.positionZ.setValueAtTime(position.z, now);
        listener.forwardX.setValueAtTime(forward.x, now);
        listener.forwardY.setValueAtTime(forward.y, now);
        listener.forwardZ.setValueAtTime(forward.z, now);
        listener.upX.setValueAtTime(up.x, now);
        listener.upY.setValueAtTime(up.y, now);
        listener.upZ.setValueAtTime(up.z, now);
      } else {
        listener.setPosition(position.x, position.y, position.z);
        listener.setOrientation(
          forward.x,
          forward.y,
          forward.z,
          up.x,
          up.y,
          up.z,
        );
      }
    },
    sync,
    dispose() {
      generation++;
      watched?.removeEventListener('statechange', sync);
      stopLive();
    },
  };
}
