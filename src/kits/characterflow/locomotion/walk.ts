// Locomotion: characters really walk through the set — no treadmill, no sliding feet.
//
// A Walker integrates a speed profile (m/s keys) into distance and gait phase. Step length follows
// speed, so cadence and stride change together; when the speed drops to zero the gait finishes its
// step and both feet come to rest. Each foot is planted at the body's position at mid-stance and
// swings to its next plant with a lift arc, toe-off and heel strike; the legs reach the plants with
// IK (skeleton.ts), so foot contact is exact. walkBody() layers the upper-body motion on any body
// preset: pelvis bob and yaw, counter-rotating chest, arm swing (unless a gesture owns the arm).
//
// Pure maths (no rendering), so the sound department can place footsteps on the same plants.

import { BODY, type BodyName } from "../character/presets/bodies.ts";
import { clonePose, type Pose } from "../character/pose.ts";
import { DIMS, type CharacterSpec, type V3 } from "../character/spec.ts";

export type SpeedKey = [t: number, v: number];
export type WalkerDef = {
  /** ground point where distance 0 is */
  start: V3;
  /** horizontal travel direction (normalised internally) */
  dir: V3;
  /** speed keys (m/s), eased between keys */
  speed: SpeedKey[];
  spec: CharacterSpec;
  /** distance already covered at speed[0][0] */
  d0?: number;
  /** gait phase at speed[0][0] (cycles) — continue another walker's stride */
  phi0?: number;
  /** sideways offset from the line (m, + = his right) over time — lane changes */
  lane?: (t: number) => number;
};
export type Foot = { t: V3; q: [number, number, number, number]; lift: number; planted: boolean };
export type WalkState = { d: number; v: number; phi: number; pos: V3; yaw: number; amt: number };

const DT = 1 / 240;
const smooth = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const smoother = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * k * (k * (k * 6 - 15) + 10); };

/** Step length (m) at speed v for a character of this scale. */
export const stepLength = (v: number, scale: number) => Math.min(0.8, Math.max(0.3, 0.3 + 0.38 * v)) * (scale / 0.94);
const ankleH = (spec: CharacterSpec) => 0.087 * spec.scale;

const quatYXZ = (yaw: number, pitch: number): [number, number, number, number] => {
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2);
  // q = qy * qx
  return [cy * sx, sy * cx, -sy * sx, cy * cx];
};

export class Walker {
  def: WalkerDef;
  t0: number;
  dir: V3;
  right: V3;
  yaw: number;
  private d: Float64Array;
  private phi: Float64Array;
  private v: Float64Array;

  constructor(def: WalkerDef, t1: number) {
    this.def = def;
    this.t0 = def.speed[0][0];
    const l = Math.hypot(def.dir[0], def.dir[2]);
    this.dir = [def.dir[0] / l, 0, def.dir[2] / l];
    this.right = [-this.dir[2], 0, this.dir[0]];
    this.yaw = Math.atan2(this.dir[0], this.dir[2]);
    const n = Math.ceil((t1 - this.t0) / DT) + 2;
    this.d = new Float64Array(n);
    this.phi = new Float64Array(n);
    this.v = new Float64Array(n);
    let d = def.d0 ?? 0, phi = def.phi0 ?? 0;
    for (let i = 0; i < n; i++) {
      const t = this.t0 + i * DT;
      const v = this.speedAt(t);
      this.d[i] = d;
      this.phi[i] = phi;
      this.v[i] = v;
      const L = stepLength(v, def.spec.scale);
      let rate = v / (2 * L);
      // stopping: finish the current step so both feet end on the ground (rest at φ ≡ 0.06 mod 0.5)
      if (v < 0.04) {
        const u = (((phi - 0.06) % 0.5) + 0.5) % 0.5;
        rate = u > 0.012 ? Math.max(rate, 0.9) : 0;
      }
      d += v * DT;
      phi += rate * DT;
    }
  }

  speedAt(t: number) {
    const k = this.def.speed;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * smooth((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
    return k[k.length - 1][1];
  }

  private sample(arr: Float64Array, t: number) {
    const x = Math.min(arr.length - 1.001, Math.max(0, (t - this.t0) / DT));
    const i = Math.floor(x), f = x - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  }
  /** distance at the moment the phase reaches `p` (binary search; phase is monotonic) */
  private dAtPhase(p: number) {
    const a = this.phi;
    if (p <= a[0]) return this.d[0] - (a[0] - p) * 2 * stepLength(this.v[0], this.def.spec.scale);
    let lo = 0, hi = a.length - 1;
    if (p >= a[hi]) return this.d[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] < p) lo = m; else hi = m; }
    const f = (p - a[lo]) / Math.max(1e-9, a[hi] - a[lo]);
    return this.d[lo] + (this.d[hi] - this.d[lo]) * f;
  }
  private at3(d: number, lateral = 0, t = this.t0): V3 {
    const s = this.def.start;
    lateral += this.def.lane ? this.def.lane(t) : 0;
    return [s[0] + this.dir[0] * d + this.right[0] * lateral, s[1], s[2] + this.dir[2] * d + this.right[2] * lateral];
  }

  at(t: number): WalkState {
    const d = this.sample(this.d, t), v = this.sample(this.v, t), phi = this.sample(this.phi, t);
    return { d, v, phi, pos: this.at3(d, 0, t), yaw: this.yaw, amt: Math.min(1.2, v / 1.0) };
  }

