// Environment registry (Node-safe data). An environment = a component that draws it (components.tsx)
// + this planning data: camera bounds and keep-out zones, the main walk line, standing marks, seats,
// prop points, ambience, and light/grade per time of day. The director only talks to this.
//
// Adding an environment: write `<name>.data.ts` (layout numbers) + `<Name>.tsx` (geometry), add an
// EnvData entry here and the component in components.tsx. Nothing else in the system changes.

import type { Grade } from "../render/FilmPost.tsx";
import type { LightState } from "../render/Lights.tsx";
import type { V3 } from "../character/spec.ts";
import type { Seat } from "../locomotion/stand.ts";
import { BEDROOM } from "./bedroom.data.ts";
import { CAMPUS } from "./campus.data.ts";
import { ROOMS, roomBlockers, roomSeats, type RoomLayout } from "./room.data.ts";

export type TimeOfDay = "day" | "night" | "sunset";
export type EnvData = {
  id: EnvId;
  name: string;
  /** cameras stay inside this box */
  bounds: { min: V3; max: V3 };
  /** spheres cameras must not enter or look through (canopies, furniture) */
  blockers: { c: V3; r: number }[];
  /** horizontal direction from the action toward where cameras belong (the open side of the set) */
  viewSide: V3;
  /** main straight walk line: through `meet`, along `dir`; characters keep `lane` m to their right */
  path: { meet: V3; dir: V3; lane: number; length: number } | null;
  /** standing marks (yaw: facing direction, 0 = +Z) */
  marks: Record<string, { pos: V3; yaw: number }>;
  seats: Record<string, Seat>;
  /** bedroom only: lying / sitting-in-bed anchors (pelvis point on the mattress) */
  bed?: { lie: V3; sit: V3; edge: number; top: number; lampTapLie: V3; lampTapSit: V3 };
  props: Record<string, V3>;
  /** plain-language list of the marks (for the validator and the docs) */
  markInfo?: Record<string, string>;
  /** indoor set (wide shots instead of the high establishing crane) */
  indoor: boolean;
  /** a home: people wear socks */
  home: boolean;
  ambience: "campus" | "room" | "class" | "office" | "cafe";
  times: TimeOfDay[];
  light: (time: TimeOfDay, focus: V3) => LightState;
  grade: (time: TimeOfDay) => Grade;
};
export type EnvId = "campus" | "bedroom" | "classroom" | "office" | "cafe" | "livingroom";

const P_OFF = { pos: [0, -50, 0] as V3, color: "#ffffff", i: 0, dist: 1 };
const SPOT_OFF = { pos: [0, 40, 0] as V3, target: [0, 0, 0] as V3, color: "#ffffff", i: 0, angle: 0.6, penumbra: 0.6, dist: 10 };
const G0: Grade = { exposure: 1, lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, contrast: 1, vignette: 0.22, grain: 0.016, bloom: 0.22, bloomRadius: 0.45, bloomThreshold: 1.05, flash: 0, flashColor: "#ffffff", black: 0, ao: 1 };

