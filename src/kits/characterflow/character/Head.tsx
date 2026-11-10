// Stylised head + face rig. Units are "head units" (the unscaled head is ~0.21 m wide); the parent
// scales by spec.headScale. Features are placed on the actual skull surface (a ray-cast lookup built
// once), so brows, mouth, nose and blush sit on the skin for any expression instead of floating.
//
// Face controls (pose.ts › Face): brows (up / inner / asym), lids (open → wide, squint), gaze, mouth
// (smile, open, wide) and blush. The mouth is a live mesh with fixed topology — never re-allocated.

import React, { useLayoutEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector3,
} from "three";
import { cached, sphere, torus } from "../lib/geo.ts";
import type { CharMats } from "./materials.ts";
import type { Face } from "./pose.ts";
import type { CharacterSpec, V3 } from "./spec.ts";

// ── skull ───────────────────────────────────────────────────────────────────
export const HEAD_R: V3 = [0.106, 0.114, 0.108];

/** Unit-sphere point → stylised skull (soft square jaw, full cheeks, rounded cranium). */
export const skull = (x: number, y: number, z: number): V3 => {
  const low = Math.max(0, -y);
  x *= 1 - 0.1 * Math.pow(low, 1.6) - 0.05 * low * low * Math.max(0, z);
  z += 0.08 * low * Math.max(0, z) * Math.max(0, z);
  y *= 1 - 0.04 * low;
  const cheek = Math.exp(-((y + 0.25) ** 2) / 0.06) * Math.max(0, z) * 0.09;
  x *= 1 + cheek;
  z *= 1 - 0.035 * Math.max(0, y) * Math.max(0, z);
  if (z < 0 && y > -0.2) z *= 1 + 0.06 * (y + 0.2);
  return [x * HEAD_R[0], y * HEAD_R[1], z * HEAD_R[2]];
};

export const headGeo = () =>
  cached("cf-head", () => {
    const g = new SphereGeometry(1, 96, 72);
    const a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const [x, y, z] = skull(a.getX(i), a.getY(i), a.getZ(i));
      a.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });

// Surface lookup over the face: z (and normal) of the skin at (x, y), front side.
type Surf = { z: (x: number, y: number) => number; n: (x: number, y: number) => Vector3 };
let surf: Surf | null = null;
const surface = (): Surf => {
  if (surf) return surf;
  const mesh = new Mesh(headGeo(), new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld();
  const rc = new Raycaster();
  const X0 = -0.1, X1 = 0.1, Y0 = -0.13, Y1 = 0.12, NX = 41, NY = 51;
  const Z = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const x = X0 + ((X1 - X0) * i) / (NX - 1), y = Y0 + ((Y1 - Y0) * j) / (NY - 1);
      rc.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
      const hit = rc.intersectObject(mesh, false)[0];
      Z[j * NX + i] = hit ? hit.point.z : 0;
    }
  const z = (x: number, y: number) => {
    const fi = Math.min(NX - 1.001, Math.max(0, ((x - X0) / (X1 - X0)) * (NX - 1)));
    const fj = Math.min(NY - 1.001, Math.max(0, ((y - Y0) / (Y1 - Y0)) * (NY - 1)));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const a = Z[j * NX + i], b = Z[j * NX + i + 1], c = Z[(j + 1) * NX + i], d = Z[(j + 1) * NX + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const n = (x: number, y: number) => {
    const e = 0.002;
    const dzx = (z(x + e, y) - z(x - e, y)) / (2 * e), dzy = (z(x, y + e) - z(x, y - e)) / (2 * e);
    return new Vector3(-dzx, -dzy, 1).normalize();
  };
  surf = { z, n };
  return surf;
};

const onSkin = (x: number, y: number, lift = 0): V3 => {
  const s = surface();
  const nn = s.n(x, y);
  return [x + nn.x * lift, y + nn.y * lift, s.z(x, y) + nn.z * lift];
};
const skinQuat = (x: number, y: number) => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), surface().n(x, y));

