// Performance engine: turns a list of acting beats into a Pose at any time t (pure, no state).
//
// A beat sets any of five independent channels — body, left arm, right arm, face, look — and blends
// into it over `dur` seconds with an acting curve. Channels evaluate live (a moving IK target or a
// run cycle keeps moving during a blend). On top sit the procedural layers that keep a character
// alive between beats: breathing, blinks, eye saccades, idle sway and tremble.
//
// Beats know nothing about a topic: scenes give them times (usually voice-over cues) and presets.

import { bezier, clamp, remap } from "../../../core/motion/easing.ts";
import { hash1, noise1 } from "../lib/rng.ts";
import { BODY, type Anchor, type BodyName } from "./presets/bodies.ts";
import { EXPR, type ExprName } from "./presets/expressions.ts";
import { GESTURE, type Gesture, type GestureName } from "./presets/gestures.ts";
import { blend, clonePose, lerpArm, lerpFace, lerpHand, lerpN, type Face, type Pose } from "./pose.ts";
import { lookAngles, resolveIK } from "./skeleton.ts";
import type { CharacterSpec, V3 } from "./spec.ts";

export const CURVES = {
  /** default acting move: quick start, long settle */
  act: bezier(0.3, 0, 0.15, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
  soft: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
  /** fast with a small overshoot (startle, snap) */
  snap: bezier(0.2, 0.9, 0.3, 1.18),
  /** anticipation: dips back before going (big body moves) */
  antic: bezier(0.55, -0.22, 0.25, 1.06),
  linear: (t: number) => clamp(t),
};
export type CurveName = keyof typeof CURVES;

type Val<T> = T | ((t: number) => T);
export type BodySel = BodyName | ((t: number) => Pose);
export type GestureSel = GestureName | Gesture | ((t: number) => Gesture);
export type FaceSel = ExprName | Face | { base: ExprName; mix?: ExprName; k?: number; add?: Partial<Face> };
export type LookSel = V3 | ((t: number) => V3) | null;

export type Beat = {
  at: number;
  dur?: number;
  curve?: CurveName;
  body?: BodySel;
  /** tweak the body pose after the preset (live) */
  bodyMod?: (p: Pose, t: number) => void;
  /** null hands the arm back to the body (e.g. the walk's arm swing) */
  armL?: GestureSel | null;
  armR?: GestureSel | null;
  arms?: GestureSel | null;
  face?: FaceSel;
  look?: LookSel;
  /** how far the head follows the look target (0…1; eyes always follow) */
  headFollow?: number;
  breath?: { amp?: number; rate?: number };
  tremble?: number;
  /** eye darting 0…1 */
  nervous?: number;
  blink?: boolean;
  /** deep breath (inhale ≈ 1.1 s, exhale ≈ 1.5 s) starting at `at` */
  sigh?: boolean;
  label?: string;
};

export type Performance = { spec: CharacterSpec; anchor: Val<Anchor>; beats: Beat[] };

// ── generic channel evaluation ───────────────────────────────────────────────
type Ch<T> = { at: number; dur: number; curve: CurveName; v: (t: number) => T };
const channel = <T>(list: Ch<T>[], t: number, mix: (a: T, b: T, k: number) => T, i = -1): T => {
  if (i < 0) {
    i = 0;
    while (i < list.length - 1 && list[i + 1].at <= t) i++;
  }
  const c = list[i];
  const cur = c.v(t);
  if (i === 0) return cur;
  const k = CURVES[c.curve](remap(t, c.at, c.at + Math.max(1e-3, c.dur)));
  if (k >= 1 && t >= c.at + c.dur) return cur;
  return mix(channel(list, t, mix, i - 1), cur, k);
};

const val = <T>(v: Val<T>, t: number): T => (typeof v === "function" ? (v as (t: number) => T)(t) : v);

// ── performance → compiled channels ─────────────────────────────────────────
type Compiled = {
  body: Ch<Pose>[]; armL: Ch<Gesture | null>[]; armR: Ch<Gesture | null>[]; face: Ch<Face>[];
  lookH: Ch<{ p: V3; w: number }>[]; lookE: Ch<{ p: V3; w: number }>[]; follow: Ch<number>[];
  scal: Ch<{ amp: number; rate: number; tremble: number; nervous: number }>[];
  blinks: number[]; sighs: number[];
};

const faceOf = (s: FaceSel): Face => {
  if (typeof s === "string") return EXPR[s];
  if ("base" in s) {
    let f = EXPR[s.base];
    if (s.mix) f = lerpFace(f, EXPR[s.mix], s.k ?? 0.5);
    return { ...f, ...(s.add ?? {}) };
  }
  return s;
};
const gestureOf = (s: GestureSel, t: number): Gesture => (typeof s === "string" ? GESTURE[s] : typeof s === "function" ? s(t) : s);

const cache = new WeakMap<Performance, Compiled>();
const compile = (perf: Performance): Compiled => {
  let c = cache.get(perf);
  if (c) return c;
  const beats = [...perf.beats].sort((a, b) => a.at - b.at);
  const spec = perf.spec;
  const anchor = (t: number) => val(perf.anchor, t);
  c = { body: [], armL: [], armR: [], face: [], lookH: [], lookE: [], follow: [], scal: [], blinks: [], sighs: [] };
  let sc = { amp: 1, rate: 0.24, tremble: 0, nervous: 0 };
  for (const b of beats) {
    const dur = b.dur ?? 0.45, curve = b.curve ?? "act";
    if (b.body) {
      const sel = b.body, mod = b.bodyMod;
      c.body.push({ at: b.at, dur, curve, v: (t) => {
        const p = typeof sel === "string" ? clonePose(BODY[sel](anchor(t), spec, t)) : sel(t);
        if (mod) mod(p, t);
        return p;
      } });
    }
    // `null` is a real value (give the arm back to the body), so only `undefined` falls back to `arms`
    const armL = b.armL !== undefined ? b.armL : b.arms, armR = b.armR !== undefined ? b.armR : b.arms;
    if (armL !== undefined) c.armL.push({ at: b.at, dur, curve, v: (t) => (armL === null ? null : gestureOf(armL, t)) });
    if (armR !== undefined) c.armR.push({ at: b.at, dur, curve, v: (t) => (armR === null ? null : gestureOf(armR, t)) });
    if (b.face) {
      const f = faceOf(b.face);
      c.face.push({ at: b.at, dur: b.dur ?? 0.3, curve, v: () => f });
    }
    if (b.look !== undefined) {
      const L = b.look;
      const v = (t: number) => (L === null ? { p: [0, 0, 0] as V3, w: 0 } : { p: val(L, t), w: 1 });
      c.lookH.push({ at: b.at, dur: dur * 1.15, curve: "inOut", v });
      c.lookE.push({ at: b.at, dur: Math.min(0.14, dur), curve: "act", v });
    }
    if (b.headFollow !== undefined) c.follow.push({ at: b.at, dur, curve: "inOut", v: () => b.headFollow! });
    if (b.breath || b.tremble !== undefined || b.nervous !== undefined) {
      sc = { amp: b.breath?.amp ?? sc.amp, rate: b.breath?.rate ?? sc.rate, tremble: b.tremble ?? sc.tremble, nervous: b.nervous ?? sc.nervous };
      const s = sc;
      c.scal.push({ at: b.at, dur: Math.max(0.6, dur), curve: "soft", v: () => s });
    }
    if (b.blink) c.blinks.push(b.at);
    if (b.sigh) c.sighs.push(b.at);
  }
  if (!c.body.length) c.body.push({ at: 0, dur: 0, curve: "act", v: (t) => BODY.stand(anchor(t), spec, t) });
  if (!c.face.length) c.face.push({ at: 0, dur: 0, curve: "act", v: () => EXPR.neutral });
  if (!c.armL.length) c.armL.push({ at: 0, dur: 0, curve: "act", v: () => null });
  if (!c.armR.length) c.armR.push({ at: 0, dur: 0, curve: "act", v: () => null });
  if (!c.lookH.length) { c.lookH.push({ at: 0, dur: 0, curve: "act", v: () => ({ p: [0, 0, 0], w: 0 }) }); c.lookE.push(c.lookH[0]); }
  if (!c.follow.length) c.follow.push({ at: 0, dur: 0, curve: "act", v: () => 0.85 });
  if (!c.scal.length) c.scal.push({ at: 0, dur: 0, curve: "act", v: () => sc });
  cache.set(perf, c);
  return c;
};

// ── procedural life layers ──────────────────────────────────────────────────
const blinkShape = (dt: number) => (dt < 0 ? 0 : dt < 0.065 ? dt / 0.065 : dt < 0.095 ? 1 : dt < 0.22 ? 1 - (dt - 0.095) / 0.125 : 0);
/** Natural blinks every 2–5 s (deterministic), plus forced ones. */
export const blinkAt = (t: number, forced: number[], seed = 1) => {
  let b = 0;
  for (const f of forced) b = Math.max(b, blinkShape(t - f));
  let tb = 0.7 + hash1(0, seed) * 1.5;
  for (let i = 1; tb <= t + 0.3 && i < 400; i++) {
    b = Math.max(b, blinkShape(t - tb));
    tb += 2.1 + 2.9 * hash1(i, seed);
    if (hash1(i, seed + 7) < 0.15) tb -= 1.7; // occasional double blink
  }
  return b;
};

/** Fixation jumps: piecewise-constant gaze offsets with 50 ms transitions. */
const saccade = (t: number, nervous: number, seed: number): [number, number] => {
  const rate = 0.9 - 0.6 * nervous;
  const i = Math.floor(t / rate), f = t / rate - i;
  const pick = (k: number): [number, number] => [(hash1(k, seed) - 0.5) * 2, (hash1(k, seed + 3) - 0.5) * 2];
  const a = pick(i - 1), b = pick(i);
  const k = clamp(f * rate / 0.05);
  const amp = 0.025 + 0.13 * nervous;
  return [lerpN(a[0], b[0], k) * amp, lerpN(a[1], b[1], k) * amp * 0.6];
};

/** Deep breath envelope at time since start (0…1 inhale, back to 0 on exhale). */
const sighShape = (dt: number) => (dt < 0 ? 0 : dt < 1.1 ? Math.sin((dt / 1.1) * Math.PI / 2) : dt < 2.6 ? Math.cos(((dt - 1.1) / 1.5) * Math.PI / 2) : 0);

const mixGesture = (a: Gesture | null, b: Gesture | null, k: number, base: Gesture): Gesture => {
  const A = a ?? base, B = b ?? base;
  return { arm: lerpArm(A.arm, B.arm, k), hand: lerpHand(A.hand, B.hand, k) };
};

export type Evaluated = { pose: Pose; look: V3 | null };

/** The pose of a performance at time t (seconds). */
export const perform = (perf: Performance, t: number, seed = 1): Evaluated => {
  const c = compile(perf);
  const spec = perf.spec;
  const body = channel(c.body, t, blend);
  const p = clonePose(body);

  // arms: resolve IK targets for this body, then blend like-for-like (chest space)
  const resolveG = (g: Gesture | null, side: 1 | -1): Gesture | null => {
    if (!g) return null;
    if (!g.arm.ik) return g;
    return { arm: { ...g.arm, ik: resolveIK(g.arm.ik, body, spec, side) }, hand: g.hand };
  };
  const baseL: Gesture = { arm: body.armL, hand: body.handL }, baseR: Gesture = { arm: body.armR, hand: body.handR };
  const gl = channel(c.armL.map((x) => ({ ...x, v: (tt: number) => resolveG(x.v(tt), 1) })), t, (a, b, k) => mixGesture(a, b, k, baseL));
  const gr = channel(c.armR.map((x) => ({ ...x, v: (tt: number) => resolveG(x.v(tt), -1) })), t, (a, b, k) => mixGesture(a, b, k, baseR));
  if (gl) { p.armL = gl.arm; p.handL = gl.hand; }
  if (gr) { p.armR = gr.arm; p.handR = gr.hand; }

  p.face = { ...channel(c.face, t, lerpFace) };
  const sc = channel(c.scal, t, (a, b, k) => ({ amp: lerpN(a.amp, b.amp, k), rate: lerpN(a.rate, b.rate, k), tremble: lerpN(a.tremble, b.tremble, k), nervous: lerpN(a.nervous, b.nervous, k) }));
  p.breath = sc.amp * body.breath;
  p.breathRate = sc.rate;
  p.tremble = sc.tremble;

  // deep breaths: shoulders rise, chest opens, head lifts
  let sg = 0;
  for (const s0 of c.sighs) sg = Math.max(sg, sighShape(t - s0));
  if (sg > 0) {
    p.shrug += 0.55 * sg;
    p.chest = [p.chest[0] - 0.07 * sg, p.chest[1], p.chest[2]];
    p.head = [p.head[0] - 0.08 * sg, p.head[1], p.head[2]];
  }
  // breathing shoulders + idle sway (more when nervous)
  const bs = Math.sin(t * p.breathRate * Math.PI * 2);
  p.shrug += 0.07 * p.breath * Math.max(0, bs);
  const sway = 0.012 + 0.02 * sc.nervous;
  p.spine = [p.spine[0] + sway * 0.6 * noise1(t * 0.35, seed), p.spine[1] + sway * noise1(t * 0.27, seed + 1), p.spine[2] + sway * 0.5 * noise1(t * 0.31, seed + 2)];
  p.head = [p.head[0] + sway * 1.4 * noise1(t * 0.5 + 9, seed), p.head[1] + sway * 1.6 * noise1(t * 0.43 + 4, seed + 1), p.head[2] + sway * noise1(t * 0.38, seed + 5)];

  // look: head follows the slow channel, eyes the fast one
  const lh = channel(c.lookH, t, (a, b, k) => ({ p: a.w === 0 ? b.p : b.w === 0 ? a.p : ([lerpN(a.p[0], b.p[0], k), lerpN(a.p[1], b.p[1], k), lerpN(a.p[2], b.p[2], k)] as V3), w: lerpN(a.w, b.w, k) }));
  const le = channel(c.lookE, t, (a, b, k) => ({ p: a.w === 0 ? b.p : b.w === 0 ? a.p : ([lerpN(a.p[0], b.p[0], k), lerpN(a.p[1], b.p[1], k), lerpN(a.p[2], b.p[2], k)] as V3), w: lerpN(a.w, b.w, k) }));
  const follow = channel(c.follow, t, lerpN);
  let headYaw = p.neck[1] + p.head[1], headPitch = p.neck[0] + p.head[0];
  if (lh.w > 0.001) {
    const [yaw0, pitch0] = lookAngles(body, spec, lh.p);
    const yaw = clamp(yaw0, -1.25, 1.25) * follow, pitch = clamp(pitch0, -0.8, 0.8) * follow;
    const w = lh.w;
    p.neck = [lerpN(p.neck[0], body.neck[0] * 0.4 + pitch * 0.35, w), lerpN(p.neck[1], yaw * 0.38, w), p.neck[2]];
    p.head = [lerpN(p.head[0], body.head[0] * 0.4 + pitch * 0.55, w), lerpN(p.head[1], yaw * 0.6, w), p.head[2]];
    headYaw = p.neck[1] + p.head[1];
    headPitch = p.neck[0] + p.head[0];
  }
  if (le.w > 0.001) {
    const [ey, ep] = lookAngles(body, spec, le.p);
    p.face.eyeX = lerpN(p.face.eyeX, clamp(ey - headYaw, -0.6, 0.6), le.w);
    p.face.eyeY = lerpN(p.face.eyeY, clamp(-(ep - headPitch), -0.45, 0.45), le.w);
  }
  const [sx, sy] = saccade(t, sc.nervous, seed);
  p.face.eyeX += sx;
  p.face.eyeY += sy;

  // blinks (not while the eyes are already shut)
  const bl = blinkAt(t, c.blinks, seed) * clamp(p.face.lid / 0.4);
  p.face.lid = p.face.lid * (1 - bl);
  p.face.squint = lerpN(p.face.squint, Math.max(p.face.squint, 0.3), bl);
  if (sg > 0) p.face.lid *= 1 - 0.25 * sg;
  return { pose: p, look: lh.w > 0.5 ? lh.p : null };
};
