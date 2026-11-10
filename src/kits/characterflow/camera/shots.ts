// Shot library for 9:16 character storytelling (Node-safe maths). Every preset frames "subjects"
// (face position + facing) for a portrait frame — the narrow horizontal field means two people are
// framed side-on or down a line, never as a wide landscape two-shot. `safeCam` keeps any camera
// inside the environment and out of its keep-out zones.

import { Vector3 } from "three";
import type { Cam } from "../render/FilmPost.tsx";
import type { V3 } from "../character/spec.ts";
import type { EnvData } from "../env/registry.ts";

export type Subject = { face: V3; fwd: V3; pos: V3 };
export type ShotKind =
  | "establish" | "wide" | "closeUp" | "medium" | "mediumWide" | "twoShot" | "ots" | "track" | "pathDown"
  | "reaction" | "explain" | "think" | "sitStand" | "turn" | "boardWide" | "bedWide" | "bedClose" | "bedThink";
export type ShotSpec = { kind: ShotKind; a: string; b?: string; side?: 1 | -1; t0: number; t1: number; /** wide two-person: camera direction from the pair (chosen by the director to fit the set) */ dir?: V3 };

const V = (v: V3) => new Vector3(...v);
const A = (v: Vector3): V3 => [v.x, v.y, v.z];
const flat = (v: V3) => { const x = V(v).setY(0); return x.lengthSq() < 1e-6 ? new Vector3(0, 0, 1) : x.normalize(); };
const drift = (t: number, amt: number): V3 => [amt * 0.012 * (Math.sin(t * 0.83) + 0.5 * Math.sin(t * 2.1 + 1)), amt * 0.008 * Math.sin(t * 1.07 + 2), amt * 0.01 * Math.sin(t * 0.61 + 4)];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** distance that frames `h` metres of height with vertical fov `fov` (deg) */
const distFor = (h: number, fov: number) => h / 2 / Math.tan((fov * Math.PI) / 360);
/** a direction rotated `deg` around +Y */
const rotY = (v: Vector3, deg: number) => v.clone().applyAxisAngle(new Vector3(0, 1, 0), (deg * Math.PI) / 180);
const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

/** in front of a subject at an angle (deg, + = toward his left), framing height h */
const front = (s: Subject, angle: number, h: number, fov: number, up = 0, lookUp = 0): { pos: V3; target: V3 } => {
  const d = distFor(h, fov);
  const dir = rotY(flat(s.fwd), angle);
  const p = V(s.face).addScaledVector(dir, d).add(new Vector3(0, up, 0));
  return { pos: A(p), target: [s.face[0], s.face[1] + lookUp, s.face[2]] };
};

/** Horizontal half-width of the 9:16 frame per metre of distance at a vertical fov of 42°. */
const HALF_W = Math.tan((42 * Math.PI) / 360) * (9 / 16);
/** Distance that fits two people (positions a, b) side by side when seen from direction dir. */
export const pairDist = (a: V3, b: V3, dir: V3) => {
  const right = new Vector3(-dir[2], 0, dir[0]).normalize();
  const w = Math.abs(V(b).sub(V(a)).dot(right)) / 2 + 0.45;
  return Math.max(distFor(3.0, 42), w / HALF_W);
};
/**
 * The best direction for a wide shot of two people inside a set: both inside the frame, the camera
 * inside the room, as many faces toward the lens as possible. null when no direction fits.
 */
