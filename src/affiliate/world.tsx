// The product inserts' set, in centimetres: Dika's desk corner (the same oak, wall paint and floor as his bedroom),
// a wall socket with a charger, a laptop, an office chair, his phone, charger cables and the clip. Everything is a
// pure function of the props it gets; the shots (shots.ts) decide where things are at every moment.

import React, { useEffect, useMemo } from "react";
import { CatmullRomCurve3, DoubleSide, PlaneGeometry, TubeGeometry, Vector3 } from "three";
import { box, cached, cyl, sphere, torus } from "../kits/characterflow/lib/geo.ts";
import { basic, canvasTex, mulberry32, phys, shade } from "../kits/characterflow/lib/mats.ts";
import { paintTex, plankTex } from "../kits/characterflow/env/textures.ts";
import { FONT } from "../core/type/fonts.ts";
import { CLIP_D, CLIP_L, PAD, clipGeometry } from "./clip.ts";

import { DESK, PHONE, SOCKET, type CableSpec, type ClipSpec, type V3 } from "./set.ts";
export * from "./set.ts";

// ── room ──────────────────────────────────────────────────────────────────────────────────────────────────

const woodTex = () =>
  canvasTex("aff-wood", 1024, 512, (g, w, h) => {
    const r = mulberry32(23);
    g.fillStyle = "#c89a6a";
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) {
      const y = r() * h, a = 0.03 + r() * 0.07;
      g.strokeStyle = r() < 0.5 ? `rgba(110,66,30,${a})` : `rgba(255,236,200,${a * 0.8})`;
      g.lineWidth = 0.8 + r() * 3;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.006 + k) * (4 + r() * 6) + (r() - 0.5) * 2);
      g.stroke();
    }
  }, [1, 1]);

