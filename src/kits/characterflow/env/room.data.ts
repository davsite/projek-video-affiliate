// Indoor set kit (Node-safe data). A room is a box — back wall at z0, side walls at x0 / x1, the camera
// side (+z) open — with windows and a door cut into the walls and a list of furniture pieces. Room.tsx
// draws a layout; roomEnv() (registry.ts) derives the director's data from it: camera bounds, keep-out
// zones, seats, marks and the light per time of day. A new indoor environment is one more layout here.

import type { V3 } from "../character/spec.ts";
import type { Seat } from "../locomotion/stand.ts";

export type Wall = "back" | "left" | "right";
/** an opening along a wall: back wall → x from a to b, side walls → z from a to b */
export type Opening = { wall: Wall; a: number; b: number; y0: number; y1: number; kind: "window" | "door" };
type XZ = [number, number];
/** yaw = the direction a person using the piece faces (0 = +z, toward the cameras) */
export type Piece =
  | { k: "desk"; at: XZ; yaw?: number; w?: number; d?: number; top?: ("laptop" | "books" | "mug" | "monitor" | "plant")[]; seat?: string; color?: string }
  | { k: "schoolDesk"; at: XZ; yaw?: number; seat?: string }
  | { k: "chair"; at: XZ; yaw?: number; seat?: string; color?: string }
  | { k: "stool"; at: XZ; yaw?: number; seat?: string }
  | { k: "sofa"; at: XZ; yaw?: number; w?: number; seats?: string[]; color?: string }
  | { k: "armchair"; at: XZ; yaw?: number; seat?: string; color?: string }
  | { k: "coffeeTable"; at: XZ; yaw?: number; w?: number; d?: number }
  | { k: "cafeTable"; at: XZ; r?: number; cups?: number }
  | { k: "counter"; at: XZ; yaw?: number; w?: number; d?: number; h?: number; machine?: boolean }
  | { k: "shelf"; at: XZ; yaw?: number; w?: number; h?: number }
  | { k: "board"; at: XZ; yaw?: number; w?: number; h?: number; y?: number; style?: "white" | "chalk" | "menu" }
  | { k: "tv"; at: XZ; yaw?: number; w?: number }
  | { k: "plant"; at: XZ; s?: number }
  | { k: "rug"; at: XZ; w: number; d: number; color: string; yaw?: number }
  | { k: "frame"; at: XZ; yaw?: number; y?: number; w?: number; h?: number; colors?: [string, string, string] }
  | { k: "clock"; at: XZ; yaw?: number; y?: number }
  | { k: "dispenser"; at: XZ; yaw?: number }
  | { k: "cabinet"; at: XZ; yaw?: number; w?: number; h?: number; d?: number; color?: string }
  | { k: "lamp"; at: XZ; y: number; style?: "pendant" | "tube" };

export type RoomLayout = {
  id: string;
  room: { x0: number; x1: number; z0: number; z1: number; h: number };
  openings: Opening[];
  pieces: Piece[];
  marks: Record<string, { pos: V3; yaw: number; what: string }>;
  palette: { wall: string; wallLow?: string; floor: string; floorKind: "wood" | "tile" | "carpet"; trim: string; accent: string; ceiling?: string };
  /** what is seen through the windows by day */
  view: "city" | "garden" | "street";
  /** sound of the room */
  ambience: "room" | "class" | "office" | "cafe";
  /** horizontal direction cameras prefer around a subject (default +z) */
  viewSide?: V3;
  /** a home (people wear socks indoors) */
  home?: boolean;
};

const FW = (yaw: number): XZ => [Math.sin(yaw), Math.cos(yaw)];
const R = (yaw: number, lx: number, lz: number): XZ => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];

/** Chair offset behind a desk (the sitter faces the desk's yaw). */
export const DESK_CHAIR = 0.62;
export const SEAT_H = { chair: 0.47, stool: 0.62, sofa: 0.45, schoolDesk: 0.45 };

