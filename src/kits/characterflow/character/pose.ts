// Character pose: a plain number tree, computed per frame from film time (no state, no clocks).
// Angles in radians. Conventions (character faces +Z, his left is +X):
//   hips/spine/chest/neck/head [pitch fwd +, yaw to his left +, roll to his left +]
//   legs [swing fwd +, abduct out +, twist], knee bend +, ankle toes-up +
//   arms: FK [swing fwd +, abduct out +, twist] + elbow bend, optionally pulled to an IK target.
// IK targets are written in "chest", "head" or "world" space by presets; the performance resolves
// them to chest space (skeleton.ts) before poses are blended, so blending is always like-for-like.

import { Quaternion } from "three";
import type { V3 } from "./spec.ts";

export type E3 = [number, number, number];
export type IKSpace = "chest" | "head" | "world";

export type Face = {
  /** both brows: +1 raised, −1 lowered */
  browUp: number;
  /** inner brow ends: +1 raised (worry), −1 pulled down (focus/anger) */
  browIn: number;
  /** his left brow up / right down */
  browAsym: number;
  /** upper lids: 1 open, 0 closed, >1 wide */
  lid: number;
  /** lower lid raise (smile squint / tension) 0…1 */
  squint: number;
  /** mouth corners −1 frown … 1 smile */
  smile: number;
  /** mouth open 0…1 */
  open: number;
  /** mouth width −1 pucker … 1 wide/grimace */
  wide: number;
  /** gaze yaw (to his left +) and pitch (up +), radians */
  eyeX: number;
  eyeY: number;
  /** extra blush 0…1 */
  blush: number;
};

export type Hand = { curl: number; index: number; thumb: number; spread: number };
/** `q` optionally fixes the hand orientation (same space as `t`; quaternion x, y, z, w). */
export type IK = { t: V3; space: IKSpace; pole: V3; w: number; q?: [number, number, number, number] };
export type Arm = { sw: number; ab: number; tw: number; el: number; wr: E3; ik?: IK };
/** Legs are FK, or (ik.w ≥ 0.5) planted by IK on a world ankle target with a world foot orientation. */
export type LegIK = { t: V3; q: [number, number, number, number]; w: number };
export type Leg = { sw: number; ab: number; tw: number; kn: number; an: number; ik?: LegIK };

export type Pose = {
  x: number; y: number; z: number; yaw: number;
  hipY: number; hips: E3;
  spine: E3; chest: E3; neck: E3; head: E3;
  /** shoulder shrug 0…1 (both), raises the arm roots */
  shrug: number;
  armL: Arm; armR: Arm;
  legL: Leg; legR: Leg;
  handL: Hand; handR: Hand;
  face: Face;
  /** breathing amplitude (0…1), breaths per second, hand tremble (0…1) */
  breath: number; breathRate: number; tremble: number;
};

export const FACE0: Face = { browUp: 0, browIn: 0, browAsym: 0, lid: 1, squint: 0.1, smile: 0.08, open: 0, wide: 0, eyeX: 0, eyeY: 0, blush: 0 };
export const HAND0: Hand = { curl: 0.35, index: 0.3, thumb: 0.25, spread: 0.1 };

export const arm0 = (): Arm => ({ sw: 0.04, ab: 0.1, tw: 0, el: 0.2, wr: [0, 0, 0] });
export const leg0 = (): Leg => ({ sw: 0, ab: 0.02, tw: 0, kn: 0.04, an: 0 });

export const restPose = (): Pose => ({
  x: 0, y: 0, z: 0, yaw: 0,
  hipY: 0, hips: [0, 0, 0],
  spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shrug: 0,
  armL: arm0(), armR: arm0(),
  legL: leg0(), legR: leg0(),
  handL: { ...HAND0 }, handR: { ...HAND0 },
  face: { ...FACE0 },
  breath: 1, breathRate: 0.24, tremble: 0,
});

export const clonePose = (p: Pose): Pose => ({
  ...p,
  hips: [...p.hips], spine: [...p.spine], chest: [...p.chest], neck: [...p.neck], head: [...p.head],
  armL: cloneArm(p.armL), armR: cloneArm(p.armR),
  legL: { ...p.legL }, legR: { ...p.legR },
  handL: { ...p.handL }, handR: { ...p.handR },
  face: { ...p.face },
});
export const cloneArm = (a: Arm): Arm => ({ ...a, wr: [...a.wr], ik: a.ik ? { ...a.ik, t: [...a.ik.t], pole: [...a.ik.pole] } : undefined });

export const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: E3 | V3, b: E3 | V3, k: number): E3 => [lerpN(a[0], b[0], k), lerpN(a[1], b[1], k), lerpN(a[2], b[2], k)];

const slerpQ = (a: IK["q"], b: IK["q"], k: number): IK["q"] => {
  if (!a || !b) return k < 0.5 ? a : b;
  const q = new Quaternion(...a).slerp(new Quaternion(...b), k);
  return [q.x, q.y, q.z, q.w];
};