export const pairDir = (a: Subject, b: Subject, inside: (p: V3) => boolean): V3 | null => {
  const mid = V(a.pos).add(V(b.pos)).multiplyScalar(0.5);
  let best: V3 | null = null, bestS = -Infinity;
  for (let deg = 0; deg < 360; deg += 10) {
    const dir: V3 = [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
    const d = pairDist(a.pos, b.pos, dir);
    const p: V3 = [mid.x + dir[0] * d, 1.7, mid.z + dir[2] * d];
    if (!inside(p)) continue;
    const face = (s: Subject) => Math.max(-0.5, flat(s.fwd).dot(V(dir)));
    const score = face(a) + face(b) - 0.08 * d;
    if (score > bestS) { bestS = score; best = dir; }
  }
  // two people in profile (facing each other) score about 0; both turned away score below −0.5
  return best && bestS > -0.45 ? best : null;
};

export const SHOTS: Record<ShotKind, (S: Record<string, Subject>, spec: ShotSpec, t: number) => Cam> = {
  establish: (S, sp, t) => {
    const s = S[sp.a], k = ease((t - sp.t0) / Math.max(0.5, sp.t1 - sp.t0));
    const dir = rotY(flat(s.fwd), 55 * (sp.side ?? 1));
    const hi = V(s.pos).addScaledVector(dir, 9).add(new Vector3(0, 6, 0));
    const lo = V(s.pos).addScaledVector(dir, 6.2).add(new Vector3(0, 2.0, 0));
    return { pos: add(A(hi.lerp(lo, k)), drift(t, 0.4)), target: [s.pos[0], 1.2 + 0.3 * k, s.pos[2]], fov: 44, aperture: 0.0006, maxBlur: 0.003 };
  },
  wide: (S, sp, t) => {
    const s = S[sp.a];
    if (sp.b && S[sp.b] && sp.dir) {
      const o = S[sp.b], mid = V(s.pos).add(V(o.pos)).multiplyScalar(0.5);
      const d = pairDist(s.pos, o.pos, sp.dir);
      const p = mid.clone().addScaledVector(V(sp.dir), d).add(new Vector3(0, 1.7, 0));
      return { pos: add(A(p), drift(t, 0.4)), target: [mid.x, 0.95, mid.z], fov: 42, aperture: 0.0006, maxBlur: 0.003 };
    }
    const f = front(s, 35 * (sp.side ?? 1), 3.4, 42, 0.6);
    return { pos: add(f.pos, drift(t, 0.4)), target: [s.pos[0], 1.0, s.pos[2]], fov: 42, aperture: 0.0006, maxBlur: 0.003 };
  },
  closeUp: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 25 * (sp.side ?? 1), 0.55, 28, 0.03);
    return { ...f, pos: add(f.pos, drift(t, 0.25)), fov: 28, aperture: 0.002, maxBlur: 0.006 };
  },
  medium: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 30 * (sp.side ?? 1), 1.05, 36, 0.0, -0.18);
    return { ...f, pos: add(f.pos, drift(t, 0.4)), fov: 36, aperture: 0.0014, maxBlur: 0.005 };
  },
  mediumWide: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 32 * (sp.side ?? 1), 2.1, 40, -0.25, -0.55);
    return { ...f, pos: add(f.pos, drift(t, 0.4)), fov: 40, aperture: 0.001, maxBlur: 0.004 };
  },
  // two people: camera perpendicular to the line between them, far enough for both + margin
  twoShot: (S, sp, t) => {
    const a = V(S[sp.a].face), b = V(S[sp.b ?? sp.a].face);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const line = b.clone().sub(a).setY(0);
    const sep = Math.max(0.6, line.length());
    let perp = new Vector3(-line.z, 0, line.x).normalize();
    if (perp.z < 0) perp.negate();
    if (sp.side === -1) perp.negate();
    const fov = 42, halfW = Math.tan(Math.atan(Math.tan((fov * Math.PI) / 360) * (9 / 16)));
    const d = Math.max(distFor(1.4, fov), (sep / 2 + 0.55) / halfW);
    const p = mid.clone().addScaledVector(perp, d).add(new Vector3(0, -0.1, 0));
    return { pos: add(A(p), drift(t, 0.3)), target: [mid.x, mid.y - 0.22, mid.z], fov, aperture: 0.0009, maxBlur: 0.004 };
  },
  // over the shoulder of `a`, looking at `b`
  ots: (S, sp, t) => {
    const a = S[sp.a], b = S[sp.b ?? sp.a];
    const ab = V(b.face).sub(V(a.face)).setY(0).normalize();
    const side = new Vector3(-ab.z, 0, ab.x).multiplyScalar(sp.side ?? 1);
    const p = V(a.face).addScaledVector(ab, -0.95).addScaledVector(side, 0.45).add(new Vector3(0, 0.12, 0));
    const dist = V(b.face).distanceTo(p);
    const fov = Math.max(18, Math.min(34, 34 - (dist - 2) * 1.2));
    return { pos: add(A(p), drift(t, 0.4)), target: [b.face[0], b.face[1] - 0.22, b.face[2]], fov, aperture: 0.0012, maxBlur: 0.005 };
  },
  track: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 22 * (sp.side ?? 1), 1.5, 36, -0.05, -0.3);
    return { ...f, pos: add(f.pos, drift(t, 0.6)), fov: 36, aperture: 0.0014, maxBlur: 0.005 };
  },
  // down the walk line from behind `a` toward `b` (encounters at distance)
  pathDown: (S, sp, t) => {
    const a = S[sp.a], b = S[sp.b ?? sp.a];
    const ab = V(b.pos).sub(V(a.pos)).setY(0).normalize();
    const side = new Vector3(-ab.z, 0, ab.x).multiplyScalar(sp.side ?? 1);
    const p = V(a.pos).addScaledVector(ab, -2.3).addScaledVector(side, 1.6).add(new Vector3(0, 2.0, 0));
    const tg = V(a.pos).lerp(V(b.pos), 0.45).add(new Vector3(0, 1.35, 0));
    return { pos: add(A(p), drift(t, 0.4)), target: A(tg), fov: 42, aperture: 0.0008, maxBlur: 0.004 };
  },
  reaction: (S, sp, t) => {
    const s = S[sp.a], k = ease((t - sp.t0) / Math.max(0.5, sp.t1 - sp.t0));
    const f = front(s, 18 * (sp.side ?? 1), 0.62 - 0.12 * k, 28, 0.02);
    return { ...f, pos: add(f.pos, drift(t, 0.25)), fov: 28, aperture: 0.002, maxBlur: 0.006 };
  },
  explain: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 38 * (sp.side ?? 1), 1.2, 38, 0.02, -0.2);
    return { ...f, pos: add(f.pos, drift(t, 0.4)), fov: 38, aperture: 0.0012, maxBlur: 0.005 };
  },
  // headroom above for a thought bubble
  think: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 28 * (sp.side ?? 1), 1.75, 40, 0.15, 0.22);
    return { ...f, pos: add(f.pos, drift(t, 0.4)), fov: 40, aperture: 0.0012, maxBlur: 0.004 };
  },
  // the subject in the lower frame with room behind/above for a sign or gag beside the path
  boardWide: (S, sp, t) => {
    const s = S[sp.a], b = S[sp.b ?? sp.a];
    const mx = (s.pos[0] + b.pos[0]) / 2, mz = (s.pos[2] + b.pos[2]) / 2;
    const span = Math.hypot(s.pos[0] - b.pos[0], s.pos[2] - b.pos[2]);
    const d = Math.max(6.2, span / 2 / 0.24 + 1.5);
    return { pos: add([mx, 1.9, mz + d], drift(t, 0.4)), target: [mx, 2.0, mz - 0.4], fov: 46, aperture: 0.0006, maxBlur: 0.003 };
  },
  // someone lying / sitting up in bed: fixed high angles from the foot side of the bed (the head's
  // facing is useless while lying, and the camera must not swing while they sit up or lie down)
  bedWide: (S, sp, t) => {
    const f = S[sp.a].face;
    return { pos: add([f[0] + 0.4, f[1] + 1.3, f[2] + 1.85], drift(t, 0.3)), target: [f[0], f[1] - 0.12, f[2] + 0.45], fov: 38, aperture: 0.0008, maxBlur: 0.004 };
  },
  bedClose: (S, sp, t) => {
    const f = S[sp.a].face;
    return { pos: add([f[0] + 0.35, f[1] + 0.95, f[2] + 1.05], drift(t, 0.2)), target: [f[0], f[1] - 0.05, f[2] + 0.08], fov: 34, aperture: 0.0014, maxBlur: 0.005 };
  },
  // lying with a thought bubble: lower, from the side of the bed, headroom above the face
  bedThink: (S, sp, t) => {
    const f = S[sp.a].face;
    return { pos: add([f[0] + 1.05, f[1] + 0.5, f[2] + 1.25], drift(t, 0.3)), target: [f[0] - 0.08, f[1] + 0.32, f[2] - 0.08], fov: 42, aperture: 0.001, maxBlur: 0.004 };
  },
  sitStand: (S, sp, t) => {
    const s = S[sp.a];
    const f = front(s, 40 * (sp.side ?? 1), 2.0, 40, -0.35, -0.55);
    return { ...f, pos: add(f.pos, drift(t, 0.3)), fov: 40, aperture: 0.0009, maxBlur: 0.004 };
  },
  turn: (S, sp, t) => {
    const s = S[sp.a], k = ease((t - sp.t0) / Math.max(0.5, sp.t1 - sp.t0));
    const f = front(s, (55 - 25 * k) * (sp.side ?? 1), 1.7, 38, -0.1, -0.35);
    return { ...f, pos: add(f.pos, drift(t, 0.3)), fov: 38, aperture: 0.001, maxBlur: 0.004 };
  },
};

