// Modular campus set (CHARACTERFLOW): a long pedestrian walkway for walking scenes, lecture buildings
// behind, trees, bushes, benches, lamp posts and small props for depth, under a bright sky dome.
// Everything is placed from one CampusLayout, so a topic can lengthen the walk, move the building,
// rename the sign or re-colour the palette without touching geometry code. Daylight, clean, playful.

import React from "react";
import { BackSide, PlaneGeometry, SphereGeometry } from "three";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { basic, canvasTex, mulberry32, phys, shade } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";
import type { V3 } from "../character/spec.ts";

export { CAMPUS, type CampusLayout } from "./campus.data.ts";
import type { CampusLayout } from "./campus.data.ts";
import { CAMPUS } from "./campus.data.ts";

// ── textures ────────────────────────────────────────────────────────────────
const grassTex = (base: string) =>
  canvasTex(`cfgrass${base}`, 512, 512, (g, w, h) => {
    const r = mulberry32(41);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,255,220" : "20,70,20"},${0.03 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 3 + r() * 5);
    }
    for (let k = 0; k < 30; k++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 1.5 + r() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }, [40, 26]);

const paverTex = (base: string) =>
  canvasTex(`cfpaver${base}`, 512, 512, (g, w, h) => {
    const r = mulberry32(17);
    g.fillStyle = shade(base, 0.72);
    g.fillRect(0, 0, w, h);
    const s = 64;
    for (let y = 0; y < h; y += s / 2)
      for (let x = ((y / (s / 2)) % 2) * (s / 2) - s; x < w + s; x += s) {
        g.fillStyle = shade(base, 0.92 + r() * 0.14);
        g.beginPath();
        g.roundRect(x + 2, y + 2, s - 4, s / 2 - 4, 4);
        g.fill();
      }
  }, [30, 1.4]);

const facadeTex = (wall: string, glass: string, band: string, floors: number, rep: number) =>
  canvasTex(`cffacade${wall}${glass}${floors}${rep}`, 1024, 512, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    const fh = h / floors;
    for (let f = 0; f < floors; f++) {
      g.fillStyle = band;
      g.fillRect(0, f * fh + fh - 10, w, 10);
      for (let i = 0; i < 8; i++) {
        const x = 24 + i * 125, y = f * fh + 26, ww = 92, hh = fh - 62;
        const gr = g.createLinearGradient(x, y, x + ww, y + hh);
        gr.addColorStop(0, shade(glass, 1.25));
        gr.addColorStop(0.5, glass);
        gr.addColorStop(1, shade(glass, 0.78));
        g.fillStyle = gr;
        g.fillRect(x, y, ww, hh);
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.beginPath();
        g.moveTo(x + 10, y + hh);
        g.lineTo(x + 40, y);
        g.lineTo(x + 55, y);
        g.lineTo(x + 25, y + hh);
        g.fill();
        g.strokeStyle = "#ffffff";
        g.lineWidth = 6;
        g.strokeRect(x, y, ww, hh);
        g.fillStyle = "#ffffff";
        g.fillRect(x + ww / 2 - 2, y, 4, hh);
      }
    }
  }, [rep, 1]);

