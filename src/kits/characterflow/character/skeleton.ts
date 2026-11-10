// Forward kinematics + 2-bone arm IK. The renderer (Character.tsx) nests its groups with exactly these
// local matrices, so anything a performance asks about the body — where the eyes are, where the right
// hand is, which way the chest faces — is answered by the same maths that draws it. Props held in a
// hand, cameras framing a face, and look-at / reach targets all go through here.

import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { Arm, IK, Leg, Pose } from "./pose.ts";
import { DIMS, type CharacterSpec, type V3 } from "./spec.ts";

const m4 = () => new Matrix4();
const T = (x: number, y: number, z: number) => m4().makeTranslation(x, y, z);
const R = (e: Euler) => m4().makeRotationFromEuler(e);
const Q = (q: Quaternion) => m4().makeRotationFromQuaternion(q);
const mul = (...ms: Matrix4[]) => ms.reduce((a, b) => a.multiply(b), m4());

export type ArmRig = { shoulder: Matrix4; elbow: Matrix4; wrist: Matrix4; bend: number };
export type LegRig = { hip: Matrix4; knee: Matrix4; ankle: Matrix4 };
export type Skeleton = {
  /** local matrices (parent → child), in rig units; `root` carries world placement + spec scale */
  root: Matrix4; hips: Matrix4; spine: Matrix4; chest: Matrix4; neck: Matrix4; head: Matrix4; headGeo: Matrix4;
  armL: ArmRig; armR: ArmRig; legL: LegRig; legR: LegRig;
  /** world matrices of the main joints */
  W: { hips: Matrix4; chest: Matrix4; head: Matrix4; headGeo: Matrix4; wristL: Matrix4; wristR: Matrix4; kneeL: Matrix4; kneeR: Matrix4; ankleL: Matrix4; ankleR: Matrix4; elbowL: Matrix4; elbowR: Matrix4; shoulderL: Matrix4; shoulderR: Matrix4 };
};

const eul = (e: [number, number, number], extraPitch = 0) => new Euler(e[0] + extraPitch, e[1], -e[2], "YXZ");

/** Shoulder joint position in chest space. */
export const shoulderPos = (spec: CharacterSpec, s: number, shrug: number) =>
  new Vector3(s * DIMS.shoulder[0] * spec.build, DIMS.shoulder[1] + shrug * 0.032, DIMS.shoulder[2]);