  /** Ankle targets + foot orientations for both feet at time t. */
  feet(t: number): { L: Foot; R: Foot } {
    const st = this.at(t);
    const spec = this.def.spec;
    const gap = 0.1 * spec.scale;
    const foot = (off: number, side: 1 | -1): Foot => {
      const pf = st.phi + off;
      const n = Math.floor(pf), u = pf - n;
      const plant = (k: number) => this.dAtPhase(k + 0.3 - off) - 0.04;
      let dd: number, lift = 0, pitch = 0, planted = true;
      if (u < 0.6) {
        dd = plant(n);
        pitch = 0.16 * smooth((u - 0.42) / 0.18) * Math.min(1, st.v / 0.4); // heel rises late in stance
      } else {
        const k = smoother((u - 0.6) / 0.4);
        dd = plant(n) + (plant(n + 1) - plant(n)) * k;
        const amp = Math.min(1, 0.25 + st.v / 0.6);
        lift = 0.075 * Math.sin(Math.PI * k) * amp;
        pitch = 0.5 * Math.cos(Math.PI * k) * Math.sqrt(Math.sin(Math.PI * k)) * amp;
        planted = false;
      }
      const p = this.at3(dd, side * gap, t);
      const y = p[1] + ankleH(spec) + lift + Math.max(0, pitch) * 0.12 + Math.max(0, -pitch) * 0.05;
      return { t: [p[0], y, p[2]], q: quatYXZ(this.yaw - side * 0.07, pitch), lift, planted };
    };
    // `right` points to his right: left foot −gap, right foot +gap; toes turn slightly out
    return { L: foot(0, -1), R: foot(0.5, 1) };
  }

  /** Times (s) of heel strikes in [a, b] — for footstep sounds. */
  heelStrikes(a: number, b: number): { t: number; side: "L" | "R" }[] {
    const out: { t: number; side: "L" | "R" }[] = [];
    let prevL = this.sample(this.phi, a), prevR = prevL + 0.5;
    for (let t = a + DT; t <= b; t += DT) {
      const p = this.sample(this.phi, t);
      if (Math.floor(p) > Math.floor(prevL) && this.sample(this.v, t) > 0.02) out.push({ t, side: "L" });
      if (Math.floor(p + 0.5) > Math.floor(prevR) && this.sample(this.v, t) > 0.02) out.push({ t, side: "R" });
      prevL = p; prevR = p + 0.5;
    }
    return out;
  }
}

/** Distance covered at time t by a speed profile (no walker needed). */
export const distanceAt = (speed: SpeedKey[], t: number, d0 = 0) => {
  const w = { speedAt: Walker.prototype.speedAt, def: { speed } } as unknown as Walker;
  let d = d0;
  for (let x = speed[0][0]; x < t; x += DT) d += w.speedAt(x) * DT;
  return d;
};

/**
 * Scale the cruise speed of a profile so the walk covers exactly `dist` by `tEnd`
 * (`keys(v)` builds the profile for a cruise speed v; bisection, deterministic).
 */
export const fitCruise = (keys: (v: number) => SpeedKey[], dist: number, tEnd: number) => {
  let lo = 0.05, hi = 3;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (distanceAt(keys(m), tEnd) < dist) lo = m; else hi = m;
  }
  return keys((lo + hi) / 2);
};

const D = Math.PI / 180;

/**
 * A walking body: `base` preset at the walker's position, plus gait motion and planted legs.
 * `amtOverride` scales the upper-body swing (e.g. smaller while holding a phone).
 */
export const walkBody = (w: Walker, base: BodyName = "stand", mod?: (p: Pose, t: number) => void) => (t: number): Pose => {
  const st = w.at(t);
  const spec = w.def.spec;
  const p = clonePose(BODY[base]({ x: st.pos[0], y: st.pos[1], z: st.pos[2], yaw: st.yaw }, spec, t));
  const a = Math.min(1, st.amt);
  const c = Math.cos(2 * Math.PI * st.phi);
  p.hipY = p.hipY - 0.008 - 0.024 * a + 0.011 * a * Math.cos(4 * Math.PI * (st.phi - 0.3));
  p.hips = [p.hips[0] + 3 * D * a, p.hips[1] - 6 * D * a * c, p.hips[2] + 2.2 * D * a * Math.sin(2 * Math.PI * (st.phi - 0.3))];
  p.chest = [p.chest[0] + 1.5 * D * a, p.chest[1] + 8 * D * a * c, p.chest[2]];
  p.neck = [p.neck[0] - 1 * D * a, p.neck[1] - 2 * D * a * c, p.neck[2]];
  p.armL = { ...p.armL, sw: p.armL.sw - 0.34 * a * c, el: p.armL.el + 0.1 * a + 0.12 * a * Math.max(0, -c) };
  p.armR = { ...p.armR, sw: p.armR.sw + 0.34 * a * c, el: p.armR.el + 0.1 * a + 0.12 * a * Math.max(0, c) };
  const f = w.feet(t);
  p.legL = { ...p.legL, ik: { t: f.L.t, q: f.L.q, w: 1 } };
  p.legR = { ...p.legR, ik: { t: f.R.t, q: f.R.q, w: 1 } };
  if (mod) mod(p, t);
  return p;
};

/** World eye position of a walking character (for look-at between characters, no recursion). */
export const eyeOf = (w: Walker, t: number): V3 => {
  const st = w.at(t);
  const h = (DIMS.pelvisH + DIMS.spineY + DIMS.chestY + DIMS.neckY + DIMS.headY + DIMS.headCenter[1]) * w.def.spec.scale;
  return [st.pos[0] + w.dir[0] * 0.08, st.pos[1] + h - 0.03, st.pos[2] + w.dir[2] * 0.08];
};
