// Modular bedroom set. Everything is placed from one layout object (BedroomLayout) so a topic can move
// the bed, swap the palette or drop pieces without touching geometry code. Pieces: room shell with a
// moonlit window, bed (frame, mattress, headboard, pillows), nightstand with a touch lamp and a clock,
// shelf, posters, rug, desk corner, plant and slippers. The duvet is separate (Blanket.tsx) because it
// follows the character.

import React from "react";
import { DoubleSide, PlaneGeometry, type Material } from "three";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { basic, canvasTex, phys, shade } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";
import { duvetTex, paintTex, plankTex, posterTex, rugTex, skyTex, spineColors } from "./textures.ts";
import type { V3 } from "../character/spec.ts";

export { BEDROOM, type BedroomLayout } from "./bedroom.data.ts";
import { BEDROOM, type BedroomLayout } from "./bedroom.data.ts";

const mats = (L: BedroomLayout) => {
  const P = L.palette;
  return {
    wall: phys(`cfwall${P.wall}`, { color: "#ffffff", map: paintTex(P.wall, P.wall, [3, 3]), roughness: 0.92 }),
    floor: phys(`cffloor${P.floor}`, { color: "#ffffff", map: plankTex([3, 2], P.floor), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    wood: phys(`cfwood${P.wood}`, { color: P.wood, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
    woodDark: phys(`cfwoodD${P.wood}`, { color: shade(P.wood, 0.62), roughness: 0.55 }),
    sheet: phys(`cfsheet${P.sheet}`, { color: P.sheet, roughness: 0.85, sheen: 0.5, sheenColor: "#ffffff" }),
    head: phys(`cfhead${P.headboard}`, { color: P.headboard, roughness: 0.8, sheen: 0.7, sheenColor: shade(P.headboard, 1.8) }),
    duvet: phys(`cfduvet${P.duvet}`, { color: "#ffffff", map: duvetTex(P.duvet, P.duvet, P.duvetInk, [2, 2]), roughness: 0.82, sheen: 0.6, sheenColor: "#ffffff", side: DoubleSide }),
    cuff: phys(`cfcuff${P.cuff}`, { color: P.cuff, roughness: 0.85, sheen: 0.5, sheenColor: "#ffffff", side: DoubleSide }),
    white: phys("cfwhite", { color: "#f4f2ee", roughness: 0.35, clearcoat: 0.4 }),
    metal: phys("cfmetal", { color: "#c9c4bb", roughness: 0.3, metalness: 0.8 }),
    dark: phys("cfdark", { color: "#2b2d33", roughness: 0.4 }),
    leaf: phys("cfleaf", { color: "#3f8f5a", roughness: 0.6, sheen: 0.4, sheenColor: "#a8e6b8" }),
    pot: phys("cfpot", { color: "#e07a5f", roughness: 0.7 }),
    accent: phys(`cfacc${P.accent}`, { color: P.accent, roughness: 0.7, sheen: 0.5 }),
  };
};
export type BedroomMats = ReturnType<typeof mats>;
export const bedroomMats = mats;

/** Wavy curtain panel. */
const curtainGeo = (w: number, h: number) =>
  cached(`cfcurtain${w},${h}`, () => {
    const g = new PlaneGeometry(w, h, 40, 4);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) a.setZ(i, 0.03 * Math.sin((a.getX(i) / w) * Math.PI * 7));
    g.computeVertexNormals();
    return g;
  });

const clockTex = (text: string) =>
  canvasTex(`cfclock${text}`, 256, 128, (g, w, h) => {
    g.fillStyle = "#050a10";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#7ff3ff";
    g.font = `600 88px ${FONT}, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });

export const Lamp: React.FC<{ at: V3; on: number }> = ({ at, on }) => {
  const shadeMat = phys("cflampshade", { color: "#f3e6cf", roughness: 0.8, side: DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 0 });
  shadeMat.emissiveIntensity = 0.55 * on;
  const bulb = basic("cfbulb", { color: "#fff2d6", toneMapped: false });
  bulb.color.setRGB(0.25 + 1.6 * on, 0.22 + 1.35 * on, 0.18 + 1.0 * on);
  const m = phys("cflampbase", { color: "#f2efe8", roughness: 0.25, clearcoat: 0.8 });
  return (
    <group position={at}>
      <mesh geometry={sphere(0.075, 32, 16, Math.PI * 2, Math.PI / 2)} material={m} scale={[1, 0.75, 1]} castShadow receiveShadow />
      <mesh geometry={cyl(0.012, 0.012, 0.2, 12)} material={phys("cfbrass", { color: "#d6b06a", metalness: 0.9, roughness: 0.3 })} position={[0, 0.14, 0]} castShadow />
      <mesh geometry={cyl(0.085, 0.13, 0.16, 40, true)} material={shadeMat} position={[0, 0.3, 0]} castShadow />
      <mesh geometry={sphere(0.032, 16, 12)} material={bulb} position={[0, 0.27, 0]} />
    </group>
  );
};

export const Clock: React.FC<{ at: V3; text: string; glow: number }> = ({ at, text, glow }) => {
  const scr = phys(`cfclockscr${text}`, { color: "#000000", emissive: "#ffffff", emissiveMap: clockTex(text), emissiveIntensity: 1, roughness: 0.2, clearcoat: 1 });
  scr.emissiveIntensity = glow;
  return (
    <group position={at} rotation={[0, 0.55, 0]}>
      <mesh geometry={box(0.15, 0.075, 0.07, 0.02)} material={phys("cfclockbody", { color: "#2c3038", roughness: 0.35, clearcoat: 0.6 })} position={[0, 0.0375, 0]} castShadow />
      <mesh geometry={cached("cfclockplane", () => new PlaneGeometry(0.12, 0.055))} material={scr} position={[0, 0.0385, 0.0352]} />
    </group>
  );
};

export const Bedroom: React.FC<{ L?: BedroomLayout; lamp: number; clockText: string; clockGlow: number; ceiling?: boolean; children?: React.ReactNode }> = ({ L = BEDROOM, lamp, clockText, clockGlow, ceiling = true, children }) => {
  const M = mats(L);
  const { x0, x1, z0, z1, h } = L.room;
  const W = L.window;
  const bed = L.bed;
  const bw = bed.halfW * 2 + 0.08, bl = bed.z1 - bed.z0 + 0.06, bz = (bed.z0 + bed.z1) / 2;
  const ns = L.nightstand;
  const wallT = 0.12;
  return (
    <group>
      {/* floor + walls */}
      <mesh geometry={box(x1 - x0 + 0.4, 0.06, z1 - z0 + 0.4, 0.01)} material={M.floor} position={[(x0 + x1) / 2, -0.03, (z0 + z1) / 2]} receiveShadow />
      <mesh geometry={box(x1 - x0, h, wallT, 0.01)} material={M.wall} position={[(x0 + x1) / 2, h / 2, z0 - wallT / 2]} receiveShadow castShadow />
      <mesh geometry={box(wallT, h, z1 - z0, 0.01)} material={M.wall} position={[x0 - wallT / 2, h / 2, (z0 + z1) / 2]} receiveShadow castShadow />
      {/* window wall (+x) built around the opening */}
      <group position={[x1 + wallT / 2, 0, 0]}>
        <mesh geometry={box(wallT, W.y0, z1 - z0, 0.01)} material={M.wall} position={[0, W.y0 / 2, (z0 + z1) / 2]} receiveShadow castShadow />
        <mesh geometry={box(wallT, h - W.y1, z1 - z0, 0.01)} material={M.wall} position={[0, (h + W.y1) / 2, (z0 + z1) / 2]} receiveShadow castShadow />
        <mesh geometry={box(wallT, W.y1 - W.y0, W.z0 - z0, 0.01)} material={M.wall} position={[0, (W.y0 + W.y1) / 2, (z0 + W.z0) / 2]} receiveShadow castShadow />
        <mesh geometry={box(wallT, W.y1 - W.y0, z1 - W.z1, 0.01)} material={M.wall} position={[0, (W.y0 + W.y1) / 2, (W.z1 + z1) / 2]} receiveShadow castShadow />
        {/* frame, mullions, sill */}
        {[[0, W.y0], [0, W.y1], [0, (W.y0 + W.y1) / 2]].map(([, y], i) => (
          <mesh key={`h${i}`} geometry={box(0.08, 0.05, W.z1 - W.z0, 0.01)} material={M.white} position={[-0.02, y, (W.z0 + W.z1) / 2]} castShadow />
        ))}
        {[W.z0, W.z1, (W.z0 + W.z1) / 2].map((z, i) => (
          <mesh key={`v${i}`} geometry={box(0.08, W.y1 - W.y0, 0.05, 0.01)} material={M.white} position={[-0.02, (W.y0 + W.y1) / 2, z]} castShadow />
        ))}
        <mesh geometry={box(0.2, 0.04, W.z1 - W.z0 + 0.16, 0.012)} material={M.white} position={[-0.1, W.y0 - 0.02, (W.z0 + W.z1) / 2]} castShadow receiveShadow />
        <mesh geometry={cached("cfskyplane", () => new PlaneGeometry(5, 3.4))} material={basic("cfsky", { map: skyTex(), toneMapped: true })} position={[1.4, (W.y0 + W.y1) / 2 + 0.3, (W.z0 + W.z1) / 2]} rotation={[0, -Math.PI / 2, 0]} />
      </group>
      {/* curtains */}
      {[W.z0 - 0.22, W.z1 + 0.22].map((z, i) => (
        <mesh key={`c${i}`} geometry={curtainGeo(0.5, W.y1 - W.y0 + 0.5)} material={phys("cfcurtain", { color: "#f2e3c6", roughness: 0.85, sheen: 0.6, sheenColor: "#fff", side: DoubleSide })} position={[x1 - 0.12, (W.y0 + W.y1) / 2 + 0.05, z]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={cyl(0.015, 0.015, W.z1 - W.z0 + 1.2, 12)} material={M.metal} position={[x1 - 0.12, W.y1 + 0.22, (W.z0 + W.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} />
      {ceiling ? <mesh geometry={box(x1 - x0, 0.06, z1 - z0, 0.01)} material={M.wall} position={[(x0 + x1) / 2, h + 0.03, (z0 + z1) / 2]} /> : null}
      {/* baseboards */}
      <mesh geometry={box(x1 - x0, 0.09, 0.02, 0.005)} material={M.white} position={[(x0 + x1) / 2, 0.045, z0 + 0.01]} />
      <mesh geometry={box(0.02, 0.09, z1 - z0, 0.005)} material={M.white} position={[x1 - 0.01, 0.045, (z0 + z1) / 2]} />

      {/* bed */}
      <group position={[bed.x, 0, bz]}>
        <mesh geometry={box(bw + 0.06, 0.2, bl + 0.06, 0.03)} material={M.wood} position={[0, 0.2, 0]} castShadow receiveShadow />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} geometry={cyl(0.03, 0.025, 0.1, 12)} material={M.woodDark} position={[sx * (bw / 2 - 0.03), 0.05, sz * (bl / 2 - 0.03)]} />
        ))}
        <mesh geometry={box(bw - 0.04, bed.top - 0.3, bl - 0.04, 0.07)} material={M.sheet} position={[0, (bed.top + 0.3) / 2, 0]} castShadow receiveShadow />
      </group>
      <group position={[bed.x, 0, bed.z0 - 0.06]}>
        <mesh geometry={box(bw + 0.14, 1.1, 0.1, 0.05)} material={M.head} position={[0, 0.55, 0]} castShadow receiveShadow />
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={box(0.2, 0.52, 0.06, 0.03)} material={M.head} position={[k * 0.22, 0.8, 0.05]} castShadow />
        ))}
      </group>
      {/* pillows */}
      <mesh geometry={box(0.66, 0.16, 0.42, 0.075)} material={M.sheet} position={L.pillow} scale={[1, 0.85, 1]} castShadow receiveShadow />
      <mesh geometry={box(0.5, 0.36, 0.14, 0.06)} material={M.accent} position={[bed.x + 0.42, bed.top + 0.2, bed.z0 + 0.12]} rotation={[-0.25, -0.12, 0.03]} castShadow receiveShadow />

      {/* nightstand */}
      <group position={[ns.x, 0, ns.z]}>
        <mesh geometry={box(ns.w, ns.h - 0.08, ns.d, 0.025)} material={M.wood} position={[0, (ns.h + 0.08) / 2, 0]} castShadow receiveShadow />
        <mesh geometry={box(ns.w - 0.06, 0.16, 0.01, 0.004)} material={M.woodDark} position={[0, ns.h - 0.14, ns.d / 2 + 0.002]} rotation={[0, 0, 0]} />
        <mesh geometry={sphere(0.016, 12, 8)} material={M.metal} position={[0, ns.h - 0.14, ns.d / 2 + 0.014]} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} geometry={cyl(0.016, 0.012, 0.09, 10)} material={M.woodDark} position={[sx * (ns.w / 2 - 0.04), 0.045, sz * (ns.d / 2 - 0.04)]} />
        ))}
      </group>
      <Lamp at={L.lamp} on={lamp} />
      <Clock at={L.clock} text={clockText} glow={clockGlow} />

      {/* wall shelf above the nightstand */}
      <group position={[ns.x - 0.05, 1.42, z0 + 0.12]}>
        <mesh geometry={box(0.8, 0.035, 0.22, 0.008)} material={M.wood} castShadow receiveShadow />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => (
          <mesh key={k} geometry={box(0.035, 0.18 + (k % 3) * 0.03, 0.15, 0.006)} material={phys(`cfspine${k}`, { color: spineColors[k], roughness: 0.6 })} position={[-0.34 + k * 0.042, 0.11 + (k % 3) * 0.015, 0]} rotation={[0, 0, k === 6 ? -0.25 : 0]} castShadow />
        ))}
        <mesh geometry={cyl(0.05, 0.04, 0.09, 20)} material={M.pot} position={[0.22, 0.063, 0]} castShadow />
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} geometry={sphere(0.045, 12, 8)} material={M.leaf} position={[0.22 + 0.05 * Math.cos(k * 1.3), 0.14 + 0.03 * (k % 2), 0.04 * Math.sin(k * 1.3)]} scale={[1, 0.45, 0.7]} rotation={[0.3 * k, k, 0.5]} castShadow />
        ))}
      </group>
      {/* posters above the bed */}
      {[[-0.32, "#f7b267", "#f25c54", "#3d405b"], [0.3, "#8ecae6", "#219ebc", "#023047"]].map(([dx, a, b, c], i) => (
        <group key={i} position={[bed.x + (dx as number), 1.62 + i * 0.06, z0 + 0.02]} rotation={[0, 0, i ? 0.02 : -0.015]}>
          <mesh geometry={box(0.42, 0.56, 0.025, 0.006)} material={M.dark} castShadow />
          <mesh geometry={cached("cfposterplane", () => new PlaneGeometry(0.38, 0.52))} material={phys(`cfposter${i}`, { map: posterTex(String(i), a as string, b as string, c as string), roughness: 0.6 })} position={[0, 0, 0.014]} />
        </group>
      ))}
      {/* rug, slippers */}
      <mesh geometry={cached("cfrugplane", () => new PlaneGeometry(1.7, 1.7))} material={phys("cfrug", { map: rugTex(), roughness: 0.95, sheen: 0.6, sheenColor: "#fff" })} position={[bed.x + 1.05, 0.004, 0.7]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {[0, 1].map((k) => (
        <mesh key={k} geometry={box(0.11, 0.05, 0.27, 0.04)} material={M.accent} position={[bed.x + 0.98 + k * 0.15, 0.03, 0.45 + k * 0.04]} rotation={[0, 0.3 + k * 0.15, 0]} castShadow />
      ))}
      {/* desk corner (−x wall) */}
      <group position={[x0 + 0.38, 0, 1.15]}>
        <mesh geometry={box(0.7, 0.04, 1.1, 0.01)} material={M.wood} position={[0, 0.74, 0]} castShadow receiveShadow />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} geometry={cyl(0.02, 0.02, 0.72, 10)} material={M.dark} position={[sx * 0.3, 0.36, sz * 0.5]} />
        ))}
        <mesh geometry={box(0.3, 0.018, 0.4, 0.008)} material={phys("cflaptop", { color: "#b9bcc4", metalness: 0.7, roughness: 0.35 })} position={[0.05, 0.77, 0.1]} rotation={[0, 0.2, 0]} castShadow />
        <mesh geometry={cyl(0.04, 0.035, 0.1, 16)} material={M.white} position={[0.12, 0.81, -0.32]} castShadow />
        {/* desk chair, swivelled toward the room */}
        <mesh geometry={box(0.45, 0.05, 0.45, 0.02)} material={M.accent} position={[0.45, 0.47, 0.1]} castShadow receiveShadow />
        <mesh geometry={box(0.45, 0.5, 0.06, 0.02)} material={M.accent} position={[0.45, 0.72, -0.13]} castShadow />
        <mesh geometry={cyl(0.03, 0.03, 0.42, 10)} material={M.dark} position={[0.45, 0.22, 0.1]} castShadow />
        <mesh geometry={cyl(0.24, 0.24, 0.03, 20)} material={M.dark} position={[0.45, 0.02, 0.1]} />
      </group>
      {/* floor plant by the window */}
      <group position={[x1 - 0.38, 0, 0.85]}>
        <mesh geometry={cyl(0.17, 0.13, 0.36, 24)} material={M.pot} position={[0, 0.18, 0]} castShadow receiveShadow />
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} geometry={sphere(0.16, 16, 10)} material={M.leaf} position={[0.18 * Math.cos(k * 2.4), 0.55 + 0.09 * k, 0.18 * Math.sin(k * 2.4)]} scale={[1, 0.22, 0.62]} rotation={[0.4 * Math.sin(k), k * 2.4, 0.35]} castShadow />
        ))}
      </group>
      {children}
    </group>
  );
};

export type { Material };
