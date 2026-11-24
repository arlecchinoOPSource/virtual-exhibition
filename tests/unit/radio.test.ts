import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRadio } from '../../src/audio/radio';
import type { Channel, RadioState } from '../../src/audio/radio';
import type { Track } from '../../src/audio/tracks';

// A minimal stand-in for the Web Audio graph: enough to see which sources
// start, stop and disconnect, and where gains are heading.
class Param {
  value = 0;
  setTargetAtTime(value: number) {
    this.value = value;
  }
  setValueAtTime(value: number) {
    this.value = value;
  }
}
class Node {
  outputs: unknown[] = [];
  connect<T>(node: T) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs = [];
  }
}
class Source extends Node {
  buffer: unknown;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started = false;
  stopped = false;
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}
class Context {
  state: AudioContextState = 'running';
  currentTime = 0;
  sources: Source[] = [];
  handlers = new Set<() => void>();
  listener = Object.fromEntries(
    ['position', 'forward', 'up'].flatMap((name) =>
      ['X', 'Y', 'Z'].map((axis) => [name + axis, new Param()]),
    ),
  );
  createGain() {
    return Object.assign(new Node(), { gain: new Param() });
  }
  createPanner() {
    return Object.assign(new Node(), {
      positionX: new Param(),
      positionY: new Param(),
      positionZ: new Param(),
    });
  }
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async () => buffer(12.8, 0));
  addEventListener(_: string, handler: () => void) {
    this.handlers.add(handler);
  }
  removeEventListener(_: string, handler: () => void) {
    this.handlers.delete(handler);
  }
  resume() {
    this.state = 'running';
    for (const handler of this.handlers) handler();
  }
}

// A buffer whose first `silent` samples are near zero, at 100 Hz for brevity.
function buffer(seconds: number, silent: number) {
  const data = new Float32Array(Math.round(seconds * 100)).fill(0.5);
  data.fill(0.001, 0, silent);
  return {
    duration: seconds,
    sampleRate: 100,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

const track: Track = {
  title: 'Test loop',
  sources: [{ url: 'audio/test.m4a', type: 'audio/mp4' }],
  loopSeconds: 12.8,
  level: 0.5,
};
const flush = () => new Promise((done) => setImmediate(done));

function setup(load = vi.fn(async () => new ArrayBuffer(8))) {
  const context = new Context();
  const output = new Node();
  let live = 0;
  const radio = createRadio(
    track,
    () => ({ context, output }) as unknown as Channel,
    (_state: RadioState, sources) => {
      live = sources;
    },
    load,
  );
  const enter = () => {
    radio.setSound(true);
    radio.setReady({ x: 26.6, y: -2, z: 3.7 });
    radio.setZone(true);
  };
  return { radio, context, load, enter, live: () => live };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('basement radio', () => {
  it('requests nothing until Sound is on and the basement has loaded', async () => {
    const { radio, context, load, live } = setup();
    radio.setReady({ x: 26.6, y: -2, z: 3.7 });
    radio.setZone(true);
    expect(load).not.toHaveBeenCalled();
    expect(radio.state).toBe('silent');

    radio.setSound(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(radio.state).toBe('loading');
    await flush();
    expect(radio.state).toBe('playing');
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]!.started).toBe(true);
    expect(context.sources[0]!.loop).toBe(true);
    expect(live()).toBe(1);
  });

  it('starts no source when Sound goes off while the track loads', async () => {
    let finish: (data: ArrayBuffer) => void = () => {};
    const { radio, context, enter } = setup(
      vi.fn(() => new Promise<ArrayBuffer>((done) => (finish = done))),
    );
    enter();
    radio.setSound(false);
    finish(new ArrayBuffer(8));
    await flush();
    expect(context.sources).toHaveLength(0);
    expect(radio.state).toBe('silent');
  });

  it('keeps one source through rapid power and zone changes, then stops it', async () => {
    const { radio, context, enter, live } = setup();
    enter();
    await flush();
    for (let i = 0; i < 5; i++) {
      radio.press();
      radio.setZone(i % 2 === 0);
    }
    radio.setZone(true);
    // Back on within the fade: the same source returns.
    expect(radio.power).toBe(false);
    radio.press();
    expect(context.sources).toHaveLength(1);
    expect(live()).toBe(1);

    radio.press();
    expect(radio.state).toBe('off');
    vi.advanceTimersByTime(1500);
    expect(context.sources[0]!.stopped).toBe(true);
    expect(context.sources[0]!.outputs).toHaveLength(0);
    expect(live()).toBe(0);

    // Power stays off across leaving and coming back.
    radio.setZone(false);
    radio.setZone(true);
    expect(radio.state).toBe('off');
    radio.press();
    expect(context.sources).toHaveLength(2);
    expect(live()).toBe(1);
  });

  it('reports a failed track and retries it from the power switch', async () => {
    const load = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new ArrayBuffer(8));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { radio, context, enter } = setup(load);
    enter();
    await flush();
    expect(radio.state).toBe('unavailable');
    expect(context.sources).toHaveLength(0);

    radio.press();
    expect(radio.power).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    await flush();
    expect(radio.state).toBe('playing');
    warn.mockRestore();
  });

  it('waits while the browser blocks audio, then plays on resume', async () => {
    const { radio, context, enter } = setup();
    context.state = 'suspended';
    enter();
    await flush();
    expect(radio.state).toBe('blocked');
    // Pressing a blocked radio retries rather than switching it off.
    radio.press();
    expect(radio.power).toBe(true);
    context.resume();
    expect(radio.state).toBe('playing');
    expect(context.sources).toHaveLength(1);
  });

  it('ignores a track that arrives after disposal', async () => {
    let finish: (data: ArrayBuffer) => void = () => {};
    const { radio, context, enter } = setup(
      vi.fn(() => new Promise<ArrayBuffer>((done) => (finish = done))),
    );
    enter();
    radio.dispose();
    finish(new ArrayBuffer(8));
    await flush();
    expect(context.sources).toHaveLength(0);
  });

  it('fades the same source out and back in around a hidden tab', async () => {
    const { radio, context, enter } = setup();
    enter();
    await flush();
    const fade = context.sources[0]!.outputs[0] as { gain: Param };
    expect(fade.gain.value).toBe(0.5);
    radio.setHidden(true);
    expect(fade.gain.value).toBe(0);
    vi.advanceTimersByTime(5000);
    radio.setHidden(false);
    expect(fade.gain.value).toBe(0.5);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]!.stopped).toBe(false);
  });

  it('loops exactly the musical length when the decoder keeps padding', async () => {
    const { radio, context, enter } = setup();
    context.decodeAudioData.mockResolvedValue(buffer(12.84, 3));
    enter();
    await flush();
    const source = context.sources[0]!;
    expect(source.loopStart).toBeCloseTo(0.03, 5);
    expect(source.loopEnd).toBeCloseTo(12.83, 5);
    expect(radio.state).toBe('playing');
  });
});
