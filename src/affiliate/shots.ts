// The product inserts of this video, as pure functions of film time (seconds). Each insert cuts in over the
// character film on the words where the VO talks about the cable and the clip. Units: centimetres (see world.tsx).

import { ease, remap } from "../core/motion/easing.ts";
import type { Cam } from "../kits/characterflow/render/FilmPost.tsx";
import { CLIP_D, SLOT_R, SLOT_X, TOP_Y, seatY } from "./clip.ts";
import { CHARGER_OUT, PHONE, PLUG_LEN, type CableSpec, type ClipSpec, type V3 } from "./set.ts";

export type Mode = "night" | "day" | "hero";
export type Tag = { text: string; ok: boolean; t0: number; y?: number };
export type State = {
  cam: Cam;
  mode: Mode;
  focus: V3;
  shadow: number;
  clip?: ClipSpec;
  cables: CableSpec[];
  phone?: { p: V3; yaw?: number; tilt?: number; roll?: number };
  chair?: V3;
  rings: { p: V3; k: number; r: number; color?: string; normal?: "y" | "x" | "z" }[];
  sparkles: { c: V3; k: number; r: number; seed?: number }[];
  chip?: { text: string; t0: number };
  tags: Tag[];
  title?: { t0: number; t1?: number; text: string; sub: string };
  cta?: { t0: number };
  slotMarks?: { t0: number };
  fade?: number;
};
export type Insert = { id: string; t0: number; t1: number; at: (t: number) => State };

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────
const P = (t: number, a: number, b: number, e: (x: number) => number = ease.inOut) => e(remap(t, a, b));
const mixv = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const mixn = (a: number, b: number, u: number) => a + (b - a) * u;
/** damped bounce after time t0 (0 before) */
const bounce = (t: number, t0: number, amp: number, f = 9, d = 7) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * d) * Math.sin((t - t0) * f * Math.PI));
/** 0→1 progress of a short event (for rings / sparkles) */
const pulse = (t: number, t0: number, dur: number) => (t - t0) / dur;
const camMove = (t: number, a: number, b: number, c0: Cam, c1: Cam, e: (x: number) => number = ease.inOut): Cam => {
  const u = P(t, a, b, e);
  return { pos: mixv(c0.pos, c1.pos, u), target: mixv(c0.target, c1.target, u), fov: mixn(c0.fov, c1.fov, u), near: 0.5, far: 1200, aperture: c0.aperture, maxBlur: c0.maxBlur, focus: c0.focus };
};

const WHITE = "#f3f2ee", GREY = "#3a3e46";
const R0 = 0.2; // the phone charger cable (4 mm)
/** the chosen spot: clip on the desk top by the right side edge, cables running along −X into the desk */
const XC = -2.6, ZC = -16;
const zSlot = (i: number, zc = ZC) => zc + SLOT_X[i];
const CLIP_C = (extra: Partial<ClipSpec> = {}): ClipSpec => ({ p: [XC, 0, ZC], yaw: -Math.PI / 2, ...extra });
const XF = XC + CLIP_D / 2, XB = XC - CLIP_D / 2; // clip faces along x (front = edge side)

/** From the charger, droop down and come up the right side of the desk to the top edge at z. */
const chargerToRightEdge = (z: number, droop = 0): V3[] => {
  const [cx, cy, cz] = CHARGER_OUT;
  return [
    CHARGER_OUT,
    [cx - 0.3, cy - 2.0, cz + 2.2],
    [mixn(cx, 1.5, 0.35), cy - 12 - droop, mixn(cz, z, 0.3)],
    [mixn(cx, 1.2, 0.7), cy - 9 - droop * 0.6, mixn(cz, z, 0.62)],
    [1.0, -5, z],
    [0.5, -1.1, z],
  ];
};
/**
 * A cable along the desk top from the right edge (at zEdge) to its plug at tipX, optionally held in the clip at
 * (zClip, yClip). `lift` raises everything on the desk (a hand holding it up).
 */
