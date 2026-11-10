// Shared measurements of the product inserts' set (centimetres) — plain TypeScript so scripts can import it.

export type V3 = [number, number, number];
export const DESK = { x0: -100, x1: 0, z0: -60, z1: 0, top: 0, thick: 2.6, floor: -75, wall: -63 };
export const SOCKET: V3 = [21, -30, DESK.wall];
/** Where the charger's cable leaves the brick. */
export const CHARGER_OUT: V3 = [SOCKET[0], SOCKET[1] - 0.6, DESK.wall + 0.8 + 3 + 0.25];
export const PHONE = { w: 7.2, l: 15.2, t: 0.85 };
/** Length of the plug from the cable end to the connector tip (for placing it into a phone port). */
export const PLUG_LEN = 3.16;

export type CableSpec = { pts: V3[]; r: number; color: string; plug?: boolean; key: string };
export type ClipSpec = {
  p: V3;
  /** yaw: the direction its cables run (local Z) */
  yaw: number;
  /** flip about local X (0 = standing, π = upside down showing the pad) */
  flip?: number;
  squash?: number;
  /** 0 = liner on, 1 = peeled off */
  peel?: number;
  wobble?: number;
};
