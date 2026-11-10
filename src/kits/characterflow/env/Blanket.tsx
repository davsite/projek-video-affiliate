// A duvet that drapes over whoever is in the bed. Every frame it rebuilds a height field over the
// mattress from the character's body capsules (pelvis, torso, thighs, shins, feet — taken from the
// skeleton, so it follows any pose), softens it like fabric, hangs a skirt over the sides and the foot,
// and turns a cuff back at its top edge. Fixed topology: positions are rewritten in place.

import React, { useLayoutEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, type Material, Vector3 } from "three";
import type { Skeleton } from "../character/skeleton.ts";
import type { V3 } from "../character/spec.ts";

export type Capsule = { a: V3; b: V3; r: number };
export type BedFrame = { x: number; z0: number; z1: number; halfW: number; top: number };

/** Body capsules for the blanket, from a skeleton (world space). Arms are left out: they rest on top. */
export const bodyCapsules = (sk: Skeleton, scale: number): Capsule[] => {
  const P = (m: { elements: number[] }, l: V3 = [0, 0, 0]) => {
    const v = new Vector3(...l).applyMatrix4(m as never);
    return [v.x, v.y, v.z] as V3;
  };
  const W = sk.W;
  const hip = P(W.hips), chestTop = P(W.chest, [0, 0.12, 0]), chestLow = P(W.chest, [0, -0.2, 0]);
  const caps: Capsule[] = [{ a: P(W.hips, [0.1, -0.02, 0]), b: P(W.hips, [-0.1, -0.02, 0]), r: 0.15 * scale }];
  // the torso only lifts the duvet while it lies down (an upright torso is above the top edge)
  const horiz = (a: V3, b: V3) => Math.abs(b[1] - a[1]) < 0.45 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (horiz(hip, chestTop)) caps.push({ a: chestLow, b: chestTop, r: 0.17 * scale }, { a: hip, b: chestLow, r: 0.16 * scale });
  for (const [knee, ankle] of [[W.kneeL, W.ankleL], [W.kneeR, W.ankleR]] as const) {
    const k = P(knee), an = P(ankle);
    const h = P(knee, [0, 0.43, 0]);
    caps.push({ a: h, b: k, r: 0.1 * scale });
    caps.push({ a: k, b: an, r: 0.08 * scale });
    caps.push({ a: P(knee, [0, -0.36, 0]), b: P(ankle, [0, -0.05, 0.2]), r: 0.075 * scale });
  }
  return caps;
};

const NX = 46, NZ = 56;

export const Blanket: React.FC<{
  bed: BedFrame;
  /** z of the turned-back top edge (toward the headboard = smaller z) */
  edge: number;
  caps: Capsule[];
  /** [duvet, cuff] */
  materials: [Material, Material];
}> = ({ bed, edge, caps, materials }) => {
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(NX * NZ * 3), 3));
    const uv = new Float32Array(NX * NZ * 2);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { uv[(j * NX + i) * 2] = (i / (NX - 1)) * 1.6; uv[(j * NX + i) * 2 + 1] = (j / (NZ - 1)) * 1.8; }
    g.setAttribute("uv", new BufferAttribute(uv, 2));
    const idx: number[] = [];
    for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    // cuff band: first rows near the edge (separate group)
    const cuffTris = (NX - 1) * 6 * 7;
    g.addGroup(0, cuffTris, 1);
    g.addGroup(cuffTris, idx.length - cuffTris, 0);
    return g;
  }, []);
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  const { x: bx, halfW, top, z1 } = bed;
  const skirt = 0.3, over = 0.13;
  const H = new Float32Array(NX * NZ), X = new Float32Array(NX * NZ), Z = new Float32Array(NX * NZ), B = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    const v = j / (NZ - 1);
    for (let i = 0; i < NX; i++) {
      const u = i / (NX - 1);
      const lx = -halfW - over + u * 2 * (halfW + over);
      const lzRaw = edge + v * (z1 + over - edge);
      // skirt: beyond the mattress the fabric hangs (x/z clamp to the edge, y drops)
      const ox = Math.max(0, Math.abs(lx) - halfW), oz = Math.max(0, lzRaw - z1);
      const o = Math.max(ox, oz);
      const k = Math.min(1, o / over);
      const drop = skirt * (1 - Math.cos((k * Math.PI) / 2)) + 0.05 * Math.sin(k * Math.PI);
      const x = bx + Math.sign(lx) * Math.min(Math.abs(lx), halfW + 0.035 * Math.sin((k * Math.PI) / 2));
      const z = Math.min(lzRaw, z1 + 0.035 * Math.sin((Math.min(1, oz / over) * Math.PI) / 2));
      // body: highest capsule top under this point
      let hb = -1;
      for (const c of caps) {
        const ax = c.b[0] - c.a[0], az = c.b[2] - c.a[2];
        const L2 = ax * ax + az * az;
        let s = L2 > 1e-8 ? ((x - c.a[0]) * ax + (z - c.a[2]) * az) / L2 : 0;
        s = Math.min(1, Math.max(0, s));
        const px = c.a[0] + ax * s, pz = c.a[2] + az * s, py = c.a[1] + (c.b[1] - c.a[1]) * s;
        const d2 = (x - px) ** 2 + (z - pz) ** 2;
        const rr = c.r + 0.05;
        if (d2 < rr * rr) {
          const inner = Math.sqrt(Math.max(0, c.r * c.r - Math.min(d2, c.r * c.r)));
          const soft = d2 < c.r * c.r ? inner : -(Math.sqrt(d2) - c.r) * 1.2;
          hb = Math.max(hb, py + soft + 0.022);
        }
      }
      const n = j * NX + i;
      X[n] = x; Z[n] = z;
      B[n] = hb;
      H[n] = Math.max(top + 0.03 - drop, hb);
    }
  }
  // fabric softening: blur, then never sink below the body
  const T = new Float32Array(NX * NZ);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        let s = 0, w = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = Math.min(NX - 1, Math.max(0, i + di)), jj = Math.min(NZ - 1, Math.max(0, j + dj));
          const ww = di === 0 && dj === 0 ? 2 : 1;
          s += H[jj * NX + ii] * ww; w += ww;
        }
        T[j * NX + i] = s / w;
      }
    for (let n = 0; n < NX * NZ; n++) H[n] = Math.max(T[n], B[n]);
  }
  const p = geo.attributes.position as BufferAttribute;
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const n = j * NX + i;
      // top edge: the first row tucks down to give the duvet thickness
      const tuck = j === 0 ? -0.045 : j === 1 ? -0.008 : 0;
      p.setXYZ(n, X[n], H[n] + tuck, Z[n] + (j === 0 ? 0.012 : 0));
    }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return (
    <mesh geometry={geo} material={materials} castShadow receiveShadow />
  );
};
