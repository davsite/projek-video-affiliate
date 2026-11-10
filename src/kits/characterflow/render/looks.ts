// Blending of light states and grades (scene moods change continuously: lamp off, alarm, calm).

import { Color } from "three";
import type { Grade } from "./FilmPost.tsx";
import type { LightState, PointL } from "./Lights.tsx";
import type { V3 } from "../character/spec.ts";

const mixN = (a: number, b: number, k: number) => a + (b - a) * k;
const mix3 = (a: V3, b: V3, k: number): V3 => [mixN(a[0], b[0], k), mixN(a[1], b[1], k), mixN(a[2], b[2], k)];
const _a = new Color(), _b = new Color();
const mixC = (a: string, b: string, k: number) => `#${_a.set(a).lerp(_b.set(b), k).getHexString()}`;
const mixP = (a: PointL, b: PointL, k: number): PointL => {
  // a light fading in/out keeps its position (no sliding across the room)
  const pos = a.i === 0 ? b.pos : b.i === 0 ? a.pos : mix3(a.pos, b.pos, k);
  return { pos, color: mixC(a.color, b.color, k), i: mixN(a.i, b.i, k), dist: mixN(a.dist, b.dist, k) };
};

export const mixLight = (a: LightState, b: LightState, k: number): LightState => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  return {
    bg: mixC(a.bg, b.bg, k),
    fog: { color: mixC(a.fog.color, b.fog.color, k), density: mixN(a.fog.density, b.fog.density, k) },
    env: mixN(a.env, b.env, k),
    hemi: { sky: mixC(a.hemi.sky, b.hemi.sky, k), ground: mixC(a.hemi.ground, b.hemi.ground, k), i: mixN(a.hemi.i, b.hemi.i, k) },
    moon: { dir: mix3(a.moon.dir, b.moon.dir, k), box: a.moon.box, color: mixC(a.moon.color, b.moon.color, k), i: mixN(a.moon.i, b.moon.i, k) },
    spot: a.spot.i === 0 ? { ...b.spot, i: b.spot.i * k } : b.spot.i === 0 ? { ...a.spot, i: a.spot.i * (1 - k) } : { ...b.spot, i: mixN(a.spot.i, b.spot.i, k) },
    pts: [0, 1, 2, 3].map((i) => mixP(a.pts[i], b.pts[i], k)) as LightState["pts"],
  };
};

export const mixGrade = (a: Grade, b: Grade, k: number): Grade => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const o = { ...a };
  for (const key of Object.keys(a) as (keyof Grade)[]) {
    const va = a[key], vb = b[key];
    if (typeof va === "number" && typeof vb === "number") (o as Record<string, unknown>)[key] = mixN(va, vb, k);
    else if (Array.isArray(va) && Array.isArray(vb)) (o as Record<string, unknown>)[key] = mix3(va as V3, vb as V3, k);
    else if (typeof va === "string" && typeof vb === "string") (o as Record<string, unknown>)[key] = mixC(va, vb, k);
  }
  return o;
};

/** Piecewise timeline of keyed states with smooth blends: [[t, state, blendSeconds], …]. */
export const keyed = <S,>(keys: [number, S, number][], mix: (a: S, b: S, k: number) => S, t: number): S => {
  let cur = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, s, d] = keys[i];
    if (t < t0) break;
    const k = d <= 0 ? 1 : Math.min(1, (t - t0) / d);
    const e = k * k * (3 - 2 * k);
    cur = mix(cur, s, e);
  }
  return cur;
};
