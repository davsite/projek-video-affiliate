// Prop attach maths (pure, Node-safe): a prop's world matrix is a chain of states — resting
// somewhere, or held by a hand. When a hand takes a prop the grip offset is measured at that instant
// (prop rest × inverse hand), so the prop never jumps; when let go it settles onto its next rest pose.

import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { V3 } from "../character/spec.ts";

export const mat = (p: V3, yaw = 0, pitch = 0, roll = 0) => {
  const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, "YXZ"));
  return new Matrix4().compose(new Vector3(...p), q, new Vector3(1, 1, 1));
};
export const lerpMat = (a: Matrix4, b: Matrix4, k: number) => {
  if (k <= 0) return a.clone();
  if (k >= 1) return b.clone();
  const pa = new Vector3(), qa = new Quaternion(), sa = new Vector3(), pb = new Vector3(), qb = new Quaternion(), sb = new Vector3();
  a.decompose(pa, qa, sa);
  b.decompose(pb, qb, sb);
  return new Matrix4().compose(pa.lerp(pb, k), qa.slerp(qb, k), sa.lerp(sb, k));
};
/** Offset that keeps `prop` where it is when attached to `hand`. */
export const gripOffset = (hand: Matrix4, prop: Matrix4) => hand.clone().invert().multiply(prop);
export const held = (hand: Matrix4, offset: Matrix4) => hand.clone().multiply(offset);
export const toPQ = (m: Matrix4) => {
  const p = new Vector3(), q = new Quaternion(), s = new Vector3();
  m.decompose(p, q, s);
  return { position: [p.x, p.y, p.z] as V3, quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number] };
};
export const xform = (m: Matrix4, local: V3): V3 => {
  const v = new Vector3(...local).applyMatrix4(m);
  return [v.x, v.y, v.z];
};

