// CHARACTERFLOW sound kit: a tiny deterministic synthesiser (no samples, no third-party audio).
// Buses, filters, oscillators, instruments, foley generators, reverb and a VO-ducking mixer.
// Topic scores (scripts/sound.ts) place these on the film clock.

import { spawnSync } from "node:child_process";
import fs from "node:fs";

export const SR = 48000;
export const S = (t: number) => Math.round(t * SR);

export const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
export const dbg = (db: number) => 10 ** (db / 20);
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const NOTE: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
export const nf = (n: string) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n)!; return mtof(12 * (Number(m[2]) + 1) + NOTE[m[1]]); };

export class Bus {
  L: Float32Array; R: Float32Array; N: number;
  constructor(N: number) { this.N = N; this.L = new Float32Array(N); this.R = new Float32Array(N); }
  /** add a mono signal at time t (s), equal-power pan −1..1 */
  add(t: number, x: Float32Array, gain = 1, pan = 0) {
    const o = S(t);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain * Math.SQRT2, gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain * Math.SQRT2;
    for (let i = 0; i < x.length; i++) { const j = o + i; if (j < 0 || j >= this.N) continue; this.L[j] += x[i] * gl; this.R[j] += x[i] * gr; }
  }
  addSt(t: number, l: Float32Array, r: Float32Array, gain = 1) {
    const o = S(t);
    for (let i = 0; i < l.length; i++) { const j = o + i; if (j < 0 || j >= this.N) continue; this.L[j] += l[i] * gain; this.R[j] += r[i] * gain; }
  }
}

/** RBJ biquad, in place. `f` may vary per sample. */
export const biquad = (x: Float32Array, type: "lp" | "hp" | "bp" | "peak", f: number | ((i: number) => number), q = 0.707, gainDb = 0) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, lastF = -1;
  const coef = (fc: number) => {
    const w = (2 * Math.PI * clamp(fc, 10, SR * 0.45)) / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    let a0: number;
    if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { const A = 10 ** (gainDb / 40); b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  for (let i = 0; i < x.length; i++) {
    const fc = typeof f === "number" ? f : f(i);
    if (typeof f !== "number" ? (i & 31) === 0 : lastF < 0) { coef(fc); lastF = fc; }
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
};

export const noise = (n: number, seed = 1) => { const r = rng(seed); const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = r() * 2 - 1; return a; };
export const pink = (n: number, seed = 1) => {
  const w = noise(n, seed); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { b0 = 0.99765 * b0 + w[i] * 0.099046; b1 = 0.963 * b1 + w[i] * 0.2965164; b2 = 0.57 * b2 + w[i] * 1.0526913; w[i] = (b0 + b1 + b2 + w[i] * 0.1848) * 0.2; }
  return w;
};
export const envExp = (x: Float32Array, tau: number, attack = 0.002) => { for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t / attack) * Math.exp(-t / tau); } return x; };
export const envAR = (x: Float32Array, a: number, r: number) => { const d = x.length / SR; for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= smooth(0, a, t) * (1 - smooth(d - r, d, t)); } return x; };
export const sine = (dur: number, f: number | ((t: number) => number), phase = 0) => {
  const n = S(dur), a = new Float32Array(n); let p = phase;
  for (let i = 0; i < n; i++) { const fr = typeof f === "number" ? f : f(i / SR); p += (2 * Math.PI * fr) / SR; a[i] = Math.sin(p); }
  return a;
};
export const saw = (dur: number, f: number, seed = 0) => {
  const n = S(dur), a = new Float32Array(n); let p = rng(seed)();
  for (let i = 0; i < n; i++) { p += f / SR; p -= Math.floor(p); a[i] = 2 * p - 1; }
  return a;
};
export const mixInto = (dst: Float32Array, src: Float32Array, g = 1) => { for (let i = 0; i < Math.min(dst.length, src.length); i++) dst[i] += src[i] * g; return dst; };

// ── instruments ─────────────────────────────────────────────────────────────
export type Out = { dry: Bus; verb: Bus };

