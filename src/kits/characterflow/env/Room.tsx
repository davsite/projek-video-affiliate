// Generic indoor set: draws any RoomLayout (room.data.ts) — floor, four walls with window / door openings
// and the view outside, ceiling with lamps, and the furniture pieces. Everything is built from the same
// small parts (rounded boxes, cylinders, spheres) and shared materials, so a new room is data only.

import React from "react";
import { DoubleSide, PlaneGeometry } from "three";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { basic, phys, shade } from "../lib/mats.ts";
import { boardTex, carpetTex, paintTex, plankTex, spineColors, tileTex, viewTex } from "./textures.ts";
import { DESK_CHAIR, type Piece, type RoomLayout, type Wall } from "./room.data.ts";
import type { TimeOfDay } from "./registry.ts";

type M = ReturnType<typeof mats>;
const mats = (L: RoomLayout) => {
  const P = L.palette;
  const w = P.wall, rx = L.room.x1 - L.room.x0, rz = L.room.z1 - L.room.z0;
  return {
    wall: phys(`rmwall${L.id}`, { color: "#ffffff", map: paintTex(`rm${L.id}`, w, [3, 2]), roughness: 0.92 }),
    wallLow: phys(`rmwallLow${L.id}`, { color: "#ffffff", map: paintTex(`rmL${L.id}`, P.wallLow ?? w, [3, 1]), roughness: 0.85 }),
    floor: phys(`rmfloor${L.id}`, {
      color: "#ffffff",
      map: P.floorKind === "wood" ? plankTex([rx / 1.6, rz / 3.2], P.floor) : P.floorKind === "tile" ? tileTex(P.floor, [rx / 2, rz / 2]) : carpetTex(P.floor, [rx / 1.2, rz / 1.2]),
      roughness: P.floorKind === "carpet" ? 0.95 : 0.55,
      clearcoat: P.floorKind === "wood" ? 0.2 : P.floorKind === "tile" ? 0.12 : 0,
      clearcoatRoughness: 0.45,
    }),
    ceiling: phys(`rmceil${L.id}`, { color: P.ceiling ?? "#e8e5df", roughness: 0.95 }),
    trim: phys(`rmtrim${P.trim}`, { color: P.trim, roughness: 0.45, clearcoat: 0.3 }),
    accent: phys(`rmacc${P.accent}`, { color: P.accent, roughness: 0.6, sheen: 0.4 }),
    wood: phys("rmwood", { color: "#b98b5e", roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    woodDark: phys("rmwoodD", { color: "#6b4a33", roughness: 0.55 }),
    white: phys("rmwhite", { color: "#e4e1db", roughness: 0.4, clearcoat: 0.3 }),
    metal: phys("rmmetal", { color: "#b9bcc2", roughness: 0.3, metalness: 0.8 }),
    dark: phys("rmdark", { color: "#2b2d33", roughness: 0.45 }),
    glass: phys("rmglass", { color: "#cfe6f5", roughness: 0.05, transmission: 0.9, thickness: 0.01, transparent: true, opacity: 0.25 }),
    leaf: phys("rmleaf", { color: "#3f8f5a", roughness: 0.6, sheen: 0.4, sheenColor: "#a8e6b8" }),
    pot: phys("rmpot", { color: "#e07a5f", roughness: 0.7 }),
    screen: phys("rmscreen", { color: "#0d1520", emissive: "#7fb2ff", emissiveIntensity: 0.55, roughness: 0.2, clearcoat: 1 }),
  };
};

const T = 0.12; // wall thickness

/** A wall along its own axis from 0 to len, height h, with openings; drawn in local coords (x along, z out). */
const WallMesh: React.FC<{ len: number; h: number; holes: { a: number; b: number; y0: number; y1: number }[]; m: M; split: number; shadow: boolean }> = ({ len, h, holes, m, split, shadow }) => {
  const cuts = [...new Set([0, len, ...holes.flatMap((o) => [o.a, o.b])])].sort((a, b) => a - b);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2, w = b - a;
    if (w < 0.005) continue;
    const hole = holes.find((o) => mid > o.a && mid < o.b);
    const spans: [number, number][] = hole ? [[0, hole.y0], [hole.y1, h]] : [[0, h]];
    for (const [y0, y1] of spans) {
      if (y1 - y0 < 0.005) continue;
      // two-tone wall: a lower band up to `split`
      const parts: [number, number, boolean][] = y0 < split && y1 > split ? [[y0, split, true], [split, y1, false]] : [[y0, y1, y0 < split]];
      for (const [p0, p1, low] of parts)
        out.push(<mesh key={`${i}-${p0}`} geometry={box(w, p1 - p0, T, 0.004)} material={low ? m.wallLow : m.wall} position={[mid, (p0 + p1) / 2, 0]} castShadow={shadow} receiveShadow />);
    }
  }
  // a dado rail on two-tone walls
  if (split > 0) out.push(<mesh key="rail" geometry={box(len, 0.04, 0.03, 0.01)} material={m.trim} position={[len / 2, split, T / 2 + 0.01]} />);
  out.push(<mesh key="base" geometry={box(len, 0.09, 0.02, 0.005)} material={m.trim} position={[len / 2, 0.045, T / 2 + 0.01]} />);
  return <>{out}</>;
};

const WindowFrame: React.FC<{ w: number; y0: number; y1: number; m: M; view: RoomLayout["view"]; time: TimeOfDay }> = ({ w, y0, y1, m, view, time }) => {
  const hh = y1 - y0, cy = (y0 + y1) / 2;
  const viewMat = basic(`rmview${view}${time}`, { map: viewTex(view, time), toneMapped: true });
  return (
    <group>
      {[y0, y1, cy].map((y, i) => <mesh key={`h${i}`} geometry={box(w, 0.05, 0.07, 0.01)} material={m.white} position={[w / 2, y, 0.02]} castShadow />)}
      {[0, w, w / 2].map((x, i) => <mesh key={`v${i}`} geometry={box(0.05, hh, 0.07, 0.01)} material={m.white} position={[x, cy, 0.02]} castShadow />)}
      <mesh geometry={box(w + 0.12, 0.04, 0.2, 0.012)} material={m.white} position={[w / 2, y0 - 0.02, 0.1]} castShadow receiveShadow />
      <mesh geometry={cached(`rmviewplane${w}`, () => new PlaneGeometry(w * 2.2, hh * 2.4))} material={viewMat} position={[w / 2, cy + 0.2, -1.6]} />
    </group>
  );
};

const Door: React.FC<{ w: number; h: number; m: M }> = ({ w, h, m }) => (
  <group>
    <mesh geometry={box(w - 0.06, h - 0.03, 0.05, 0.01)} material={m.woodDark} position={[w / 2, (h - 0.03) / 2, -0.02]} castShadow receiveShadow />
    {[0, w].map((x, i) => <mesh key={i} geometry={box(0.07, h, 0.15, 0.01)} material={m.trim} position={[x, h / 2, 0]} />)}
    <mesh geometry={box(w + 0.07, 0.07, 0.15, 0.01)} material={m.trim} position={[w / 2, h, 0]} />
    <mesh geometry={sphere(0.03, 12, 8)} material={m.metal} position={[w - 0.12, 1.0, 0.03]} />
  </group>
);

// ── furniture ───────────────────────────────────────────────────────────────
const Legs: React.FC<{ w: number; d: number; h: number; r?: number; m: React.ComponentProps<"mesh">["material"] }> = ({ w, d, h, r = 0.022, m }) => (
  <>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => <mesh key={i} geometry={cyl(r, r * 0.85, h, 10)} material={m} position={[sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)]} castShadow />)}</>
);

