// Everyday hand props: a phone and a crossbody sling bag (with a live strap). The grip rule from the
// notebook pen applies: when a prop's pose matters (a phone held up to the eyes), the HAND is derived
// from the prop — `gripFor` returns the wrist target + hand orientation for arm IK.

import React from "react";
import { type Matrix4, PlaneGeometry, Quaternion, Vector3 } from "three";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { canvasTex, phys } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";
import { toPQ } from "./attach.ts";
import { BAG, PHONE } from "./grip.ts";
export { BAG, PHONE, PHONE_IN_HAND, gripFor, phoneReadPose } from "./grip.ts";
import type { V3 } from "../character/spec.ts";

// ── phone ───────────────────────────────────────────────────────────────────

const homeTex = (clock: string) =>
  canvasTex(`cfhome${clock}`, 256, 540, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#5b8def");
    gr.addColorStop(0.55, "#9b6be8");
    gr.addColorStop(1, "#f08aa7");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = `300 64px ${FONT}, sans-serif`;
    g.fillText(clock, w / 2, 110);
    g.font = `500 16px ${FONT}, sans-serif`;
    g.fillText("Jumat, 31 Oktober", w / 2, 138);
    const cols = ["#ffd166", "#06d6a0", "#ef476f", "#118ab2", "#ffffff", "#f78c6b", "#83d483", "#c3a6ff"];
    for (let i = 0; i < 12; i++) {
      const x = 38 + (i % 4) * 60, y = 220 + Math.floor(i / 4) * 72;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.roundRect(x - 20, y - 20, 40, 40, 11);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.roundRect(18, h - 78, w - 36, 56, 22);
    g.fill();
  });

/** Phone: centre at the origin, screen faces +Z, top toward +Y. */
export const Phone: React.FC<{ m: Matrix4; on: number; clock?: string }> = ({ m, on, clock = "07:42" }) => {
  const { position, quaternion } = toPQ(m);
  const scr = phys(`cfphonescr${clock}`, { color: "#000000", emissive: "#ffffff", emissiveMap: homeTex(clock), emissiveIntensity: 1, roughness: 0.15, clearcoat: 1 });
  scr.emissiveIntensity = 0.15 + 0.75 * on;
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={box(PHONE.w, PHONE.h, PHONE.t, 0.009)} material={phys("cfphonebody", { color: "#2a2d36", roughness: 0.3, metalness: 0.5, clearcoat: 0.6 })} castShadow />
      <mesh geometry={cached("cfphonescreen", () => new PlaneGeometry(PHONE.w - 0.006, PHONE.h - 0.008))} material={scr} position={[0, 0, PHONE.t / 2 + 0.0004]} />
      <mesh geometry={cyl(0.007, 0.007, 0.002, 16)} material={phys("cfphonecam", { color: "#111", roughness: 0.1, clearcoat: 1 })} position={[-0.02, 0.058, -PHONE.t / 2 - 0.0008]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
};

// ── sling bag ───────────────────────────────────────────────────────────────

/** Sling bag: origin at the centre of its top edge, front faces +Z, hangs along −Y. */
export const SlingBag: React.FC<{ m: Matrix4; flap: number; color?: string }> = ({ m, flap, color = "#e07a3f" }) => {
  const { position, quaternion } = toPQ(m);
  const body = phys(`cfbag${color}`, { color, roughness: 0.75, sheen: 0.6, sheenColor: "#ffd7b5" });
  const dark = phys("cfbagtrim", { color: "#5b3a29", roughness: 0.6 });
  const a = -2.3 * Math.min(1, Math.max(0, flap));
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={box(BAG.w, BAG.h, BAG.d, 0.03)} material={body} position={[0, -BAG.h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={box(BAG.w - 0.04, 0.012, BAG.d - 0.03, 0.005)} material={phys("cfbaginside", { color: "#3a2a22", roughness: 0.9 })} position={[0, -0.004, 0]} />
      {/* flap hinged at the back of the top edge */}
      <group position={[0, 0.004, -BAG.d / 2]} rotation={[a, 0, 0]}>
        <mesh geometry={box(BAG.w + 0.008, 0.012, BAG.d + 0.004, 0.005)} material={body} position={[0, 0, BAG.d / 2]} castShadow />
        <mesh geometry={box(BAG.w + 0.01, 0.13, 0.012, 0.005)} material={body} position={[0, -0.065, BAG.d + 0.004]} castShadow />
        <mesh geometry={box(0.05, 0.03, 0.006, 0.004)} material={dark} position={[0, -0.11, BAG.d + 0.012]} />
      </group>
    </group>
  );
};

/** Strap as a tube through world points. */
export const Strap: React.FC<{ pts: V3[]; r?: number; color?: string }> = ({ pts, r = 0.011, color = "#5b3a29" }) => {
  const mat = phys(`cfstrap${color}`, { color, roughness: 0.7 });
  const up = new Vector3(0, 1, 0);
  return (
    <group>
      {pts.slice(1).map((b, i) => {
        const a = new Vector3(...pts[i]), c = new Vector3(...b);
        const len = a.distanceTo(c);
        const mid = a.clone().add(c).multiplyScalar(0.5);
        const q = new Quaternion().setFromUnitVectors(up, c.clone().sub(a).normalize());
        return <mesh key={i} geometry={cyl(r, r, 1, 8)} material={mat} position={[mid.x, mid.y, mid.z]} quaternion={[q.x, q.y, q.z, q.w]} scale={[1.6, len, 0.55]} castShadow />;
      })}
      {pts.map((p, i) => <mesh key={`j${i}`} geometry={sphere(r * 1.05, 8, 6)} material={mat} position={p} scale={[1.6, 1, 0.55]} />)}
    </group>
  );
};
