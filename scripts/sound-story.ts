// Automatic sound department for any story: compiles the story exactly like the film, then places
// ambience (per environment and time of day), footsteps (from the walkers / turns), SFX per acting
// verb, music sections per mood, and mixes it all under the voice-over (ducked; music never covers it).
//   node scripts/sound-story.ts stories/<id>/story.json   → public/audio/<id>-mix.wav

import fs from "node:fs";
import path from "node:path";
import { compile } from "../src/kits/characterflow/director/compile.ts";
import type { Story } from "../src/kits/characterflow/director/story.ts";
import {
  Bus, S, SR, bell, biquad, boing, breath, cheer, clap, click, dbg, decode, duckEnvelope, envExp, ep, freeverb, heartbeat, kalimba, pad, pink, pluck, pop,
  rng, rustle, shimmer, sine, smooth, sneakerStep, squeak, subPulse, thud, ticktock, whistle, whoosh, writeWav, zipper, type Out,
} from "./synth.ts";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/sound-story.ts stories/<id>/story.json"); process.exit(1); }
const story = JSON.parse(fs.readFileSync(file, "utf8")) as Story;
const P = compile(story);
const DUR = P.duration;
const N = Math.round(DUR * SR);
const amb = new Bus(N), music = new Bus(N), sfx = new Bus(N), verb = new Bus(N);
const M: Out = { dry: music, verb }, F: Out = { dry: sfx, verb };
const quiet = (t: number) => P.music.some((m) => m.mood === "awkward" && t >= m.t0 && t < m.t1);