const Chair: React.FC<{ color?: string; m: M }> = ({ color = "#6b7a8f", m }) => {
  const c = phys(`rmchair${color}`, { color, roughness: 0.6, sheen: 0.3 });
  return (
    <group>
      <mesh geometry={box(0.44, 0.05, 0.42, 0.02)} material={c} position={[0, 0.455, 0]} castShadow receiveShadow />
      <mesh geometry={box(0.44, 0.44, 0.05, 0.02)} material={c} position={[0, 0.72, -0.2]} rotation={[-0.08, 0, 0]} castShadow />
      <Legs w={0.42} d={0.4} h={0.44} r={0.016} m={m.dark} />
    </group>
  );
};

const Laptop: React.FC<{ m: M }> = ({ m }) => (
  <group>
    <mesh geometry={box(0.34, 0.018, 0.24, 0.008)} material={m.metal} position={[0, 0.009, 0]} castShadow />
    <group position={[0, 0.018, 0.12]} rotation={[0.32, 0, 0]}>
      <mesh geometry={box(0.34, 0.23, 0.012, 0.006)} material={m.metal} position={[0, 0.115, 0]} castShadow />
      <mesh geometry={cached("rmlapscr", () => new PlaneGeometry(0.31, 0.2))} material={m.screen} position={[0, 0.118, -0.0065]} rotation={[0, Math.PI, 0]} />
    </group>
  </group>
);

