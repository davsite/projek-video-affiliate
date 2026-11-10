// Procedural, deterministic textures (no image assets): perforated grilles and boards.

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, type ColorSpace } from "three";

const toTexture = (data: Uint8Array, w: number, h: number, colorSpace: ColorSpace = SRGBColorSpace) => {
  const t = new DataTexture(data, w, h, RGBAFormat);
  t.colorSpace = colorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Hex-packed micro perforation. Alpha carries the outline mask (stadium / circle) for
 * alpha-to-coverage, so edges stay anti-aliased under MSAA.
 */
export const perforation = ({
  w = 1024, h = 1024, across = 18, hole = 0.36, base = "#3a3a3d", rim = "#55565a", deep = "#0d0d0f",
  mask = "none" as "none" | "stadium" | "circle",
}) => {
  const data = new Uint8Array(w * h * 4);
  const pitch = w / across;
  const rowH = pitch * Math.sqrt(3) / 2;
  const B = hex(base), R = hex(rim), D = hex(deep);
  const r = pitch * hole;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const row = Math.round(y / rowH);
      const cy = row * rowH;
      const off = row % 2 ? pitch / 2 : 0;
      const cx = Math.round((x - off) / pitch) * pitch + off;
      // nearest of the two candidate rows keeps the hex lattice exact
      let d = Math.hypot(x - cx, y - cy);
      const row2 = row + (y > cy ? 1 : -1);
      const off2 = row2 % 2 ? pitch / 2 : 0;
      const cx2 = Math.round((x - off2) / pitch) * pitch + off2;
      d = Math.min(d, Math.hypot(x - cx2, y - row2 * rowH));
      const inHole = Math.min(1, Math.max(0, (r - d) / 1.2));
      const onRim = Math.min(1, Math.max(0, 1 - Math.abs(d - r - 1.2) / 1.6));
      const c = B.map((b, i) => b + (R[i] - b) * onRim * 0.8 + (D[i] - b) * inHole);
      let a = 255;
      if (mask !== "none") {
        const u = (x + 0.5) / w - 0.5, v = (y + 0.5) / h - 0.5;
        let dist: number;
        if (mask === "circle") dist = 0.5 - Math.hypot(u, v);
        else {
          // stadium in a w×h box (aspect-correct)
          const aspect = w / h;
          const hx = 0.5 * aspect - 0.5;
          const px = Math.max(Math.abs(u * aspect) - hx, 0);
          dist = 0.5 - Math.hypot(px, v);
        }
        a = Math.round(Math.min(1, Math.max(0, dist * h * 0.6 + 0.5)) * 255);
      }
      const k = (y * w + x) * 4;
      data[k] = c[0];
      data[k + 1] = c[1];
      data[k + 2] = c[2];
      data[k + 3] = a;
    }
  return toTexture(data, w, h);
};

/** Seeded PRNG (Park–Miller). */
export const prng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Circuit board: graphite substrate, routed traces, vias and champagne pads. */
export const circuitBoard = (size = 1024, seed = 11) => {
  const rnd = prng(seed);
  const S = size;
  const data = new Uint8Array(S * S * 4);
  const base = hex("#2c2d30"), trace = hex("#45474b"), pad = hex("#c8b48c"), via = hex("#8d8a84");
  const set = (x: number, y: number, c: Rgb, a = 1) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const k = (y * S + x) * 4;
    for (let i = 0; i < 3; i++) data[k + i] = data[k + i] + (c[i] - data[k + i]) * a;
  };
  for (let i = 0; i < S * S; i++) {
    const n = (rnd() - 0.5) * 6;
    data[i * 4] = base[0] + n;
    data[i * 4 + 1] = base[1] + n;
    data[i * 4 + 2] = base[2] + n;
    data[i * 4 + 3] = 255;
  }
  const disc = (cx: number, cy: number, r: number, c: Rgb, hollow = 0) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const a = Math.min(1, Math.max(0, r - d + 0.5)) * (hollow ? Math.min(1, Math.max(0, d - hollow + 0.5)) : 1);
        if (a > 0) set(x, y, c, a);
      }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, wdt: number) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= L; s += 0.5) {
      const x = x0 + ((x1 - x0) * s) / L, y = y0 + ((y1 - y0) * s) / L;
      disc(x, y, wdt / 2, trace);
    }
  };
  // Manhattan + 45° routing from random pins
  for (let i = 0; i < 70; i++) {
    let x = rnd() * S, y = rnd() * S;
    const steps = 2 + Math.floor(rnd() * 3);
    const w = 3 + rnd() * 4;
    for (let s = 0; s < steps; s++) {
      const dir = Math.floor(rnd() * 8) * (Math.PI / 4);
      const len = 40 + rnd() * 180;
      const nx = x + Math.cos(dir) * len, ny = y + Math.sin(dir) * len;
      line(x, y, nx, ny, w);
      x = nx;
      y = ny;
    }
    disc(x, y, w * 1.6, via, w * 0.7);
  }
  for (let i = 0; i < 40; i++) disc(rnd() * S, rnd() * S, 5 + rnd() * 5, pad);
  return toTexture(data, S, S);
};