/** Shots that frame one person (another person must not stand between the lens and them). */
export const SOLO_SHOTS: ShotKind[] = ["closeUp", "medium", "mediumWide", "explain", "think", "reaction", "sitStand", "turn", "track"];

/** The camera moved around `pivot` (a vertical axis) by `deg`; it keeps looking at the same target. */
export const orbitCam = (c: Cam, pivot: V3, deg: number): Cam => {
  if (!deg) return c;
  const off = V(c.pos).sub(V(pivot));
  return { ...c, pos: A(V(pivot).add(rotY(off, deg))) };
};

/** True when someone else's head or chest is within `clear` m of the line from the lens to the subject's face. */
export const peopleBlock = (c: Cam, me: Subject, others: Subject[], clear = 0.3) => {
  const p = V(c.pos), f = V(me.face), d = f.clone().sub(p);
  const len = d.length();
  d.normalize();
  return others.some((o) => [V(o.face), V(o.face).add(new Vector3(0, -0.35, 0))].some((q) => {
    const s = q.clone().sub(p).dot(d);
    if (s < 0 || s > len - 0.25) return false;
    return p.clone().addScaledVector(d, s).distanceTo(q) < clear;
  }));
};

/** True when this camera sits on the set's open side (where cameras belong). */
export const onViewSide = (c: Cam, env: EnvData) => V(c.pos).sub(V(c.target)).setY(0).dot(V(env.viewSide)) >= -0.05;

