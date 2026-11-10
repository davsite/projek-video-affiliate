// Campus layout data (Node-safe) — the Campus component draws it, the director plans on it.

import { mulberry32 } from "../lib/rng.ts";
import type { V3 } from "../character/spec.ts";

export type CampusLayout = {
  /** main walkway along X at z, from x0 to x1 */
  path: { x0: number; x1: number; z: number; width: number };
  /** a side path from the walkway to the building entrance at x */
  entrance: { x: number };
  building: { z: number; x0: number; x1: number; depth: number; floors: number; sign: string };
  trees: V3[];
  benches: { p: V3; yaw: number }[];
  lamps: V3[];
  bushes: V3[];
  bins: V3[];
  palette: { grass: string; paver: string; curb: string; wall: string; band: string; roof: string; glass: string; trunk: string; leaf: string[]; accent: string };
};

const ROW = (x0: number, x1: number, step: number, z: number, jitter = 0, seed = 1): V3[] => {
  const r = mulberry32(seed);
  const out: V3[] = [];
  for (let x = x0; x <= x1; x += step) out.push([x + (r() - 0.5) * jitter, 0, z + (r() - 0.5) * jitter]);
  return out;
};

export const CAMPUS: CampusLayout = {
  path: { x0: -34, x1: 34, z: 0, width: 2.8 },
  entrance: { x: 5.5 },
  building: { z: -12, x0: -26, x1: 22, depth: 9, floors: 3, sign: "GEDUNG KULIAH B" },
  // camera-side row only outside the central action zone (cameras live on the +z side)
  trees: [...ROW(-30, 30, 7.5, -3.3, 1.2, 3), ...ROW(-26.5, 30, 9, 3.6, 1.5, 7).filter((p) => p[0] < -24 || p[0] > 16)],
  benches: [-19, -5, 9.5, 23].map((x) => ({ p: [x, 0, -2.25] as V3, yaw: 0 })),
  lamps: ROW(-31, 31, 10, 2.2, 0, 1),
  bushes: [...ROW(-25, 21, 2.3, -7.1, 0.6, 11), ...ROW(-33, 33, 3.1, 5.6, 1.2, 13)],
  bins: [[-12.5, 0, -2.2], [16, 0, -2.2]],
  palette: { grass: "#7cc46b", paver: "#e6d8c3", curb: "#f4efe6", wall: "#f2e6d3", band: "#d9805f", roof: "#8a5a44", glass: "#8fc4ec", trunk: "#8a6243", leaf: ["#4fae5b", "#6cc46a", "#3f9a54"], accent: "#2f7d84" },
};

