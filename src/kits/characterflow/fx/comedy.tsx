// Comedy props for CHARACTERFLOW: a scoreboard that springs out of the ground (any "competition"
// joke), and a tumbleweed for awkward silences. Text comes from the topic.

import React from "react";
import { PlaneGeometry } from "three";
import { box, cached, cyl, lathe, sphere, torus } from "../lib/geo.ts";
import { canvasTex, hash1, phys } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";
import type { V3 } from "../character/spec.ts";

const springUp = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 - Math.exp(-6 * x) * Math.cos(9 * x);
};

export type BoardFace = { kicker: string; title: string; left?: string; right?: string };

const boardTex = (f: BoardFace) =>
  canvasTex(`cfboard${f.kicker}${f.title}${f.left}${f.right}`, 1024, 640, (g, w, h) => {
    g.fillStyle = "#1d2a4d";
    g.beginPath();
    g.roundRect(0, 0, w, h, 40);
    g.fill();
    // marquee bulbs
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 2 ? "#ffd166" : "#fff3c4";
      g.beginPath();
      g.arc(40 + i * 37.5, 28, 9, 0, Math.PI * 2);
      g.arc(40 + i * 37.5, h - 28, 9, 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = "center";
    g.fillStyle = "#ffd166";
    g.font = `600 46px ${FONT}, sans-serif`;
    g.fillText(f.kicker, w / 2, 120);
    g.fillStyle = "#ffffff";
    g.font = `600 84px ${FONT}, sans-serif`;
    const words = f.title.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const wd of words) { if (g.measureText(cur + " " + wd).width > w - 120 && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd; }
    lines.push(cur);
    lines.forEach((l, i) => g.fillText(l, w / 2, 230 + i * 92));
    if (f.left || f.right) {
      const y = 230 + lines.length * 92 + 40;
      g.font = `600 70px ${FONT}, sans-serif`;
      g.fillStyle = "#7fe0ff";
      g.fillText(f.left ?? "", w * 0.25, y);
      g.fillStyle = "#ff8fab";
      g.fillText(f.right ?? "", w * 0.75, y);
      g.fillStyle = "#ffd166";
      g.font = `600 56px ${FONT}, sans-serif`;
      g.fillText("VS", w / 2, y - 4);
    }
  });

/**
 * A scoreboard on two posts that springs up from the ground at `upAt`, swaps to `face2` at `swapAt`
 * (flip), and sinks at `downAt`. Facing +Z at `p` (rotate with `yaw`).
 */
export const PopBoard: React.FC<{ p: V3; yaw?: number; scale?: number; t: number; upAt: number; swapAt: number; downAt: number; face1: BoardFace; face2: BoardFace }> = ({ p, yaw = 0, scale = 1, t, upAt, swapAt, downAt, face1, face2 }) => {
  const up = springUp((t - upAt) / 0.9) * (1 - Math.min(1, Math.max(0, (t - downAt) / 0.45)) ** 2);
  if (up <= 0.001) return null;
  const flip = Math.min(1, Math.max(0, (t - swapAt) / 0.35));
  const face = flip < 0.5 ? face1 : face2;
  const rot = Math.PI * (flip < 0.5 ? flip : flip - 1);
  const W = 2.2, H = 1.375;
  const sink = (1 - up) * 3.4;
  const post = phys("cfboardpost2", { color: "#2d3340", roughness: 0.4, metalness: 0.5 });
  const gold = phys("cftrophy", { color: "#f4c542", metalness: 1, roughness: 0.25 });
  return (
    <group position={[p[0], p[1] - sink * scale, p[2]]} rotation={[0, yaw, 0]} scale={scale}>
      {[-1, 1].map((s) => <mesh key={s} geometry={cyl(0.06, 0.06, 2.6, 12)} material={post} position={[s * 0.85, 1.3, -0.04]} castShadow />)}
      <group position={[0, 2.35, 0]} rotation={[rot, 0, 0]}>
        <mesh geometry={box(W + 0.12, H + 0.12, 0.12, 0.05)} material={phys("cfboardframe", { color: "#f2b544", roughness: 0.4, clearcoat: 0.5 })} castShadow />
        <mesh geometry={cached("cfpopboard", () => new PlaneGeometry(W, H))} material={phys(`cfpopface${face.title}${face.left}`, { map: boardTex(face), emissive: "#ffffff", emissiveMap: boardTex(face), emissiveIntensity: 0.35, roughness: 0.4 })} position={[0, 0, 0.065]} />
      </group>
      {/* trophy on top */}
      <group position={[0, 3.2 + 0.05 * Math.sin(t * 3), 0]} rotation={[0, t * 1.2, 0]}>
        <mesh geometry={lathe("cftrophycup", [[0, 0], [0.16, 0], [0.16, 0.04], [0.05, 0.08], [0.04, 0.2], [0.1, 0.26], [0.19, 0.42], [0.21, 0.52], [0.0, 0.52]], 32)} material={gold} castShadow />
        {[-1, 1].map((s) => <mesh key={s} geometry={torus(0.07, 0.016, 8, 20)} material={gold} position={[s * 0.22, 0.4, 0]} rotation={[0, Math.PI / 2, 0]} />)}
      </group>
    </group>
  );
};

/** Tumbleweed rolling from `a` to `b` between t0 and t1, bouncing. */
export const Tumbleweed: React.FC<{ a: V3; b: V3; t: number; t0: number; t1: number; r?: number }> = ({ a, b, t, t0, t1, r = 0.32 }) => {
  if (t < t0 || t > t1) return null;
  const k = (t - t0) / (t1 - t0);
  const x = a[0] + (b[0] - a[0]) * k, z = a[2] + (b[2] - a[2]) * k;
  const dist = Math.hypot(b[0] - a[0], b[2] - a[2]) * k;
  const bounce = Math.abs(Math.sin(k * Math.PI * 5)) * 0.25 * (1 - 0.5 * k);
  const roll = dist / r;
  const dir = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const twig = phys("cftwig", { color: "#b08a55", roughness: 0.85 });
  return (
    <group position={[x, a[1] + r + bounce, z]} rotation={[0, dir, 0]}>
      <group rotation={[roll, 0, 0]}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} geometry={torus(r * (0.6 + 0.4 * hash1(i, 3)), 0.012, 4, 24)} material={twig} rotation={[hash1(i, 5) * 6.3, hash1(i, 7) * 6.3, hash1(i, 9) * 6.3]} castShadow />
        ))}
        <mesh geometry={sphere(r * 0.35, 8, 6)} material={twig} />
      </group>
    </group>
  );
};