const Books: React.FC<{ n?: number }> = ({ n = 4 }) => (
  <>{Array.from({ length: n }, (_, k) => <mesh key={k} geometry={box(0.24, 0.04, 0.17, 0.006)} material={phys(`rmbook${k}`, { color: spineColors[k % spineColors.length], roughness: 0.6 })} position={[0, 0.02 + k * 0.041, 0]} rotation={[0, 0.15 * (k % 2 ? 1 : -1), 0]} castShadow />)}</>
);
const Mug: React.FC<{ m: M; color?: string }> = ({ m, color }) => (
  <mesh geometry={cyl(0.04, 0.035, 0.095, 18)} material={color ? phys(`rmmug${color}`, { color, roughness: 0.35, clearcoat: 0.5 }) : m.white} position={[0, 0.048, 0]} castShadow />
);
const SmallPlant: React.FC<{ m: M }> = ({ m }) => (
  <group>
    <mesh geometry={cyl(0.06, 0.045, 0.1, 18)} material={m.pot} position={[0, 0.05, 0]} castShadow />
    {[0, 1, 2, 3, 4].map((k) => <mesh key={k} geometry={sphere(0.05, 12, 8)} material={m.leaf} position={[0.05 * Math.cos(k * 1.3), 0.14 + 0.025 * (k % 2), 0.05 * Math.sin(k * 1.3)]} scale={[1, 0.5, 0.7]} rotation={[0.3 * k, k, 0.5]} castShadow />)}
  </group>
);

