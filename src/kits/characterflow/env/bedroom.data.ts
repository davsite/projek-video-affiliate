// Bedroom layout data (Node-safe) — the Bedroom component draws it, the director plans on it.

import type { V3 } from "../character/spec.ts";
import type { BedFrame } from "./Blanket.tsx";

export type BedroomLayout = {
  room: { x0: number; x1: number; z0: number; z1: number; h: number };
  bed: BedFrame & { z0: number };
  pillow: V3;
  nightstand: { x: number; z: number; w: number; d: number; h: number };
  lamp: V3;
  clock: V3;
  window: { z0: number; z1: number; y0: number; y1: number };
  palette: { wall: string; floor: string; duvet: string; duvetInk: string; cuff: string; sheet: string; headboard: string; wood: string; accent: string };
};

export const BEDROOM: BedroomLayout = {
  room: { x0: -2.4, x1: 2.0, z0: -1.3, z1: 2.8, h: 2.75 },
  bed: { x: -0.05, z0: -1.14, z1: 1.0, halfW: 0.74, top: 0.56 },
  pillow: [-0.16, 0.62, -0.86],
  nightstand: { x: -1.08, z: -0.74, w: 0.48, d: 0.44, h: 0.58 },
  lamp: [-1.14, 0.58, -0.84],
  clock: [-0.99, 0.58, -0.6],
  window: { z0: -0.95, z1: 0.35, y0: 0.95, y1: 2.25 },
  palette: { wall: "#8ea6c4", floor: "#a77b55", duvet: "#9ec3ea", duvetInk: "#f5d77a", cuff: "#e0dbd0", sheet: "#e3dfd6", headboard: "#2f7d84", wood: "#c89a6a", accent: "#f2b544" },
};

