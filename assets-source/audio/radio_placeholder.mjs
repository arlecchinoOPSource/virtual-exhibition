// Renders the basement radio's placeholder loop: an original, synthesized
// black metal fragment heard through an old AM set. Deterministic, no samples.
//
//   node assets-source/audio/radio_placeholder.mjs /tmp/radio-placeholder.wav
//   afconvert -f Oggf -d opus@48000 -b 40000 /tmp/radio-placeholder.wav public/audio/radio-placeholder.opus
//   afconvert -f m4af -d aac -b 64000 /tmp/radio-placeholder.wav public/audio/radio-placeholder.m4a
//
// Eight bars at 150 BPM of tremolo-picked power chords over a blast beat,
// band-limited to the AM voice band with hiss and crackle. Every voice is
// rendered circularly (tails wrap to the start), so the loop has no seam.
import { writeFileSync } from 'node:fs';

const RATE = 48000;
const BPM = 150;
const BARS = 8;
const beat = 60 / BPM;
const length = Math.round(BARS * 4 * beat * RATE);
const out = new Float32Array(length);

let seed = 61;
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

// Adds a voice at time t, wrapping anything past the end back to the start.
function add(t, samples) {
  const start = Math.round(t * RATE);
  for (let i = 0; i < samples.length; i++)
    out[(start + i) % length] += samples[i];
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// Root notes per bar: a descending minor figure with a Phrygian half step.
const roots = [40, 41, 38, 40, 36, 35, 34, 35];

// Guitar: power chords tremolo-picked in sixteenths, detuned and overdriven.
const pick = beat / 4;
roots.forEach((root, bar) => {
  for (let k = 0; k < 16; k++) {
    const t = (bar * 4 + k / 4) * beat;
    const n = Math.round(pick * RATE);
    const voice = new Float32Array(n);
    const notes = [root, root + 7, root + 12].map(midi);
    for (let i = 0; i < n; i++) {
      const s = i / RATE;
      let v = 0;
      for (const f of notes)
        for (const detune of [0.997, 1.003])
          v += ((s * f * detune) % 1) * 2 - 1;
      const env = Math.min(1, i / 60) * Math.exp(-s * 9);
      voice[i] = Math.tanh(v * 1.8) * 0.16 * env;
    }
    add(t, voice);
  }
});

// Bass: the root an octave down, held through each bar.
roots.forEach((root, bar) => {
  const n = Math.round(4 * beat * RATE);
  const voice = new Float32Array(n);
  const f = midi(root - 12);
  for (let i = 0; i < n; i++)
    voice[i] = Math.sin((2 * Math.PI * f * i) / RATE) * 0.14;
  add(bar * 4 * beat, voice);
});

// Drums: a blast beat, kick and snare alternating on every eighth note.
function kick() {
  const n = Math.round(0.12 * RATE);
  const v = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const s = i / RATE;
    phase += (2 * Math.PI * (45 + 90 * Math.exp(-s * 40))) / RATE;
    v[i] = Math.sin(phase) * Math.exp(-s * 25) * 0.5;
  }
  return v;
}
function snare() {
  const n = Math.round(0.1 * RATE);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / RATE;
    v[i] =
      ((random() * 2 - 1) * 0.3 + Math.sin(2 * Math.PI * 190 * s) * 0.15) *
      Math.exp(-s * 35);
  }
  return v;
}
for (let k = 0; k < BARS * 8; k++) {
  add((k * beat) / 2, k % 2 ? snare() : kick());
  // Ride on every eighth: short bursts of bright noise.
  const n = Math.round(0.03 * RATE);
  const ride = new Float32Array(n);
  for (let i = 0; i < n; i++)
    ride[i] = (random() * 2 - 1) * 0.05 * Math.exp((-i / RATE) * 60);
  add((k * beat) / 2, ride);
}

// The radio: a 300-3200 Hz band, light saturation, hiss and crackle. The
// filters run over the loop twice so their state is settled at the seam.
function biquad(type, f, q) {
  const w = (2 * Math.PI * f) / RATE;
  const a = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const [b0, b1, b2] =
    type === 'low'
      ? [(1 - c) / 2, 1 - c, (1 - c) / 2]
      : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const [a0, a1, a2] = [1 + a, -2 * c, 1 - a];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    return y;
  };
}
const chain = [
  biquad('high', 300, 0.7),
  biquad('high', 300, 0.7),
  biquad('low', 3200, 0.7),
  biquad('low', 3200, 0.7),
];
const radio = new Float32Array(length);
for (let pass = 0; pass < 2; pass++)
  for (let i = 0; i < length; i++) {
    const wobble = 1 + 0.04 * Math.sin((2 * Math.PI * 0.5 * i) / RATE);
    let v = out[i] * wobble + (random() * 2 - 1) * 0.012;
    if (random() < 0.0004) v += (random() * 2 - 1) * 0.5;
    for (const stage of chain) v = stage(v);
    radio[i] = Math.tanh(v * 1.4);
  }
let peak = 0;
for (const v of radio) peak = Math.max(peak, Math.abs(v));

const data = Buffer.alloc(44 + length * 2);
data.write('RIFF', 0);
data.writeUInt32LE(36 + length * 2, 4);
data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(RATE, 24);
data.writeUInt32LE(RATE * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; i++)
  data.writeInt16LE(Math.round((radio[i] / peak) * 0.89 * 32767), 44 + i * 2);
writeFileSync(process.argv[2] ?? 'radio-placeholder.wav', data);
console.log(`${(length / RATE).toFixed(2)} s, ${length} samples at ${RATE} Hz`);