// ── campus ──────────────────────────────────────────────────────────────────
const campusBlockers = [
  ...CAMPUS.trees.flatMap((p) => [{ c: [p[0], 3.4, p[2]] as V3, r: 1.9 }, { c: [p[0], 1.2, p[2]] as V3, r: 0.45 }]),
  ...CAMPUS.lamps.map((p) => ({ c: [p[0], 1.8, p[2]] as V3, r: 0.35 })),
];
const campusBench = CAMPUS.benches.reduce((a, b) => (Math.abs(b.p[0] - -5) < Math.abs(a.p[0] - -5) ? b : a));
export const CAMPUS_ENV: EnvData = {
  id: "campus",
  name: "Kampus (jalur pedestrian, gedung kuliah, taman)",
  bounds: { min: [-32, 0.35, -10.5], max: [32, 9, 14] },
  blockers: campusBlockers,
  viewSide: [0, 0, 1],
  path: { meet: [0, 0, 0], dir: [1, 0, 0], lane: 0.38, length: 30 },
  marks: {
    center: { pos: [0, 0, 0.2], yaw: 0 },
    talkL: { pos: [-0.42, 0, 0.06], yaw: Math.PI / 2 },
    talkR: { pos: [0.42, 0, -0.06], yaw: -Math.PI / 2 },
    lawn: { pos: [2.5, 0, 3.0], yaw: -0.4 },
  },
  seats: {
    benchL: { pos: [campusBench.p[0] - 0.42, 0, campusBench.p[2] - 0.02], yaw: 0, height: 0.47 },
    benchR: { pos: [campusBench.p[0] + 0.42, 0, campusBench.p[2] - 0.02], yaw: 0, height: 0.47 },
  },
  props: {},
  indoor: false,
  home: false,
  ambience: "campus",
  times: ["day", "sunset"],
  light: (time, f) => ({
    bg: time === "sunset" ? "#f2b98a" : "#9cc9f0",
    fog: { color: time === "sunset" ? "#f6c9a0" : "#bcdcf5", density: 0.0022 },
    env: 0.32,
    hemi: { sky: time === "sunset" ? "#ffd7b0" : "#bfe0ff", ground: "#6f9e57", i: time === "sunset" ? 0.45 : 0.55 },
    moon: { dir: time === "sunset" ? [-0.75, 0.32, 0.55] : [-0.3, 0.78, 0.55], color: time === "sunset" ? "#ffc58a" : "#fff0d2", i: time === "sunset" ? 2.4 : 2.7, box: { min: [f[0] - 7, -0.2, f[2] - 7], max: [f[0] + 7, 5.5, f[2] + 6] } },
    spot: SPOT_OFF,
    pts: [P_OFF, P_OFF, P_OFF, P_OFF],
  }),
  grade: (time) => ({ ...G0, exposure: 0.95, lift: [0.0, 0.004, 0.012], gain: time === "sunset" ? [1.1, 0.98, 0.9] : [1.03, 1.0, 0.97], sat: 1.16, contrast: 1.1, vignette: 0.18, grain: 0.01, bloom: 0.12, bloomRadius: 0.45, bloomThreshold: 1.25 }),
};