// ── features ────────────────────────────────────────────────────────────────
export const EYE = { x: 0.041, y: 0.004, z: 0.0765, r: 0.0262 };
const LID_R = EYE.r * 1.058;

/** Tapered, arched brow along +x from the inner end (thick) to the outer end (thin). */
const browGeo = () =>
  cached("cf-brow", () => {
    const N = 14, M = 10, L = 0.044;
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const r = 0.0068 * (1 - 0.55 * u) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.6)));
      const cx = u * L, cy = 0.006 * Math.sin(Math.PI * u * 0.9) - 0.002 * u, cz = -0.012 * u * u;
      for (let j = 0; j < M; j++) {
        const a = (j / M) * Math.PI * 2;
        pos.push(cx, cy + Math.sin(a) * r * 0.75, cz + Math.cos(a) * r * 0.55);
      }
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M; j++) {
        const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
        idx.push(a, c, b, b, c, d);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

const capsule = (r: number, l: number) => cached(`cfcap${r},${l}`, () => new CapsuleGeometry(r, l, 6, 14));

// ── the mouth (dynamic) ─────────────────────────────────────────────────────
const MN = 28;
type MouthGeos = { inner: BufferGeometry; line: BufferGeometry; teeth: BufferGeometry; tongue: BufferGeometry };
const strip = () => {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array((MN + 1) * 2 * 3), 3));
  const idx: number[] = [];
  for (let i = 0; i < MN; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setIndex(idx);
  return g;
};
const setStrip = (g: BufferGeometry, top: (u: number) => [number, number], bot: (u: number) => [number, number], lift: number) => {
  const p = g.attributes.position as BufferAttribute;
  for (let i = 0; i <= MN; i++) {
    const u = (i / MN) * 2 - 1;
    const [x0, y0] = top(u), [x1, y1] = bot(u);
    const a = onSkin(x0, y0, lift), b = onSkin(x1, y1, lift);
    p.setXYZ(i * 2, a[0], a[1], a[2]);
    p.setXYZ(i * 2 + 1, b[0], b[1], b[2]);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
};

const Mouth: React.FC<{ f: Face; m: CharMats }> = ({ f, m }) => {
  const geos = useMemo<MouthGeos>(() => ({ inner: strip(), line: strip(), teeth: strip(), tongue: strip() }), []);
  useLayoutEffect(() => () => { for (const g of Object.values(geos)) g.dispose(); }, [geos]);
  const Y = -0.061;
  const half = 0.02 * (1 + 0.3 * f.wide + 0.12 * Math.max(0, f.smile)) * (1 - 0.15 * f.open);
  const c = 0.0085 * f.smile + 0.003 * Math.min(0, f.wide);
  const op = Math.max(0, f.open);
  const yU = (u: number) => Y + c * u * u + op * 0.0035 * (1 - u * u) + 0.0012 * Math.max(0, f.smile) * (1 - u * u);
  const yL = (u: number) => Y + c * u * u - op * (0.017 + 0.004 * f.wide) * Math.pow(1 - u * u, 0.85) - 0.0035 * Math.max(0, f.smile) * Math.pow(1 - u * u, 1.4) * (0.4 + op);
  const xx = (u: number) => u * half;
  const lw = 0.0021 + 0.0006 * (1 - op);
  setStrip(geos.inner, (u) => [xx(u), yU(u)], (u) => [xx(u), yL(u)], 0.0006);
  setStrip(geos.line, (u) => [xx(u) * 1.02, yU(u) + lw * 0.5 * (1 - 0.6 * u * u)], (u) => [xx(u) * 1.02, yU(u) - lw * 0.5 * (1 - 0.6 * u * u)], 0.0011);
  const th = Math.min(1, Math.max(0, op - 0.15) * 3) * 0.0055;
  setStrip(geos.teeth, (u) => [xx(u) * 0.8, yU(u * 0.8) - 0.0008], (u) => [xx(u) * 0.8, yU(u * 0.8) - 0.0008 - th * (1 - u * u * 0.6)], 0.0009);
  const tg = op * 0.006;
  setStrip(geos.tongue, (u) => [xx(u) * 0.62, yL(u * 0.62) + tg], (u) => [xx(u) * 0.62, yL(u * 0.62) + 0.0004], 0.0009);
  return (
    <group>
      <mesh geometry={geos.inner} material={m.mouth} visible={op > 0.02 || f.smile > 0.3} />
      <mesh geometry={geos.teeth} material={m.teeth} visible={op > 0.17} />
      <mesh geometry={geos.tongue} material={m.tongue} visible={op > 0.25} />
      <mesh geometry={geos.line} material={m.lipLine} />
    </group>
  );
};

// ── hair ────────────────────────────────────────────────────────────────────
// A sculpted shell over the skull (one smooth mesh with lock grooves, a scalloped hairline and a
// front quiff) plus a few hero locks for the silhouette — clean stylised hair, no spikes.
const sstep = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const table = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (x <= pts[i][0]) { const k = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); const u = 0.5 - 0.5 * Math.cos(Math.PI * k); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u; }
  return pts[pts.length - 1][1];
};
type HairCfg = { line: [number, number][]; base: number; top: number; quiff: number; groove: number; scallop: number; fringe: number; curls?: number };
const HAIR: Record<CharacterSpec["hairStyle"], HairCfg> = {
  swoop: { line: [[0, 0.42], [0.75, 0.37], [1.15, 0.22], [1.45, 0.17], [1.75, 0.12], [2.3, -0.18], [Math.PI, -0.5]], base: 0.007, top: 0.016, quiff: 0.024, groove: 0.3, scallop: 0.045, fringe: 1 },
  crop: { line: [[0, 0.5], [0.8, 0.44], [1.2, 0.26], [1.5, 0.2], [1.8, 0.14], [2.4, -0.2], [Math.PI, -0.45]], base: 0.006, top: 0.012, quiff: 0.006, groove: 0.12, scallop: 0.02, fringe: 0 },
  bun: { line: [[0, 0.46], [0.8, 0.4], [1.2, 0.18], [1.5, 0.1], [1.8, 0.0], [2.4, -0.3], [Math.PI, -0.55]], base: 0.01, top: 0.016, quiff: 0.004, groove: 0.1, scallop: 0.015, fringe: 0 },
  curly: { line: [[0, 0.44], [0.8, 0.4], [1.2, 0.22], [1.5, 0.18], [1.8, 0.12], [2.4, -0.14], [Math.PI, -0.42]], base: 0.015, top: 0.022, quiff: 0.0, groove: 0, scallop: 0.025, fringe: 0, curls: 0.3 },
  // shoulder-length: a side-parted cap that comes down over the ears (the back mass is added in Head)
  long: { line: [[0, 0.4], [0.7, 0.3], [1.1, 0.0], [1.4, -0.35], [1.8, -0.55], [2.4, -0.7], [Math.PI, -0.75]], base: 0.012, top: 0.018, quiff: 0.008, groove: 0.14, scallop: 0.0, fringe: 0.6 },
  // a hijab is its own shell (hijabShell); this entry only satisfies the table
  hijab: { line: [[0, 0.46], [Math.PI, -0.5]], base: 0.01, top: 0.01, quiff: 0, groove: 0, scallop: 0, fringe: 0 },
};