/** Warm pad: 3 detuned saws per note → 2-pole low-pass, slow envelope. */
export const pad = (o: Out, t0: number, t1: number, notes: string[], g: number, cutoff = 900, a = 1.5, r = 1.5, pan = 0, bright = 0) => {
  const dur = t1 - t0, n = S(dur);
  const L = new Float32Array(n), R = new Float32Array(n);
  notes.forEach((nn, k) => {
    const f = nf(nn);
    for (const [d, p] of [[-0.006, -0.6], [0, 0], [0.007, 0.6]] as const) {
      const s = saw(dur, f * (1 + d), k * 7 + Math.round(d * 1000));
      const gl = Math.cos(((p * 0.7 + pan + 1) * Math.PI) / 4), gr = Math.sin(((p * 0.7 + pan + 1) * Math.PI) / 4);
      for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
    }
  });
  const fc = (i: number) => cutoff * (1 + bright * smooth(0, n, i));
  biquad(L, "lp", fc, 0.6); biquad(L, "lp", fc, 0.6); biquad(R, "lp", fc, 0.6); biquad(R, "lp", fc, 0.6);
  envAR(L, a, r); envAR(R, a, r);
  const k = g / Math.max(1, notes.length * 1.2);
  o.dry.addSt(t0, L, R, k);
  o.verb.addSt(t0, L, R, k * 0.5);
};

export const pluck = (o: Out, t: number, note: string, g: number, pan = 0, decay = 0.996, brightness = 0.5) => {
  const f = nf(note), p = Math.max(2, Math.round(SR / f));
  const n = S(2.2), y = new Float32Array(n), buf = noise(p, Math.round(t * 1000 + f));
  biquad(buf, "lp", 1500 + brightness * 5000);
  for (let i = 0; i < n; i++) { const j = i % p; const v = buf[j]; buf[j] = decay * 0.5 * (v + buf[(j + 1) % p]); y[i] = v; }
  envExp(y, 0.9, 0.002);
  o.dry.add(t, y, g, pan);
  o.verb.add(t, y, g * 0.5, pan);
};

export const bell = (o: Out, t: number, note: string, g: number, dur = 3, pan = 0) => {
  const f = nf(note), n = S(dur), y = new Float32Array(n);
  for (const [m, a, tau] of [[1, 1, 1.4], [2.76, 0.45, 0.7], [5.4, 0.25, 0.35], [8.93, 0.12, 0.2]] as const) mixInto(y, envExp(sine(dur, f * m), tau * (dur / 3), 0.002), a);
  o.dry.add(t, y, g * 0.3, pan);
  o.verb.add(t, y, g * 0.35, pan);
};

export const kalimba = (o: Out, t: number, note: string, g: number, pan = 0) => {
  const f = nf(note), y = envExp(sine(1.8, f), 0.55, 0.002);
  mixInto(y, envExp(sine(1.8, f * 5.4), 0.06, 0.001), 0.25);
  mixInto(y, envExp(sine(1.8, f * 2), 0.25, 0.002), 0.15);
  o.dry.add(t, y, g * 0.35, pan);
  o.verb.add(t, y, g * 0.3, pan);
};

/** Electric-piano chord (sine partials + tremolo). */
export const ep = (o: Out, t: number, notes: string[], g: number, dur: number) => {
  notes.forEach((nn, k) => {
    const f = nf(nn), y = envExp(sine(dur, f), dur * 0.45, 0.01);
    mixInto(y, envExp(sine(dur, f * 2), dur * 0.18, 0.005), 0.25);
    mixInto(y, envExp(sine(dur, f * 3), dur * 0.08, 0.003), 0.08);
    for (let i = 0; i < y.length; i++) y[i] *= 1 + 0.12 * Math.sin((2 * Math.PI * 4.5 * i) / SR);
    envAR(y, 0.01, 0.4);
    o.dry.add(t + k * 0.014, y, (g * 0.3) / notes.length, (k / Math.max(1, notes.length - 1) - 0.5) * 0.5);
    o.verb.add(t, y, (g * 0.25) / notes.length);
  });
};

export const subPulse = (o: Out, t: number, g: number, f0 = 55) => { const x = envExp(sine(0.6, (u) => f0 - 18 * Math.min(1, u * 5)), 0.12, 0.004); o.dry.add(t, x, g); };

