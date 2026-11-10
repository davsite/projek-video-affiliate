// One material set per (character, variant). "hero" materials are opaque; "mini" materials (the
// little imagined versions of the cast inside thought bubbles) can be faded and tinted together
// without touching the lead's look.

import { Color, DoubleSide, type MeshPhysicalMaterial, type Material, MeshBasicMaterial } from "three";
import { canvasTex, eyeTex, mulberry32, phys, shade, weaveTex } from "../lib/mats.ts";
import type { CharacterSpec } from "./spec.ts";

export type Variant = "hero" | "mini";

export type CharMats = {
  skin: MeshPhysicalMaterial; hair: MeshPhysicalMaterial; scarf: MeshPhysicalMaterial; top: MeshPhysicalMaterial; topTrim: MeshPhysicalMaterial;
  bottom: MeshPhysicalMaterial; skirt: MeshPhysicalMaterial; foot: MeshPhysicalMaterial; sole: MeshPhysicalMaterial;
  eye: MeshPhysicalMaterial; lash: MeshPhysicalMaterial; brow: MeshPhysicalMaterial;
  mouth: MeshPhysicalMaterial; lipLine: MeshPhysicalMaterial; teeth: MeshPhysicalMaterial; tongue: MeshPhysicalMaterial;
  blush: MeshBasicMaterial; glint: MeshBasicMaterial; frame: MeshPhysicalMaterial; nail: MeshPhysicalMaterial;
  all: Material[];
};

const sets = new Map<string, CharMats>();

/** Soft knit for t-shirts: fine rib + a few slubs. */
const knitTex = (key: string, color: string) =>
  canvasTex(`knit${key}`, 256, 256, (g, w, h) => {
    const r = mulberry32(17);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 3) {
      g.fillStyle = `rgba(${x % 6 ? "255,255,255" : "0,0,0"},0.035)`;
      g.fillRect(x, 0, 1.5, h);
    }
    for (let k = 0; k < 90; k++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "60,40,20"},${0.03 + r() * 0.04})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 6 + r() * 18);
    }
  }, [5, 5]);

export const charMats = (spec: CharacterSpec, variant: Variant = "hero"): CharMats => {
  const key = `${spec.id}:${variant}`;
  let s = sets.get(key);
  if (s) return s;
  const k = (n: string) => `${key}:${n}`;
  const fabric = { roughness: 0.82, sheen: 0.55, sheenRoughness: 0.55 };
  const skin = phys(k("skin"), { color: spec.skin, roughness: 0.48, sheen: 0.45, sheenColor: "#ffb196", sheenRoughness: 0.45, clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const hair = phys(k("hair"), { color: spec.hair, roughness: 0.46, sheen: 1, sheenColor: spec.hairSheen, sheenRoughness: 0.35, clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const scarf = phys(k("scarf"), { color: spec.scarf ?? spec.hair, roughness: 0.85, sheen: 0.7, sheenColor: shade(spec.scarf ?? spec.hair, 1.5), sheenRoughness: 0.5, side: DoubleSide });
  const top = phys(k("top"), { color: "#ffffff", map: spec.top.kind === "hoodie" ? weaveTex(`${spec.id}top`, spec.top.color, [6, 6]) : knitTex(spec.id, spec.top.color), sheenColor: shade(spec.top.color, 1.3), ...fabric });
  const topTrim = phys(k("trim"), { color: spec.top.accent, sheenColor: "#ffffff", ...fabric });
  const bottom = phys(k("bottom"), { color: spec.bottom.color, sheenColor: shade(spec.bottom.color, 2.2), ...fabric, roughness: 0.78 });
  const skirt = phys(k("skirt"), { color: spec.bottom.color, sheenColor: shade(spec.bottom.color, 2.2), ...fabric, roughness: 0.78, side: DoubleSide });
  const foot = phys(k("foot"), { color: spec.feet.kind === "bare" ? spec.skin : spec.feet.color, ...fabric, roughness: spec.feet.kind === "shoes" ? 0.5 : 0.85 });
  const sole = phys(k("sole"), { color: "#4a4a50", roughness: 0.8 });
  const eye = phys(k("eye"), { map: eyeTex(spec.id, spec.iris), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lash = phys(k("lash"), { color: shade(spec.hair, 0.6), roughness: 0.6 });
  const brow = phys(k("brow"), { color: spec.brow, roughness: 0.75, sheen: 0.4, sheenColor: spec.hairSheen });
  const decal = { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: DoubleSide };
  const mouth = phys(k("mouth"), { color: "#5a2226", roughness: 0.7, ...decal });
  const lipLine = phys(k("lip"), { color: shade(spec.lip, 0.62), roughness: 0.55, ...decal, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const teeth = phys(k("teeth"), { color: "#f6f1e8", roughness: 0.3, ...decal, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const tongue = phys(k("tongue"), { color: "#c4636a", roughness: 0.5, ...decal, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const blush = new MeshBasicMaterial({ color: new Color("#ff6f6a"), transparent: true, opacity: 0.16 * spec.blush, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, map: blushTex() });
  const glint = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const frame = phys(k("frame"), { color: "#2b2522", roughness: 0.35, clearcoat: 0.6 });
  const nail = phys(k("nail"), { color: shade(spec.skin, 1.18), roughness: 0.3, clearcoat: 0.5 });
  const all: Material[] = [skin, hair, scarf, top, topTrim, bottom, skirt, foot, sole, eye, lash, brow, mouth, lipLine, teeth, tongue, frame, nail];
  s = { skin, hair, scarf, top, topTrim, bottom, skirt, foot, sole, eye, lash, brow, mouth, lipLine, teeth, tongue, blush, glint, frame, nail, all };
  sets.set(key, s);
  return s;
};

const blushTex = () =>
  canvasTex("blush", 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

/** Fade every mini material of a character (thought-bubble imagery). */
export const setMiniFade = (spec: CharacterSpec, opacity: number) => {
  const s = charMats(spec, "mini");
  for (const m of s.all) {
    m.opacity = opacity;
    m.transparent = opacity < 0.999;
  }
  s.blush.opacity = 0.16 * spec.blush * opacity;
};
