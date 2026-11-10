// Parametric rounded slab with a FIXED topology: every parameter change only moves
// vertices, so a slab can morph continuously from a 1990s brick to a 2026 glass slab
// (or a sensor orb) with no remeshing, popping or flicker.
//
// Surface = outline (front view, rounded rectangle with per-corner radius) × side profile
// (front cap → front fillet → side wall with optional seam groove → back fillet → back cap).
// The outline is offset inward by the profile inset; corners use the exact inward offset of
// a rounded corner (radius rc − inset, mitred once the inset exceeds rc), so the same
// generator makes sharp-cornered modules, rounded phones and — with rc = hw = hh and
// fillets = d/2 — a sphere. Normals are analytic (sharp edges stay sharp).

import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";

export type SlabSpec = {
  /** Half width (x), half height (y), full depth (z). */
  hw: number;
  hh: number;
  d: number;
  /** Outline corner radius, or per corner [TR, TL, BL, BR]. */
  rc: number | readonly [number, number, number, number];
  /** Front / back edge fillet radii. */
  reF: number;
  reB: number;
  /** Groove around the side wall (z of its centre, depth, width). */
  seamZ?: number;
  seamDepth?: number;
  seamWidth?: number;
  /** Dome height of the front / back caps. */
  bulgeF?: number;
  bulgeB?: number;
  /** Offset added to the shader-space position attribute `tfPos` (e.g. a module's place in its parent). */
  origin?: readonly [number, number];
  /** Planar UV: u = (x + origin.x) / uvSize.x + 0.5. */
  uvSize?: readonly [number, number];
};

const N_CORNER = 10; // segments per corner arc
const CAP_RHO = [0, 0.38, 0.68, 0.88]; // cap rings (edge ring comes from the fillet)
const N_FILLET = 8;
const GROOVE_U = [0.85, 0.5, 0.18, 0, -0.18, -0.5, -0.85];

const P = 4 * (N_CORNER + 1);
type Row = { kind: "capF" | "filletF" | "wall" | "filletB" | "capB"; a: number };
const ROWS: Row[] = [
  ...CAP_RHO.map((a) => ({ kind: "capF" as const, a })),
  ...Array.from({ length: N_FILLET + 1 }, (_, k) => ({ kind: "filletF" as const, a: (k / N_FILLET) * (Math.PI / 2) })),
  ...GROOVE_U.map((a) => ({ kind: "wall" as const, a })),
  ...Array.from({ length: N_FILLET + 1 }, (_, k) => ({ kind: "filletB" as const, a: ((N_FILLET - k) / N_FILLET) * (Math.PI / 2) })),
  ...[...CAP_RHO].reverse().map((a) => ({ kind: "capB" as const, a })),
];
const V = ROWS.length;
/** Band index ranges per material group: front cap, side (fillets + wall), back cap. */
const FRONT_END = CAP_RHO.length; // bands [0, FRONT_END)
const BACK_START = V - 1 - CAP_RHO.length; // bands [BACK_START, V-1)

const SIGN: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

/** Outline point at inset i for sample c (0..P-1); writes [x, y, nx, ny]. */
const outline = (hw: number, hh: number, rc: readonly number[], i: number, c: number, out: number[]) => {
  const k = Math.floor(c / (N_CORNER + 1));
  const j = c % (N_CORNER + 1);
  const th = (k + j / N_CORNER) * (Math.PI / 2);
  const m = Math.max(rc[k], i);
  const r = Math.max(rc[k] - i, 0);
  const [sx, sy] = SIGN[k];
  const cx = sx * Math.max(hw - m, 0);
  const cy = sy * Math.max(hh - m, 0);
  out[0] = cx + r * Math.cos(th);
  out[1] = cy + r * Math.sin(th);
  out[2] = Math.cos(th);
  out[3] = Math.sin(th);
};

export class Slab {
  readonly geometry: BufferGeometry;
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;
  private tf: Float32Array;