// ── 2-bone IK (root joint → end joint), result in the parent's space ─────────
const ik2 = (S: Vector3, Tg: Vector3, pole: Vector3, UA: number, FA: number) => {
  const d0 = new Vector3().subVectors(Tg, S);
  const d = Math.min(Math.max(d0.length(), Math.abs(UA - FA) + 1e-3), UA + FA - 1e-3);
  const u = d0.normalize();
  const cosA = (UA * UA + d * d - FA * FA) / (2 * UA * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const w = pole.clone().addScaledVector(u, -pole.dot(u));
  if (w.lengthSq() < 1e-8) w.set(0, 0, -1).addScaledVector(u, -u.z);
  w.normalize();
  const upper = u.clone().multiplyScalar(cosA).addScaledVector(w, sinA).normalize();
  const E = S.clone().addScaledVector(upper, UA);
  const fore = new Vector3().subVectors(S.clone().addScaledVector(u, d), E).normalize();
  const bend = Math.acos(Math.min(1, Math.max(-1, upper.dot(fore))));
  const Y = upper.clone().negate();
  let Z = fore.clone().addScaledVector(upper, -fore.dot(upper));
  if (Z.lengthSq() < 1e-8) Z = w.clone().negate();
  Z.normalize();
  const X = new Vector3().crossVectors(Y, Z).normalize();
  Z.crossVectors(X, Y).normalize();
  return { q: new Quaternion().setFromRotationMatrix(m4().makeBasis(X, Y, Z)), bend };
};

const armRig = (spec: CharacterSpec, s: number, a: Arm, shrug: number): ArmRig => {
  const S = shoulderPos(spec, s, shrug);
  const fk = new Quaternion().setFromEuler(new Euler(-a.sw, s * a.tw, s * a.ab, "XZY"));
  let q = fk, el = a.el;
  if (a.ik && a.ik.w > 0) {
    if (a.ik.space !== "chest") throw new Error("IK target must be resolved to chest space before FK");
    const tg = new Vector3(a.ik.t[0], a.ik.t[1], a.ik.t[2]);
    const pole = new Vector3(a.ik.pole[0] * s, a.ik.pole[1], a.ik.pole[2]);
    const r = ik2(S, tg, pole, DIMS.upperArm, DIMS.foreArm);
    q = fk.clone().slerp(r.q, a.ik.w);
    el = el + (r.bend - el) * a.ik.w;
  }
  let wq = new Quaternion().setFromEuler(new Euler(a.wr[0], s * a.wr[1], s * a.wr[2], "XYZ"));
  if (a.ik && a.ik.q && a.ik.w > 0) {
    // hand orientation given in chest space: wrist = inverse(forearm) × hand
    const fore = q.clone().multiply(new Quaternion().setFromEuler(new Euler(-el, 0, 0)));
    const want = fore.invert().multiply(new Quaternion(...a.ik.q));
    wq = wq.slerp(want, a.ik.w);
  }
  return {
    shoulder: mul(T(S.x, S.y, S.z), Q(q)),
    elbow: mul(T(0, -DIMS.upperArm, 0), R(new Euler(-el, 0, 0))),
    wrist: mul(T(0, -DIMS.foreArm, 0), Q(wq)),
    bend: el,
  };
};

const legRig = (spec: CharacterSpec, s: number, l: Leg, Whips: Matrix4): LegRig => {
  const H = new Vector3(s * DIMS.hip[0] * spec.build, DIMS.hip[1], DIMS.hip[2]);
  if (l.ik && l.ik.w >= 0.5) {
    // planted leg: ankle on a world target, knee forward, foot turned to a world orientation
    const tg = new Vector3(...l.ik.t).applyMatrix4(Whips.clone().invert());
    const r = ik2(H, tg, new Vector3(s * 0.12, -0.05, 1), DIMS.thigh, DIMS.shin);
    const hq = new Quaternion();
    Whips.decompose(new Vector3(), hq, new Vector3());
    const kneeWorld = hq.clone().multiply(r.q).multiply(new Quaternion().setFromEuler(new Euler(-r.bend, 0, 0)));
    const ankle = kneeWorld.invert().multiply(new Quaternion(...l.ik.q));
    return {
      hip: mul(T(H.x, H.y, H.z), Q(r.q)),
      knee: mul(T(0, -DIMS.thigh, 0), R(new Euler(-r.bend, 0, 0))),
      ankle: mul(T(0, -DIMS.shin, 0), Q(ankle)),
    };
  }
  return {
    hip: mul(T(H.x, H.y, H.z), R(new Euler(-l.sw, s * l.tw, s * l.ab, "XZY"))),
    knee: mul(T(0, -DIMS.thigh, 0), R(new Euler(l.kn, 0, 0))),
    ankle: mul(T(0, -DIMS.shin, 0), R(new Euler(-l.an, 0, 0))),
  };
};

/** Torso-only chain (root → chest, neck, head) — used to resolve IK and look targets. */
const torso = (p: Pose, spec: CharacterSpec, breathPitch = 0) => {
  const root = mul(T(p.x, p.y, p.z), R(new Euler(0, p.yaw, 0)), m4().makeScale(spec.scale, spec.scale, spec.scale));
  const hips = mul(T(0, DIMS.pelvisH + p.hipY, 0), R(eul(p.hips)));
  const spine = mul(T(0, DIMS.spineY, 0), R(eul(p.spine)));
  const chest = mul(T(0, DIMS.chestY, 0), R(eul(p.chest, breathPitch)));
  const neck = mul(T(0, DIMS.neckY, -0.01), R(eul(p.neck)));
  const head = mul(T(0, DIMS.headY, 0.01), R(eul(p.head)));
  const hc = DIMS.headCenter;
  const headGeo = mul(T(hc[0], hc[1], hc[2]), m4().makeScale(spec.headScale, spec.headScale, spec.headScale));
  const Whips = mul(root, hips);
  const Wchest = mul(Whips, spine, chest);
  const Whead = mul(Wchest, neck, head);
  return { root, hips, spine, chest, neck, head, headGeo, Whips, Wchest, Whead, WheadGeo: mul(Whead, headGeo) };
};

/** Breathing as a chest pitch (rad) at time t — shared by the renderer and the skeleton. */
export const breathPitch = (p: Pose, t: number) => p.breath * 0.014 * Math.sin(t * p.breathRate * Math.PI * 2);

export const skeleton = (p: Pose, spec: CharacterSpec, t = 0): Skeleton => {
  const b = torso(p, spec, breathPitch(p, t));
  const armL = armRig(spec, 1, p.armL, p.shrug), armR = armRig(spec, -1, p.armR, p.shrug);
  const legL = legRig(spec, 1, p.legL, b.Whips), legR = legRig(spec, -1, p.legR, b.Whips);
  const hs = spec.handScale;
  const handS = m4().makeScale(hs, hs, hs);
  const wShL = mul(b.Wchest, armL.shoulder), wShR = mul(b.Wchest, armR.shoulder);
  const wElL = mul(wShL, armL.elbow), wElR = mul(wShR, armR.elbow);
  const wKL = mul(b.Whips, legL.hip, legL.knee), wKR = mul(b.Whips, legR.hip, legR.knee);
  return {
    root: b.root, hips: b.hips, spine: b.spine, chest: b.chest, neck: b.neck, head: b.head, headGeo: b.headGeo,
    armL, armR, legL, legR,
    W: {
      hips: b.Whips, chest: b.Wchest, head: b.Whead, headGeo: b.WheadGeo,
      shoulderL: wShL, shoulderR: wShR, elbowL: wElL, elbowR: wElR,
      wristL: mul(wElL, armL.wrist, handS), wristR: mul(wElR, armR.wrist, handS),
      kneeL: wKL, kneeR: wKR, ankleL: mul(wKL, legL.ankle), ankleR: mul(wKR, legR.ankle),
    },
  };
};

/** Turn an IK target given in head or world space into chest space for this pose. */
export const resolveIK = (ik: IK, p: Pose, spec: CharacterSpec, side: 1 | -1): IK => {
  if (ik.space === "chest") return { ...ik, t: [ik.t[0] * side, ik.t[1], ik.t[2]] };
  const b = torso(p, spec);
  const v = new Vector3(...ik.t);
  if (ik.space === "head") {
    v.x *= side;
    v.applyMatrix4(mul(b.neck, b.head, b.headGeo));
  } else {
    v.applyMatrix4(b.Wchest.clone().invert());
  }
  let q = ik.q;
  if (q && ik.space === "world") {
    const cq = new Quaternion();
    b.Wchest.decompose(new Vector3(), cq, new Vector3());
    const r = cq.invert().multiply(new Quaternion(...q));
    q = [r.x, r.y, r.z, r.w];
  }
  return { ...ik, t: [v.x, v.y, v.z], space: "chest", q };
};

/** Direction from the head to a world point, in chest space → [yaw, pitch] for neck+head+eyes. */
export const lookAngles = (p: Pose, spec: CharacterSpec, w: V3): [number, number] => {
  const b = torso(p, spec);
  const inv = b.Wchest.clone().invert();
  const tgt = new Vector3(...w).applyMatrix4(inv);
  const eye = new Vector3(0, 0, 0.06).applyMatrix4(mul(b.neck, b.head, b.headGeo));
  const d = tgt.sub(eye);
  const yaw = Math.atan2(d.x, d.z);
  const pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z));
  return [yaw, pitch];
};

export const point = (m: Matrix4, local: V3 = [0, 0, 0]): V3 => {
  const v = new Vector3(...local).applyMatrix4(m);
  return [v.x, v.y, v.z];
};

/** World position of a point on the face (head units, e.g. [0, 0.01, 0.1] = between the eyes). */
export const facePoint = (sk: Skeleton, local: V3 = [0, 0.005, 0.1]) => point(sk.W.headGeo, local);
/** World forward direction of the face. */
export const faceDir = (sk: Skeleton): V3 => {
  const a = new Vector3(...facePoint(sk, [0, 0, 0])), b = new Vector3(...facePoint(sk, [0, 0, 1]));
  const d = b.sub(a).normalize();
  return [d.x, d.y, d.z];
};