/** Every seat a layout offers (pelvis point on the seat, facing yaw). */
export const roomSeats = (L: RoomLayout): Record<string, Seat> => {
  const out: Record<string, Seat> = {};
  for (const p of L.pieces) {
    const yaw = "yaw" in p && p.yaw !== undefined ? p.yaw : 0;
    const f = FW(yaw);
    if ((p.k === "desk" || p.k === "schoolDesk") && p.seat) {
      const back = p.k === "desk" ? DESK_CHAIR : 0.5;
      out[p.seat] = { pos: [p.at[0] - f[0] * back, 0, p.at[1] - f[1] * back], yaw, height: p.k === "desk" ? SEAT_H.chair : SEAT_H.schoolDesk };
    }
    if ((p.k === "chair" || p.k === "stool") && p.seat) out[p.seat] = { pos: [p.at[0] + f[0] * 0.03, 0, p.at[1] + f[1] * 0.03], yaw, height: p.k === "stool" ? SEAT_H.stool : SEAT_H.chair };
    if (p.k === "armchair" && p.seat) out[p.seat] = { pos: [p.at[0] + f[0] * 0.06, 0, p.at[1] + f[1] * 0.06], yaw, height: SEAT_H.sofa };
    if (p.k === "sofa" && p.seats) {
      const w = p.w ?? 2.0, n = p.seats.length;
      p.seats.forEach((id, i) => {
        const lx = -w / 2 + 0.25 + ((w - 0.5) * (i + 0.5)) / n;
        const o = R(yaw, lx, 0.06);
        out[id] = { pos: [p.at[0] + o[0], 0, p.at[1] + o[1]], yaw, height: SEAT_H.sofa };
      });
    }
  }
  return out;
};

/** Keep-out spheres for cameras: tall furniture and the walls' near zone. */
export const roomBlockers = (L: RoomLayout): { c: V3; r: number }[] => {
  const out: { c: V3; r: number }[] = [];
  for (const p of L.pieces) {
    const [x, z] = p.at;
    switch (p.k) {
      case "shelf": out.push({ c: [x, 1.0, z], r: Math.max(0.55, (p.w ?? 1) * 0.55) }); break;
      case "counter": out.push({ c: [x, 0.6, z], r: 0.6 }); break;
      case "plant": out.push({ c: [x, 0.8, z], r: 0.45 * (p.s ?? 1) }); break;
      case "dispenser": out.push({ c: [x, 0.7, z], r: 0.35 }); break;
      case "cabinet": out.push({ c: [x, (p.h ?? 0.9) / 2, z], r: 0.45 }); break;
      case "desk": out.push({ c: [x, 0.5, z], r: 0.5 }); break;
      case "cafeTable": out.push({ c: [x, 0.5, z], r: 0.4 }); break;
      case "sofa": case "armchair": out.push({ c: [x, 0.45, z], r: 0.55 }); break;
      case "lamp": out.push({ c: [x, p.y, z], r: 0.3 }); break;
      default: break;
    }
  }
  return out;
};

// ── the four rooms ──────────────────────────────────────────────────────────
const H = Math.PI / 2;

