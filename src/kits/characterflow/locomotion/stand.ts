// Standing and sitting blocking with planted feet (leg IK), for any character.
//
//   standBody — standing on a mark: living idle (slow weight shift), turns in place with real steps
//               (each foot lifts and re-plants at the new heading, staggered), optional base preset.
//   seatBody  — a chair/bench/bed-edge seat: sits down and stands up through a forward-lean crouch
//               while the feet stay planted in front of the seat.
// Pure maths — the director and the sound department (footsteps on turns) share it.

import { BODY, type BodyName } from "../character/presets/bodies.ts";
import { blend, clonePose, type Pose } from "../character/pose.ts";
import { DIMS, type CharacterSpec, type V3 } from "../character/spec.ts";

const D = Math.PI / 180;
const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const ANKLE_H = 0.087;

export type Turn = { at: number; dur: number; to: number };
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Heading at time t after a list of turns (shortest way round). */
export const yawAt = (yaw0: number, turns: Turn[], t: number, lag = 0) => {
  let y = yaw0;
  for (const tr of turns) {
    if (t < tr.at) break;
    const k = smooth((t - tr.at - lag * tr.dur) / tr.dur);
    y = y + wrap(tr.to - y) * k;
  }
  return y;
};

const quatYXZ = (yaw: number, pitch: number): [number, number, number, number] => {
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2);
  return [cy * sx, sy * cx, -sy * sx, cy * cx];
};

/** Foot (ankle target + orientation) standing at `pos` with heading `yaw`; side −1 = left, +1 = right. */
const footAt = (pos: V3, yaw: number, side: number, spec: CharacterSpec, lift = 0, back = 0.02): { t: V3; q: [number, number, number, number] } => {
  const gap = 0.1 * spec.scale;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const rx = -fz, rz = fx; // his right
  return {
    t: [pos[0] + rx * gap * side - fx * back, pos[1] + ANKLE_H * spec.scale + lift, pos[2] + rz * gap * side - fz * back],
    q: quatYXZ(yaw - side * 0.07, 0),
  };
};

/** Turn progress of one foot inside a turn: left steps first, right follows. */
const stepK = (turns: Turn[], t: number, first: boolean) => {
  for (const tr of turns) {
    const u = (t - tr.at) / tr.dur;
    if (u > 0 && u < 1) {
      const [a, b] = first ? [0.05, 0.55] : [0.45, 0.95];
      const k = smooth((u - a) / (b - a));
      return { k, lift: 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - a) / (b - a)))) };
    }
  }
  return null;
};

export const standBody = (spec: CharacterSpec, pos: V3, yaw0: number, turns: Turn[] = [], base: BodyName = "stand", mod?: (p: Pose, t: number) => void) => (t: number): Pose => {
  const yaw = yawAt(yaw0, turns, t);
  const p = clonePose(BODY[base]({ x: pos[0], y: pos[1], z: pos[2], yaw }, spec, t));
  // idle: slow weight shift between the feet
  const w = Math.sin(t * 2 * Math.PI * 0.11 + spec.scale * 10);
  p.hips = [p.hips[0], p.hips[1] + 1.2 * D * w, p.hips[2] + 1.8 * D * w];
  p.chest = [p.chest[0], p.chest[1] - 0.8 * D * w, p.chest[2] - 1.0 * D * w];
  p.x += Math.cos(yaw) * 0.012 * w;
  p.z += -Math.sin(yaw) * 0.012 * w;
  p.hipY -= 0.008;
  // turning: dip a little while stepping round
  for (const tr of turns) { const u = (t - tr.at) / tr.dur; if (u > 0 && u < 1) p.hipY -= 0.018 * Math.sin(Math.PI * u); }
  // feet: each re-plants at the new heading on its own step
  const prevYaw = (side: -1 | 1) => {
    const s = stepK(turns, t, side === -1);
    if (!s) return { yaw, lift: 0 };
    // heading this foot has reached
    let y = yaw0;
    for (const tr of turns) { if (t < tr.at) break; if (t > tr.at + tr.dur) y = y + wrap(tr.to - y); else y = y + wrap(tr.to - y) * s.k; }
    return { yaw: y, lift: s.lift };
  };
  const L = prevYaw(-1), R = prevYaw(1);
  const fl = footAt(pos, L.yaw, -1, spec, L.lift), fr = footAt(pos, R.yaw, 1, spec, R.lift);
  p.legL = { ...p.legL, ik: { t: fl.t, q: fl.q, w: 1 } };
  p.legR = { ...p.legR, ik: { t: fr.t, q: fr.q, w: 1 } };
  if (mod) mod(p, t);
  return p;
};