// ── foley / design ──────────────────────────────────────────────────────────
export const click = (o: Out, t: number, f: number, g: number, pan = 0, tau = 0.012) => {
  const x = envExp(biquad(noise(S(0.08), Math.round(t * 997)), "bp", f, 2.5), tau * 0.5, 0.0005);
  mixInto(x, envExp(sine(0.08, f * 0.62), tau, 0.0005), 0.4);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.15, pan);
};
export const thud = (o: Out, t: number, g: number, f = 60, tau = 0.18, pan = 0) => {
  const x = envExp(sine(0.8, (u) => f * (1.25 - 0.3 * Math.min(1, u * 4))), tau, 0.002);
  mixInto(x, envExp(biquad(noise(S(0.8), Math.round(t * 31)), "lp", 500), tau * 0.4, 0.002), 0.6);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.3, pan);
};
/** Fabric: band-passed noise with a slow, uneven swell. */
export const rustle = (o: Out, t: number, dur: number, g: number, pan = 0, f = 2400) => {
  const n = S(dur);
  const x = biquad(biquad(noise(n, Math.round(t * 113)), "bp", f, 0.7), "hp", 700);
  const r = rng(Math.round(t * 71));
  let e = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 255) === 0) e = 0.55 + 0.45 * r();
    x[i] *= Math.sin(Math.PI * u) * e;
  }
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.12, pan);
};
export const whoosh = (o: Out, t: number, dur: number, g: number, f0: number, f1: number, pan0 = -0.4, pan1 = 0.4) => {
  const n = S(dur);
  const x = biquad(noise(n, Math.round(t * 71)), "bp", (i) => f0 * (f1 / f0) ** (i / n), 1.2);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.sin(Math.PI * u) ** 1.5; }
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = pan0 + (pan1 - pan0) * (i / n); L[i] = x[i] * Math.cos(((p + 1) * Math.PI) / 4); R[i] = x[i] * Math.sin(((p + 1) * Math.PI) / 4); }
  o.dry.addSt(t, L, R, g);
  o.verb.addSt(t, L, R, g * 0.3);
};
export const heartbeat = (o: Out, t: number, g: number) => {
  for (const [dt, k] of [[0, 1], [0.17, 0.7]] as const) {
    const x = envExp(sine(0.4, (u) => 58 - 22 * Math.min(1, u * 6)), 0.07, 0.004);
    biquad(x, "lp", 160);
    o.dry.add(t + dt, x, g * k);
  }
};
/** A soft notification "bloop": a rising sine blip with a bell sparkle. */
export const pop = (o: Out, t: number, g: number, f = 880, pan = 0) => {
  const x = envExp(sine(0.35, (u) => f * (0.75 + 0.35 * Math.min(1, u * 18))), 0.07, 0.003);
  mixInto(x, envExp(sine(0.35, f * 2.01), 0.04, 0.002), 0.25);
  mixInto(x, envExp(sine(0.35, f * 3.02), 0.02, 0.001), 0.12);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.35, pan);
};
export const shimmer = (o: Out, t: number, dur: number, g: number, base = 2400, seed = 1) => {
  const r = rng(seed);
  for (let k = 0; k < Math.round(dur * 26); k++) {
    const tt = t + r() * dur, f = base * (1 + r() * 2);
    const x = envExp(sine(0.25, f), 0.05 + r() * 0.08, 0.002);
    const w = Math.sin(Math.PI * ((tt - t) / dur));
    o.dry.add(tt, x, g * 0.05 * w, r() * 1.6 - 0.8);
    o.verb.add(tt, x, g * 0.05 * w, 0);
  }
};
/** Breath: filtered noise, inhale (rising) then exhale (falling). */
export const breath = (o: Out, t: number, inhale: number, exhale: number, g: number) => {
  const a = biquad(biquad(pink(S(inhale), Math.round(t * 17)), "bp", (i) => 900 + 700 * (i / S(inhale)), 0.8), "hp", 300);
  for (let i = 0; i < a.length; i++) a[i] *= Math.sin((Math.PI * i) / a.length) ** 1.2;
  const b = biquad(biquad(pink(S(exhale), Math.round(t * 19)), "bp", (i) => 1300 - 700 * (i / S(exhale)), 0.7), "hp", 250);
  for (let i = 0; i < b.length; i++) b[i] *= Math.sin((Math.PI * i) / b.length) ** 0.8;
  o.dry.add(t, a, g * 0.9);
  o.dry.add(t + inhale, b, g);
};
/** Pen on paper: short scratchy grains, one per stroke. */
export const scribble = (o: Out, t0: number, t1: number, g: number, seed = 5) => {
  const r = rng(seed);
  let t = t0;
  while (t < t1) {
    const d = 0.05 + r() * 0.1;
    const x = biquad(biquad(noise(S(d), Math.round(t * 1000)), "bp", 3500 + r() * 2500, 1.4), "hp", 1800);
    for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length) * (0.6 + 0.4 * Math.sin(i * 0.004 * (1 + r())));
    o.dry.add(t, x, g * (0.6 + 0.4 * r()), 0.15);
    t += d + r() * 0.05;
  }
};