/** An empty classroom after lessons: whiteboard, teacher's desk, two rows of school desks. */
export const CLASSROOM: RoomLayout = {
  id: "classroom",
  room: { x0: -3.6, x1: 3.6, z0: -2.4, z1: 4.4, h: 3.0 },
  openings: [
    { wall: "right", a: -1.6, b: -0.2, y0: 0.95, y1: 2.35, kind: "window" },
    { wall: "right", a: 0.6, b: 2.0, y0: 0.95, y1: 2.35, kind: "window" },
    { wall: "left", a: 1.6, b: 2.6, y0: 0, y1: 2.15, kind: "door" },
  ],
  pieces: [
    { k: "board", at: [0, -2.38], w: 3.2, h: 1.2, y: 1.0, style: "white" },
    { k: "desk", at: [-2.3, -1.3], yaw: 0.35, w: 1.2, d: 0.6, top: ["books", "mug"], color: "#b98b5e" },
    { k: "chair", at: [-2.55, -1.95], yaw: 0.35, color: "#6b7a8f" },
    // front row (the hero seats: free space between them and the board for the cameras)
    { k: "schoolDesk", at: [-0.55, 0.55], yaw: Math.PI, seat: "deskL" },
    { k: "schoolDesk", at: [0.55, 0.55], yaw: Math.PI, seat: "deskR" },
    { k: "schoolDesk", at: [-1.95, 0.55], yaw: Math.PI },
    { k: "schoolDesk", at: [1.95, 0.55], yaw: Math.PI },
    { k: "schoolDesk", at: [-1.95, 1.95], yaw: Math.PI },
    { k: "schoolDesk", at: [-0.55, 1.95], yaw: Math.PI },
    { k: "schoolDesk", at: [0.55, 1.95], yaw: Math.PI },
    { k: "schoolDesk", at: [1.95, 1.95], yaw: Math.PI },
    { k: "shelf", at: [-3.3, -0.4], yaw: H, w: 1.0, h: 1.4 },
    { k: "clock", at: [1.9, -2.38], y: 2.45 },
    { k: "frame", at: [-1.95, -2.38], y: 1.9, w: 0.5, h: 0.65, colors: ["#e63946", "#f1faee", "#1d3557"] },
    { k: "plant", at: [3.2, -2.0], s: 0.8 },
    { k: "lamp", at: [-1.2, -0.6], y: 2.95, style: "tube" },
    { k: "lamp", at: [1.2, -0.6], y: 2.95, style: "tube" },
    { k: "lamp", at: [0, 1.8], y: 2.95, style: "tube" },
  ],
  marks: {
    center: { pos: [0, 0, -0.75], yaw: 0, what: "in front of the class, facing the desks" },
    board: { pos: [-0.9, 0, -1.65], yaw: 0.2, what: "at the whiteboard, facing the class (a teacher / presenter)" },
    talkL: { pos: [-0.42, 0, -0.85], yaw: H, what: "two people talking in front of the class (left)" },
    talkR: { pos: [0.42, 0, -0.95], yaw: -H, what: "two people talking in front of the class (right)" },
    window: { pos: [2.9, 0, -0.9], yaw: H, what: "at the window, looking out" },
    door: { pos: [-2.9, 0, 2.1], yaw: H, what: "just inside the door" },
  },
  palette: { wall: "#f1e4c8", wallLow: "#8fb39a", floor: "#d8d2c4", floorKind: "tile", trim: "#f7f3ea", accent: "#3e7cb1" },
  view: "garden",
  ambience: "class",
  viewSide: [1, 0, 0.25],
};

/** A small modern office: two desks facing the room, a window wall with the city, shelves, dispenser. */
export const OFFICE: RoomLayout = {
  id: "office",
  room: { x0: -3.4, x1: 3.4, z0: -2.2, z1: 3.8, h: 2.9 },
  openings: [
    { wall: "back", a: -3.0, b: -0.6, y0: 0.7, y1: 2.5, kind: "window" },
    { wall: "back", a: 0.6, b: 3.0, y0: 0.7, y1: 2.5, kind: "window" },
    { wall: "left", a: 1.4, b: 2.4, y0: 0, y1: 2.15, kind: "door" },
  ],
  pieces: [
    { k: "desk", at: [-0.85, -0.55], yaw: 0, w: 1.3, d: 0.7, top: ["laptop", "mug"], seat: "deskA", color: "#d6d0c6" },
    { k: "desk", at: [0.85, -0.55], yaw: 0, w: 1.3, d: 0.7, top: ["laptop", "plant"], seat: "deskB", color: "#d6d0c6" },
    { k: "desk", at: [-2.45, 0.9], yaw: H, w: 1.2, d: 0.65, top: ["monitor", "books"], color: "#d6d0c6" },
    { k: "chair", at: [-3.05, 0.9], yaw: H, color: "#2f3542" },
    { k: "shelf", at: [3.05, 0.6], yaw: -H, w: 1.2, h: 1.9 },
    { k: "cabinet", at: [3.05, -1.3], yaw: -H, w: 1.0, h: 0.9, d: 0.5, color: "#d9d4cc" },
    { k: "dispenser", at: [-3.05, -1.75], yaw: H },
    { k: "plant", at: [0, -1.9], s: 1.1 },
    { k: "plant", at: [3.0, 2.2], s: 0.9 },
    { k: "frame", at: [-3.38, -0.4], yaw: H, y: 1.6, w: 0.9, h: 0.6, colors: ["#264653", "#2a9d8f", "#e9c46a"] },
    { k: "clock", at: [3.38, -0.3], yaw: -H, y: 2.2 },
    { k: "lamp", at: [-0.85, -0.3], y: 2.85, style: "pendant" },
    { k: "lamp", at: [0.85, -0.3], y: 2.85, style: "pendant" },
    { k: "lamp", at: [0, 1.9], y: 2.85, style: "tube" },
  ],
  marks: {
    center: { pos: [0, 0, 0.75], yaw: 0, what: "in the middle of the office, in front of the desks" },
    talkL: { pos: [-0.42, 0, 0.85], yaw: H, what: "two colleagues talking (left)" },
    talkR: { pos: [0.42, 0, 0.75], yaw: -H, what: "two colleagues talking (right)" },
    window: { pos: [1.9, 0, -1.55], yaw: Math.PI, what: "at the window, looking at the city" },
    dispenser: { pos: [-2.55, 0, -1.45], yaw: -H, what: "at the water dispenser" },
    door: { pos: [-2.75, 0, 1.9], yaw: H, what: "just inside the door" },
  },
  palette: { wall: "#d9dee2", wallLow: "#d9dee2", floor: "#8d939c", floorKind: "carpet", trim: "#eceae6", accent: "#2a9d8f" },
  view: "city",
  ambience: "office",
};