/** Steps of a turn (for footstep sounds). */
export const turnSteps = (turns: Turn[]) => turns.flatMap((tr) => [tr.at + tr.dur * 0.55, tr.at + tr.dur * 0.95]);

// ── sitting ─────────────────────────────────────────────────────────────────
export type Seat = { pos: V3; yaw: number; height: number; floor?: number };
/** sit = 1 seated, 0 standing in front of the seat; transitions take ~1 s each */
export type SeatChange = { at: number; sit: boolean; dur?: number };

export const sitAmount = (start: boolean, changes: SeatChange[], t: number) => {
  let k = start ? 1 : 0;
  for (const c of changes) {
    if (t < c.at) break;
    const d = c.dur ?? 1.1;
    const target = c.sit ? 1 : 0;
    k = k + (target - k) * smooth((t - c.at) / d);
  }
  return k;
};

/** Position where he stands when he gets up from the seat (feet stay where they were). */
export const seatStandPos = (s: Seat, spec: CharacterSpec): V3 => {
  const f = 0.36 * spec.scale / 0.94;
  return [s.pos[0] + Math.sin(s.yaw) * f, s.floor ?? 0, s.pos[2] + Math.cos(s.yaw) * f];
};

export const seatBody = (spec: CharacterSpec, seat: Seat, startSeated: boolean, changes: SeatChange[], mod?: (p: Pose, t: number) => void) => (t: number): Pose => {
  const k = sitAmount(startSeated, changes, t);
  const floor = seat.floor ?? 0;
  const standPos = seatStandPos(seat, spec);
  const fx = Math.sin(seat.yaw), fz = Math.cos(seat.yaw);
  // standing
  const st = BODY.stand({ x: standPos[0], y: floor, z: standPos[2], yaw: seat.yaw }, spec, t);
  // seated: pelvis on the seat, thighs forward, upright back
  const se = clonePose(BODY.stand({ x: seat.pos[0], y: floor, z: seat.pos[2], yaw: seat.yaw }, spec, t));
  se.y = seat.height + 0.1 * spec.scale - DIMS.pelvisH * spec.scale;
  se.hips = [-4 * D, 0, 0];
  se.spine = [5 * D, 0, 0];
  se.chest = [5 * D, 0, 0];
  se.armL = { ...se.armL, sw: 0.45, ab: 0.14, el: 0.7 };
  se.armR = { ...se.armR, sw: 0.45, ab: 0.14, el: 0.7 };
  // half-way: weight forward over the feet
  const cr = clonePose(st);
  cr.x = (seat.pos[0] + standPos[0]) / 2 + fx * 0.06;
  cr.z = (seat.pos[2] + standPos[2]) / 2 + fz * 0.06;
  cr.y = floor + (seat.height + 0.1 * spec.scale - DIMS.pelvisH * spec.scale - floor) * 0.55;
  cr.hips = [22 * D, 0, 0];
  cr.spine = [16 * D, 0, 0];
  cr.chest = [10 * D, 0, 0];
  cr.armL = { ...cr.armL, sw: 0.5, el: 0.5 };
  cr.armR = { ...cr.armR, sw: 0.5, el: 0.5 };
  const p = k < 0.5 ? blend(st, cr, smooth(k * 2)) : blend(cr, se, smooth((k - 0.5) * 2));
  const fl = footAt(standPos, seat.yaw, -1, spec, 0, 0.03), fr = footAt(standPos, seat.yaw, 1, spec, 0, 0.03);
  p.legL = { ...p.legL, ik: { t: fl.t, q: fl.q, w: 1 } };
  p.legR = { ...p.legR, ik: { t: fr.t, q: fr.q, w: 1 } };
  if (mod) mod(p, t);
  return p;
};