/**
 * Hijab: a smooth cloth shell over the whole head that leaves an oval for the face (forehead to chin,
 * cheek to cheek) and wraps down past the jaw at the sides and back; the drape over the neck and
 * shoulders hangs from the neck (Character.tsx), so the head can turn inside it.
 */
export const hijabShell = () =>
  cached("cf-hijab", () => {
    const NA = 200, NT = 60;
    const pos: number[] = [];
    // lowest covered elevation per azimuth: high at the face, deep everywhere else
    const rim = (az: number) => table([[0, 0.5], [0.55, 0.44], [0.78, 0.05], [0.95, -0.75], [1.15, -1.2], [1.5, -1.32], [Math.PI, -1.32]], Math.abs(az));
    for (let j = -2; j <= NT; j++) {
      for (let i = 0; i < NA; i++) {
        const az = -Math.PI + (i / NA) * Math.PI * 2;
        const H = rim(az);
        const t = Math.max(0, j / NT);
        const el = H + (Math.PI / 2 - H) * Math.pow(t, 0.9);
        const ux = Math.sin(az) * Math.cos(el), uy = Math.sin(el), uz = Math.cos(az) * Math.cos(el);
        const [sx, sy, sz] = skull(ux, uy, uz);
        const r = Math.hypot(sx, sy, sz);
        // a soft fold where the cloth meets the face, fuller over the crown and the back
        const th = 0.011 + 0.008 * Math.max(0, uy) + 0.006 * Math.max(0, -uz) + 0.004 * sstep(0.9, 0.6, Math.abs(az));
        const lip = j < 0 ? -0.004 * (-j) : th * Math.sqrt(sstep(0, 0.1, t)) + 0.0015;
        const k = (r + lip) / r;
        pos.push(sx * k, sy * k, sz * k);
      }
    }
    const rows = NT + 3, idx: number[] = [];
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < NA; i++) {
        const a0 = j * NA + i, a1 = j * NA + ((i + 1) % NA), b0 = (j + 1) * NA + i, b1 = (j + 1) * NA + ((i + 1) % NA);
        idx.push(a0, a1, b0, a1, b1, b0);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

export const hairShell = (style: CharacterSpec["hairStyle"]) =>
  cached(`cf-hair-${style}`, () => {
    // Parametric cap: columns around the head (az), rows from the hairline (t = 0) to the crown
    // (t = 1). The rim is an explicit smooth curve with a rounded lip tucked under the skin.
    const C = HAIR[style];
    const NA = 220, NT = 70;
    const pos: number[] = [];
    const hairline = (az: number) => {
      const A = Math.abs(az);
      let H = table(C.line, A) + C.scallop * Math.sin(az * 11 + 0.6) * sstep(1.9, 0.4, A);
      return H - C.fringe * 0.1 * Math.exp(-((az + 0.32) ** 2) / 0.09);
    };
    for (let j = -2; j <= NT; j++) {
      for (let i = 0; i < NA; i++) {
        const az = -Math.PI + (i / NA) * Math.PI * 2;
        const H = hairline(az);
        const t = Math.max(0, j / NT);
        const el = H + (Math.PI / 2 - H) * Math.pow(t, 0.85);
        const ux = Math.sin(az) * Math.cos(el), uy = Math.sin(el), uz = Math.cos(az) * Math.cos(el);
        const [sx, sy, sz] = skull(ux, uy, uz);
        const r = Math.hypot(sx, sy, sz);
        let th = C.base + C.top * Math.pow(Math.max(0, uy), 0.9);
        const qd = (ux + 0.12) ** 2 + (uy - 0.68) ** 2 + (uz - 0.72) ** 2;
        th += C.quiff * Math.exp(-qd / 0.12);
        th *= 1 + C.groove * Math.sin(ux * 14 + uz * 6 - uy * 5) * sstep(0, 0.25, t) * sstep(0.97, 0.8, uy);
        // tight curls: overlapping round bumps (3-D lattice, no seams)
        if (C.curls) th *= 1 + C.curls * Math.sin(ux * 13) * Math.sin(uy * 13 + 1.3) * Math.sin(uz * 13 + 0.7) * sstep(0, 0.12, t);
        // rounded lip: thickness rises quickly from the rim; rows j < 0 tuck under the skin
        const lip = j < 0 ? -0.004 * (-j) : th * Math.sqrt(sstep(0, 0.07, t)) + 0.0012;
        const k = (r + lip) / r;
        pos.push(sx * k, sy * k, sz * k);
      }
    }
    const rows = NT + 3;
    const idx: number[] = [];
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < NA; i++) {
        const a0 = j * NA + i, a1 = j * NA + ((i + 1) % NA), b0 = (j + 1) * NA + i, b1 = (j + 1) * NA + ((i + 1) % NA);
        idx.push(a0, a1, b0, a1, b1, b0);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

// ── head ────────────────────────────────────────────────────────────────────
export const Head: React.FC<{ f: Face; spec: CharacterSpec; m: CharMats; shadows: boolean }> = ({ f, spec, m, shadows }) => {
  // upper lid edge sits ~32° above the eye centre when open (lid = 1), closes at 0, opens wider above 1
  const low = 0.95 - 0.55 * f.squint - 0.25 * Math.max(0, f.smile);
  const lidA = Math.min(low - 0.02, Math.max(-1.1, Math.PI / 2 - 2.13 * f.lid));
  const lowA = Math.PI + low;
  const cs = shadows;
  return (
    <group>
      <mesh geometry={headGeo()} material={m.skin} castShadow={cs} receiveShadow />
      {/* ears */}
      {[1, -1].map((s) => (
        <group key={`ear${s}`} position={[s * 0.101, -0.012, -0.004]} rotation={[0, s * 0.35, 0]}>
          <mesh geometry={sphere(0.034, 20, 14)} material={m.skin} scale={[0.36, 0.92, 0.66]} castShadow={cs} />
          <mesh geometry={sphere(0.02, 14, 10)} material={m.skin} position={[s * 0.006, -0.002, 0.004]} scale={[0.3, 0.8, 0.5]} />
        </group>
      ))}
      {/* nose */}
      <mesh geometry={sphere(0.0135, 24, 16)} material={m.skin} position={onSkin(0, -0.03, 0.0045)} scale={[1.1, 0.88, 0.95]} castShadow={cs} />
      <mesh geometry={sphere(0.009, 16, 12)} material={m.skin} position={onSkin(0, -0.012, -0.0005)} scale={[0.8, 1.45, 0.7]} />
      {[1, -1].map((s) => (
        <mesh key={`nos${s}`} geometry={sphere(0.0058, 14, 10)} material={m.skin} position={onSkin(s * 0.0098, -0.0335, 0.0)} />
      ))}
      {/* cheeks blush */}
      {[1, -1].map((s) => (
        <mesh key={`bl${s}`} geometry={cached("cf-blushplane", () => new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2))} material={m.blush}
          position={onSkin(s * 0.056, -0.034, 0.0015)} quaternion={skinQuat(s * 0.056, -0.034).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2))}
          scale={[0.024 * (1 + 0.2 * f.blush), 0.001, 0.016 * (1 + 0.2 * f.blush)]} />
      ))}
      {/* eyes */}
      {[1, -1].map((s) => {
        const tilt = -s * 0.12 * f.browIn;
        return (
          <group key={`eye${s}`} position={[s * EYE.x, EYE.y, EYE.z]}>
            <mesh geometry={sphere(EYE.r, 40, 28)} material={m.eye} rotation={[-f.eyeY, f.eyeX, 0]} />
            {/* catchlights stay fixed to the head (the eye turns under them) */}
            <mesh visible={f.lid > 0.74} geometry={sphere(0.0026, 10, 8)} material={m.glint} position={[s * -0.007 + 0.002, 0.009, EYE.r * 0.88]} />
            <mesh visible={f.lid > 0.74} geometry={sphere(0.0013, 8, 6)} material={m.glint} position={[s * 0.006, -0.006, EYE.r * 0.93]} />
            <group rotation={[0, 0, tilt]}>
              <group rotation={[lidA, 0, 0]}>
                <mesh geometry={sphere(LID_R, 36, 14, Math.PI * 2, Math.PI / 2)} material={m.skin} />
                <mesh geometry={torus(LID_R, 0.0024, 6, 40, Math.PI)} material={m.lash} rotation={[Math.PI / 2, 0, 0]} />
                {/* outer lash flick */}
                <mesh geometry={capsule(0.0019, 0.006)} material={m.lash} position={[s * LID_R * 0.96, 0, LID_R * 0.18]} rotation={[0, 0, s * 1.05]} />
              </group>
              <group rotation={[lowA, 0, 0]}>
                <mesh geometry={sphere(LID_R * 0.995, 36, 12, Math.PI * 2, Math.PI / 2)} material={m.skin} />
              </group>
            </group>
          </group>
        );
      })}
      {/* brows */}
      {[1, -1].map((s) => {
        const up = 0.0085 * f.browUp + s * 0.006 * f.browAsym;
        const bx = s * 0.0225, by = 0.041 + up + 0.0035 * f.browIn;
        const a = -s * 0.3 * f.browIn + s * 0.08;
        const pos = onSkin(bx, by, 0.0035);
        return (
          <group key={`br${s}`} position={pos} rotation={[-0.18, s * 0.2, a]} scale={[s, 1, 1]}>
            <mesh geometry={browGeo()} material={m.brow} castShadow={cs} />
          </group>
        );
      })}
      <Mouth f={f} m={m} />
      {/* hair */}
      {spec.hairStyle === "hijab" ? (
        <mesh geometry={hijabShell()} material={m.scarf} castShadow={cs} receiveShadow />
      ) : (
        <mesh geometry={hairShell(spec.hairStyle)} material={m.hair} castShadow={cs} receiveShadow />
      )}
      {spec.hairStyle === "bun" ? <mesh geometry={sphere(0.055, 24, 16)} material={m.hair} position={[0, 0.1, -0.09]} castShadow={cs} /> : null}
      {spec.hairStyle === "long" ? (
        <>
          <mesh geometry={sphere(1, 32, 20)} material={m.hair} position={[0, -0.045, -0.042]} scale={[0.108, 0.135, 0.085]} castShadow={cs} />
          {[1, -1].map((s) => <mesh key={`lk${s}`} geometry={sphere(1, 20, 14)} material={m.hair} position={[s * 0.088, -0.07, -0.022]} scale={[0.026, 0.085, 0.05]} rotation={[0.15, 0, s * 0.08]} castShadow={cs} />)}
        </>
      ) : null}
      {spec.moustache ? [1, -1].map((s) => <mesh key={`mo${s}`} geometry={sphere(1, 20, 12)} material={m.brow} position={onSkin(s * 0.0125, -0.046, 0.0005)} quaternion={skinQuat(s * 0.0125, -0.046)} rotation={[0, 0, s * -0.18]} scale={[0.0155, 0.0062, 0.006]} />) : null}
      {spec.beard ? <mesh geometry={cached("cf-beard", () => new SphereGeometry(1, 40, 20, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.6, Math.PI * 0.3))} material={m.hair} position={[0, 0.004, 0.002]} scale={[0.103, 0.121, 0.109]} /> : null}
      {spec.glasses ? (
        <group>
          {[1, -1].map((s) => (
            <group key={`gl${s}`}>
              <mesh geometry={torus(0.031, 0.0032, 8, 36)} material={m.frame} position={[s * EYE.x, EYE.y, EYE.z + EYE.r + 0.01]} />
              <mesh geometry={capsule(0.0025, 0.08)} material={m.frame} position={[s * 0.085, EYE.y + 0.004, 0.06]} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          <mesh geometry={capsule(0.0026, 0.016)} material={m.frame} position={[0, EYE.y + 0.006, EYE.z + EYE.r + 0.012]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      ) : null}
    </group>
  );
};
