// Shared materials, deterministic randomness and procedural canvas textures. Every material is built
// once per key and shared; textures are drawn from seeded randomness, so nothing depends on files.

import {
  CanvasTexture,
  Color,
  type Material,
  MeshBasicMaterial,
  type MeshBasicMaterialParameters,
  MeshPhysicalMaterial,
  type MeshPhysicalMaterialParameters,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

export { mulberry32, hash1, noise1 } from "./rng.ts";
import { mulberry32 } from "./rng.ts";

const cache = new Map<string, Material>();
export const phys = (key: string, p: MeshPhysicalMaterialParameters): MeshPhysicalMaterial => {
  let m = cache.get(key) as MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new MeshPhysicalMaterial(p);
    cache.set(key, m);
  }
  return m;
};
export const basic = (key: string, p: MeshBasicMaterialParameters): MeshBasicMaterial => {
  let m = cache.get(key) as MeshBasicMaterial | undefined;
  if (!m) {
    m = new MeshBasicMaterial(p);
    cache.set(key, m);
  }
  return m;
};

const texCache = new Map<string, Texture>();
export const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number], srgb = true) => {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    draw(g, w, h);
    t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(...repeat);
    }
    texCache.set(key, t);
  }
  return t;
};

export const shade = (hex: string, k: number) => {
  const c = new Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};
export const mixHex = (a: string, b: string, k: number) => `#${new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, k))).getHexString()}`;

/** Soft woven fabric. */
export const weaveTex = (key: string, color: string, rep: [number, number], stripe?: string) =>
  canvasTex(`weave${key}`, 256, 256, (g, w, h) => {
    const r = mulberry32(3);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4)
      for (let x = 0; x < w; x += 4) {
        g.fillStyle = `rgba(${(x + y) % 8 ? "255,255,255" : "0,0,0"},${0.02 + r() * 0.03})`;
        g.fillRect(x, y, 4, 2);
      }
    if (stripe) {
      g.fillStyle = stripe;
      for (let y = 0; y < h; y += 64) g.fillRect(0, y + 20, w, 10);
    }
  }, rep);

/** Stylised eye: equirect sphere texture with the iris centred on +Z (u = 0.25, v = 0.5). */
export const eyeTex = (key: string, iris: string) =>
  canvasTex(`eye${key}`, 1024, 512, (g, w, h) => {
    g.fillStyle = "#f7f3ee";
    g.fillRect(0, 0, w, h);
    // faint warm vignette toward the back of the eyeball
    const bg = g.createRadialGradient(w * 0.25, h * 0.5, w * 0.05, w * 0.25, h * 0.5, w * 0.3);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(1, "rgba(150,90,80,0.18)");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const cx = w * 0.25, cy = h * 0.5;
    const rx = w * 0.108, ry = h * 0.216;
    const gr = g.createRadialGradient(cx, cy - ry * 0.25, 0, cx, cy, rx);
    gr.addColorStop(0, shade(iris, 2.1));
    gr.addColorStop(0.5, shade(iris, 1.25));
    gr.addColorStop(0.85, iris);
    gr.addColorStop(1, shade(iris, 0.35));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,225,170,0.22)";
    g.lineWidth = 2;
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rx * 0.5, cy + Math.sin(a) * ry * 0.5);
      g.lineTo(cx + Math.cos(a) * rx * 0.88, cy + Math.sin(a) * ry * 0.88);
      g.stroke();
    }
    g.fillStyle = "#0b0706";
    g.beginPath();
    g.ellipse(cx, cy, rx * 0.44, ry * 0.44, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(iris, 0.25);
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(cx, cy, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
    g.stroke();
  });