export const Room: React.FC = () => {
  const wood = phys("aff-desk", { color: "#f2ece4", map: woodTex(), roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.45 });
  const woodEdge = phys("aff-desk-edge", { color: shade("#c89a6a", 0.9), roughness: 0.5, clearcoat: 0.3 });
  const wall = phys("aff-wall", { color: "#ffffff", map: paintTex("aff-wall", "#8ea6c4", [3, 3]), roughness: 0.92 });
  const floor = phys("aff-floor", { color: "#ffffff", map: plankTex([3.5, 2.5], "#a77b55"), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const white = phys("aff-white", { color: "#f4f2ee", roughness: 0.4, clearcoat: 0.4 });
  const { x0, x1, z0, z1, thick, floor: fy, wall: wz } = DESK;
  const legH = -thick - fy;
  return (
    <group>
      {/* desk */}
      <mesh geometry={box(x1 - x0, thick, z1 - z0, 0.5, 3)} material={wood} position={[(x0 + x1) / 2, -thick / 2, (z0 + z1) / 2]} castShadow receiveShadow />
      {[[x1 - 3.5, z1 - 3.5], [x0 + 3.5, z1 - 3.5], [x1 - 3.5, z0 + 3.5], [x0 + 3.5, z0 + 3.5]].map(([x, z], i) => (
        <mesh key={i} geometry={box(4, legH, 4, 0.4)} material={woodEdge} position={[x, -thick - legH / 2, z]} castShadow receiveShadow />
      ))}
      <mesh geometry={box(x1 - x0 - 8, 9, 1.8, 0.3)} material={woodEdge} position={[(x0 + x1) / 2, -thick - 4.5, z0 + 3]} castShadow receiveShadow />
      {/* wall + skirting + floor */}
      <mesh geometry={cached("aff-wallg", () => new PlaneGeometry(400, 260))} material={wall} position={[-40, fy + 130, wz]} receiveShadow />
      <mesh geometry={box(400, 9, 1.2, 0.3)} material={white} position={[-40, fy + 4.5, wz + 0.6]} receiveShadow />
      <mesh geometry={cached("aff-floorg", () => new PlaneGeometry(400, 300))} material={floor} position={[-40, fy, 60]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {/* socket + charger brick */}
      <group position={SOCKET}>
        <mesh geometry={box(8.6, 8.6, 0.8, 0.8)} material={white} position={[0, 0, 0.4]} castShadow receiveShadow />
        <mesh geometry={cyl(2.6, 2.6, 0.5, 40)} material={phys("aff-socketcup", { color: "#e6e2da", roughness: 0.5 })} position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={box(3.4, 3.4, 3, 0.55)} material={white} position={[0, -0.2, 0.8 + 1.5 + 0.2]} castShadow receiveShadow />
        <mesh geometry={cyl(0.45, 0.4, 0.8, 16)} material={white} position={[0, -0.6, 0.8 + 3.2 + 0.2]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {/* laptop + a notebook for context */}
      <group position={[-52, 0, -30]} rotation={[0, 0.12, 0]}>
        <mesh geometry={box(32, 1.6, 22, 0.7)} material={phys("aff-laptop", { color: "#b9bcc4", metalness: 0.7, roughness: 0.35 })} position={[0, 0.8, 0]} castShadow receiveShadow />
        <mesh geometry={box(5, 0.05, 2.5, 0.02)} material={phys("aff-laptoplogo", { color: "#d6d9df", metalness: 0.8, roughness: 0.2 })} position={[0, 1.62, 0]} />
      </group>
      <group position={[-28, 0, -44]} rotation={[0, -0.25, 0]}>
        <mesh geometry={box(15, 1.2, 21, 0.3)} material={phys("aff-notebook", { color: "#2f7d84", roughness: 0.6 })} position={[0, 0.6, 0]} castShadow receiveShadow />
        <mesh geometry={box(14.4, 1.0, 20.4, 0.2)} material={phys("aff-pages", { color: "#f3efe4", roughness: 0.9 })} position={[0.35, 0.6, 0]} />
      </group>
    </group>
  );
};

// ── chair (only in the "outer edge" shot) ─────────────────────────────────────────────────────────────────
export const Chair: React.FC<{ p: V3 }> = ({ p }) => {
  const fabric = phys("aff-chair", { color: "#34456b", roughness: 0.8, sheen: 0.4, sheenColor: "#9fb3e0" });
  const dark = phys("aff-chairdark", { color: "#24262c", roughness: 0.45, clearcoat: 0.3 });
  const fy = DESK.floor - p[1];
  return (
    <group position={p}>
      {/* seat (top at y = 0 in chair space), backrest away from the desk (+z), armrests */}
      <mesh geometry={box(46, 7, 46, 3)} material={fabric} position={[0, -3.5, 0]} castShadow receiveShadow />
      <mesh geometry={box(44, 48, 6, 3)} material={fabric} position={[0, 30, 23]} rotation={[-0.08, 0, 0]} castShadow receiveShadow />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh geometry={box(5, 2.6, 24, 1.1)} material={dark} position={[sx * 24.5, 20, 2]} castShadow />
          <mesh geometry={box(2.4, 20, 2.4, 0.6)} material={dark} position={[sx * 24.5, 9, 9]} castShadow />
        </group>
      ))}
      <mesh geometry={cyl(2.2, 2.2, -fy - 10, 20)} material={dark} position={[0, (fy + 10) / 2 - 7, 0]} castShadow />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh geometry={box(28, 2.6, 4, 1)} material={dark} position={[14, fy + 6, 0]} castShadow />
            <mesh geometry={sphere(2.6, 16, 10)} material={dark} position={[27, fy + 2.6, 0]} castShadow />
          </group>
        );
      })}
    </group>
  );
};

// ── phone (Dika's phone, at desk scale) ───────────────────────────────────────────────────────────────────
const screenTex = (clock: string, day: string) =>
  canvasTex(`aff-screen${clock}${day}`, 256, 540, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#5b8def");
    gr.addColorStop(0.55, "#9b6be8");
    gr.addColorStop(1, "#f08aa7");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = `300 70px ${FONT}, sans-serif`;
    g.fillText(clock, w / 2, 130);
    g.font = `500 18px ${FONT}, sans-serif`;
    g.fillText(day, w / 2, 162);
    // charging badge
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.roundRect(w / 2 - 46, h - 120, 92, 34, 17);
    g.fill();
    g.fillStyle = "#3ccf7a";
    g.beginPath();
    g.roundRect(w / 2 - 38, h - 112, 60, 18, 6);
    g.fill();
    g.fillStyle = "#1d2a4d";
    g.font = `600 16px ${FONT}, sans-serif`;
    g.fillText("⚡", w / 2 + 34, h - 97);
  });