// ── ambience (per place: a story with scenes changes the room tone at each cut) ──
const places = P.scenes ? P.scenes.map((x) => ({ t0: x.t0, t1: x.t1, env: x.P.env, time: x.P.time })) : [{ t0: 0, t1: DUR, env: P.env, time: P.time }];
const placeAt = (t: number) => places.find((x) => t >= x.t0 && t < x.t1) ?? places[places.length - 1];
/** a short fade at each cut so the room tones swap without a click */
const win = (t: number, a: number, b: number) => smooth(a - 0.06, a + 0.06, t) * (1 - smooth(b - 0.06, b + 0.06, t));
const chirps = (seed: number, t0: number, t1: number, gap: [number, number], f0: number, g: number, pan: number) => {
  const r = rng(seed);
  for (let t = t0 + 0.5 + r() * 2; t < t1 - 0.2; t += gap[0] + r() * gap[1]) { const f = f0 + r() * 1200, d = 0.08, x = sine(d, (u) => f * (1 + 0.3 * Math.sin((u / d) * Math.PI))); for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length); amb.add(t, biquad(x, "lp", 3000), g, pan); }
};
for (const pl of places) {
  const shape = (x: Float32Array, k: (t: number) => number) => { for (let i = 0; i < N; i++) { const t = i / SR; x[i] *= win(t, pl.t0, pl.t1) * k(t); } return x; };
  if (pl.env.ambience === "campus") {
    const air = biquad(pink(N, 4), "lp", 900), babble = biquad(biquad(pink(N, 12), "bp", 700, 0.6), "lp", 2200);
    shape(air, () => 0.55);
    shape(babble, (t) => (0.16 + 0.08 * Math.sin(t * 0.37)) * (quiet(t) ? 0.2 : 1));
    amb.add(0, air, 0.5, -0.1);
    amb.add(0, babble, 0.5, 0.15);
    for (let b = 0; b < 4; b++) {
      const r = rng(500 + b);
      for (let t = pl.t0 + r() * 2; t < pl.t1; t += 1.2 + r() * 3.2) {
        if (quiet(t) && r() > 0.2) continue;
        const f = 2800 + b * 700 + r() * 600, pan = r() * 1.6 - 0.8;
        for (let c = 0, n = 1 + Math.floor(r() * 3); c < n; c++) {
          const d = 0.06 + r() * 0.08, x = sine(d, (u) => f * (1 + 0.35 * Math.sin((u / d) * Math.PI)));
          for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length);
          amb.add(t + c * (d + 0.04), x, 0.018, pan);
        }
      }
    }
    continue;
  }
  // indoors: room tone, plus what each kind of room sounds like
  const room = shape(biquad(pink(N, 6), "lp", 180), () => 1);
  amb.add(0, room, 0.34, 0);
  if (pl.env.ambience === "cafe" || pl.env.ambience === "class") {
    const babble = shape(biquad(biquad(pink(N, 14), "bp", 650, 0.7), "lp", 2000), (t) => (pl.env.ambience === "cafe" ? 0.13 : 0.06) * (0.8 + 0.2 * Math.sin(t * 0.43)) * (quiet(t) ? 0.25 : 1));
    amb.add(0, babble, 0.5, 0.1);
  }
  if (pl.env.ambience === "cafe") {
    const r = rng(41);
    for (let t = pl.t0 + 0.8 + r() * 2; t < pl.t1 - 0.3; t += 1.6 + r() * 3.5) bell(F, t, r() < 0.5 ? "E7" : "C7", 0.012 + r() * 0.01, 0.4, r() * 1.4 - 0.7);
    for (let t = pl.t0 + 3 + r() * 4; t < pl.t1 - 2; t += 9 + r() * 7) whoosh(F, t, 1.6, 0.012, 2500, 3200, 0.5, 0.5);
  } else if (pl.env.ambience === "office") {
    const hum = shape(biquad(pink(N, 8), "bp", 120, 0.5), () => 0.5);
    amb.add(0, hum, 0.3, 0);
    const r = rng(43);
    for (let t = pl.t0 + 1 + r() * 2; t < pl.t1 - 1; t += 3 + r() * 4) for (let k = 0, n = 4 + Math.floor(r() * 8); k < n; k++) click(F, t + k * (0.09 + r() * 0.07), 3200 + r() * 800, 0.012, 0.6, 0.004);
  }
  if (pl.time === "night" && pl.env.id === "bedroom") {
    const r = rng(100);
    for (let c = 0; c < 4; c++) { const f = 4200 + r() * 800, pan = 0.2 + r() * 0.6; for (let t = pl.t0 + r(); t < pl.t1; t += 0.6 + r() * 0.5) for (let p = 0; p < 3; p++) { const x = sine(0.03, f); for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length); amb.add(t + p * 0.044, biquad(x, "lp", 2600), 0.014, pan); } }
  } else if (pl.time !== "night" && (pl.env.ambience === "room" || pl.env.ambience === "class")) chirps(7, pl.t0, pl.t1, [2.5, 4], 3200, 0.012, 0.6);
}
{
  // crickets when the story says "awkward silence"
  for (const m of P.music) if (m.mood === "awkward") {
    const r = rng(77);
    for (let c = 0; c < 3; c++) for (let t = m.t0 + 0.2 + c * 0.11; t < m.t1 - 0.2; t += 0.55 + r() * 0.15) for (let p = 0; p < 3; p++) { const x = sine(0.03, 4300 + c * 400); for (let i = 0; i < x.length; i++) x[i] *= Math.sin((Math.PI * i) / x.length); amb.add(t + p * 0.045, x, 0.05, c - 1); }
  }
}