/** Freeverb-style stereo reverb. */
export const freeverb = (x: Float32Array, spread: number, room = 0.84, damp = 0.25) => {
  const k = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ b: new Float32Array(Math.round((d + spread) * k)), i: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ b: new Float32Array(Math.round((d + spread) * k)), i: 0 }));
  const y = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    const inp = x[n] * 0.015;
    let out = 0;
    for (const c of combs) { const o = c.b[c.i]; c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = inp + c.f * room; c.i = (c.i + 1) % c.b.length; out += o; }
    for (const a of aps) { const o = a.b[a.i]; a.b[a.i] = out + o * 0.5; a.i = (a.i + 1) % a.b.length; out = o - out; }
    y[n] = out;
  }
  return y;
};

/** Decode an audio file to mono float at SR. */
export const decode = (file: string) => {
  const raw = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 }).stdout as Buffer;
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
};

/** Speech envelope → ducking gain 0…1 (attack 60 ms, release 380 ms). */
export const duckEnvelope = (vo: Float32Array) => {
  const N = vo.length, win = S(0.02), duck = new Float32Array(N);
  let env = 0;
  for (let i = 0; i < N; i += win) {
    let e = 0;
    for (let j = i; j < Math.min(N, i + win); j++) e += vo[j] * vo[j];
    const on = Math.sqrt(e / win) > 0.012 ? 1 : 0;
    const a = on > env ? 1 - Math.exp(-0.02 / 0.06) : 1 - Math.exp(-0.02 / 0.38);
    env += (on - env) * a;
    for (let j = i; j < Math.min(N, i + win); j++) duck[j] = env;
  }
  return duck;
};