const PieceView: React.FC<{ p: Piece; m: M; night: boolean }> = ({ p, m, night }) => {
  const yaw = "yaw" in p && p.yaw !== undefined ? p.yaw : 0;
  const at: [number, number, number] = [p.at[0], 0, p.at[1]];
  switch (p.k) {
    case "desk": {
      const w = p.w ?? 1.2, d = p.d ?? 0.6, top = p.top ?? [];
      const mat = phys(`rmdesk${p.color ?? "w"}`, { color: p.color ?? "#b98b5e", roughness: 0.45, clearcoat: 0.3 });
      const slots = [-w / 2 + 0.25, w / 2 - 0.22, 0.05];
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, 0.04, d, 0.012)} material={mat} position={[0, 0.74, 0]} castShadow receiveShadow />
          <Legs w={w} d={d} h={0.72} m={m.dark} />
          <mesh geometry={box(w - 0.12, 0.3, 0.02, 0.006)} material={mat} position={[0, 0.55, d / 2 - 0.04]} castShadow />
          {top.map((it, i) => (
            <group key={i} position={[it === "laptop" ? -w / 2 + 0.3 : slots[(i + 1) % 2], 0.76, it === "laptop" ? -0.06 : 0.05]} rotation={[0, it === "laptop" ? Math.PI - 0.45 : 0.3, 0]}>
              {it === "laptop" ? <Laptop m={m} /> : it === "books" ? <Books n={3} /> : it === "mug" ? <Mug m={m} color="#e76f51" /> : it === "plant" ? <SmallPlant m={m} /> : (
                <group>
                  <mesh geometry={box(0.52, 0.32, 0.03, 0.01)} material={m.dark} position={[0, 0.3, 0.1]} castShadow />
                  <mesh geometry={cached("rmmonscr", () => new PlaneGeometry(0.48, 0.28))} material={m.screen} position={[0, 0.3, 0.084]} rotation={[0, Math.PI, 0]} />
                  <mesh geometry={cyl(0.015, 0.015, 0.15, 8)} material={m.dark} position={[0, 0.08, 0.1]} />
                  <mesh geometry={box(0.2, 0.015, 0.15, 0.005)} material={m.dark} position={[0, 0.008, 0.1]} />
                </group>
              )}
            </group>
          ))}
          {p.seat ? <group position={[0, 0, -DESK_CHAIR]}><Chair m={m} color="#2f3542" /></group> : null}
        </group>
      );
    }
    case "schoolDesk":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(0.62, 0.035, 0.45, 0.01)} material={m.wood} position={[0, 0.71, 0]} castShadow receiveShadow />
          <mesh geometry={box(0.58, 0.012, 0.4, 0.004)} material={m.dark} position={[0, 0.62, 0]} castShadow />
          <Legs w={0.6} d={0.43} h={0.7} r={0.015} m={m.metal} />
          <group position={[0, 0, -0.5]}><Chair m={m} color="#3e7cb1" /></group>
        </group>
      );
    case "chair":
      return <group position={at} rotation={[0, yaw, 0]}><Chair m={m} color={p.color} /></group>;
    case "stool":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={cyl(0.19, 0.19, 0.05, 24)} material={m.woodDark} position={[0, 0.62, 0]} castShadow receiveShadow />
          <mesh geometry={cyl(0.025, 0.025, 0.6, 10)} material={m.metal} position={[0, 0.3, 0]} castShadow />
          <mesh geometry={cyl(0.18, 0.2, 0.025, 24)} material={m.metal} position={[0, 0.012, 0]} />
        </group>
      );
    case "sofa": case "armchair": {
      const w = p.k === "sofa" ? p.w ?? 2.0 : 0.95;
      const c = phys(`rmsofa${p.color}`, { color: p.color ?? "#5b7fa6", roughness: 0.85, sheen: 0.7, sheenColor: shade(p.color ?? "#5b7fa6", 1.6) });
      const n = p.k === "sofa" ? Math.max(2, (p.seats ?? []).length || 2) : 1;
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, 0.3, 0.85, 0.06)} material={c} position={[0, 0.22, 0]} castShadow receiveShadow />
          <mesh geometry={box(w, 0.55, 0.2, 0.08)} material={c} position={[0, 0.6, -0.33]} castShadow receiveShadow />
          {[-1, 1].map((s) => <mesh key={s} geometry={box(0.18, 0.5, 0.85, 0.07)} material={c} position={[s * (w / 2 - 0.09), 0.37, 0]} castShadow receiveShadow />)}
          {Array.from({ length: n }, (_, i) => {
            const cw = (w - 0.36) / n;
            return <mesh key={i} geometry={box(cw - 0.03, 0.12, 0.62, 0.05)} material={c} position={[-w / 2 + 0.18 + cw * (i + 0.5), 0.41, 0.08]} castShadow receiveShadow />;
          })}
          {p.k === "sofa" ? <mesh geometry={box(0.42, 0.36, 0.13, 0.06)} material={m.accent} position={[w / 2 - 0.42, 0.62, -0.18]} rotation={[-0.2, -0.15, 0.04]} castShadow /> : null}
          <Legs w={w - 0.1} d={0.75} h={0.07} r={0.025} m={m.woodDark} />
        </group>
      );
    }
    case "coffeeTable": {
      const w = p.w ?? 1.0, d = p.d ?? 0.55;
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, 0.05, d, 0.015)} material={m.wood} position={[0, 0.42, 0]} castShadow receiveShadow />
          <mesh geometry={box(w - 0.1, 0.03, d - 0.1, 0.01)} material={m.woodDark} position={[0, 0.14, 0]} castShadow receiveShadow />
          <Legs w={w} d={d} h={0.41} r={0.02} m={m.woodDark} />
          <group position={[0.22, 0.445, 0.05]}><Mug m={m} color="#2a9d8f" /></group>
          <group position={[-0.25, 0.445, -0.04]}><Books n={2} /></group>
        </group>
      );
    }
    case "cafeTable": {
      const r = p.r ?? 0.36;
      return (
        <group position={at}>
          <mesh geometry={cyl(r, r, 0.035, 40)} material={m.wood} position={[0, 0.74, 0]} castShadow receiveShadow />
          <mesh geometry={cyl(0.03, 0.03, 0.72, 10)} material={m.dark} position={[0, 0.37, 0]} castShadow />
          <mesh geometry={cyl(0.22, 0.24, 0.025, 24)} material={m.dark} position={[0, 0.012, 0]} />
          {Array.from({ length: p.cups ?? 0 }, (_, i) => (
            <group key={i} position={[(i ? 1 : -1) * r * 0.45, 0.76, (i ? -0.06 : 0.05)]}>
              <mesh geometry={cyl(0.07, 0.07, 0.008, 20)} material={m.white} position={[0, 0.004, 0]} />
              <mesh geometry={cyl(0.042, 0.034, 0.075, 18)} material={m.white} position={[0, 0.045, 0]} castShadow />
              <mesh geometry={cyl(0.037, 0.037, 0.004, 18)} material={phys("rmcoffee", { color: "#5a3a22", roughness: 0.2, clearcoat: 1 })} position={[0, 0.078, 0]} />
            </group>
          ))}
        </group>
      );
    }
    case "counter": {
      const w = p.w ?? 3, d = p.d ?? 0.6, h = p.h ?? 1.0;
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, h - 0.05, d, 0.02)} material={m.woodDark} position={[0, (h - 0.05) / 2, 0]} castShadow receiveShadow />
          <mesh geometry={box(w + 0.08, 0.05, d + 0.1, 0.012)} material={phys("rmcountertop", { color: "#e8e1d6", roughness: 0.25, clearcoat: 0.6 })} position={[0, h - 0.025, 0.02]} castShadow receiveShadow />
          {Array.from({ length: Math.floor(w / 0.5) }, (_, i) => <mesh key={i} geometry={box(0.42, h - 0.2, 0.01, 0.004)} material={m.wood} position={[-w / 2 + 0.27 + i * 0.5, (h - 0.05) / 2, d / 2 + 0.004]} />)}
          {p.machine ? (
            <group position={[w / 2 - 0.6, h, -0.05]}>
              <mesh geometry={box(0.55, 0.42, 0.4, 0.04)} material={phys("rmespresso", { color: "#c0392b", roughness: 0.25, clearcoat: 0.8 })} position={[0, 0.21, 0]} castShadow />
              <mesh geometry={box(0.5, 0.05, 0.38, 0.01)} material={m.metal} position={[0, 0.445, 0]} castShadow />
              {[-0.12, 0.12].map((x) => <mesh key={x} geometry={cyl(0.03, 0.03, 0.08, 12)} material={m.metal} position={[x, 0.12, 0.22]} rotation={[Math.PI / 2, 0, 0]} />)}
              {[0, 1, 2].map((k) => <mesh key={k} geometry={cyl(0.04, 0.034, 0.08, 16)} material={m.white} position={[-0.15 + k * 0.15, 0.49, 0]} castShadow />)}
            </group>
          ) : null}
          <group position={[-w / 2 + 0.5, h, 0.05]}>
            <mesh geometry={box(0.3, 0.2, 0.25, 0.03)} material={m.dark} position={[0, 0.1, 0]} castShadow />
            <mesh geometry={box(0.26, 0.14, 0.02, 0.01)} material={m.screen} position={[0, 0.27, 0.02]} rotation={[-0.4, 0, 0]} />
          </group>
          <mesh geometry={cyl(0.16, 0.12, 0.12, 24, true)} material={phys("rmjar", { color: "#f3ead8", roughness: 0.1, transmission: 0.6, transparent: true, opacity: 0.6, side: DoubleSide })} position={[-w / 2 + 1.1, h + 0.06, 0.05]} />
        </group>
      );
    }
    case "shelf": {
      const w = p.w ?? 1.0, h = p.h ?? 1.9, d = 0.32, rows = Math.max(2, Math.round(h / 0.42));
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          {[-1, 1].map((s) => <mesh key={s} geometry={box(0.03, h, d, 0.008)} material={m.wood} position={[s * (w / 2 - 0.015), h / 2, 0]} castShadow receiveShadow />)}
          <mesh geometry={box(w, h, 0.02, 0.005)} material={m.woodDark} position={[0, h / 2, -d / 2 + 0.01]} receiveShadow />
          {Array.from({ length: rows + 1 }, (_, r) => <mesh key={r} geometry={box(w, 0.025, d, 0.006)} material={m.wood} position={[0, 0.03 + (r * (h - 0.06)) / rows, 0]} castShadow receiveShadow />)}
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: Math.floor((w - 0.1) / 0.05) }, (_, k) => (k * 7 + r * 3) % 11 === 0 ? null : (
              <mesh key={`${r}-${k}`} geometry={box(0.04, 0.22 + ((k + r) % 3) * 0.04, 0.2, 0.005)} material={phys(`rmspine${(k + r) % 8}`, { color: spineColors[(k + r) % 8], roughness: 0.65 })} position={[-w / 2 + 0.07 + k * 0.05, 0.045 + (r * (h - 0.06)) / rows + 0.11 + ((k + r) % 3) * 0.02, 0.02]} castShadow />
            )))}
        </group>
      );
    }
    case "board": {
      const w = p.w ?? 2.4, h = p.h ?? 1.2, y = p.y ?? 0.95, st = p.style ?? "white";
      return (
        <group position={[at[0], y, at[2]]} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w + 0.08, h + 0.08, 0.03, 0.01)} material={st === "white" ? m.metal : m.woodDark} position={[0, h / 2, 0.015]} castShadow />
          <mesh geometry={cached(`rmboard${w},${h}`, () => new PlaneGeometry(w, h))} material={phys(`rmboard${st}`, { map: boardTex(st), roughness: st === "white" ? 0.25 : 0.9, clearcoat: st === "white" ? 0.6 : 0 })} position={[0, h / 2, 0.032]} />
          {st === "white" ? <mesh geometry={box(w * 0.6, 0.03, 0.07, 0.008)} material={m.metal} position={[0, -0.02, 0.05]} /> : null}
        </group>
      );
    }
    case "tv": {
      const w = p.w ?? 1.2;
      return (
        <group position={[at[0], 0.5, at[2]]} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, w * 0.58, 0.05, 0.01)} material={m.dark} position={[0, 0.42, 0.04]} castShadow />
          <mesh geometry={cached(`rmtvscr${w}`, () => new PlaneGeometry(w - 0.04, w * 0.58 - 0.04))} material={night ? phys("rmtvon", { color: "#0d1520", emissive: "#5a8fd8", emissiveIntensity: 0.35, roughness: 0.2 }) : phys("rmtvoff", { color: "#11151c", roughness: 0.15, clearcoat: 1 })} position={[0, 0.42, 0.066]} />
          <mesh geometry={box(0.3, 0.02, 0.18, 0.005)} material={m.dark} position={[0, 0.02, 0.04]} />
        </group>
      );
    }
    case "plant": {
      const s = p.s ?? 1;
      return (
        <group position={at} scale={[s, s, s]}>
          <mesh geometry={cyl(0.18, 0.14, 0.38, 24)} material={m.pot} position={[0, 0.19, 0]} castShadow receiveShadow />
          {Array.from({ length: 10 }, (_, k) => <mesh key={k} geometry={sphere(0.17, 16, 10)} material={m.leaf} position={[0.19 * Math.cos(k * 2.4), 0.55 + 0.09 * k, 0.19 * Math.sin(k * 2.4)]} scale={[1, 0.22, 0.62]} rotation={[0.4 * Math.sin(k), k * 2.4, 0.35]} castShadow />)}
        </group>
      );
    }
    case "rug":
      return <mesh geometry={cached(`rmrug${p.w},${p.d}`, () => new PlaneGeometry(p.w, p.d))} material={phys(`rmrug${p.color}`, { color: p.color, roughness: 0.97, sheen: 0.6, sheenColor: "#ffffff" })} position={[at[0], 0.006, at[2]]} rotation={[-Math.PI / 2, 0, yaw]} receiveShadow />;
    case "frame": {
      const w = p.w ?? 0.5, h = p.h ?? 0.6, [a, b, c] = p.colors ?? ["#f4a261", "#2a9d8f", "#264653"];
      return (
        <group position={[at[0], p.y ?? 1.6, at[2]]} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, h, 0.03, 0.006)} material={m.dark} position={[0, 0, 0.015]} castShadow />
          <mesh geometry={box(w - 0.06, h - 0.06, 0.01, 0.003)} material={phys(`rmart${a}`, { color: a, roughness: 0.7 })} position={[0, 0, 0.032]} />
          <mesh geometry={sphere(Math.min(w, h) * 0.22, 20, 12)} material={phys(`rmart${b}`, { color: b, roughness: 0.7 })} position={[-w * 0.12, h * 0.08, 0.035]} scale={[1, 1, 0.05]} />
          <mesh geometry={box(w - 0.08, h * 0.25, 0.01, 0.003)} material={phys(`rmart${c}`, { color: c, roughness: 0.7 })} position={[0, -h * 0.28, 0.038]} />
        </group>
      );
    }
    case "clock":
      return (
        <group position={[at[0], p.y ?? 2.2, at[2]]} rotation={[0, yaw, 0]}>
          <mesh geometry={cyl(0.17, 0.17, 0.04, 40)} material={m.dark} position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow />
          <mesh geometry={cyl(0.15, 0.15, 0.01, 40)} material={m.white} position={[0, 0, 0.042]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={box(0.012, 0.1, 0.006, 0.002)} material={m.dark} position={[0, 0.045, 0.05]} />
          <mesh geometry={box(0.07, 0.012, 0.006, 0.002)} material={m.dark} position={[0.03, 0, 0.05]} />
        </group>
      );
    case "dispenser":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(0.32, 1.0, 0.32, 0.03)} material={m.white} position={[0, 0.5, 0]} castShadow receiveShadow />
          <mesh geometry={cyl(0.13, 0.13, 0.4, 24)} material={phys("rmgallon", { color: "#9fd3f5", roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.7 })} position={[0, 1.2, 0]} castShadow />
          {[-0.06, 0.06].map((x, i) => <mesh key={i} geometry={box(0.04, 0.05, 0.04, 0.01)} material={phys(`rmtap${i}`, { color: i ? "#2b6cb0" : "#c0392b", roughness: 0.4 })} position={[x, 0.78, 0.17]} />)}
        </group>
      );
    case "cabinet": {
      const w = p.w ?? 1.0, h = p.h ?? 0.9, d = p.d ?? 0.45;
      const c = phys(`rmcab${p.color}`, { color: p.color ?? "#d9d4cc", roughness: 0.5, clearcoat: 0.3 });
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh geometry={box(w, h, d, 0.02)} material={c} position={[0, h / 2, 0]} castShadow receiveShadow />
          {[-1, 1].map((s) => <mesh key={s} geometry={box(0.012, h * 0.5, 0.012, 0.004)} material={m.metal} position={[s * 0.05, h * 0.55, d / 2 + 0.01]} />)}
        </group>
      );
    }
    case "lamp": {
      const on = night ? 1 : 0.35;
      const bulb = basic(`rmbulb${on}`, { color: "#fff2d6", toneMapped: false });
      bulb.color.setRGB(0.5 + 1.4 * on, 0.45 + 1.15 * on, 0.36 + 0.85 * on);
      if (p.style === "tube")
        return (
          <group position={[at[0], p.y, at[2]]}>
            <mesh geometry={box(1.2, 0.05, 0.2, 0.015)} material={m.white} position={[0, -0.025, 0]} />
            <mesh geometry={box(1.12, 0.02, 0.14, 0.008)} material={bulb} position={[0, -0.055, 0]} />
          </group>
        );
      return (
        <group position={[at[0], p.y, at[2]]}>
          <mesh geometry={cyl(0.006, 0.006, 0.6, 6)} material={m.dark} position={[0, 0.3, 0]} />
          <mesh geometry={cyl(0.06, 0.2, 0.2, 32, true)} material={phys("rmshade", { color: "#2b2d33", roughness: 0.5, side: DoubleSide })} position={[0, -0.05, 0]} castShadow />
          <mesh geometry={sphere(0.05, 16, 10)} material={bulb} position={[0, -0.1, 0]} />
        </group>
      );
    }
  }
};