// ── bedroom ─────────────────────────────────────────────────────────────────
const B = BEDROOM;
export const BEDROOM_ENV: EnvData = {
  id: "bedroom",
  name: "Kamar tidur (kasur, meja belajar, jendela)",
  bounds: { min: [B.room.x0 + 0.2, 0.35, B.room.z0 + 0.2], max: [B.room.x1 - 0.2, B.room.h - 0.25, 4.2] },
  blockers: [
    { c: [B.nightstand.x, 0.5, B.nightstand.z], r: 0.4 },
    { c: [B.room.x0 + 0.38, 0.75, 1.15], r: 0.55 },
    { c: [B.room.x1 - 0.38, 0.9, 0.85], r: 0.5 },
  ],
  viewSide: [0.25, 0, 1],
  path: { meet: [0.4, 0, 1.75], dir: [-1, 0, 0], lane: 0, length: 3.2 },
  marks: {
    rug: { pos: [1.0, 0, 1.25], yaw: 0 },
    window: { pos: [1.35, 0, -0.35], yaw: Math.PI / 2 },
    center: { pos: [0.3, 0, 1.75], yaw: 0 },
    talkL: { pos: [-0.1, 0, 1.75], yaw: Math.PI / 2 },
    talkR: { pos: [0.7, 0, 1.75], yaw: -Math.PI / 2 },
  },
  seats: {
    chair: { pos: [B.room.x0 + 0.38 + 0.45, 0, 1.28], yaw: 0, height: 0.495 },
    bedEdge: { pos: [0.55, 0, 0.55], yaw: Math.PI / 2, height: B.bed.top },
  },
  bed: { lie: [-0.16, B.bed.top, -0.1], sit: [-0.16, B.bed.top, -0.42], edge: B.bed.x + B.bed.halfW, top: B.bed.top, lampTapLie: [-0.86, 0.84, -0.8], lampTapSit: [-0.88, 0.88, -0.78] },
  props: { lamp: [B.lamp[0], B.lamp[1] + 0.3, B.lamp[2]] },
  indoor: true,
  home: true,
  ambience: "room",
  times: ["night", "day"],
  light: (time) =>
    time === "night"
      ? {
          bg: "#06090f", fog: { color: "#0b1324", density: 0 }, env: 0.2,
          hemi: { sky: "#5f7cc0", ground: "#1c1a24", i: 0.42 },
          moon: { dir: [0.86, 0.48, 0.2], color: "#9fb9ff", i: 3.0, box: { min: [-1.5, -0.1, -1.3], max: [2.1, 2.6, 2.8] } },
          spot: SPOT_OFF,
          pts: [P_OFF, P_OFF, { pos: [0.9, 1.9, 1.7], color: "#6f8cd0", i: 1.4, dist: 7 }, { pos: [0.55, 2.0, -0.35], color: "#8fb0ff", i: 1.5, dist: 4 }],
        }
      : {
          bg: "#dfeaf5", fog: { color: "#dfeaf5", density: 0 }, env: 0.5,
          hemi: { sky: "#fff4e0", ground: "#8a7058", i: 0.7 },
          moon: { dir: [0.86, 0.5, 0.15], color: "#fff0d6", i: 2.6, box: { min: [-1.5, -0.1, -1.3], max: [2.1, 2.6, 2.8] } },
          spot: SPOT_OFF,
          pts: [P_OFF, P_OFF, { pos: [0.9, 1.9, 2.2], color: "#ffffff", i: 1.2, dist: 7 }, P_OFF],
        },
  grade: (time) =>
    time === "night"
      ? { ...G0, exposure: 1.32, lift: [0.016, 0.026, 0.06], gain: [0.94, 1.0, 1.08], sat: 1.04, contrast: 1.04, vignette: 0.3, bloom: 0.3, bloomRadius: 0.6, bloomThreshold: 0.95 }
      : { ...G0, exposure: 0.95, lift: [0.01, 0.01, 0.015], gain: [1.02, 1.0, 0.96], sat: 1.1, contrast: 1.05, vignette: 0.16, grain: 0.01, bloom: 0.12, bloomThreshold: 1.25 },
};

