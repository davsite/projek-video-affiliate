// Hand props + the attach maths that lets a character pick things up and put them down.
//
// A prop's world matrix over time is a chain of states: resting somewhere, or held by a hand. When a
// hand takes a prop, the grip offset is measured at that instant (prop rest × inverse hand), so the
// prop never jumps; when it is let go it settles onto its next rest pose. All pure functions of t.

import React, { useMemo } from "react";
import { CanvasTexture, DoubleSide, type Matrix4, PlaneGeometry, SRGBColorSpace } from "three";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { phys } from "../lib/mats.ts";

export { mat, lerpMat, gripOffset, held, toPQ, xform } from "./attach.ts";
import { toPQ } from "./attach.ts";

// ── notebook with live handwriting ──────────────────────────────────────────
export const NB = { w: 0.15, d: 0.21, t: 0.014 };
const CW = 600, CH = Math.round((CW * NB.d) / NB.w);

export type Writing = { header: string; lines: string[]; checkbox: boolean; font: string; ink: string };

type Layout = { x0: number; y: number; w: number }[];
const layoutLines = (g: CanvasRenderingContext2D, W: Writing): Layout => {
  g.font = `64px ${W.font}`;
  const out: Layout = [];
  let y = 300;
  W.lines.forEach((ln, i) => {
    const x0 = i === 0 && W.checkbox ? 130 : 70;
    out.push({ x0, y, w: g.measureText(ln).width });
    y += 96;
  });
  return out;
};
const totalLen = (L: Layout, W: Writing) => L.reduce((s, l) => s + l.w, 0) + (W.checkbox ? 160 : 0);

/** Page-space (0…1) position of the pen tip for writing progress p. */
export const penOnPage = (W: Writing, p: number): [number, number] => {
  const c = document.createElement("canvas").getContext("2d")!;
  const L = layoutLines(c, W);
  let d = Math.min(1, Math.max(0, p)) * totalLen(L, W);
  if (W.checkbox) {
    if (d < 160) {
      const k = d / 160, s = 50;
      const [x, y] = k < 0.25 ? [70 + s * (k / 0.25), 250] : k < 0.5 ? [70 + s, 250 + s * ((k - 0.25) / 0.25)] : k < 0.75 ? [70 + s - s * ((k - 0.5) / 0.25), 250 + s] : [70, 250 + s - s * ((k - 0.75) / 0.25)];
      return [x / CW, y / CH];
    }
    d -= 160;
  }
  for (const l of L) {
    if (d <= l.w) {
      const wob = Math.sin(d * 0.21) * 9 + Math.sin(d * 0.057) * 6;
      return [(l.x0 + d) / CW, (l.y - 14 + wob) / CH];
    }
    d -= l.w;
  }
  const last = L[L.length - 1];
  return [(last.x0 + last.w + 6) / CW, (last.y - 10) / CH];
};

const drawPage = (g: CanvasRenderingContext2D, W: Writing, p: number) => {
  g.fillStyle = "#fbf8f0";
  g.fillRect(0, 0, CW, CH);
  g.strokeStyle = "rgba(90,140,200,0.35)";
  g.lineWidth = 2;
  for (let y = 210; y < CH - 30; y += 96) {
    g.beginPath();
    g.moveTo(30, y + 112);
    g.lineTo(CW - 30, y + 112);
    g.stroke();
  }
  g.strokeStyle = "rgba(230,90,90,0.45)";
  g.beginPath();
  g.moveTo(52, 0);
  g.lineTo(52, CH);
  g.stroke();
  g.fillStyle = "rgba(60,70,90,0.55)";
  g.font = `600 30px Manrope, sans-serif`;
  g.textAlign = "right";
  g.fillText(W.header, CW - 40, 120);
  g.textAlign = "left";
  const L = layoutLines(g, W);
  let d = Math.min(1, Math.max(0, p)) * totalLen(L, W);
  g.strokeStyle = W.ink;
  g.fillStyle = W.ink;
  g.lineWidth = 6;
  g.lineCap = "round";
  if (W.checkbox) {
    const k = Math.min(1, d / 160), s = 50;
    g.beginPath();
    const pts: [number, number][] = [[70, 250], [70 + s, 252], [72 + s, 250 + s], [69, 249 + s], [70, 250]];
    const segs = 4 * k;
    g.moveTo(...pts[0]);
    for (let i = 0; i < 4; i++) {
      if (segs <= i) break;
      const f = Math.min(1, segs - i);
      g.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f);
    }
    g.stroke();
    d -= 160;
  }
  g.font = `64px ${W.font}`;
  W.lines.forEach((ln, i) => {
    const l = L[i];
    if (d <= 0) return;
    const show = Math.min(l.w, d);
    g.save();
    g.beginPath();
    g.rect(l.x0 - 10, l.y - 90, show + 12, 140);
    g.clip();
    g.fillText(ln, l.x0, l.y);
    g.restore();
    d -= l.w;
  });
};