// ── SFX per cue ─────────────────────────────────────────────────────────────
let k = 0;
for (const c of P.sound) {
  const pan = c.pan ?? 0, t = c.t;
  switch (c.kind) {
    case "step": sneakerStep(F, t, placeAt(t).env.indoor ? (placeAt(t).env.home ? 0.05 : 0.065) : 0.085, pan, k++); break;
    case "ding": bell(F, t, k++ % 2 ? "G6" : "E6", 0.3, 1.4, pan); break;
    case "boing": boing(F, t, 0.1, 160, 480, 0.6, pan); break;
    case "whoosh": whoosh(F, t, 0.32, 0.045, 700, 2600, pan - 0.2, pan + 0.2); break;
    case "pocket": whoosh(F, t, 0.25, 0.03, 1800, 600, pan, pan); break;
    case "zip": zipper(F, t, 0.35, 0.05, pan); for (let tt = t + 0.4; tt < t + 3; tt += 0.55) rustle(F, tt, 0.35, 0.022, pan, 2600); break;
    case "pop": pop(F, t, 0.05, 660, pan); break;
    case "popHi": pop(F, t, 0.055, 1047, pan); break;
    case "popThought": pop(F, t, 0.06, 784 + 100 * (k++ % 3), pan); break;
    case "squeak": squeak(F, t, 0.04, pan); break;
    case "slap": thud(F, t, 0.06, 160, 0.04, pan); break;
    case "clap": clap(F, t, 0.26, 0); break;
    case "sparkle": shimmer(F, t, 1.0, 0.6, 3000, k++); break;
    case "click": click(F, t, 2600, 0.14, -0.4, 0.01); thud(F, t + 0.005, 0.05, 140, 0.05, -0.4); break;
    case "rustle": rustle(F, t, 1.0, 0.06, pan, 1900); break;
    case "breath": breath(F, t, 1.1, 1.5, 0.045); break;
    case "heartbeat": for (let tt = t, iv = 0.9; tt < t + 4; tt += iv, iv = Math.max(0.55, iv * 0.93)) heartbeat(F, tt, 0.18); break;
    case "tick": ticktock(F, t, t + 1.4, 0.045); break;
    case "board": boing(F, t, 0.12, 140, 480, 0.7, -0.2); whistle(F, t + 0.35, 0.55, 0.05, 0.1); cheer(F, t + 0.45, 1.6, 0.06); break;
    case "tumbleweed": whoosh(F, t - 0.3, 3.2, 0.05, 260, 700, 0.7, -0.7); break;
  }
}

// ── music per mood section ──────────────────────────────────────────────────
const beat = 60 / 108;
const pizz = (t: number, n: string, g: number, pan = 0) => pluck(M, t, n, g, pan, 0.985, 0.35);
for (const m of P.music) {
  const t0 = m.t0 + 0.05, t1 = m.t1;
  if (t1 - t0 < 0.8) continue;
  if (m.mood === "playful") {
    const prog = [["F2", "A3", "C4", "F4"], ["E2", "G3", "C4", "E4"], ["D2", "F3", "A3", "D4"], ["Bb1", "F3", "Bb3", "D4"]];
    const tune = ["C5", "A4", "F4", "A4", "G4", "E4", "C4", "E4"];
    for (let i = 0, t = t0; t < t1 - 0.1; i++, t = t0 + i * beat) {
      const ch = prog[Math.floor(i / 4) % 4];
      pizz(t, ch[0], 0.065, -0.1);
      if (i % 2) ch.slice(1).forEach((n, j) => pizz(t + j * 0.012, n, 0.022, j - 1));
      if (i % 4 === 0) kalimba(M, t + beat * 0.5, tune[(i / 4) % tune.length], 0.18, 0.2);
    }
  } else if (m.mood === "warm") {
    const prog = [["C3", "G3", "C4", "E4"], ["A2", "E3", "C4", "E4"], ["F2", "C3", "A3", "E4"], ["G2", "D3", "B3", "D4"]];
    for (let i = 0, t = t0; t < t1 - 0.3; i++, t = t0 + i * 1.6) { ep(M, t, prog[i % 4], 0.42, 2.2); if (i % 2 === 0) kalimba(M, t + 0.8, ["E5", "G5", "C6", "A5"][i % 4], 0.22, 0.2); }
    pad(M, t0, t1 + 0.6, ["C3", "G3", "E4"], 0.14, 1000, 0.6, 1.0);
  } else if (m.mood === "calm") {
    pad(M, t0, t1 + 0.8, ["F2", "C3", "A3", "E4"], 0.2, 800, 1.2, 1.4);
    for (let t = t0 + 0.8; t < t1 - 0.5; t += 3.2) bell(M, t, ["A5", "E5", "C6"][Math.floor(t) % 3], 0.08, 2.5, 0.2);
  } else if (m.mood === "sad") {
    pad(M, t0, t1 + 0.8, ["D2", "A2", "F3", "C4"], 0.2, 650, 0.8, 1.2);
    for (let t = t0 + 0.4, j = 0; t < t1 - 0.5; t += 1.4, j++) ep(M, t, [["D4"], ["C4"], ["A3"], ["Bb3"]][j % 4], 0.35, 1.6);
  } else if (m.mood === "tense") {
    pad(M, t0, t1, ["A1", "E2", "Bb2"], 0.22, 420, 0.6, 0.3);
    for (let t = t0; t < t1 - 0.2; t += beat / 2) pizz(t, ["A3", "E4", "C4", "E4"][Math.round((t - t0) / (beat / 2)) % 4], 0.035, 0.3);
    subPulse(M, t0, 0.18);
  }
  // "awkward": no music — only the crickets
}
void envExp; void S;