// ── rooms (room.data.ts) ────────────────────────────────────────────────────
const ROOM_NAMES: Record<string, string> = {
  classroom: "Ruang kelas (papan tulis, meja-meja sekolah, jendela)",
  office: "Kantor kecil (dua meja kerja, jendela kota, rak, dispenser)",
  cafe: "Kafe (meja kasir + mesin kopi, menu, meja berdua, jendela jalan)",
  livingroom: "Ruang tamu / rumah (sofa, meja, TV, jendela, pintu depan)",
};
const ROOM_TIMES: Record<string, TimeOfDay[]> = { classroom: ["day", "sunset"], office: ["day", "night"], cafe: ["day", "night"], livingroom: ["day", "night"] };
const lampPts = (L: RoomLayout) => L.pieces.filter((p) => p.k === "lamp").map((p) => [p.at[0], (p as { y: number }).y - 0.35, p.at[1]] as V3);
/** The window the daylight comes through (its wall gives the sun direction). */
const sunDir = (L: RoomLayout, time: TimeOfDay): V3 => {
  const w = L.openings.find((o) => o.kind === "window")?.wall ?? "back";
  const low = time === "sunset" ? 0.3 : 0.5;
  return w === "left" ? [-0.85, low, 0.35] : w === "right" ? [0.85, low, 0.35] : [0.25, low, -0.85];
};
export const roomEnv = (L: RoomLayout): EnvData => {
  const { x0, x1, z0, z1, h } = L.room;
  const seats = roomSeats(L);
  const lamps = lampPts(L);
  const box = { min: [x0, -0.1, z0] as V3, max: [x1, h, z1] as V3 };
  const mk = (pos: V3, i: number, color: string) => ({ pos, color, i, dist: 7 });
  return {
    id: L.id as EnvId,
    name: ROOM_NAMES[L.id] ?? L.id,
    bounds: { min: [x0 + 0.25, 0.35, z0 + 0.3], max: [x1 - 0.25, h - 0.2, z1 - 0.25] },
    blockers: roomBlockers(L),
    viewSide: L.viewSide ?? [0, 0, 1],
    path: null,
    marks: Object.fromEntries(Object.entries(L.marks).map(([k, m]) => [k, { pos: m.pos, yaw: m.yaw }])),
    markInfo: Object.fromEntries(Object.entries(L.marks).map(([k, m]) => [k, m.what])),
    seats,
    props: {},
    indoor: true,
    home: !!L.home,
    ambience: L.ambience,
    times: ROOM_TIMES[L.id] ?? ["day", "night"],
    light: (time) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (time === "night") {
        const pts = [0, 1, 2].map((k) => (lamps[k] ? { ...mk(lamps[k], 2.3, "#ffc98a"), dist: 5.5 } : P_OFF));
        return {
          bg: "#0a0f1c", fog: { color: "#0a0f1c", density: 0 }, env: 0.16,
          hemi: { sky: "#6f7fb8", ground: "#241c16", i: 0.22 },
          moon: { dir: sunDir(L, "day").map((v, k) => (k === 1 ? 0.6 : v)) as V3, color: "#8fa6e0", i: 0.7, box },
          spot: SPOT_OFF,
          pts: [pts[0], pts[1], pts[2], mk([cx, 2.1, z1 - 0.6], 0.75, "#ffd9b0")],
        };
      }
      const sun = time === "sunset";
      return {
        bg: sun ? "#f2c29a" : "#dfeaf5", fog: { color: "#dfeaf5", density: 0 }, env: 0.5,
        // daylight is soft: pale walls and desks burn to white under a full sun
        hemi: { sky: sun ? "#ffe2c4" : "#fff4e0", ground: "#7a6a58", i: 0.6 },
        moon: { dir: sunDir(L, time), color: sun ? "#ffc58a" : "#fff0d6", i: sun ? 2.4 : 2.3, box },
        spot: SPOT_OFF,
        pts: [mk([cx - 1.2, 2.3, cz + 0.6], 0.5, "#fff6ea"), mk([cx + 1.2, 2.3, cz + 0.6], 0.5, "#fff6ea"), P_OFF, mk([cx, 2.0, z1 - 0.5], 0.7, "#ffffff")],
      };
    },
    grade: (time) =>
      time === "night"
        ? { ...G0, exposure: 1.2, lift: [0.012, 0.016, 0.04], gain: [1.06, 0.99, 0.9], sat: 1.06, contrast: 1.08, vignette: 0.3, bloom: 0.26, bloomRadius: 0.55, bloomThreshold: 1.0 }
        : { ...G0, exposure: 0.94, lift: [0.01, 0.01, 0.015], gain: time === "sunset" ? [1.08, 0.99, 0.92] : [1.02, 1.0, 0.97], sat: 1.12, contrast: 1.05, vignette: 0.16, grain: 0.01, bloom: 0.1, bloomThreshold: 1.3 },
  };
};

export const ENVS: Record<EnvId, EnvData> = {
  campus: CAMPUS_ENV,
  bedroom: BEDROOM_ENV,
  classroom: roomEnv(ROOMS.classroom),
  office: roomEnv(ROOMS.office),
  cafe: roomEnv(ROOMS.cafe),
  livingroom: roomEnv(ROOMS.livingroom),
};