/** A cosy café: counter with an espresso machine and a chalk menu, small tables, street window. */
export const CAFE: RoomLayout = {
  id: "cafe",
  room: { x0: -3.6, x1: 3.6, z0: -2.6, z1: 4.0, h: 3.0 },
  openings: [
    { wall: "left", a: -1.8, b: 2.4, y0: 0.55, y1: 2.6, kind: "window" },
    { wall: "right", a: 1.6, b: 2.6, y0: 0, y1: 2.2, kind: "door" },
  ],
  pieces: [
    { k: "counter", at: [0.9, -1.95], w: 3.2, d: 0.7, h: 1.02, machine: true },
    { k: "board", at: [0.9, -2.58], w: 1.8, h: 0.9, y: 1.55, style: "menu" },
    { k: "shelf", at: [-1.9, -2.42], w: 1.2, h: 1.7 },
    // the hero table: two chairs facing each other across it (people in profile to the cameras)
    { k: "cafeTable", at: [0.1, 0.5], cups: 2 },
    { k: "chair", at: [-0.55, 0.5], yaw: H, seat: "tableL", color: "#8a5a3c" },
    { k: "chair", at: [0.75, 0.5], yaw: -H, seat: "tableR", color: "#8a5a3c" },
    { k: "cafeTable", at: [-2.6, 1.4], cups: 1 },
    { k: "chair", at: [-2.6, 0.8], yaw: 0, seat: "window", color: "#8a5a3c" },
    { k: "chair", at: [-2.6, 2.0], yaw: Math.PI, color: "#8a5a3c" },
    { k: "cafeTable", at: [2.7, 0.2], cups: 0 },
    { k: "chair", at: [2.7, -0.4], yaw: 0, color: "#8a5a3c" },
    { k: "stool", at: [-0.3, -1.25], yaw: Math.PI, seat: "bar" },
    { k: "stool", at: [0.6, -1.25], yaw: Math.PI },
    { k: "plant", at: [3.2, -2.2], s: 1.0 },
    { k: "plant", at: [-3.25, -2.2], s: 0.8 },
    { k: "frame", at: [3.58, -0.6], yaw: -H, y: 1.7, w: 0.7, h: 0.9, colors: ["#6d4c41", "#ffcc80", "#3e2723"] },
    { k: "lamp", at: [0.1, 0.5], y: 2.2, style: "pendant" },
    { k: "lamp", at: [-2.6, 1.4], y: 2.2, style: "pendant" },
    { k: "lamp", at: [0.9, -1.6], y: 2.3, style: "pendant" },
    { k: "lamp", at: [2.7, 0.2], y: 2.2, style: "pendant" },
  ],
  marks: {
    center: { pos: [0.1, 0, 1.45], yaw: 0, what: "standing in the middle of the café" },
    counter: { pos: [1.6, 0, -1.2], yaw: Math.PI, what: "at the counter, ordering (back to the cameras: use for 1–2 beats)" },
    talkL: { pos: [-0.35, 0, 1.6], yaw: H, what: "two people talking, standing (left)" },
    talkR: { pos: [0.5, 0, 1.5], yaw: -H, what: "two people talking, standing (right)" },
    window: { pos: [-2.95, 0, 0.0], yaw: -H, what: "at the window, looking at the street" },
    door: { pos: [2.9, 0, 2.1], yaw: -H, what: "just inside the door" },
  },
  palette: { wall: "#efe2cf", wallLow: "#6f4e37", floor: "#9c6b45", floorKind: "wood", trim: "#3b2a20", accent: "#d4a373" },
  view: "street",
  ambience: "cafe",
};