// ── mix ─────────────────────────────────────────────────────────────────────
const vL = freeverb(verb.L, 0, 0.78, 0.35), vR = freeverb(verb.R, 23, 0.78, 0.35);
for (const b of [music, amb, sfx]) { biquad(b.L, "hp", 38); biquad(b.R, "hp", 38); }
const voFile = path.join("public", story.vo.file);
const voSrc = decode(voFile);
const off = P.cues.offset;
const vo = new Float32Array(N);
vo.set(voSrc.subarray(0, Math.max(0, N - Math.round(off * SR))), Math.round(off * SR));
const duck = duckEnvelope(vo);
const MUSIC_DUCK = dbg(-10), AMB_DUCK = dbg(-5), SFX_DUCK = dbg(-3);
const gMusic = dbg(-2), gAmb = dbg(-1), gSfx = dbg(0), gVerb = dbg(-8);
const L = new Float32Array(N), R = new Float32Array(N);
let eV = 0, eB = 0, nS = 0;
for (let i = 0; i < N; i++) {
  const d = duck[i];
  const km = gMusic * (1 + (MUSIC_DUCK - 1) * d), ka = gAmb * (1 + (AMB_DUCK - 1) * d), ks = gSfx * (1 + (SFX_DUCK - 1) * d), kv = gVerb * (1 + (MUSIC_DUCK - 1) * d * 0.6);
  const bl = music.L[i] * km + amb.L[i] * ka + sfx.L[i] * ks + vL[i] * kv, br = music.R[i] * km + amb.R[i] * ka + sfx.R[i] * ks + vR[i] * kv;
  const f = smooth(0, 0.25, i / SR) * (1 - smooth(DUR - 0.9, DUR - 0.02, i / SR));
  L[i] = (bl + vo[i]) * f;
  R[i] = (br + vo[i]) * f;
  if (d > 0.9 && i % 64 === 0) { eV += vo[i] ** 2; eB += (bl * bl + br * br) / 2; nS++; }
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > dbg(-1) ? dbg(-1) / peak : 1;
const out = path.join("public", "audio", `${story.id}-mix.wav`);
fs.mkdirSync(path.dirname(out), { recursive: true });
writeWav(out, L, R, norm);
console.log(`mix: ${out} (${DUR}s; VO ${(voSrc.length / SR).toFixed(2)} s at ${off}s → ends ${(off + voSrc.length / SR).toFixed(2)} s)`);
console.log(`bed under speech: ${nS ? (10 * Math.log10(eB / nS) - 10 * Math.log10(eV / nS)).toFixed(1) : "n/a"} dB relative to the voice; ${P.sound.length} cues; music: ${P.music.map((m) => `${m.mood}@${m.t0.toFixed(1)}`).join(", ")}`);