const deskRun = (o: { zEdge: number; zClip?: number; yClip?: number; tipX: number; r?: number; lift?: number; tipY?: number; droop?: number; zTip?: number }): V3[] => {
  const r = o.r ?? R0, lift = o.lift ?? 0, zc = o.zClip ?? o.zEdge, yc = o.yClip ?? r, zt = o.zTip ?? zc;
  const ty = o.tipY ?? 0.33;
  const pts: V3[] = [...chargerToRightEdge(o.zEdge, o.droop)];
  const run = o.tipX - XB;
  const desk: V3[] = [
    [0.05, r + 0.04 + lift * 0.6, mixn(o.zEdge, zc, 0.3)],
    [XF + 0.45, mixn(r, yc, 0.8) + lift, mixn(o.zEdge, zc, 0.85)],
    [XF, yc + lift, zc],
    [XB, yc + lift, zc],
    [XB - 1.1, mixn(yc, r, 0.6) + lift, mixn(zc, zt, 0.15)],
    [XB + run * 0.55, r + lift, mixn(zc, zt, 0.6)],
  ];
  // keep only what lies between the edge and the plug (a plug near the edge drops the clip points)
  for (const q of desk) if (q[0] > o.tipX + 1.6) pts.push(q);
  pts.push([o.tipX + 1.1, ty - 0.03 + lift, zt]);
  pts.push([o.tipX, ty + lift, zt]);
  return pts;
};
const cable = (key: string, pts: V3[], color = WHITE, r = R0, plug = true): CableSpec => ({ key, pts, color, r, plug });
/** Phone centre so that its port takes the plug whose cable ends at (x, y, z) pointing −X. */
const phoneOnTip = (x: number, z: number, inserted = 1): V3 => [x - PLUG_LEN + 0.62 * inserted - PHONE.l / 2 - (1 - inserted) * 0.6, PHONE.t / 2, z];

const base = (cam: Cam, mode: Mode, focus: V3, shadow: number): State => ({ cam, mode, focus, shadow, cables: [], rings: [], sparkles: [], tags: [] });