/**
 * Keep a camera inside the environment, outside its keep-out spheres, and with nothing between the
 * lens and the subject: anything in the way makes the camera slide along the view line past it.
 */
export const safeCam = (c: Cam, env: EnvData): Cam => {
  const p = V(c.pos), tg = V(c.target);
  for (let i = 0; i < 8; i++) {
    let moved = false;
    for (const b of env.blockers) {
      const C = V(b.c), dir = tg.clone().sub(p);
      const len = dir.length();
      dir.normalize();
      const s = Math.min(len, Math.max(0, C.clone().sub(p).dot(dir)));
      const closest = p.clone().addScaledVector(dir, s);
      if (closest.distanceTo(C) < b.r && s < len - 0.6) {
        // past the far side of the sphere along the view line (never closer than 0.6 m to the subject)
        const half = Math.sqrt(Math.max(0, b.r * b.r - closest.distanceToSquared(C)));
        p.addScaledVector(dir, Math.min(len - 0.6, s + half + 0.12));
        moved = true;
      }
    }
    if (!moved) break;
  }
  const { min, max } = env.bounds;
  p.set(Math.min(max[0], Math.max(min[0], p.x)), Math.min(max[1], Math.max(min[1], p.y)), Math.min(max[2], Math.max(min[2], p.z)));
  return { ...c, pos: A(p) };
};