  constructor() {
    const n = P * V;
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);
    this.tf = new Float32Array(n * 3);
    const idx: number[] = [];
    for (let r = 0; r < V - 1; r++)
      for (let c = 0; c < P; c++) {
        const c1 = (c + 1) % P;
        const a = r * P + c, b = (r + 1) * P + c, d = (r + 1) * P + c1, e = r * P + c1;
        idx.push(a, b, d, a, d, e);
      }
    const g = new BufferGeometry();
    g.setIndex(idx);
    g.setAttribute("position", new BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new BufferAttribute(this.uv, 2));
    g.setAttribute("tfPos", new BufferAttribute(this.tf, 3));
    const per = P * 6;
    g.addGroup(0, FRONT_END * per, 0);
    g.addGroup(FRONT_END * per, (BACK_START - FRONT_END) * per, 1);
    g.addGroup(BACK_START * per, (V - 1 - BACK_START) * per, 2);
    g.boundingSphere = new Sphere(new Vector3(), 1);
    this.geometry = g;
  }

  update(s: SlabSpec) {
    const rc = typeof s.rc === "number" ? [s.rc, s.rc, s.rc, s.rc] : [...s.rc];
    const half = s.d / 2;
    // fillets can never exceed the depth or the outline
    let reF = Math.max(0, Math.min(s.reF, s.d, s.hw, s.hh));
    let reB = Math.max(0, Math.min(s.reB, s.d, s.hw, s.hh));
    if (reF + reB > s.d) {
      const k = s.d / (reF + reB);
      reF *= k;
      reB *= k;
    }
    for (let k = 0; k < 4; k++) rc[k] = Math.max(0, Math.min(rc[k], s.hw, s.hh));
    const zTop = half - reF, zBot = -half + reB;
    const wallLen = zTop - zBot;
    const w = Math.min(s.seamWidth ?? 0.1, wallLen * 0.9);
    const seamZ = Math.min(zTop - w / 2, Math.max(zBot + w / 2, s.seamZ ?? (zTop + zBot) / 2));
    const g = Math.min(s.seamDepth ?? 0, Math.min(s.hw, s.hh) * 0.5);
    const bF = s.bulgeF ?? 0, bB = s.bulgeB ?? 0;
    const [ox, oy] = s.origin ?? [0, 0];
    const [us, vs] = s.uvSize ?? [2 * s.hw, 2 * s.hh];
    const o = [0, 0, 0, 0];
    const edge = [0, 0, 0, 0];

    for (let r = 0; r < V; r++) {
      const row = ROWS[r];
      for (let c = 0; c < P; c++) {
        let x: number, y: number, z: number, nx: number, ny: number, nz: number;
        if (row.kind === "capF" || row.kind === "capB") {
          const front = row.kind === "capF";
          outline(s.hw, s.hh, rc, front ? reF : reB, c, edge);
          const rho = row.a;
          x = edge[0] * rho;
          y = edge[1] * rho;
          const R2 = Math.max(edge[0] * edge[0] + edge[1] * edge[1], 1e-9);
          const b = front ? bF : bB;
          z = front ? half + b * (1 - rho * rho) : -half - b * (1 - rho * rho);
          // dome slope: n ∝ (2b·r/R² · radial, ±1)
          const k = (2 * b) / R2;
          nx = k * x;
          ny = k * y;
          nz = front ? 1 : -1;
        } else {
          let inset: number, nOut: number, nZ: number;
          if (row.kind === "filletF") {
            inset = reF * (1 - Math.sin(row.a));
            z = zTop + reF * Math.cos(row.a);
            nOut = Math.sin(row.a);
            nZ = Math.cos(row.a);
          } else if (row.kind === "filletB") {
            inset = reB * (1 - Math.sin(row.a));
            z = zBot - reB * Math.cos(row.a);
            nOut = Math.sin(row.a);
            nZ = -Math.cos(row.a);
          } else {
            const u = row.a;
            z = seamZ + (w / 2) * u;
            inset = (g * (1 + Math.cos(Math.PI * u))) / 2;
            const slope = w > 1e-6 ? (-g * Math.PI * Math.sin(Math.PI * u)) / w : 0;
            const l = Math.hypot(1, slope);
            nOut = 1 / l;
            nZ = slope / l;
          }
          outline(s.hw, s.hh, rc, inset, c, o);
          x = o[0];
          y = o[1];
          nx = nOut * o[2];
          ny = nOut * o[3];
          nz = nZ;
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        const v = r * P + c;
        this.pos[v * 3] = x;
        this.pos[v * 3 + 1] = y;
        this.pos[v * 3 + 2] = z;
        this.nor[v * 3] = nx / l;
        this.nor[v * 3 + 1] = ny / l;
        this.nor[v * 3 + 2] = nz / l;
        this.uv[v * 2] = (x + ox) / us + 0.5;
        this.uv[v * 2 + 1] = (y + oy) / vs + 0.5;
        this.tf[v * 3] = x + ox;
        this.tf[v * 3 + 1] = y + oy;
        this.tf[v * 3 + 2] = z;
      }
    }
    const g0 = this.geometry;
    g0.attributes.position.needsUpdate = true;
    g0.attributes.normal.needsUpdate = true;
    g0.attributes.uv.needsUpdate = true;
    g0.attributes.tfPos.needsUpdate = true;
    g0.boundingSphere!.radius = Math.hypot(s.hw, s.hh, half + Math.max(bF, bB)) + 0.01;
  }

  dispose() {
    this.geometry.dispose();
  }
}