export const Notebook: React.FC<{ m: Matrix4; open: number; writing: Writing; progress: number }> = ({ m, open, writing, progress }) => {
  const page = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = CW;
    c.height = CH;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    return { c, tex, last: -1 };
  }, []);
  const q = Math.round(progress * 400) / 400;
  if (q !== page.last) {
    drawPage(page.c.getContext("2d")!, writing, q);
    page.tex.needsUpdate = true;
    page.last = q;
  }
  const pageMat = phys("cfnbpage", { color: "#ffffff", roughness: 0.75, side: DoubleSide });
  pageMat.map = page.tex;
  const cover = phys("cfnbcover", { color: "#e4572e", roughness: 0.55, clearcoat: 0.3 });
  const { position, quaternion } = toPQ(m);
  const ang = Math.PI * Math.min(1, Math.max(0, open));
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={box(NB.w, 0.004, NB.d, 0.002)} material={cover} position={[0, 0.002, 0]} castShadow receiveShadow />
      <mesh geometry={box(NB.w - 0.006, NB.t - 0.006, NB.d - 0.006, 0.002)} material={phys("cfnbpages", { color: "#f4efe2", roughness: 0.9 })} position={[0, NB.t / 2, 0]} castShadow receiveShadow />
      <mesh geometry={cached("cfnbpageplane", () => new PlaneGeometry(NB.w - 0.008, NB.d - 0.008))} material={pageMat} position={[0, NB.t - 0.0025, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* spiral along the left edge */}
      {Array.from({ length: 11 }, (_, k) => (
        <mesh key={k} geometry={cyl(0.0035, 0.0035, 0.004, 8)} material={phys("cfspiral", { color: "#cfd3d8", metalness: 0.9, roughness: 0.25 })} position={[-NB.w / 2, NB.t / 2, -NB.d / 2 + 0.012 + k * 0.0186]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 2.2]} />
      ))}
      {/* cover hinges on the left edge and folds under */}
      <group position={[-NB.w / 2, NB.t, 0]} rotation={[0, 0, ang]}>
        <mesh geometry={box(NB.w, 0.004, NB.d, 0.002)} material={cover} position={[NB.w / 2, 0.002, 0]} castShadow receiveShadow />
        <mesh geometry={box(0.05, 0.0012, NB.d * 0.7, 0.0005)} material={phys("cfnblabel", { color: "#fff3d6", roughness: 0.7 })} position={[NB.w / 2 + 0.03, 0.0048, 0]} />
      </group>
    </group>
  );
};

/** Ball pen; tip at the local origin, body along +Y. */
export const Pen: React.FC<{ m: Matrix4 }> = ({ m }) => {
  const { position, quaternion } = toPQ(m);
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={cyl(0.0012, 0.0035, 0.012, 10)} material={phys("cfpentip", { color: "#c9ccd2", metalness: 0.9, roughness: 0.25 })} position={[0, 0.006, 0]} />
      <mesh geometry={cyl(0.0048, 0.0048, 0.11, 14)} material={phys("cfpen", { color: "#2b59c3", roughness: 0.3, clearcoat: 0.7 })} position={[0, 0.067, 0]} castShadow />
      <mesh geometry={sphere(0.0048, 12, 8)} material={phys("cfpen", { color: "#2b59c3" })} position={[0, 0.122, 0]} />
      <mesh geometry={box(0.0016, 0.045, 0.004, 0.0008)} material={phys("cfpenclip", { color: "#e8e8ea", metalness: 0.9, roughness: 0.2 })} position={[0.0055, 0.1, 0]} />
    </group>
  );
};