const signTex = (text: string, accent: string) =>
  canvasTex(`cfsign${text}`, 1024, 160, (g, w, h) => {
    g.fillStyle = accent;
    g.beginPath();
    g.roundRect(0, 0, w, h, 24);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `600 86px ${FONT}, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });

const skyTex = () =>
  canvasTex("cfdaysky", 64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#3d8be6");
    gr.addColorStop(0.42, "#79b7f2");
    gr.addColorStop(0.5, "#cfe6f8");
    gr.addColorStop(1, "#cfe6f8");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

// ── pieces ──────────────────────────────────────────────────────────────────
export const Tree: React.FC<{ p: V3; s?: number; seed?: number; P: CampusLayout["palette"] }> = ({ p, s = 1, seed = 1, P }) => {
  const r = mulberry32(seed * 97 + 5);
  const trunk = phys(`cftrunk${P.trunk}`, { color: P.trunk, roughness: 0.85 });
  const leaves = P.leaf.map((c) => phys(`cfleafc${c}`, { color: c, roughness: 0.7, sheen: 0.5, sheenColor: "#e8ffd0" }));
  const h = (2.6 + r() * 0.8) * s;
  return (
    <group position={p} rotation={[0, r() * 6, 0]}>
      <mesh geometry={cyl(0.12 * s, 0.18 * s, h, 12)} material={trunk} position={[0, h / 2, 0]} castShadow receiveShadow />
      {Array.from({ length: 6 }, (_, k) => {
        const a = k * 2.1 + r(), rr = (k === 0 ? 0 : 0.75 + r() * 0.4) * s;
        const sz = (k === 0 ? 1.45 : 0.95 + r() * 0.35) * s;
        return <mesh key={k} geometry={sphere(1, 20, 14)} material={leaves[k % leaves.length]} position={[Math.cos(a) * rr, h + 0.4 * s + (k === 0 ? 0.55 * s : r() * 0.6 * s), Math.sin(a) * rr]} scale={[sz, sz * 0.86, sz]} castShadow receiveShadow />;
      })}
    </group>
  );
};

const Bench: React.FC<{ p: V3; yaw: number }> = ({ p, yaw }) => {
  const wood = phys("cfbenchwood", { color: "#c58b54", roughness: 0.6, clearcoat: 0.2 });
  const iron = phys("cfbenchiron", { color: "#2d3340", roughness: 0.45, metalness: 0.5 });
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {[0, 1, 2].map((k) => <mesh key={k} geometry={box(1.6, 0.04, 0.12, 0.015)} material={wood} position={[0, 0.45, -0.14 + k * 0.14]} castShadow receiveShadow />)}
      {[0, 1].map((k) => <mesh key={`b${k}`} geometry={box(1.6, 0.11, 0.035, 0.015)} material={wood} position={[0, 0.66 + k * 0.15, -0.24]} rotation={[-0.12, 0, 0]} castShadow />)}
      {[-1, 1].map((sx) => <mesh key={`l${sx}`} geometry={box(0.06, 0.45, 0.42, 0.02)} material={iron} position={[sx * 0.7, 0.225, -0.04]} castShadow />)}
    </group>
  );
};

const Lamp: React.FC<{ p: V3 }> = ({ p }) => {
  const iron = phys("cflampiron", { color: "#2d3340", roughness: 0.4, metalness: 0.6 });
  return (
    <group position={p}>
      <mesh geometry={cyl(0.05, 0.07, 3.4, 12)} material={iron} position={[0, 1.7, 0]} castShadow />
      <mesh geometry={sphere(0.2, 20, 14)} material={phys("cflampglobe", { color: "#fffaf0", roughness: 0.2, transmission: 0, emissive: "#fff3d8", emissiveIntensity: 0.2 })} position={[0, 3.55, 0]} castShadow />
      <mesh geometry={cyl(0.22, 0.12, 0.08, 16)} material={iron} position={[0, 3.36, 0]} />
    </group>
  );
};

const Bush: React.FC<{ p: V3; seed: number; P: CampusLayout["palette"] }> = ({ p, seed, P }) => {
  const r = mulberry32(seed * 31 + 7);
  const m = phys(`cfleafc${P.leaf[seed % P.leaf.length]}`, { color: P.leaf[seed % P.leaf.length], roughness: 0.7, sheen: 0.5, sheenColor: "#e8ffd0" });
  return (
    <group position={p}>
      {[0, 1, 2].map((k) => <mesh key={k} geometry={sphere(1, 16, 12)} material={m} position={[(k - 1) * 0.42 + (r() - 0.5) * 0.2, 0.28 + r() * 0.12, (r() - 0.5) * 0.25]} scale={[0.5 + r() * 0.15, 0.42 + r() * 0.15, 0.45]} castShadow receiveShadow />)}
      {r() < 0.5 ? [0, 1, 2].map((k) => <mesh key={`f${k}`} geometry={sphere(0.05, 8, 6)} material={phys(`cfflower${k}`, { color: ["#ffd166", "#ff8fab", "#ffffff"][k], roughness: 0.6 })} position={[(k - 1) * 0.35 + 0.05, 0.62, 0.3]} />) : null}
    </group>
  );
};

const Building: React.FC<{ L: CampusLayout }> = ({ L }) => {
  const B = L.building, P = L.palette;
  const W = B.x1 - B.x0, H = B.floors * 3.6 + 0.6, cx = (B.x0 + B.x1) / 2;
  const facade = phys(`cffacade${P.wall}${W}`, { color: "#ffffff", map: facadeTex(P.wall, P.glass, P.band, B.floors, Math.round(W / 9)), roughness: 0.6 });
  const wall = phys(`cfwallc${P.wall}`, { color: P.wall, roughness: 0.75 });
  const band = phys(`cfband${P.band}`, { color: P.band, roughness: 0.6 });
  return (
    <group>
      <mesh geometry={box(W, H, B.depth, 0.05)} material={wall} position={[cx, H / 2, B.z - B.depth / 2]} castShadow receiveShadow />
      <mesh geometry={cached(`cffacadeplane${W},${H}`, () => new PlaneGeometry(W - 0.2, H - 0.8))} material={facade} position={[cx, H / 2 - 0.1, B.z + 0.02]} />
      <mesh geometry={box(W + 0.6, 0.4, B.depth + 0.6, 0.05)} material={phys(`cfroof${P.roof}`, { color: P.roof, roughness: 0.7 })} position={[cx, H + 0.2, B.z - B.depth / 2]} castShadow />
      {Array.from({ length: Math.floor(W / 4.5) + 1 }, (_, k) => (
        <mesh key={k} geometry={box(0.42, H, 0.3, 0.04)} material={band} position={[B.x0 + 0.3 + k * 4.5, H / 2, B.z + 0.12]} castShadow />
      ))}
      {/* entrance portico, canopy, stairs, sign */}
      <group position={[L.entrance.x, 0, B.z]}>
        <mesh geometry={box(5.2, 0.25, 2.6, 0.04)} material={phys("cfcanopy", { color: P.accent, roughness: 0.5 })} position={[0, 3.3, 1.2]} castShadow />
        {[-1, 1].map((s) => <mesh key={s} geometry={cyl(0.13, 0.13, 3.3, 16)} material={phys("cfcolumn", { color: "#ffffff", roughness: 0.4 })} position={[s * 2.3, 1.65, 2.3]} castShadow />)}
        {[0, 1, 2].map((k) => <mesh key={`s${k}`} geometry={box(4.6 - k * 0.3, 0.15, 0.4, 0.02)} material={phys("cfstair", { color: "#e3ddd2", roughness: 0.8 })} position={[0, 0.075 + k * 0.15, 2.4 - k * 0.4]} receiveShadow castShadow />)}
        <mesh geometry={box(2.8, 2.6, 0.1, 0.02)} material={phys("cfdoor", { color: P.glass, roughness: 0.15, clearcoat: 1 })} position={[0, 1.55, 0.06]} />
        <mesh geometry={cached("cfsignplane", () => new PlaneGeometry(4.6, 0.72))} material={phys(`cfsign${B.sign}`, { map: signTex(B.sign, P.accent), roughness: 0.5 })} position={[0, 3.3, 2.53]} />
      </group>
    </group>
  );
};

export const Campus: React.FC<{ L?: CampusLayout; children?: React.ReactNode }> = ({ L = CAMPUS, children }) => {
  const P = L.palette, W = L.path;
  const grass = phys(`cfgrassm${P.grass}`, { color: "#ffffff", map: grassTex(P.grass), roughness: 0.95 });
  const paver = phys(`cfpaverm${P.paver}`, { color: "#ffffff", map: paverTex(P.paver), roughness: 0.8 });
  paver.map!.repeat.set((W.x1 - W.x0) / 2.2, 1.4);
  const curb = phys(`cfcurb${P.curb}`, { color: P.curb, roughness: 0.6 });
  const len = W.x1 - W.x0, cx = (W.x0 + W.x1) / 2;
  return (
    <group>
      {/* sky dome + clouds */}
      <mesh geometry={cached("cfskydome", () => new SphereGeometry(140, 32, 16))} material={basic("cfskydome", { map: skyTex(), side: BackSide, fog: false, toneMapped: false })} />
      {[[-60, 26, -90, 1.4], [-10, 32, -110, 1.8], [45, 24, -95, 1.2], [80, 30, -60, 1.5], [-85, 22, -40, 1.1]].map(([x, y, z, s], i) => (
        <group key={`cl${i}`} position={[x, y, z]} scale={s}>
          {[[-4, 0, 0, 4], [0, 1.4, 0, 5], [4.5, 0.2, 0, 3.6], [1.5, -0.6, 1, 4]].map(([a, b, c, r], k) => (
            <mesh key={k} geometry={sphere(1, 16, 12)} material={basic("cfcloud", { color: "#ffffff", fog: false })} position={[a, b, c]} scale={[r, r * 0.62, r * 0.7]} />
          ))}
        </group>
      ))}
      {/* ground, walkway, curbs, side path */}
      <mesh geometry={cached("cfground", () => new PlaneGeometry(240, 160))} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow />
      <mesh geometry={box(len, 0.06, W.width, 0.02)} material={paver} position={[cx, 0.0, W.z]} receiveShadow />
      {[-1, 1].map((s) => <mesh key={s} geometry={box(len, 0.1, 0.16, 0.03)} material={curb} position={[cx, 0.03, W.z + s * (W.width / 2 + 0.08)]} receiveShadow castShadow />)}
      <mesh geometry={box(3.4, 0.05, Math.abs(L.building.z - W.z) - W.width / 2, 0.02)} material={paver} position={[L.entrance.x, -0.002, (L.building.z + W.z - W.width / 2) / 2]} receiveShadow />
      <Building L={L} />
      {/* a second, farther building for depth */}
      <group position={[-44, 0, -24]} rotation={[0, 0.5, 0]}>
        <mesh geometry={box(22, 15, 10, 0.05)} material={phys("cfbldg2", { color: "#cfe0ec", roughness: 0.7 })} position={[0, 7.5, 0]} castShadow receiveShadow />
        {Array.from({ length: 4 }, (_, f) => <mesh key={f} geometry={box(22.2, 0.5, 10.2, 0.02)} material={phys("cfbldg2band", { color: "#7aa6c8" })} position={[0, 3 + f * 3.5, 0]} />)}
      </group>
      <group position={[38, 0, -22]} rotation={[0, -0.4, 0]}>
        <mesh geometry={box(16, 11, 10, 0.05)} material={phys("cfbldg3", { color: "#f6d9b8", roughness: 0.7 })} position={[0, 5.5, 0]} castShadow receiveShadow />
      </group>
      {/* far tree line */}
      {Array.from({ length: 22 }, (_, k) => <Tree key={`ft${k}`} p={[-70 + k * 6.6, 0, -34 - (k % 3) * 3]} s={1.6} seed={100 + k} P={P} />)}
      {L.trees.map((p, i) => <Tree key={`t${i}`} p={p} seed={i + 1} P={P} />)}
      {L.bushes.map((p, i) => <Bush key={`b${i}`} p={p} seed={i + 1} P={P} />)}
      {L.benches.map((b, i) => <Bench key={`bn${i}`} p={b.p} yaw={b.yaw} />)}
      {L.lamps.map((p, i) => <Lamp key={`lp${i}`} p={p} />)}
      {/* bins + notice board */}
      {L.bins.map((p, i) => (
        <group key={`bin${i}`} position={p}>
          <mesh geometry={cyl(0.24, 0.2, 0.75, 20)} material={phys(`cfbin${i}`, { color: i ? "#4f9d69" : "#f2b544", roughness: 0.5 })} position={[0, 0.375, 0]} castShadow />
          <mesh geometry={cyl(0.26, 0.26, 0.05, 20)} material={phys("cfbinlid", { color: "#2d3340" })} position={[0, 0.77, 0]} />
        </group>
      ))}
      <group position={[2, 0, -2.6]}>
        <mesh geometry={box(1.6, 1.1, 0.08, 0.03)} material={phys("cfboard", { color: "#9c6b45", roughness: 0.7 })} position={[0, 1.35, 0]} castShadow />
        {[0, 1, 2, 3, 4].map((k) => <mesh key={k} geometry={box(0.36, 0.3, 0.01, 0.005)} material={phys(`cfpaper${k}`, { color: ["#fff6c2", "#ffffff", "#d7f0ff", "#ffd7e1", "#e5ffd6"][k], roughness: 0.8 })} position={[-0.5 + (k % 3) * 0.48, 1.55 - Math.floor(k / 3) * 0.42, 0.05]} rotation={[0, 0, (k - 2) * 0.04]} />)}
        {[-1, 1].map((s) => <mesh key={s} geometry={cyl(0.04, 0.04, 1.9, 10)} material={phys("cfboardpost", { color: "#5b3a29" })} position={[s * 0.7, 0.95, 0]} castShadow />)}
      </group>
      {children}
    </group>
  );
};
