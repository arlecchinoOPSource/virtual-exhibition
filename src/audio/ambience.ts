export type Zone = 'gallery' | 'basement';

interface Layer {
  gain: GainNode;
  stop(): void;
}

const FADE = 0.3;
const STOP_AFTER_MS = 1500;

// Two seconds of looping brown noise, the base of both ambiences.
function brownNoise(context: AudioContext) {
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function lowpass(context: AudioContext, frequency: number) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  return filter;
}

// Original, synthesized ambience: a soft room tone upstairs and a low,
// slowly beating drone with rumble in the basement. No audio files load.
function buildLayer(context: AudioContext, output: AudioNode, zone: Zone) {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(output);
  const sources: AudioScheduledSourceNode[] = [];
  const noise = brownNoise(context);
  sources.push(noise);

  if (zone === 'gallery') {
    const tone = context.createGain();
    tone.gain.value = 0.12;
    noise.connect(lowpass(context, 500)).connect(tone).connect(gain);
  } else {
    const rumble = context.createGain();
    rumble.gain.value = 0.25;
    noise.connect(lowpass(context, 120)).connect(rumble).connect(gain);
    const drone = context.createGain();
    drone.gain.value = 0.06;
    const filter = lowpass(context, 220);
    filter.connect(drone).connect(gain);
    for (const [type, frequency] of [
      ['sawtooth', 55],
      ['sine', 55.6],
      ['sine', 82.4],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.connect(filter);
      sources.push(oscillator);
    }
  }
  for (const source of sources) source.start();
  return {
    gain,
    stop() {
      for (const source of sources) source.stop();
      gain.disconnect();
    },
  };
}

// Environmental audio. Nothing is created until the visitor opts in through a
// gesture, so no audio plays on load. `report` mirrors the state for the UI.
export function createAmbience(report: (state: string, live: Zone[]) => void) {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let enabled = false;
  let muted = false;
  let volume = 0.6;
  let zone: Zone = 'gallery';
  const layers = new Map<Zone, Layer>();
  const live = new Set<Zone>();

  function publish() {
    report(enabled ? (muted ? 'muted' : zone) : 'off', [...live].sort());
  }

  function sync() {
    if (context && master) {
      const now = context.currentTime;
      master.gain.setTargetAtTime(enabled && !muted ? volume : 0, now, 0.05);
      for (const name of ['gallery', 'basement'] as const) {
        const wanted = enabled && name === zone;
        let layer = layers.get(name);
        if (wanted && !layer) {
          layer = buildLayer(context, master, name);
          layers.set(name, layer);
          live.add(name);
        }
        if (!layer) continue;
        layer.gain.gain.setTargetAtTime(wanted ? 1 : 0, now, FADE);
        if (!wanted) {
          // Leaving an environment fades its layer, then stops its sources.
          const leaving = layer;
          layers.delete(name);
          setTimeout(() => {
            leaving.stop();
            if (!layers.has(name)) live.delete(name);
            publish();
          }, STOP_AFTER_MS);
        }
      }
    }
    publish();
  }

  publish();
  return {
    // Call from a visitor gesture: browsers only start audio after one.
    unlock() {
      if (!enabled) return;
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      }
      void context.resume();
      sync();
    },
    setEnabled(on: boolean) {
      enabled = on;
      if (on) this.unlock();
      else sync();
    },
    setVolume(level: number) {
      volume = level;
      sync();
    },
    setMuted(on: boolean) {
      muted = on;
      sync();
    },
    setZone(next: Zone) {
      if (next === zone) return;
      zone = next;
      sync();
    },
    dispose() {
      for (const layer of layers.values()) layer.stop();
      layers.clear();
      void context?.close();
    },
  };
}