/** Window / door openings of one wall in its own along-wall coordinate (0 at the wall's start). */
const holesOf = (L: RoomLayout, wall: Wall, start: number, flip: boolean) =>
  L.openings.filter((o) => o.wall === wall).map((o) => (flip ? { a: start - o.b, b: start - o.a, y0: o.y0, y1: o.y1, o } : { a: o.a - start, b: o.b - start, y0: o.y0, y1: o.y1, o }));

export const Room: React.FC<{ L: RoomLayout; time: TimeOfDay }> = ({ L, time }) => {
  const m = mats(L);
  const { x0, x1, z0, z1, h } = L.room;
  const night = time === "night";
  const split = L.palette.wallLow && L.palette.wallLow !== L.palette.wall ? 1.0 : 0;
  const lenX = x1 - x0, lenZ = z1 - z0;
  // back wall runs +x from x0; left wall runs −z from z1 (seen from inside: left to right); right wall +z
  const back = holesOf(L, "back", x0, false), left = holesOf(L, "left", z1, true), right = holesOf(L, "right", z0, false);
  const openings = (hs: ReturnType<typeof holesOf>) => hs.map((x, i) => (
    <group key={i} position={[x.a, x.o.kind === "window" ? 0 : 0, 0]}>
      {x.o.kind === "window" ? <WindowFrame w={x.b - x.a} y0={x.y0} y1={x.y1} m={m} view={L.view} time={time} /> : <Door w={x.b - x.a} h={x.y1} m={m} />}
    </group>
  ));
  return (
    <group>
      <mesh geometry={box(lenX + 0.4, 0.06, lenZ + 0.4, 0.01)} material={m.floor} position={[(x0 + x1) / 2, -0.03, (z0 + z1) / 2]} receiveShadow />
      <mesh geometry={box(lenX + 0.3, 0.06, lenZ + 0.3, 0.01)} material={m.ceiling} position={[(x0 + x1) / 2, h + 0.03, (z0 + z1) / 2]} />
      <group position={[x0, 0, z0 - T / 2]}>
        <WallMesh len={lenX} h={h} holes={back} m={m} split={split} shadow />
        {openings(back)}
      </group>
      <group position={[x0 - T / 2, 0, z1]} rotation={[0, Math.PI / 2, 0]}>
        <WallMesh len={lenZ} h={h} holes={left} m={m} split={split} shadow />
        {openings(left)}
      </group>
      <group position={[x1 + T / 2, 0, z0]} rotation={[0, -Math.PI / 2, 0]}>
        <WallMesh len={lenZ} h={h} holes={right} m={m} split={split} shadow />
        {openings(right)}
      </group>
      {/* the camera-side wall: plain, casts no shadow (it would darken the set) */}
      <group position={[x1, 0, z1 + T / 2]} rotation={[0, Math.PI, 0]}>
        <WallMesh len={lenX} h={h} holes={[]} m={m} split={split} shadow={false} />
      </group>
      {L.pieces.map((p, i) => <PieceView key={i} p={p} m={m} night={night} />)}
    </group>
  );
};