// ── the inserts (film seconds; VO offset 0.4) ─────────────────────────────────────────────────────────────
export const INSERTS: Insert[] = [
  // "kok kabelnya udah di bawah meja lagi?" — tilt from the empty desk top down to the cable on the floor
  {
    id: "under", t0: 2.2, t1: 4.44,
    at: (t) => {
      // looking over the right edge: the empty spot on the desk, then down to the floor where the cable lies
      const cam = camMove(t, 2.3, 3.95, { pos: [26, 25, -15], target: [-2, -2, -20], fov: 40 }, { pos: [25, 23, -15], target: [5.5, -75, -27], fov: 40 });
      const s = base(cam, "night", [2, -50, -25], 55);
      const fy = -75;
      const settle = bounce(t, 2.2, 0.5, 5, 6);
      s.cables.push(cable("floor", [
        CHARGER_OUT, [7.8, -19, -58.5], [8.4, -50, -59], [6, fy + R0, -50], [9.5, fy + R0, -41], [5.5, fy + R0, -32], [9.5, fy + R0, -22], [6.5, fy + R0, -15.5], [8, fy + 0.31 + Math.abs(settle) * 0.4, -10 + settle],
      ]));
      return s;
    },
  },
  // "Begitu HP diangkat, kabelnya ikut meluncur." — the phone leaves, the plug slides over the edge and drops
  {
    id: "slide", t0: 13.3, t1: 15.94,
    at: (t) => {
      const z = -16;
      let cam = camMove(t, 13.3, 14.4, { pos: [17, 9, 5], target: [-7, -1.5, -16], fov: 33 }, { pos: [16, 8, 4], target: [-5, -2, -16], fov: 33 });
      cam = camMove(t, 14.75, 15.7, cam, { pos: [15, 3, 3], target: [-1, -14, -16], fov: 34 });
      const s = base(cam, "night", [-4, -4, -16], 30);
      // phone: lifted up and away
      const lift = P(t, 13.5, 14.05, ease.in);
      const tip0 = -6.2;
      // the plug follows the phone for a moment, then drops back
      const drag = P(t, 13.5, 13.62, ease.out) * (1 - P(t, 13.62, 13.78, ease.in));
      const slide = P(t, 14.25, 14.95, ease.in);
      const fall = P(t, 14.95, 15.45, ease.in);
      let tipX = tip0 - drag * 0.5 + slide * 6.6;
      let tipY = 0.33 + drag * 1.2 + Math.abs(bounce(t, 13.78, 0.35, 6, 9));
      if (t >= 14.95) { tipX = 0.4 + fall * 2.4; tipY = 0.33 - fall * 38; }
      if (t < 14.95) {
        const pts = deskRun({ zEdge: z, tipX, tipY, droop: slide * 8 });
        s.cables.push(cable("slide", pts));
      } else {
        // over the edge: hanging from the charger, the plug falling
        const prev = mixv([tipX + 1.2, tipY + 0.05, z], [tipX + 0.25, tipY + 2.6, z], P(t, 14.95, 15.15, ease.out));
        const pts: V3[] = [...chargerToRightEdge(z, 8 + fall * 14).slice(0, 5), [0.9, mixn(-2.5, tipY + 6, fall), z], prev, [tipX, tipY, z]];
        s.cables.push(cable("slide-fall", pts));
      }
      if (lift < 1) s.phone = { p: [phoneOnTip(tip0, z)[0] - lift * 6, PHONE.t / 2 + lift * 26, z], roll: lift * 0.5, tilt: -lift * 0.35 };
      return s;
    },
  },
  // "Klip kabel ditempel di sisi meja yang bersih, terus kabelnya masuk ke slot."
  {
    id: "reveal", t0: 18.12, t1: 23.01,
    at: (t) => {
      let cam = camMove(t, 18.12, 19.3, { pos: [15, 7.5, -2], target: [XC, 4.6, ZC], fov: 30 }, { pos: [14, 6.5, -3], target: [XC, 4.2, ZC], fov: 30 });
      cam = camMove(t, 19.3, 20.4, cam, { pos: [19, 10, 3], target: [-4, 0.4, -15], fov: 30 });
      cam = camMove(t, 20.8, 22.3, cam, { pos: [15, 7.5, -1], target: [-3, 0.6, -16], fov: 30 });
      const s = base(cam, t < 19.3 ? "hero" : "night", [-3, 0, -16], 22);
      const down = P(t, 19.3, 19.95, ease.attract);
      const spin = mixn(-0.75, 0, P(t, 18.12, 19.9, ease.glide));
      const y = mixn(3.4 + 0.25 * Math.sin((t - 18.12) * 2.4), 0, down);
      const sq = Math.max(0, bounce(t, 19.95, 0.14, 7, 8)) + (t > 22.2 ? Math.max(0, bounce(t, 22.2, 0.05, 8, 10)) : 0);
      s.clip = CLIP_C({ p: [XC, y, ZC], yaw: -Math.PI / 2 + spin, squash: sq, peel: t < 19.9 ? 0 : 1 });
      s.rings.push({ p: [XC, 0.03, ZC], k: pulse(t, 19.95, 0.55), r: 3.2 });
      s.title = { t0: 18.2, t1: 20.3, text: "KLIP KABEL PEREKAT", sub: "5 slot · tipis sampai tebal" };
      // the cable: lying beside the clip, then lifted into slot 1 and pressed down
      if (t >= 19.3) {
        const zBeside = ZC + 3.6, zIn = zSlot(1), yIn = seatY(1, R0);
        const move = P(t, 20.95, 21.85, ease.inOut), press = P(t, 21.9, 22.2, ease.attract);
        const zc = mixn(zBeside, zIn, move);
        const hover = TOP_Y + R0 + 0.5;
        const yc = t < 21.9 ? mixn(R0, hover, Math.sin(Math.PI * Math.min(1, move * 1.15)) * 0.5 + move * 0.5) : mixn(hover, yIn, press);
        const lift = Math.sin(Math.PI * move) * 0.8 * (1 - press);
        s.cables.push(cable("reveal", deskRun({ zEdge: mixn(zBeside, zIn, move * 0.9), zClip: zc, yClip: yc, tipX: -9.5, lift: lift * 0.4, zTip: mixn(zBeside, zIn, move * 0.7) })));
        s.rings.push({ p: [XC + 0.95, yIn, zIn], k: pulse(t, 22.2, 0.45), r: 0.9, normal: "x" });
      }
      return s;
    },
  },
  // "Di sisi luar meja, tangannya gampang menjangkau, tapi kabel bisa tersenggol kursi."
  {
    id: "outer", t0: 26.05, t1: 31.7,
    at: (t) => {
      const X = -34, zClip = -2.6, xs = X + SLOT_X[1];
      const shake = bounce(t, 30.18, 0.5, 11, 6);
      const cam = camMove(t, 26.05, 31.4, { pos: [30, 8, 24], target: [X, -7.5, 0.5], fov: 38 }, { pos: [26, 6, 21], target: [X, -8.5, 0.5], fov: 38 }, ease.sine);
      cam.pos = [cam.pos[0], cam.pos[1] + shake * 0.6, cam.pos[2]];
      const s = base(cam, "night", [X, -20, 0], 50);
      s.clip = { p: [X, 0, zClip], yaw: 0, wobble: bounce(t, 30.18, 0.06, 9, 7) };
      const roll = P(t, 29.4, 30.18, ease.inOut);
      const chairZ = mixn(52, 22.5, roll) + Math.max(0, bounce(t, 30.18, 1.5, 4, 6));
      s.chair = [X, -27, chairZ];
      // the seat front pushes the hanging cable in, which yanks the plug toward the clip
      const pz = Math.max(0, 3.4 - (chairZ - 23)); // how far the seat front is past the cable (cm)
      const yank = P(t, 30.18, 30.4, ease.out) * 1.4;
      const ys = seatY(1, R0), zTip = -9 + yank;
      const hang = (y: number, z0: number) => z0 - pz * (y < -20 && y > -36 ? 1 : y <= -36 ? 0.6 : 0.25);
      const pts: V3[] = [
        CHARGER_OUT, [7.8, -19, -58.5], [7.5, -60, -58], [6, -74.8 + R0, -50], [-6, -74.8 + R0, -40], [-20, -74.8 + R0, -26], [X + 2, -74.8 + R0, -8],
        [xs - 0.6, -71, hang(-71, 3.6)], [xs - 0.3, -46, hang(-46, 2.8)], [xs - 0.1, -28, hang(-28, 1.6)], [xs, -12, hang(-12, 0.8)], [xs, -1.4, 0.42],
        [xs, R0 + 0.05, -0.1], [xs, mixn(R0, ys, 0.85), zClip + CLIP_D / 2 + 0.45], [xs, ys, zClip + CLIP_D / 2], [xs, ys, zClip - CLIP_D / 2],
        [xs, mixn(ys, R0, 0.6), zClip - CLIP_D / 2 - 1.1], [xs, 0.33 + yank * 0.4, zTip + 1.1], [xs, 0.33 + yank * 0.6, zTip],
      ];
      s.cables.push(cable("outer", pts));
      s.rings.push({ p: [xs, -28, 1.2], k: pulse(t, 30.18, 0.45), r: 3.5, color: "#ff6b6b", normal: "z" });
      s.chip = { text: "POSISI 1 · SISI LUAR", t0: 26.1 };
      s.tags.push({ text: "Gampang dijangkau", ok: true, t0: 27.25 }, { text: "Tersenggol kursi", ok: false, t0: 30.25, y: 1 });
      return s;
    },
  },
  // "Di sisi yang lebih dekat colokan, kabelnya lebih rapi, tapi kurang panjang kalau HP dipakai sambil dicas."
  {
    id: "socket", t0: 33.42, t1: 38.24,
    at: (t) => {
      const zc = -50, zs = zSlot(1, zc), ys = seatY(1, R0);
      let cam = camMove(t, 33.42, 33.9, { pos: [21, 8, 21], target: [2, -6, -56], fov: 34 }, { pos: [20, 8, 20], target: [2, -6, -56], fov: 34 }, ease.sine);
      cam = camMove(t, 33.9, 34.65, cam, { pos: [36, 26, -10], target: [-9, -1, -48], fov: 38 });
      cam = camMove(t, 34.65, 38.2, cam, { pos: [34, 24, -11], target: [-9, -1, -47.5], fov: 38 }, ease.sine);
      const s = base(cam, "night", [-6, -10, -42], 45);
      s.clip = { p: [XC, 0, zc], yaw: -Math.PI / 2 };
      const pull = P(t, 34.9, 36.25, ease.in);
      const tug = Math.max(0, bounce(t, 36.25, 0.7, 7, 6)) + Math.max(0, bounce(t, 36.75, 0.5, 7, 7)) * (t > 36.75 ? 1 : 0);
      // the plug can only go as far as the cable allows: from (−7.2, zs) toward the front, stopping taut
      const tipX = mixn(-7.2, -8.8, pull), zTip = mixn(zs, zs + 6.2, pull) - tug * 0.25;
      const pts: V3[] = [
        CHARGER_OUT, [7.7, -18.2, -57.4], [6, -21, -55.5], [2.8, -13, mixn(-55, zs, 0.6)], [1.0, -4.5, zs], [0.5, -1.1, zs],
        [0.05, R0 + 0.04, zs], [XF + 0.45, mixn(R0, ys, 0.8), zs], [XF, ys, zs], [XB, ys, zs], [XB - 1.0, mixn(ys, R0, 0.6), mixn(zs, zTip, 0.2)], [tipX + 1.1, 0.34, mixn(zs, zTip, 0.85)], [tipX, 0.36, zTip],
      ];
      s.cables.push(cable("socket", pts));
      const ph = phoneOnTip(tipX, zTip);
      s.phone = { p: ph };
      s.chip = { text: "POSISI 2 · DEKAT COLOKAN", t0: 33.45 };
      s.tags.push({ text: "Lebih rapi", ok: true, t0: 34.4 }, { text: "Kurang panjang", ok: false, t0: 36.35, y: 1 });
      return s;
    },
  },
  // "...dan masih memberi sedikit ruang buat kabel bergerak." — the chosen spot, with slack
  {
    id: "chosen", t0: 41.48, t1: 43.72,
    at: (t) => {
      const cam = camMove(t, 41.48, 43.6, { pos: [18, 21, 12], target: [-8, -1, -16], fov: 34 }, { pos: [16, 18, 10], target: [-8, -1, -15], fov: 33 }, ease.sine);
      const s = base(cam, "night", [-8, 0, -16], 26);
      s.clip = CLIP_C();
      const zs = zSlot(1), ys = seatY(1, R0);
      const w = Math.sin(Math.max(0, t - 41.9) * 3.2) * P(t, 41.9, 42.3) * (1 - P(t, 43.3, 43.66));
      const tipX = -12 + w * 0.6, zTip = zs + 1.5 + w * 3.2;
      const sl = 1.9 - w * 0.9; // slack bulge
      const pts: V3[] = [
        ...chargerToRightEdge(zs), [0.05, R0 + 0.04, zs], [XF + 0.45, mixn(R0, ys, 0.8), zs], [XF, ys, zs], [XB, ys, zs],
        [XB - 1.2, mixn(ys, R0, 0.7), zs - 0.4], [-6.5, R0, zs - sl], [-9.2, R0, mixn(zs, zTip, 0.6) + sl * 0.5], [tipX + 1.1, 0.34, zTip], [tipX, 0.36, zTip],
      ];
      s.cables.push(cable("chosen", pts));
      s.phone = { p: phoneOnTip(tipX, zTip) };
      s.chip = { text: "PILIHAN DIKA", t0: 41.5 };
      s.tags.push({ text: "Bisa diraih sambil duduk", ok: true, t0: 41.6 }, { text: "Ada ruang gerak", ok: true, t0: 42.5, y: 1 });
      return s;
    },
  },
  // "Kalau terlalu tebal, cari slot yang lebih lebar." — a laptop cable bounces off a small slot, then fits the big one
  {
    id: "thick", t0: 46.16, t1: 48.99,
    at: (t) => {
      const cam = camMove(t, 46.16, 48.9, { pos: [18, 5.2, -10.5], target: [XC, 0.9, -15.4], fov: 30 }, { pos: [17, 4.6, -11.2], target: [XC, 0.8, -15.2], fov: 30 }, ease.sine);
      const s = base(cam, "night", [XC, 0, ZC], 14);
      const rT = 0.3;
      const hit = 46.8;
      const sq2 = Math.max(0, bounce(t, hit, 0.06, 8, 9)), sq4 = Math.max(0, bounce(t, 48.28, 0.05, 8, 10));
      s.clip = CLIP_C({ squash: sq2 + sq4 });
      // the phone cable stays in slot 1
      s.cables.push(cable("thick-white", deskRun({ zEdge: zSlot(1), zClip: zSlot(1), yClip: seatY(1, R0), tipX: -9.5 })));
      const hoverTop = TOP_Y + rT;
      let y: number, z: number;
      if (t < hit) { y = mixn(5.5, hoverTop - 0.05, P(t, 46.25, hit, ease.in)); z = zSlot(2); }
      else if (t < 47.3) { y = hoverTop + 1.3 * ease.out(remap(t, hit, hit + 0.35)); z = zSlot(2); }
      else if (t < 47.95) { y = hoverTop + 1.3; z = mixn(zSlot(2), zSlot(4), P(t, 47.3, 47.9)); }
      else { y = mixn(hoverTop + 1.3, seatY(4, rT), P(t, 47.95, 48.28, ease.attract)); z = zSlot(4); }
      const held = y - seatY(4, rT);
      const far = held > 0.6 ? y - 0.2 : Math.max(rT, y - 0.5);
      const pts: V3[] = [[0.6, y - 9, z], [0.5, y - 3.5, z], [0.15, y - 0.4, z], [XF, y, z], [XB, y, z], [XB - 1.6, held > 0.6 ? y - 0.1 : mixn(y, rT, 0.6), z], [-9, far, z], [-16, held > 0.6 ? y - 0.4 : rT, z]];
      s.cables.push(cable("thick", pts, GREY, rT, false));
      s.rings.push({ p: [XC + 0.95, seatY(4, rT), zSlot(4)], k: pulse(t, 48.28, 0.45), r: 1.1, normal: "x" });
      s.chip = { text: "TES SLOT", t0: 46.2 };
      s.tags.push({ text: "Terlalu tebal", ok: false, t0: 46.85 }, { text: "Slot lebih lebar", ok: true, t0: 48.3, y: 1 });
      return s;
    },
  },
  // "Kalau terlalu kecil, cek apakah ujungnya masih bisa meluncur lewat slot." — the plug must stop at the clip
  {
    id: "thin", t0: 50.16, t1: 53.22,
    at: (t) => {
      const cam = camMove(t, 50.16, 53.1, { pos: [-5.6, 9.5, 4.5], target: [-4.3, 0.2, -14.6], fov: 30 }, { pos: [-5.1, 8.6, 3.2], target: [-3.9, 0.2, -14.6], fov: 30 }, ease.sine);
      const s = base(cam, "night", [-5, 0, -15], 16);
      const rt = 0.12, i = 4, z = zSlot(i), ys = seatY(i, rt);
      const jiggle = Math.sin((t - 50.16) * 18) * 0.07 * (1 - P(t, 50.5, 50.7));
      const pull = P(t, 50.7, 51.95, ease.in);
      const stop = 51.95;
      const bx = mixn(-10, XB + 0.58, pull) - Math.max(0, bounce(t, stop, 0.25, 6, 8));
      s.clip = CLIP_C({ wobble: bounce(t, stop, 0.035, 9, 8) });
      s.cables.push(cable("thin-white", deskRun({ zEdge: zSlot(1), zClip: zSlot(1), yClip: seatY(1, R0), tipX: -9.5, zTip: zSlot(1) - 1.8 })));
      // thin cable: from the edge side (falling away) through slot 3 to its plug, which points into the desk
      const pts: V3[] = [[0.9, -12, z], [0.6, -3, z], [0.25, -0.5, z + jiggle], [0.0, rt + 0.03, z + jiggle], [XF + 0.3, ys, z + jiggle], [XF, ys, z + jiggle]];
      // the plug rises from the desk to the slot height as it reaches the clip
      const yb = mixn(0.31, ys, P(bx, XB - 1.6, XB + 0.58));
      if (bx < XB - 0.9) pts.push([XB, ys, z + jiggle]);
      if (bx < XB - 2.4) pts.push([XB - 1.2, mixn(ys, rt + 0.15, 0.7), z]);
      pts.push([bx + 0.6, yb, z], [bx, yb, z]);
      s.cables.push(cable("thin", pts, WHITE, rt, true));
      s.rings.push({ p: [XB - 0.02, 0.5, z], k: pulse(t, stop, 0.45), r: 1.1, normal: "x" });
      s.chip = { text: "TES UJUNG KABEL", t0: 50.2 };
      s.tags.push({ text: "Ujungnya tertahan", ok: true, t0: 52.05 });
      return s;
    },
  },
  // "Tempel sesuai petunjuk produk, lalu cabut dan pasang HP sekali lagi."
  {
    id: "test", t0: 53.22, t1: 57.8,
    at: (t) => {
      if (t < 55.05) {
        const cam = camMove(t, 53.22, 55.0, { pos: [14, 8, -5], target: [XC, 4.4, ZC], fov: 30 }, { pos: [13, 6.5, -6.5], target: [XC, 1.8, ZC], fov: 30 }, ease.sine);
        const s = base(cam, "night", [XC, 0, ZC], 14);
        const peel = P(t, 53.42, 54.05, ease.inOut);
        const flip = Math.PI * (1 - P(t, 54.08, 54.5, ease.inOut));
        const down = P(t, 54.3, 54.68, ease.attract);
        const y = mixn(3.6 + 0.15 * Math.sin((t - 53.2) * 2.5), 0, down);
        const press = Math.max(0, bounce(t, 54.68, 0.12, 7, 9)) + (t > 54.85 ? 0.09 * Math.sin(Math.PI * Math.min(1, (t - 54.85) / 0.18)) : 0);
        s.clip = CLIP_C({ p: [XC, y + (flip > 0.01 ? Math.sin(flip) * 0.9 : 0), ZC], flip, peel, squash: press, yaw: -Math.PI / 2 + 0.35 * (1 - down) });
        s.rings.push({ p: [XC, 0.03, ZC], k: pulse(t, 54.68, 0.5), r: 3 }, { p: [XC, 0.03, ZC], k: pulse(t, 54.88, 0.5), r: 3 });
        s.chip = { text: "TEMPEL SESUAI PETUNJUK", t0: 53.3 };
        return s;
      }
      const cam = camMove(t, 55.05, 57.7, { pos: [16, 9, 3], target: [-7, -0.5, -16], fov: 33 }, { pos: [15, 8, 2], target: [-6, -0.5, -16], fov: 32 }, ease.sine);
      const s = base(cam, "night", [-6, 0, -16], 26);
      s.clip = CLIP_C();
      const zs = zSlot(1), tip = -8.2;
      const out = P(t, 55.3, 55.78, ease.in), back = P(t, 56.0, 56.45, ease.out);
      // the plug stays put: the clip keeps it (a small settle toward the clip after the phone lets go)
      const tipX = tip + P(t, 55.42, 55.6, ease.out) * 0.35 - P(t, 56.3, 56.45) * 0.35;
      s.cables.push(cable("test", deskRun({ zEdge: zs, zClip: zs, yClip: seatY(1, R0), tipX })));
      const ins = t < 55.42 ? 1 - P(t, 55.3, 55.42) : t < 56.45 ? 0 : 1;
      const away = t < 56.0 ? out : 1 - back;
      const ph = phoneOnTip(tipX, zs, ins);
      if (away < 0.999) s.phone = { p: [ph[0] - away * 7, ph[1] + Math.max(0, away - 0.15) * 30, zs], roll: away * 0.35, tilt: -away * 0.25 };
      s.rings.push({ p: [tipX - PLUG_LEN + 0.3, 0.4, zs], k: pulse(t, 56.45, 0.4), r: 1.4, normal: "x" });
      s.sparkles.push({ c: [XC, 1.2, zs], k: pulse(t, 56.55, 0.9), r: 4, seed: 3 });
      s.chip = { text: "CABUT – PASANG LAGI", t0: 55.1 };
      s.tags.push({ text: "Kabel tetap di tempat", ok: true, t0: 55.78 }, { text: "Lolos tes!", ok: true, t0: 56.6, y: 1 });
      return s;
    },
  },
  // "Senin pagi, tinggal raih dari atas."
  {
    id: "morning", t0: 63.3, t1: 65.36,
    at: (t) => {
      const cam = camMove(t, 63.3, 64.9, { pos: [14, 11, -1], target: [-4, 0.5, -16], fov: 32 }, { pos: [13, 9, -3], target: [-4, 1.5, -16], fov: 31 }, ease.sine);
      const s = base(cam, "day", [-4, 0, -16], 24);
      s.clip = CLIP_C();
      const zs = zSlot(1), ys = seatY(1, R0);
      const up = P(t, 63.55, 64.35, ease.inOut);
      const tipX = -6.6 + up * 1.2, tipY = 0.33 + up * 16;
      const pts: V3[] = [...chargerToRightEdge(zs), [0.05, R0 + 0.04, zs], [XF + 0.45, mixn(R0, ys, 0.8), zs], [XF, ys, zs], [XB, ys, zs]];
      if (up < 0.02) pts.push([XB - 1.1, mixn(ys, R0, 0.6), zs], [tipX + 1.1, 0.3, zs], [tipX, 0.33, zs]);
      else pts.push([XB - 1.0, ys + up * 0.6, zs], [tipX - 0.2, mixn(0.33, tipY - 3, up), zs], [tipX, tipY, zs]);
      s.cables.push(cable("morning", pts));
      s.sparkles.push({ c: [XC - 2, 2.5, zs], k: pulse(t, 63.6, 1.1), r: 5, seed: 7 });
      return s;
    },
  },
  // "...cek ukuran slotnya lewat tautan di profil." — product hero and the call to action
  {
    id: "hero", t0: 67.22, t1: 71.4,
    at: (t) => {
      const a = mixn(0.95, 0.35, P(t, 67.22, 71.4, ease.sine));
      const R = 21, c: V3 = [XC - 2, 0.6, ZC + 0.4];
      const cam: Cam = { pos: [c[0] + Math.cos(a) * R, 8.5 - 1.5 * P(t, 67.22, 71.4), c[2] + Math.sin(a) * R], target: c, fov: 30, near: 0.5, far: 1200 };
      const s = base(cam, "day", [XC, 0, ZC], 18);
      s.clip = CLIP_C();
      s.cables.push(cable("hero-thin", deskRun({ zEdge: zSlot(0), zClip: zSlot(0), yClip: seatY(0, 0.12), tipX: -11, r: 0.12, zTip: zSlot(0) - 2.4 }), WHITE, 0.12));
      s.cables.push(cable("hero-white", deskRun({ zEdge: zSlot(1), zClip: zSlot(1), yClip: seatY(1, R0), tipX: -8.2, zTip: zSlot(1) - 0.6 })));
      s.cables.push(cable("hero-thick", deskRun({ zEdge: zSlot(4), zClip: zSlot(4), yClip: seatY(4, 0.3), tipX: -10, r: 0.3, zTip: zSlot(4) + 2.2 }), GREY, 0.3, false));
      s.title = { t0: 67.3, text: "CEK UKURAN SLOTNYA", sub: "pilih yang pas dengan kabelmu" };
      s.cta = { t0: 68.15 };
      s.fade = P(t, 70.75, 71.38, ease.inOut);
      return s;
    },
  },
];

export const insertAt = (t: number) => INSERTS.find((x) => t >= x.t0 && t < x.t1);
/** Where the slot centres are in the world for the chosen spot (overlay markers). */
export const slotPoints = (): V3[] => SLOT_R.map((r, i) => [XC + CLIP_D / 2, TOP_Y + 0.5, zSlot(i)] as V3);
