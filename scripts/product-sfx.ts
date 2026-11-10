// Project helper (not part of the kit): the product inserts' foley (cable slides, plug clicks, the clip's tap and
// snap, chair, ✓ / ✗ stingers) laid into the kit's story mix, with the voice-over kept clearly on top.
//   node scripts/product-sfx.ts src/stories/data/<id>.json   (after sound-story.ts) → public/audio/<id>-final-mix.wav
//
// The kit's mix is vo·k + bed·k. k is recovered by least squares against the VO (the bed does not correlate with
// it), so the bed can be measured — and lowered if needed — on its own. Targets while the VO speaks: bed (music,
// room, character SFX) ≥ 18 dB under the voice, product SFX ≥ 15 dB under it.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compile } from "../src/kits/characterflow/director/compile.ts";
import type { Story } from "../src/kits/characterflow/director/story.ts";
import { INSERTS } from "../src/affiliate/shots.ts";
import { Bus, SR, bell, biquad, boing, click, dbg, decode, duckEnvelope, freeverb, noise, pluck, pop, rustle, shimmer, thud, whoosh, writeWav, zipper, type Out } from "./synth.ts";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/product-sfx.ts src/stories/data/<id>.json"); process.exit(1); }
const story = JSON.parse(fs.readFileSync(file, "utf8")) as Story;
const P = compile(story);
const mixFile = path.join("public", "audio", `${story.id}-mix.wav`);
const raw = spawnSync("ffmpeg", ["-v", "error", "-i", mixFile, "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 }).stdout as Buffer;
const inter = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
const N = Math.floor(inter.length / 2);
const mL = new Float32Array(N), mR = new Float32Array(N);
for (let i = 0; i < N; i++) { mL[i] = inter[2 * i]; mR[i] = inter[2 * i + 1]; }

// the voice exactly as the kit placed it
const voSrc = decode(path.join("public", story.vo.file));
const off = Math.round(P.cues.offset * SR);
const vo = new Float32Array(N);
vo.set(voSrc.subarray(0, Math.max(0, N - off)), off);
let num = 0, den = 0;
for (let i = 0; i < N; i++) { num += (mL[i] + mR[i]) * 0.5 * vo[i]; den += vo[i] * vo[i]; }
const k = num / den;
const bL = new Float32Array(N), bR = new Float32Array(N);
for (let i = 0; i < N; i++) { bL[i] = mL[i] / k - vo[i]; bR[i] = mR[i] / k - vo[i]; }
const duck = duckEnvelope(vo);

// ── product foley ────────────────────────────────────────────────────────────────────────────────────────
const sfx = new Bus(N), verb = new Bus(N);
const F: Out = { dry: sfx, verb };
const ding = (t: number, g = 1) => { pop(F, t, 0.5 * g, 1320, 0.1); bell(F, t + 0.02, "E6", 0.16 * g, 1.2, 0.1); };
const nope = (t: number, g = 1) => { pop(F, t, 0.45 * g, 330, -0.1); pop(F, t + 0.11, 0.45 * g, 247, -0.1); };
const chip = (t: number) => pop(F, t, 0.32, 660, 0);
const plugClick = (t: number, g = 1) => { click(F, t, 2600, 0.55 * g, 0.15, 0.01); click(F, t + 0.012, 1500, 0.3 * g, 0.15, 0.02); };
const tap = (t: number, g = 1) => { thud(F, t, 0.55 * g, 120, 0.07, 0); click(F, t, 900, 0.3 * g, 0, 0.02); };
const snap = (t: number, g = 1) => { click(F, t, 2300, 0.6 * g, 0.1, 0.008); thud(F, t, 0.25 * g, 160, 0.05, 0.1); };
const wheels = (t: number, dur: number, g: number) => {
  const n = Math.round(dur * SR), x = biquad(biquad(noise(n, 77), "lp", 380), "hp", 60);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.sin(Math.PI * Math.min(1, u * 1.3)) * (0.7 + 0.3 * Math.sin(i / SR * 70)); }
  sfx.add(t, x, g, -0.2);
};
const rattle = (t0: number, t1: number, g: number) => { for (let t = t0; t < t1; t += 0.055) click(F, t, 3200, g * (0.6 + 0.4 * Math.sin(t * 40)), 0.1, 0.004); };

const at = (id: string) => INSERTS.find((x) => x.id === id)!;
// a soft whoosh on every cut into an insert
for (const ins of INSERTS) if (!INSERTS.some((o) => Math.abs(o.t1 - ins.t0) < 0.02)) whoosh(F, ins.t0 - 0.14, 0.34, 0.16, 700, 2600, -0.3, 0.3);
// under the desk
thud(F, at("under").t0 + 0.05, 0.18, 90, 0.08);
// the plug slides off
whoosh(F, 13.5, 0.45, 0.22, 420, 1800, 0.2, -0.3);
plugClick(13.62, 0.8);
click(F, 13.78, 1700, 0.3, 0.1, 0.015);
rustle(F, 14.25, 0.72, 0.22, 0.2, 1900);
whoosh(F, 14.95, 0.5, 0.22, 1500, 380, 0.2, 0.4);
thud(F, 15.45, 0.4, 75, 0.12, 0.3);
click(F, 15.46, 1200, 0.28, 0.3, 0.02);
// reveal
shimmer(F, 18.14, 1.1, 0.9, 2600, 4);
whoosh(F, 19.3, 0.6, 0.18, 1600, 500, 0, 0);
tap(19.95);
rustle(F, 20.95, 0.9, 0.16, 0.15, 2300);
snap(22.2);
// outer edge
chip(26.1); ding(27.25);
wheels(29.4, 0.85, 0.55);
thud(F, 30.18, 0.5, 70, 0.14, -0.1);
click(F, 30.2, 1100, 0.3, -0.1, 0.02);
nope(30.25);
// near the socket
chip(33.45); ding(33.9);
rustle(F, 34.9, 1.35, 0.2, 0.1, 1400);
pluck(F, 36.25, "A2", 0.32, 0.1);
thud(F, 36.25, 0.22, 90, 0.06);
nope(36.35);
thud(F, 36.75, 0.15, 90, 0.05);
// the chosen spot
chip(41.5); ding(41.6);
rustle(F, 42.0, 1.2, 0.12, 0.1, 1700);
ding(42.5, 0.8);
// thick cable
chip(46.2);
whoosh(F, 46.3, 0.45, 0.14, 1200, 500, 0, 0);
boing(F, 46.8, 0.28, 260, 480, 0.45, 0.1);
nope(46.85);
whoosh(F, 47.3, 0.55, 0.12, 900, 1500, -0.2, 0.2);
snap(48.28); ding(48.3);
// thin cable
chip(50.2);
rattle(50.18, 50.6, 0.18);
rustle(F, 50.7, 1.25, 0.2, 0.1, 2700);
click(F, 51.95, 1500, 0.55, 0.1, 0.015);
thud(F, 51.95, 0.25, 140, 0.05);
ding(52.05);
// stick + unplug / replug
chip(53.3);
rustle(F, 53.42, 0.63, 0.16, 0.2, 4200);
zipper(F, 53.45, 0.55, 0.05, 0.2);
whoosh(F, 54.3, 0.38, 0.14, 1400, 600, 0, 0);
tap(54.68); tap(54.88, 0.7);
chip(55.1);
whoosh(F, 55.3, 0.45, 0.2, 500, 1900, 0.1, -0.3);
plugClick(55.42);
ding(55.78);
whoosh(F, 56.0, 0.45, 0.18, 1900, 600, -0.3, 0.1);
plugClick(56.45, 1.1);
shimmer(F, 56.55, 0.9, 0.8, 2800, 9);
ding(56.6, 0.9);
// morning
rustle(F, 63.55, 0.7, 0.14, 0.1, 2400);
shimmer(F, 63.6, 1.1, 0.7, 3000, 11);
// hero + call to action
shimmer(F, 67.22, 1.4, 0.8, 2400, 13);
chip(67.3);
for (let i = 0; i < 5; i++) pop(F, 67.7 + i * 0.08, 0.2, 700 + i * 140, -0.4 + i * 0.2);
pop(F, 68.15, 0.45, 990, 0); bell(F, 68.17, "B5", 0.14, 1.4, 0);

const vL = freeverb(verb.L, 0, 0.7, 0.4), vR = freeverb(verb.R, 23, 0.7, 0.4);
for (let i = 0; i < N; i++) { sfx.L[i] += vL[i] * dbg(-10); sfx.R[i] += vR[i] * dbg(-10); }

// ── levels ───────────────────────────────────────────────────────────────────────────────────────────────
const W = Math.round(0.05 * SR);
const rmsWin = (L: Float32Array, R: Float32Array | null, i0: number) => { let e = 0; for (let j = i0; j < Math.min(N, i0 + W); j++) e += R ? (L[j] * L[j] + R[j] * R[j]) / 2 : L[j] * L[j]; return Math.sqrt(e / W); };
const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
const speechWins: number[] = [], voR: number[] = [], bedR: number[] = [];
for (let i = 0; i + W < N; i += W) if (duck[i] > 0.9) { speechWins.push(i); voR.push(rmsWin(vo, null, i)); bedR.push(rmsWin(bL, bR, i)); }
const voLevel = Math.sqrt(voR.reduce((s, x) => s + x * x, 0) / voR.length);
const bedLevel = Math.sqrt(bedR.reduce((s, x) => s + x * x, 0) / bedR.length);
const bedMargin = db(voLevel) - db(bedLevel);
const gBed = bedMargin < 18 ? dbg(bedMargin - 18) : 1;
// product SFX: loud windows (p90 of the active ones) 14 dB under the voice, a further 3 dB down under speech
const sfxR: number[] = [];
for (let i = 0; i + W < N; i += W) { const r = rmsWin(sfx.L, sfx.R, i); if (r > 1e-5) sfxR.push(r); }
const gS = (voLevel * dbg(-15)) / Math.max(1e-6, pct(sfxR, 0.9));
const SFX_DUCK = dbg(-3);

const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ks = gS * (1 + (SFX_DUCK - 1) * duck[i]);
  L[i] = vo[i] + bL[i] * gBed + sfx.L[i] * ks;
  R[i] = vo[i] + bR[i] * gBed + sfx.R[i] * ks;
}
// what the listener gets while the voice speaks: voice vs everything else
const margins = speechWins.map((i) => { let ev = 0, eo = 0; for (let j = i; j < i + W; j++) { const o = (L[j] + R[j]) / 2 - vo[j]; ev += vo[j] * vo[j]; eo += o * o; } return db(Math.sqrt(ev / W)) - db(Math.sqrt(eo / W)); });
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = dbg(-1) / peak;
const out = path.join("public", "audio", `${story.id}-final-mix.wav`);
writeWav(out, L, R, norm);
console.log(`product mix: ${out} (${(N / SR).toFixed(2)} s; kit mix gain k=${k.toFixed(3)})`);
console.log(`  bed (music + room + character SFX) under speech: ${bedMargin.toFixed(1)} dB below the voice${gBed < 1 ? ` → lowered ${db(gBed).toFixed(1)} dB to 18 dB` : ""}`);
console.log(`  product SFX: loud windows 15 dB below the voice (−3 dB more under speech), gain ${db(gS).toFixed(1)} dB`);
console.log(`  voice over everything else while speaking: median ${pct(margins, 0.5).toFixed(1)} dB, 10th percentile ${pct(margins, 0.1).toFixed(1)} dB`);