/** Blend arms. Both IK targets must already be in the same space (the performance resolves to chest). */
export const lerpArm = (a: Arm, b: Arm, k: number): Arm => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const ia = a.ik, ib = b.ik;
  return {
    sw: lerpN(a.sw, b.sw, k), ab: lerpN(a.ab, b.ab, k), tw: lerpN(a.tw, b.tw, k), el: lerpN(a.el, b.el, k), wr: lerp3(a.wr, b.wr, k),
    ik: ia || ib ? {
      t: lerp3((ia ?? ib)!.t, (ib ?? ia)!.t, k),
      pole: lerp3((ia ?? ib)!.pole, (ib ?? ia)!.pole, k),
      space: (ib ?? ia)!.space,
      w: lerpN(ia?.w ?? 0, ib?.w ?? 0, k),
      q: slerpQ(ia?.q, ib?.q, k),
    } : undefined,
  };
};
export const lerpLeg = (a: Leg, b: Leg, k: number): Leg => {
  const ia = a.ik, ib = b.ik;
  const ik = ia && ib ? { t: lerp3(ia.t, ib.t, k) as V3, q: slerpQ(ia.q, ib.q, k)!, w: lerpN(ia.w, ib.w, k) } : k < 0.5 ? ia : ib;
  return { sw: lerpN(a.sw, b.sw, k), ab: lerpN(a.ab, b.ab, k), tw: lerpN(a.tw, b.tw, k), kn: lerpN(a.kn, b.kn, k), an: lerpN(a.an, b.an, k), ik };
};
export const lerpHand = (a: Hand, b: Hand, k: number): Hand => ({ curl: lerpN(a.curl, b.curl, k), index: lerpN(a.index, b.index, k), thumb: lerpN(a.thumb, b.thumb, k), spread: lerpN(a.spread, b.spread, k) });
export const lerpFace = (a: Face, b: Face, k: number): Face => {
  const o = { ...a };
  for (const key of Object.keys(a) as (keyof Face)[]) o[key] = lerpN(a[key], b[key], k);
  return o;
};

/** Blend two whole poses (yaw the short way round). */
export const blend = (a: Pose, b: Pose, k: number): Pose => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  let dy = b.yaw - a.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  return {
    x: lerpN(a.x, b.x, k), y: lerpN(a.y, b.y, k), z: lerpN(a.z, b.z, k), yaw: a.yaw + dy * k,
    hipY: lerpN(a.hipY, b.hipY, k), hips: lerp3(a.hips, b.hips, k),
    spine: lerp3(a.spine, b.spine, k), chest: lerp3(a.chest, b.chest, k), neck: lerp3(a.neck, b.neck, k), head: lerp3(a.head, b.head, k),
    shrug: lerpN(a.shrug, b.shrug, k),
    armL: lerpArm(a.armL, b.armL, k), armR: lerpArm(a.armR, b.armR, k),
    legL: lerpLeg(a.legL, b.legL, k), legR: lerpLeg(a.legR, b.legR, k),
    handL: lerpHand(a.handL, b.handL, k), handR: lerpHand(a.handR, b.handR, k),
    face: lerpFace(a.face, b.face, k),
    breath: lerpN(a.breath, b.breath, k), breathRate: lerpN(a.breathRate, b.breathRate, k), tremble: lerpN(a.tremble, b.tremble, k),
  };
};

const TAU = Math.PI * 2;
const D = Math.PI / 180;

/** Walk/run cycle at gait phase `p` (cycles). `amt` scales the stride (1 walk, 1.6 run). */
export const walkCycle = (pose: Pose, p: number, amt = 1): Pose => {
  const o = clonePose(pose);
  const run = Math.max(0, amt - 1);
  const legAt = (ph: number, l: Leg) => {
    const s = Math.sin(TAU * ph), c = Math.cos(TAU * ph);
    l.sw = (22 * D * s) * amt;
    l.kn = (6 * D + (52 + 40 * run) * D * Math.pow(Math.max(0, c), 1.4)) * (0.55 + 0.45 * Math.min(1, amt));
    l.an = (10 * D * Math.max(0, c) - 14 * D * Math.max(0, -Math.sin(TAU * ph + 0.9))) * amt;
  };
  legAt(p, o.legL);
  legAt(p + 0.5, o.legR);
  o.hipY = pose.hipY - (0.012 + 0.012 * amt) * (0.5 - 0.5 * Math.cos(TAU * 2 * p - Math.PI));
  const sway = Math.sin(TAU * p);
  o.hips = [pose.hips[0] + run * 8 * D, pose.hips[1] + 5 * D * sway * amt, pose.hips[2] + 2 * D * Math.cos(TAU * p) * amt];
  o.chest = [pose.chest[0] + run * 6 * D, pose.chest[1] - 7 * D * sway * amt, pose.chest[2]];
  if (!o.armL.ik) { o.armL.sw = pose.armL.sw - 0.32 * sway * amt; o.armL.el = pose.armL.el + 0.12 * amt + run * 0.9; }
  if (!o.armR.ik) { o.armR.sw = pose.armR.sw + 0.32 * sway * amt; o.armR.el = pose.armR.el + 0.12 * amt + run * 0.9; }
  return o;
};