/** A family living room: sofa, coffee table, TV cabinet, window, front door, family photos. */
export const LIVINGROOM: RoomLayout = {
  id: "livingroom",
  room: { x0: -3.4, x1: 3.2, z0: -2.2, z1: 4.0, h: 2.85 },
  openings: [
    { wall: "left", a: -1.4, b: 0.6, y0: 0.8, y1: 2.3, kind: "window" },
    { wall: "back", a: 2.0, b: 2.95, y0: 0, y1: 2.15, kind: "door" },
  ],
  pieces: [
    { k: "sofa", at: [-0.3, -1.55], yaw: 0, w: 2.2, seats: ["sofaL", "sofaR"], color: "#5b7fa6" },
    { k: "armchair", at: [-2.45, 0.1], yaw: H, seat: "armchair", color: "#d68c45" },
    { k: "coffeeTable", at: [-0.3, -0.45], w: 1.1, d: 0.55 },
    { k: "rug", at: [-0.3, -0.6], w: 2.8, d: 2.0, color: "#c9a27e" },
    { k: "cabinet", at: [2.85, 0.3], yaw: -H, w: 1.6, h: 0.5, d: 0.45, color: "#8a6243" },
    { k: "tv", at: [2.85, 0.3], yaw: -H, w: 1.2 },
    { k: "shelf", at: [-2.75, -1.95], w: 0.9, h: 1.8 },
    { k: "plant", at: [1.35, -1.85], s: 1.0 },
    { k: "frame", at: [-0.7, -2.18], y: 1.75, w: 0.55, h: 0.45, colors: ["#f4a261", "#e76f51", "#264653"] },
    { k: "frame", at: [0.05, -2.18], y: 1.85, w: 0.45, h: 0.55, colors: ["#a8dadc", "#457b9d", "#1d3557"] },
    { k: "clock", at: [0.75, -2.18], y: 1.95 },
    { k: "lamp", at: [-0.3, -0.5], y: 2.8, style: "pendant" },
    { k: "lamp", at: [1.4, 1.6], y: 2.8, style: "pendant" },
  ],
  marks: {
    center: { pos: [0.4, 0, 0.9], yaw: 0, what: "standing in the middle of the room" },
    talkL: { pos: [-0.02, 0, 0.95], yaw: H, what: "two people talking, standing (left)" },
    talkR: { pos: [0.82, 0, 0.85], yaw: -H, what: "two people talking, standing (right)" },
    window: { pos: [-2.75, 0, -0.8], yaw: -H, what: "at the window" },
    door: { pos: [2.45, 0, -1.4], yaw: Math.PI, what: "at the front door (back to the cameras: 1–2 beats)" },
    tv: { pos: [1.6, 0, 0.3], yaw: H, what: "standing by the TV" },
  },
  palette: { wall: "#e6d9c6", wallLow: "#e6d9c6", floor: "#b08a64", floorKind: "wood", trim: "#ece8e0", accent: "#e9c46a" },
  view: "garden",
  ambience: "room",
  home: true,
};

export const ROOMS = { classroom: CLASSROOM, office: OFFICE, cafe: CAFE, livingroom: LIVINGROOM };
