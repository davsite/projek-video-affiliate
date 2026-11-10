// Full-body pose presets. A preset is placed by an Anchor:
//   standing poses — a floor point, facing `yaw`;
//   bed poses      — a point on the mattress top under the pelvis, `yaw` = direction toward the feet.
// Arms here are only defaults; gestures (gestures.ts) override them per beat.

import { arm0, clonePose, restPose, walkCycle, type Pose } from "../pose.ts";
import { DIMS, type CharacterSpec } from "../spec.ts";

export type Anchor = { x: number; y: number; z: number; yaw: number };

const D = Math.PI / 180;

const at = (p: Pose, a: Anchor, spec: CharacterSpec, pelvisLift: number) => {
  p.x = a.x;
  p.z = a.z;
  p.yaw = a.yaw;
  p.y = a.y + pelvisLift - DIMS.pelvisH * spec.scale;
  return p;
};

export type BodyFn = (a: Anchor, spec: CharacterSpec, t: number) => Pose;

export const BODY: Record<
  "stand" | "standSlump" | "standCower" | "standProud" | "run" | "lie" | "sit" | "sitHunch" | "sitWrite" | "sitReachRight" | "lieReachRight",
  BodyFn
> = {
  stand: (a: Anchor, spec: CharacterSpec) => {
    const p = restPose();
    p.legL.kn = p.legR.kn = 0.05;
    p.legL.ab = p.legR.ab = 0.035;
    p.armL = { ...arm0(), sw: 0.02, ab: 0.12, el: 0.22 };
    p.armR = { ...arm0(), sw: 0.04, ab: 0.11, el: 0.26 };
    p.hips = [0, 0, 1.5 * D];
    p.chest = [-2 * D, 0, -1 * D];
    return at(p, a, spec, DIMS.pelvisH * spec.scale);
  },

  standSlump: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.stand(a, spec, 0);
    p.spine = [8 * D, 0, 0];
    p.chest = [14 * D, 0, 0];
    p.neck = [14 * D, 0, 0];
    p.head = [10 * D, 0, 0];
    p.shrug = 0.3;
    p.legL.kn = p.legR.kn = 0.12;
    p.hipY = -0.02;
    return p;
  },

  standCower: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.stand(a, spec, 0);
    p.hipY = -0.08;
    p.legL.kn = p.legR.kn = 0.4;
    p.legL.sw = p.legR.sw = 0.2;
    p.legL.an = p.legR.an = 0.18;
    p.spine = [14 * D, 0, 0];
    p.chest = [16 * D, 0, 0];
    p.neck = [10 * D, 0, 0];
    p.head = [16 * D, 0, 0];
    p.shrug = 0.8;
    return p;
  },

  standProud: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.stand(a, spec, 0);
    p.chest = [-7 * D, 0, 0];
    p.head = [-6 * D, 0, 0];
    p.hipY = 0.005;
    return p;
  },

  run: (a: Anchor, spec: CharacterSpec, t: number) => {
    const p = BODY.stand(a, spec, 0);
    p.spine = [10 * D, 0, 0];
    p.armL = { ...p.armL, el: 0.9 };
    p.armR = { ...p.armR, el: 0.9 };
    return walkCycle(p, t * 1.7, 1.55);
  },

  /** On his back in bed, head on the pillow, arms along the body. */
  lie: (a: Anchor, spec: CharacterSpec) => {
    const p = restPose();
    p.hips = [-90 * D, 0, 0];
    p.spine = [-3 * D, 0, 0];
    p.chest = [-4 * D, 0, 0];
    p.neck = [24 * D, 0, 0];
    p.head = [12 * D, 0, 0];
    p.legL = { sw: 1 * D, ab: 3 * D, tw: 6 * D, kn: 5 * D, an: -26 * D };
    p.legR = { sw: 1 * D, ab: 4 * D, tw: 8 * D, kn: 6 * D, an: -24 * D };
    p.armL = { ...arm0(), sw: 6 * D, ab: 14 * D, el: 0.32 };
    p.armR = { ...arm0(), sw: 6 * D, ab: 14 * D, el: 0.32 };
    p.breath = 0.8;
    p.breathRate = 0.2;
    return at(p, a, spec, 0.105);
  },

  /** Sitting up in bed, legs straight under the blanket, a soft slouch. */
  sit: (a: Anchor, spec: CharacterSpec) => {
    const p = restPose();
    const lean = -9 * D;
    p.hips = [lean, 0, 0];
    p.spine = [6 * D, 0, 0];
    p.chest = [7 * D, 0, 0];
    p.neck = [4 * D, 0, 0];
    p.head = [3 * D, 0, 0];
    p.legL = { sw: Math.PI / 2 + lean - 1 * D, ab: 4 * D, tw: 4 * D, kn: 7 * D, an: -30 * D };
    p.legR = { sw: Math.PI / 2 + lean - 2 * D, ab: 5 * D, tw: 6 * D, kn: 9 * D, an: -28 * D };
    p.armL = { ...arm0(), sw: 0.3, ab: 0.16, el: 0.7 };
    p.armR = { ...arm0(), sw: 0.3, ab: 0.16, el: 0.7 };
    return at(p, a, spec, 0.1);
  },

  /** Curled forward over the lap — overwhelmed. */
  sitHunch: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.sit(a, spec, 0);
    p.hips = [2 * D, 0, 0];
    p.legL.sw = Math.PI / 2 + 2 * D - 1 * D;
    p.legR.sw = Math.PI / 2 + 2 * D - 2 * D;
    p.legL.kn = p.legR.kn = 14 * D;
    p.spine = [16 * D, 0, 0];
    p.chest = [20 * D, 0, 0];
    p.neck = [16 * D, 0, 0];
    p.head = [16 * D, 0, 0];
    p.shrug = 0.55;
    return p;
  },

  /** Sitting tall, looking down at the lap (reading / writing). */
  sitWrite: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.sit(a, spec, 0);
    p.hips = [-4 * D, 0, 0];
    p.legL.sw = Math.PI / 2 - 4 * D - 1 * D;
    p.legR.sw = Math.PI / 2 - 4 * D - 2 * D;
    p.spine = [9 * D, 0, 0];
    p.chest = [11 * D, 3 * D, 0];
    p.neck = [18 * D, 0, 0];
    p.head = [16 * D, 0, 0];
    return p;
  },

  /** Sitting, leaning out to his right (toward a nightstand on that side). */
  sitReachRight: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.sit(a, spec, 0);
    // twist distributed low (hips/spine) so the shirt hem never swings out of the waist
    p.hips = [-2 * D, -12 * D, -8 * D];
    p.legL.sw = Math.PI / 2 - 2 * D;
    p.legR.sw = Math.PI / 2 - 3 * D;
    p.spine = [12 * D, -16 * D, -14 * D];
    p.chest = [8 * D, -5 * D, -5 * D];
    p.neck = [10 * D, -12 * D, 0];
    p.head = [12 * D, -8 * D, 4 * D];
    return p;
  },

  /** Lying, rolled a little to his right to reach the nightstand. */
  lieReachRight: (a: Anchor, spec: CharacterSpec) => {
    const p = BODY.lie(a, spec, 0);
    p.hips = [-90 * D, 0, -11 * D];
    p.spine = [-2 * D, -6 * D, -9 * D];
    p.chest = [-3 * D, -3 * D, -3 * D];
    p.neck = [18 * D, -22 * D, 0];
    p.head = [8 * D, -18 * D, 0];
    return p;
  },
};

export type BodyName = keyof typeof BODY;

/** Clone a preset result so beats can tweak it safely. */
export const bodyPose = (name: BodyName, a: Anchor, spec: CharacterSpec, t: number) => clonePose(BODY[name](a, spec, t));
