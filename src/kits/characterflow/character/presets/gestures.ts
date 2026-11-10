// Arm + hand gesture presets, written for his LEFT arm; the rig mirrors them for the right
// (FK by side, chest/head IK targets by x). World-space targets (reaching for a prop) are not
// mirrored — build those with `reach()` at performance time.
// IK targets are wrist positions; chest space is in rig metres, head space in head units.

import { arm0, HAND0, type Arm, type Hand, type IK } from "../pose.ts";
import type { V3 } from "../spec.ts";

export type Gesture = { arm: Arm; hand: Hand };

const hand = (o: Partial<Hand>): Hand => ({ ...HAND0, ...o });
export const HANDS = {
  relaxed: hand({}),
  soft: hand({ curl: 0.25, index: 0.2, thumb: 0.2, spread: 0.15 }),
  open: hand({ curl: 0.06, index: 0.04, thumb: 0.05, spread: 0.6 }),
  fist: hand({ curl: 1.05, index: 1.0, thumb: 0.9, spread: 0 }),
  grip: hand({ curl: 0.72, index: 0.62, thumb: 0.65, spread: 0.05 }),
  pen: hand({ curl: 0.85, index: 0.45, thumb: 0.7, spread: 0 }),
  point: hand({ curl: 1.0, index: 0.0, thumb: 0.8, spread: 0 }),
  claw: hand({ curl: 0.55, index: 0.5, thumb: 0.4, spread: 0.7 }),
  flat: hand({ curl: 0.08, index: 0.06, thumb: 0.12, spread: 0.12 }),
};

const ik = (t: V3, space: IK["space"], pole: V3, w = 1): IK => ({ t, space, pole, w });
const fk = (o: Partial<Arm>): Arm => ({ ...arm0(), ...o });
const g = (arm: Arm, h: Hand): Gesture => ({ arm, hand: h });