export const writeWav = (file: string, l: Float32Array, r: Float32Array, k = 1) => {
  const N = l.length;
  const b = Buffer.alloc(44 + N * 4);
  b.write("RIFF", 0); b.writeUInt32LE(36 + N * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    b.writeInt16LE(Math.round(clamp(l[i] * k, -1, 1) * 32767), 44 + i * 4);
    b.writeInt16LE(Math.round(clamp(r[i] * k, -1, 1) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
};

// ── comedy kit ──────────────────────────────────────────────────────────────
/** Cartoon boing: a sine that springs up in pitch with a wobble. */
export const boing = (o: Out, t: number, g: number, f0 = 180, f1 = 520, dur = 0.6, pan = 0) => {
  const x = sine(dur, (u) => (f0 + (f1 - f0) * Math.min(1, u / (dur * 0.35))) * (1 + 0.08 * Math.sin(u * 2 * Math.PI * 14) * Math.exp(-u * 4)));
  envAR(x, 0.005, dur * 0.5);
  mixInto(x, envExp(sine(dur, f1 * 2), 0.08, 0.002), 0.15);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.3, pan);
};
/** Referee whistle: a pea-trill around 2.6 kHz. */
export const whistle = (o: Out, t: number, dur: number, g: number, pan = 0) => {
  const n = S(dur), x = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const u = i / SR;
    const f = 2650 + 180 * Math.sign(Math.sin(2 * Math.PI * 28 * u));
    p += (2 * Math.PI * f) / SR;
    x[i] = Math.sin(p) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 28 * u));
  }
  mixInto(x, biquad(noise(n, Math.round(t * 99)), "bp", 2650, 3), 0.25);
  envAR(x, 0.01, 0.05);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.25, pan);
};
/** Crowd cheer: band-limited noise swell with "voices" (formant wobble). */
export const cheer = (o: Out, t: number, dur: number, g: number) => {
  const n = S(dur);
  const x = biquad(biquad(pink(n, 55), "bp", (i) => 900 + 400 * Math.sin(i / SR * 9), 0.8), "hp", 250);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u) * 1.4 * (0.8 + 0.2 * Math.sin(i / SR * 37)); }
  o.dry.add(t, x, g, 0);
  o.verb.add(t, x, g * 0.4, 0);
};
/** Rubber squeak (an aborted gesture). */
export const squeak = (o: Out, t: number, g: number, pan = 0) => {
  const x = sine(0.16, (u) => 1400 + 900 * Math.sin(u * Math.PI * 6));
  envAR(x, 0.01, 0.06);
  o.dry.add(t, x, g, pan);
};
/** Zipper: a fast train of clicks. */
export const zipper = (o: Out, t: number, dur: number, g: number, pan = 0) => {
  const r = rng(Math.round(t * 77));
  for (let tt = 0; tt < dur; tt += 0.008 + r() * 0.006) {
    const x = envExp(biquad(noise(S(0.02), Math.round((t + tt) * 3000)), "bp", 3500 + r() * 2500, 2), 0.003, 0.0005);
    o.dry.add(t + tt, x, g * (0.6 + 0.4 * Math.sin((Math.PI * tt) / dur)), pan);
  }
};
/** Clock tick-tock. */
export const ticktock = (o: Out, t0: number, t1: number, g: number) => {
  let k = 0;
  for (let t = t0; t < t1; t += 0.5, k++) {
    const f = k % 2 ? 2300 : 3100;
    const x = envExp(biquad(noise(S(0.05), k + 9), "bp", f, 6), 0.006, 0.0005);
    mixInto(x, envExp(sine(0.05, f * 0.5), 0.01, 0.0005), 0.3);
    o.dry.add(t, x, g, k % 2 ? 0.25 : -0.25);
  }
};
/** Sad trombone: four falling notes, the last one wobbling. */
export const sadTrombone = (o: Out, t: number, g: number) => {
  const notes: [number, number][] = [[nf("D4"), 0.42], [nf("C#4"), 0.42], [nf("C4"), 0.42], [nf("B3"), 1.4]];
  let tt = t;
  notes.forEach(([f, d], k) => {
    const n = S(d), x = new Float32Array(n);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const u = i / SR;
      const vib = k === 3 ? 1 + 0.03 * Math.sin(2 * Math.PI * 6 * u) * Math.min(1, u * 2) : 1;
      p += (2 * Math.PI * f * vib * (1 - 0.01 * Math.exp(-u * 20))) / SR;
      const ph = (p / (2 * Math.PI)) % 1;
      x[i] = 2 * ph - 1;
    }
    biquad(x, "lp", 1400, 1.5);
    biquad(x, "peak", 600, 1, 6);
    envAR(x, 0.03, k === 3 ? 0.5 : 0.06);
    o.dry.add(tt, x, g * 0.35, 0.1);
    o.verb.add(tt, x, g * 0.2, 0.1);
    tt += d;
  });
};
/** Tape rewind: a high, warbling whirr that speeds up. */
export const rewindTape = (o: Out, t: number, dur: number, g: number) => {
  const n = S(dur), x = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = 600 + 2400 * u * u + 300 * Math.sin(i / SR * 2 * Math.PI * 11);
    p += (2 * Math.PI * f) / SR;
    x[i] = Math.sin(p) * 0.4 + Math.sin(p * 1.5) * 0.2;
  }
  mixInto(x, biquad(noise(n, 31), "bp", (i) => 1500 + 3000 * (i / n), 1), 0.5);
  envAR(x, 0.05, 0.12);
  o.dry.add(t, x, g, 0);
};
/** Hand clap / high five: sharp noise burst with a body thump. */
export const clap = (o: Out, t: number, g: number, pan = 0) => {
  const x = envExp(biquad(noise(S(0.25), Math.round(t * 333)), "bp", 1800, 0.9), 0.035, 0.0008);
  mixInto(x, envExp(sine(0.25, 190), 0.03, 0.001), 0.4);
  o.dry.add(t, x, g, pan);
  o.verb.add(t, x, g * 0.4, pan);
};
/** Sneaker step on pavers. */
export const sneakerStep = (o: Out, t: number, g: number, pan = 0, seed = 1) => {
  const r = rng(Math.round(t * 1000) + seed);
  const x = envExp(biquad(noise(S(0.12), Math.round(t * 1000) + seed), "bp", 1100 + 500 * r(), 1.2), 0.018, 0.001);
  mixInto(x, envExp(sine(0.12, 85 + 20 * r()), 0.03, 0.002), 0.5);
  mixInto(x, envExp(biquad(noise(S(0.12), seed + 7), "hp", 5000), 0.006, 0.003), 0.15);
  o.dry.add(t, x, g, pan);
};
