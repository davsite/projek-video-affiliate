// Small geometry kit for architecture: struts between points, merged lattices, lathe and
// arch profiles, geodesic frames. Geometries are cached by key so a film builds each once.

import {
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const cache = new Map<string, BufferGeometry>();
export const cached = <G extends BufferGeometry>(key: string, make: () => G): G => {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g as G;
};

export const cyl = (rt: number, rb: number, h: number, seg = 32, open = false, ts = 0, tl = Math.PI * 2) =>
  cached(`cyl${rt},${rb},${h},${seg},${open},${ts},${tl}`, () => new CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl));
export const box = (w: number, h: number, d: number, r = 0.04, seg = 2) =>
  cached(`box${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01)));
export const sphere = (r: number, ws = 32, hs = 16, phiLen = Math.PI * 2, thetaLen = Math.PI) =>
  cached(`sph${r},${ws},${hs},${phiLen},${thetaLen}`, () => new SphereGeometry(r, ws, hs, 0, phiLen, 0, thetaLen));
export const torus = (R: number, r: number, rs = 8, ts = 48, arc = Math.PI * 2) =>
  cached(`tor${R},${r},${rs},${ts},${arc}`, () => new TorusGeometry(R, r, rs, ts, arc));
export const lathe = (key: string, pts: [number, number][], seg = 64) =>
  cached(`lathe${key}`, () => new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), seg));

const UP = new Vector3(0, 1, 0);
/** A cylinder from p to q (world-free; positions in the caller's frame). */
export const strutGeo = (p: Vector3, q: Vector3, r: number, seg = 6) => {
  const d = new Vector3().subVectors(q, p);
  const len = d.length();
  const g = new CylinderGeometry(r, r, len, seg, 1, false);
  const m = new Matrix4().compose(
    new Vector3().addVectors(p, q).multiplyScalar(0.5),
    new Quaternion().setFromUnitVectors(UP, d.normalize()),
    new Vector3(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g;
};

export const merged = (key: string, make: () => BufferGeometry[]) =>
  cached(key, () => {
    const parts = make().map((g) => (g.index ? g.toNonIndexed() : g));
    for (const p of parts) {
      for (const name of Object.keys(p.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") p.deleteAttribute(name);
    }
    return mergeGeometries(parts, false)!;
  });

/** Geodesic frame over the upper hemisphere (edges of a subdivided icosahedron). */
export const geodesicFrame = (R: number, detail: number, strutR: number) =>
  merged(`geo${R},${detail},${strutR}`, () => {
    const ico = new IcosahedronGeometry(R, detail);
    const p = ico.attributes.position;
    const key = (v: Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    const edges = new Map<string, [Vector3, Vector3]>();
    for (let i = 0; i < p.count; i += 3) {
      const tri = [0, 1, 2].map((k) => new Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3];
        if (a.y < -0.01 || b.y < -0.01) continue;
        const ka = key(a), kb = key(b);
        const id = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        if (!edges.has(id)) edges.set(id, [a, b]);
      }
    }
    return [...edges.values()].map(([a, b]) => strutGeo(a, b, strutR, 5));
  });

/** Arch outline (flat sides, rounded roof) in the x-y plane, base on y = 0. */
export const archShape = (w: number, h: number, shoulder: number, inset = 0) => {
  const s = new Shape();
  const hw = w / 2 - inset;
  s.moveTo(-hw, inset > 0 ? 0 : 0);
  s.lineTo(-hw, h - shoulder);
  s.quadraticCurveTo(-hw, h - inset, 0, h - inset);
  s.quadraticCurveTo(hw, h - inset, hw, h - shoulder);
  s.lineTo(hw, 0);
  s.lineTo(-hw, 0);
  return s;
};