export const GESTURE = {
  rest: g(fk({}), HANDS.relaxed),
  hangLoose: g(fk({ sw: 0.02, ab: 0.06, el: 0.12 }), HANDS.soft),
  /** lying: arm along the body on top of the blanket */
  lieSide: g(fk({ sw: 0.1, ab: 0.24, el: 0.3, wr: [0, 0, 0.2] }), HANDS.soft),
  /** sitting: hand resting on the thigh */
  onLap: g(fk({ wr: [0.35, 0, 0.25], ik: ik([0.14, -0.27, 0.27], "chest", [1, -0.3, -0.6]) }), HANDS.soft),
  /** hands meeting over the lap, fingers fidgeting */
  clasp: g(fk({ ik: ik([0.05, -0.26, 0.31], "chest", [1, -0.5, -0.4]), wr: [0.2, 0.3, 0.5] }), HANDS.grip),
  /** palm flat on the chest (calming breath) */
  onChest: g(fk({ ik: ik([0.1, -0.06, 0.2], "chest", [1, -1, -0.2]), wr: [-0.3, 0.2, 1.25] }), HANDS.flat),
  onBelly: g(fk({ ik: ik([0.05, -0.2, 0.25], "chest", [1, -0.9, 0]), wr: [0, 0, 0.8] }), HANDS.flat),
  /** fingertips to the temple — "wait, what did I say?" */
  temple: g(fk({ ik: ik([0.14, -0.075, 0.075], "head", [0.6, -0.6, 1]), wr: [0, 0.2, -0.25] }), hand({ curl: 0.35, index: 0.12, thumb: 0.5, spread: 0.2 })),
  /** rubbing the back of the neck */
  rubNeck: g(fk({ ik: ik([0.07, -0.2, -0.13], "head", [1, 0.45, 0.25]), wr: [0.4, 0, -0.6] }), HANDS.soft),
  /** chin on the knuckles — thinking */
  chin: g(fk({ ik: ik([0.01, -0.15, 0.1], "head", [1, -1, 0.3]), wr: [0, 0, 0.5] }), HANDS.fist),
  /** both hands over the face/temples — overwhelmed (use on both arms) */
  headInHands: g(fk({ ik: ik([0.105, -0.12, 0.085], "head", [0.8, -1, 0.4]), wr: [0, 0.55, 0.15] }), HANDS.claw),
  /** fingers in the hair above the ears */
  grabHair: g(fk({ ik: ik([0.125, -0.02, -0.02], "head", [1, -0.2, 0.2]), wr: [0, 0.5, -0.4] }), HANDS.claw),
  /** palm up shrug */
  palmUp: g(fk({ sw: 0.42, ab: 0.34, tw: 0.9, el: 1.35, wr: [0, 0, -0.35] }), HANDS.open),
  /** open explaining hand, forearm forward */
  explain: g(fk({ sw: 0.55, ab: 0.22, tw: 0.6, el: 1.25, wr: [-0.2, 0, -0.2] }), HANDS.open),
  point: g(fk({ sw: 1.25, ab: 0.18, tw: 0.2, el: 0.15, wr: [0, 0, 0] }), HANDS.point),
  pointUp: g(fk({ sw: 0.5, ab: 0.2, tw: 0.3, el: 1.9, wr: [0, 0, 0] }), HANDS.point),
  crossArms: g(fk({ ik: ik([-0.1, -0.06, 0.2], "chest", [1, -1, 0.2]), wr: [0, 0, 0.6] }), HANDS.flat),
  /** hand behind the head — relaxed, lying or leaning */
  behindHead: g(fk({ ik: ik([0.085, 0.02, -0.15], "head", [1, 1.2, -0.4]), wr: [0, 0, -0.3] }), HANDS.soft),
  /** cover mouth (embarrassed / shock) */
  coverMouth: g(fk({ ik: ik([0.03, -0.21, 0.13], "head", [1, -1, 0.2]), wr: [0, 0.3, 0.9] }), HANDS.flat),
  /** holding a book/notebook in front of the body (left hand under it) */
  holdBook: g(fk({ ik: ik([0.05, -0.29, 0.36], "chest", [1, -1, -0.2]), wr: [0.25, 0, 0.6] }), HANDS.grip),
  wave: g(fk({ sw: 0.3, ab: 0.9, tw: 0.4, el: 1.7, wr: [0, 0, 0] }), HANDS.open),
  /** a greeting that stops halfway (hand at chest height, unsure) */
  halfWave: g(fk({ sw: 0.62, ab: 0.42, tw: 0.55, el: 1.75, wr: [0.1, 0, -0.2] }), hand({ curl: 0.22, index: 0.12, thumb: 0.2, spread: 0.45 })),
  /** hand into the trouser pocket (same side) */
  pocket: g(fk({ ik: ik([0.15, -0.44, 0.06], "chest", [1, 0.3, -0.6]), wr: [0, 0, 0.3] }), HANDS.grip),
  /** palm over the eyes and forehead — "aduh" */
  facepalm: g(fk({ ik: ik([0.035, -0.035, 0.165], "head", [1, -1.2, 0.25]), wr: [-0.1, 0.15, 0.2] }), HANDS.flat),
  /** index finger at his own chest — "me?" */
  pointSelf: g(fk({ ik: ik([-0.04, -0.06, 0.24], "chest", [1, -1, 0]), wr: [0, 0, 0.4] }), HANDS.point),
  thumbsUp: g(fk({ sw: 0.95, ab: 0.25, tw: 0.9, el: 1.5, wr: [0, 0, -0.3] }), hand({ curl: 1.05, index: 1.0, thumb: 0, spread: 0 })),
  /** scratching the side of the head — confused */
  scratchHead: g(fk({ ik: ik([0.115, 0.02, -0.02], "head", [1, 0.3, 0.3]), wr: [0, 0.3, -0.5] }), HANDS.claw),
  /** hands on hips — confident / waiting */
  onHip: g(fk({ ik: ik([0.2, -0.38, 0.02], "chest", [1, 0.2, -1]), wr: [0, 0, 1.2] }), HANDS.fist),
  /** pointing forward at something / someone */
  pointFwd: g(fk({ sw: 1.3, ab: 0.12, tw: 0.15, el: 0.15, wr: [0, 0, 0] }), HANDS.point),
};

/** Talking with the hands: an explaining hand that moves in small beats. */
export const explaining = (rate = 1.3) => (t: number): Gesture => ({
  arm: fk({ sw: 0.55 + 0.12 * Math.sin(t * rate * 6.3), ab: 0.22, tw: 0.6, el: 1.25 + 0.15 * Math.sin(t * rate * 6.3 + 1), wr: [-0.2, 0, -0.2] }),
  hand: HANDS.open,
});

/** Hello wave that keeps waving (rate in waves per second). */
export const waving = (rate = 2.2, size = 1) => (t: number): Gesture => ({
  arm: fk({ sw: 0.3, ab: 0.95 + 0.2 * size * Math.sin(t * rate * Math.PI * 2), tw: 0.4, el: 1.6 + 0.18 * size * Math.sin(t * rate * Math.PI * 2 + 1.1) }),
  hand: HANDS.open,
});

/** High five toward a world point (open palm forward). */
export const highFive = (p: V3, pole: V3 = [1, -0.5, -0.3]): Gesture => ({ arm: { ...arm0(), wr: [-0.6, 0, 0], ik: { t: p, space: "world", pole, w: 1 } }, hand: HANDS.open });

export type GestureName = keyof typeof GESTURE;

/** Wrist IK toward a world point (props, switches). */
export const reach = (t: V3, pole: V3 = [1, -0.6, -0.4], hnd: Hand = HANDS.grip, wr: Arm["wr"] = [0, 0, 0]): Gesture => ({
  arm: { ...arm0(), wr, ik: { t, space: "world", pole, w: 1 } },
  hand: hnd,
});
