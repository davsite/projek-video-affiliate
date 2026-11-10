// Hand-prop poses (pure, Node-safe): the phone held in a right palm, the reading pose, and
// `gripFor` — derive the HAND from where the prop must be (wrist target + hand orientation for IK).

import { Matrix4, Quaternion, Vector3 } from "three";
import type { V3 } from "../character/spec.ts";

export const PHONE = { w: 0.072, h: 0.152, t: 0.009 };
export const BAG = { w: 0.3, h: 0.21, d: 0.085 };

/** Phone lying in a RIGHT palm (hand space): back on the palm (+X side), top toward the fingertips. */
export const PHONE_IN_HAND = (() => {
  const yAxis = new Vector3(0, -1, 0), zAxis = new Vector3(1, 0, 0);
  const xAxis = new Vector3().crossVectors(yAxis, zAxis);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
  return new Matrix4().compose(new Vector3(0.024, -0.085, 0.005), q, new Vector3(1, 1, 1));
})();

/**
 * Wrist target + hand orientation (world) that put `propInHand` at the world pose `prop`.
 * `handScale` = character scale × spec.handScale (the wrist frame is scaled by both).
 */
export const gripFor = (prop: Matrix4, propInHand: Matrix4, handScale: number) => {
  const pp = new Vector3(), pq = new Quaternion(), ps = new Vector3();
  prop.decompose(pp, pq, ps);
  const lp = new Vector3(), lq = new Quaternion(), ls = new Vector3();
  propInHand.decompose(lp, lq, ls);
  const hq = pq.clone().multiply(lq.clone().invert());
  const wrist = pp.clone().sub(lp.clone().multiplyScalar(handScale).applyQuaternion(hq));
  return { wrist: [wrist.x, wrist.y, wrist.z] as V3, q: [hq.x, hq.y, hq.z, hq.w] as [number, number, number, number] };
};

/** Phone held up to read: in front of and below the eyes, screen turned to them. */
export const phoneReadPose = (eye: V3, forward: V3, right: V3, lower = 0.27, out = 0.27, side = -0.04) => {
  const f = new Vector3(...forward).setY(0).normalize();
  const r = new Vector3(...right).normalize();
  const p = new Vector3(...eye).addScaledVector(f, out).add(new Vector3(0, -lower, 0)).addScaledVector(r, side);
  const z = new Vector3(...eye).sub(p).normalize();
  const y = new Vector3(0, 1, 0).addScaledVector(z, -z.y).normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return new Matrix4().compose(p, q, new Vector3(1, 1, 1));
};

