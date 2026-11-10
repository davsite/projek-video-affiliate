// Camera director: a spherical rig (target, azimuth, elevation, distance, fov) sampled from
// C1 keyframe tracks, so moves hand over without kinks and nothing depends on wall time.

import { sample, type Key } from "../motion/track.ts";
import type { Shot } from "../render/Post.tsx";

const D = Math.PI / 180;

/** Track channels: [targetX, targetY, targetZ, azimuthDeg, elevationDeg, distance, fovDeg]. */
export type RigKeys = Key[];

export const shotAt = (rig: RigKeys, frame: number, lens: { aperture: number; maxBlur: number; exposure: number }): Shot => {
  const [tx, ty, tz, az, el, dist, fov] = sample(rig, frame);
  const pos: [number, number, number] = [
    tx + dist * Math.cos(el * D) * Math.sin(az * D),
    ty + dist * Math.sin(el * D),
    tz + dist * Math.cos(el * D) * Math.cos(az * D),
  ];
  return { pos, target: [tx, ty, tz], fov, focus: dist, ...lens };
};