/** Lying phone: centre at p, screen up, its bottom edge (charging port) toward +X when yaw = 0. */
export const Phone: React.FC<{ p: V3; yaw?: number; tilt?: number; roll?: number; morning: boolean }> = ({ p, yaw = 0, tilt = 0, roll = 0, morning }) => {
  const scr = phys(`aff-phonescr${morning}`, { color: "#000000", emissive: "#ffffff", emissiveMap: screenTex(morning ? "06:52" : "21:47", morning ? "Senin, 10 November" : "Minggu, 9 November"), emissiveIntensity: 0.85, roughness: 0.15, clearcoat: 1 });
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <group rotation={[roll, 0, tilt]}>
        <mesh geometry={box(PHONE.l, PHONE.t, PHONE.w, 0.9)} material={phys("aff-phonebody", { color: "#2a2d36", roughness: 0.3, metalness: 0.5, clearcoat: 0.6 })} castShadow receiveShadow />
        <mesh geometry={cached("aff-phonescreen", () => new PlaneGeometry(PHONE.w - 0.55, PHONE.l - 0.7))} material={scr} position={[0, PHONE.t / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
        {/* port */}
        <mesh geometry={box(0.12, 0.3, 0.9, 0.1)} material={basic("aff-port", { color: "#0c0d10" })} position={[PHONE.l / 2 + 0.01, 0, 0]} />
      </group>
    </group>
  );
};

// ── cable ─────────────────────────────────────────────────────────────────────────────────────────────────

/** USB-C plug at the end of a cable: `dir` points out of the connector. */
const Plug: React.FC<{ at: V3; dir: V3; color: string; scale: number }> = ({ at, dir, color, scale }) => {
  const d = new Vector3(...dir).normalize();
  const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(Math.max(-1, Math.min(1, d.y)));
  const body = phys(`aff-plug${color}`, { color, roughness: 0.5, clearcoat: 0.15 });
  return (
    <group position={at} rotation={[pitch, yaw, 0, "YXZ"]} scale={scale}>
      <mesh geometry={cyl(0.24, 0.3, 0.8, 16)} material={body} position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={box(1.15, 0.62, 1.9, 0.26)} material={body} position={[0, 0, 1.55]} castShadow receiveShadow />
      <mesh geometry={box(0.84, 0.27, 0.72, 0.12)} material={phys("aff-plugmetal", { color: "#c9ccd2", roughness: 0.25, metalness: 0.9 })} position={[0, 0, 2.8]} castShadow />
    </group>
  );
};

export const Cable: React.FC<{ c: CableSpec }> = ({ c }) => {
  const sig = c.key + c.pts.map((p) => p.map((x) => x.toFixed(3)).join(",")).join("|");
  const geo = useMemo(() => {
    const curve = new CatmullRomCurve3(c.pts.map((p) => new Vector3(...p)), false, "centripetal");
    const len = curve.getLength();
    return new TubeGeometry(curve, Math.min(600, Math.max(48, Math.round(len * 1.6))), c.r, 12, false);
  }, [sig, c.r]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = phys(`aff-cable${c.color}`, { color: c.color, roughness: 0.55, clearcoat: 0.1 });
  const n = c.pts.length, a = c.pts[n - 2], b = c.pts[n - 1];
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {c.plug ? <Plug at={b} dir={[b[0] - a[0], b[1] - a[1], b[2] - a[2]]} color={c.color} scale={1} /> : null}
    </group>
  );
};

// ── the clip ──────────────────────────────────────────────────────────────────────────────────────────────
export const CLIP_COLOR = "#2c2f36";
export const Clip: React.FC<{ s: ClipSpec }> = ({ s }) => {
  const silicone = phys("aff-silicone", { color: CLIP_COLOR, roughness: 0.6, sheen: 0.4, sheenColor: "#9aa3b5", clearcoat: 0.15, clearcoatRoughness: 0.55 });
  const foam = phys("aff-foam", { color: "#ece6d8", roughness: 0.95 });
  const liner = phys("aff-liner", { color: "#d8463c", roughness: 0.4, clearcoat: 0.5, side: DoubleSide });
  const peel = s.peel ?? 0;
  const sq = s.squash ?? 0;
  return (
    <group position={s.p} rotation={[0, s.yaw, 0]}>
      <group rotation={[0, 0, s.wobble ?? 0]}>
        <group rotation={[s.flip ?? 0, 0, 0]}>
          <group scale={[1 + sq * 0.5, 1 - sq, 1 + sq * 0.5]}>
            <mesh geometry={clipGeometry()} material={silicone} castShadow receiveShadow />
            <mesh geometry={box(CLIP_L - 0.06, PAD, CLIP_D - 0.06, 0.03)} material={foam} position={[0, PAD / 2, 0]} castShadow />
            {/* red liner: peels from the +X end, curling up */}
            {peel < 0.999 ? <Liner peel={peel} mat={liner} /> : null}
          </group>
        </group>
      </group>
    </group>
  );
};
const Liner: React.FC<{ peel: number; mat: ReturnType<typeof phys> }> = ({ peel, mat }) => {
  // flat part still stuck to the foam, and a flap that lifts off from the +X end and folds back
  const L = CLIP_L + 0.4, pk = Math.min(1, peel / 0.85), xf = L / 2 - pk * L, flat = xf + L / 2, flap = pk * L;
  const away = Math.max(0, (peel - 0.85) / 0.15);
  const th = Math.min(1, pk * 2.2) * 2.75;
  const g = box(1, 0.02, CLIP_D + 0.12, 0.004);
  return (
    <group position={[away * 3, -away * 2.5, 0]} scale={1 - away * 0.6}>
      {flat > 0.01 ? <mesh geometry={g} material={mat} position={[-L / 2 + flat / 2, -0.012, 0]} scale={[flat, 1, 1]} /> : null}
      {flap > 0.01 ? <mesh geometry={g} material={mat} position={[xf + (Math.cos(th) * flap) / 2, -0.012 - (Math.sin(th) * flap) / 2, 0]} rotation={[0, 0, -th]} scale={[flap, 1, 1]} /> : null}
      {/* pull tab beyond the +X end */}
      <mesh geometry={g} material={mat} position={[xf + flap * Math.cos(th) + 0.25 * Math.cos(th), -0.012 - flap * Math.sin(th) - 0.25 * Math.sin(th), 0]} rotation={[0, 0, -th]} scale={[0.5, 1, 1]} />
    </group>
  );
};

// ── small 3D accents ──────────────────────────────────────────────────────────────────────────────────────
/** Expanding ring on a surface (a "tap" / "snap"). */
export const Ring: React.FC<{ p: V3; k: number; r: number; color?: string; normal?: "y" | "x" | "z" }> = ({ p, k, r, color = "#ffd25e", normal = "y" }) => {
  if (k <= 0 || k >= 1) return null;
  const rot: V3 = normal === "y" ? [-Math.PI / 2, 0, 0] : normal === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0];
  return (
    <mesh geometry={torus(1, 0.035, 8, 64)} position={p} rotation={rot} scale={r * (0.4 + 0.9 * k)}>
      <meshBasicMaterial color={color} transparent opacity={(1 - k) * 0.9} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

/** Tiny sparkles (morning / "lolos tes"). */
export const Sparkles: React.FC<{ c: V3; k: number; r: number; seed?: number }> = ({ c, k, r, seed = 1 }) => {
  if (k <= 0 || k >= 1) return null;
  const rnd = mulberry32(seed);
  return (
    <group position={c}>
      {Array.from({ length: 9 }, (_, i) => {
        const a = rnd() * Math.PI * 2, e = (rnd() - 0.3) * 1.2, d = r * (0.5 + rnd() * 0.7) * (0.3 + 0.7 * k);
        const s = Math.max(0, Math.sin(Math.PI * Math.min(1, k * 1.4 - rnd() * 0.3 + 0.2))) * r * 0.035;
        return s > 0.0001 ? (
          <group key={i} position={[Math.cos(a) * d, Math.sin(e) * d + r * 0.2, Math.sin(a) * d]} scale={s}>
            <mesh geometry={box(0.18, 1.6, 0.18, 0.05)}><meshBasicMaterial color="#fff6d5" toneMapped={false} /></mesh>
            <mesh geometry={box(1.6, 0.18, 0.18, 0.05)}><meshBasicMaterial color="#fff6d5" toneMapped={false} /></mesh>
          </group>
        ) : null;
      })}
    </group>
  );
};
