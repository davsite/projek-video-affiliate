// Thought field: imagined situations orbiting a character's head. Bubbles are data (ThoughtDef), the
// field's behaviour over time is a FieldMood that the scene computes (drift → swirl, calm → ghost →
// alarm, freeze, dissolve). Large bubbles hold staged mini scenes (vignettes.tsx) or a glyph; the swarm
// is instanced (cheap at 100+). Everything glowing sits on FX_LAYER so depth passes ignore it.
//
// Placement frame: `back` is the direction from the camera side toward the set (bubbles start behind
// and beside the head); when the swirl carries a bubble round to the camera side it is pushed up/down
// and outward so it never covers the face.

import React, { useMemo } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { FX_LAYER } from "../../../core/render/Post.tsx";
import { setMiniFade } from "../character/materials.ts";
import { BIMA, BOSS, FRIEND, NAYA, RAKA, RAKA_OUT, type V3 } from "../character/spec.ts";
import { cached, sphere, torus } from "../lib/geo.ts";
import { hash1, mixHex } from "../lib/mats.ts";
import { bubbleTex, haloTex, iconTex, ICONS, textTex, type IconName } from "./icons.ts";
import { Vignette, type Cast, type VignetteName, type VignetteText } from "./vignettes.tsx";

export type ThoughtDef = {
  id: string;
  at: number;
  vignette?: VignetteName;
  icon?: IconName;
  /** offset from the field centre in the field frame: [right, up, back] metres (right/back are
   *  horizontal and follow `back`, the direction away from the main camera) */
  slot: [number, number, number];
  size: number;
  trail?: boolean;
  /** scale with the alarm pulse */
  pulses?: boolean;
  /** this bubble only exists from `at` until `until` */
  until?: number;
  /** who plays in the vignette */
  cast?: Cast;
  /** short text written inside the bubble (any topic, no vignette needed) */
  text?: string;
};

export type FieldMood = {
  /** accumulated orbit angle (rad) — the scene integrates its own speed */
  phase: number;
  /** motion clock (stops at a freeze) */
  tm: number;
  agitation: number;
  ghost: number;
  alarm: number;
  pulse: number;
  dissolve: number;
  tight: number;
  /** overall visibility of the large bubbles */
  show: number;
};

export type SwarmDef = { at: number; spread: number; count: number; rMin: number; rMax: number };

const COOL = { disc: "#f3f9ff", rim: "#8fdcff", glow: "#7fd0ff", ink: "#2f5d8a" };
const HOT = { disc: "#ffd9d2", rim: "#ff4a3d", glow: "#ff3d2e", ink: "#b3201b" };
const GHOST = { disc: "#c9d3e0", rim: "#b8c6d8", glow: "#8aa0c0", ink: "#7a8aa3" };

const colors = (m: FieldMood) => {
  const pick = (k: keyof typeof COOL) => mixHex(mixHex(COOL[k], GHOST[k], m.ghost), HOT[k], m.alarm);
  return { disc: pick("disc"), rim: pick("rim"), glow: pick("glow"), ink: pick("ink") };
};

const popIn = (x: number) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const billboard = (pos: V3, cam: V3) =>
  new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(new Vector3(...cam), new Vector3(...pos), new Vector3(0, 1, 0)));

/** World position of a slot at time t. The (right, back) part orbits round the vertical axis with the
 *  field phase; while it passes the camera side it is pushed up/down and outward, clear of the face. */
export const slotPos = (slot: [number, number, number], center: V3, back: V3, m: FieldMood, seed: number): V3 => {
  const [x0, y0, d0] = slot;
  const b = new Vector3(...back).setY(0).normalize();
  const rt = new Vector3(-b.z, 0, b.x);
  const ang = Math.atan2(x0, d0) + m.phase * (0.8 + 0.4 * hash1(seed, 3)) + 0.1 * Math.sin(m.tm * 0.6 + seed);
  const rad = Math.hypot(x0, d0) * m.tight;
  const front = Math.max(0, -Math.cos(ang));
  const y = y0 + Math.sign(y0 - 0.05 || 1) * 0.45 * front + 0.035 * Math.sin(m.tm * (1.1 + m.agitation * 3) + seed * 1.7) * (1 + 2 * m.agitation);
  const r = rad * (1 + 0.5 * front) + 0.015 * Math.sin(m.tm * 2.3 + seed);
  const d = b.clone().multiplyScalar(Math.cos(ang) * r).addScaledVector(rt, Math.sin(ang) * r);
  return [center[0] + d.x, center[1] + y, center[2] + d.z];
};

/** 0 when a bubble would sit on the lens, 1 from a comfortable distance. */
const nearFade = (p: V3 | Vector3, cam: V3) => {
  const v = p instanceof Vector3 ? p : new Vector3(...p);
  const dd = v.distanceTo(new Vector3(...cam));
  const k = Math.min(1, Math.max(0, (dd - 0.45) / 0.5));
  return k * k * (3 - 2 * k);
};

const glowMat = () => new MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
const mats = new Map<string, MeshBasicMaterial>();
const M = (key: string, make: () => MeshBasicMaterial) => {
  let m = mats.get(key);
  if (!m) { m = make(); mats.set(key, m); }
  return m;
};
const unit = () => cached("cfunitplane", () => new PlaneGeometry(1, 1));

const Bubble: React.FC<{ d: ThoughtDef; i: number; t: number; pos: V3; cam: V3; head: V3; mood: FieldMood; txt: VignetteText; C: ReturnType<typeof colors> }> = ({ d, i, t, pos, cam, head, mood, txt, C }) => {
  const age = t - d.at;
  const out = d.until !== undefined ? 1 - Math.min(1, Math.max(0, (t - d.until) / 0.3)) : 1;
  let s = d.size * popIn(age / 0.45) * out * mood.show * (1 - 0.85 * mood.dissolve);
  if (d.pulses) s *= 1 + 0.12 * mood.pulse;
  s *= nearFade(pos, cam);
  if (s <= 0.002) return null;
  const q = billboard(pos, cam);
  const flick = mood.ghost > 0 ? 1 - mood.ghost * (0.28 + 0.22 * Math.sin(t * 23 + i * 2.1)) : 1;
  const disc = M(`disc${i}`, () => new MeshBasicMaterial({ map: bubbleTex(), transparent: true, depthWrite: false, side: DoubleSide }));
  disc.color.set(C.disc);
  disc.opacity = 0.97 * flick * (1 - mood.dissolve);
  const halo = M(`halo${i}`, glowMat);
  halo.color.set(C.glow);
  halo.opacity = (0.3 + 0.25 * mood.alarm * mood.pulse) * (1 - mood.dissolve);
  const rim = M(`rim${i}`, () => new MeshBasicMaterial({ toneMapped: false }));
  rim.color.set(C.rim).multiplyScalar(1.3 + 0.8 * mood.alarm * mood.pulse);
  const ink = M(`ink${i}`, () => new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide }));
  if (d.icon) ink.map = iconTex(d.icon);
  ink.color.set(C.ink);
  ink.opacity = flick * (1 - mood.dissolve);
  const dashes = 28, dashK = 1 - 0.55 * mood.ghost;
  const trail = d.trail ? [0.3, 0.5, 0.68].map((f) => [head[0] + (pos[0] - head[0]) * f, head[1] + 0.12 + (pos[1] - head[1] - 0.12) * f, head[2] + (pos[2] - head[2]) * f] as V3) : [];
  return (
    <>
      <group position={pos} quaternion={q} scale={s}>
        <mesh geometry={unit()} material={halo} scale={3.2} position={[0, 0, -0.05]} layers={FX_LAYER} />
        <mesh geometry={cached("cfbubbledisc", () => new PlaneGeometry(2.04, 2.04))} material={disc} layers={FX_LAYER} />
        {Array.from({ length: dashes }, (_, k) => (
          <mesh key={k} geometry={torus(1.0, 0.03, 6, 6, ((Math.PI * 2) / dashes) * dashK)} material={rim} rotation={[0, 0, (k / dashes) * Math.PI * 2 + mood.tm * 0.4]} layers={FX_LAYER} />
        ))}
        {d.icon ? <mesh geometry={unit()} material={ink} scale={1.25} position={[0, 0, 0.02]} layers={FX_LAYER} /> : null}
        {d.text ? <mesh geometry={unit()} material={M(`txt${d.text}`, () => new MeshBasicMaterial({ map: textTex(d.text!), transparent: true, depthWrite: false, toneMapped: false }))} scale={1.7} position={[0, 0, 0.025]} layers={FX_LAYER} /> : null}
        {d.vignette ? (
          <group position={[0, -0.8, 0.08]} scale={0.6}>
            <Vignette name={d.vignette} t={t + i * 1.3} txt={txt} cast={d.cast} />
          </group>
        ) : null}
      </group>
      {trail.map((p, k) => (
        <mesh key={`tr${k}`} geometry={sphere(1, 16, 12)} material={disc} position={p} scale={s * (0.08 + 0.07 * k)} layers={FX_LAYER} />
      ))}
    </>
  );
};

// ── swarm (instanced) ───────────────────────────────────────────────────────
type Inst = { dir: Vector3; r: number; at: number; icon: number; size: number; seed: number };
const swarmData = (S: SwarmDef, back: V3): Inst[] => {
  const out: Inst[] = [];
  const b = new Vector3(...back).normalize();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0, k = 0; out.length < S.count && k < S.count * 4; k++) {
    const y = 1 - (k / (S.count * 4 - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const dir = new Vector3(Math.cos(golden * k) * rr * 0.62, y * 1.1 + 0.2, Math.sin(golden * k) * rr * 0.62);
    // keep the camera side clear (nothing between the lens and the face)
    if (new Vector3(dir.x, 0, dir.z).normalize().dot(b) < -0.15 && dir.y < 1.1) continue;
    if (hash1(k, 41) < 0.5) continue;
    out.push({ dir, r: S.rMin + (S.rMax - S.rMin) * hash1(k, 5), at: S.at + S.spread * hash1(i, 9), icon: i % ICONS.length, size: 0.05 + 0.05 * hash1(k, 13), seed: k });
    i++;
  }
  return out;
};

const Swarm: React.FC<{ S: SwarmDef; t: number; center: V3; back: V3; cam: V3; mood: FieldMood; C: ReturnType<typeof colors> }> = ({ S, t, center, back, cam, mood, C }) => {
  const data = useMemo(() => swarmData(S, back), [S, back]);
  const meshes = useMemo(() => {
    const discs = new InstancedMesh(cached("cfswarmdisc", () => new PlaneGeometry(2.04, 2.04)), new MeshBasicMaterial({ map: bubbleTex(), transparent: true, depthWrite: false, side: DoubleSide }), data.length);
    const icons = ICONS.map((name, k) => new InstancedMesh(unit(), new MeshBasicMaterial({ map: iconTex(name), transparent: true, depthWrite: false, side: DoubleSide }), data.filter((d) => d.icon === k).length));
    const glow = new InstancedMesh(unit(), new MeshBasicMaterial({ map: haloTex(), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), data.length);
    for (const m of [discs, glow, ...icons]) { m.frustumCulled = false; m.layers.set(FX_LAYER); }
    return { discs, icons, glow };
  }, [data]);
  const q = billboard(center, cam);
  const counters = ICONS.map(() => 0);
  const mx = new Matrix4(), mg = new Matrix4();
  data.forEach((d, i) => {
    const age = t - d.at;
    const k = popIn(age / 0.5);
    const sp = mood.phase * (0.6 + 0.5 * hash1(d.seed, 2));
    const dir = d.dir.clone().applyAxisAngle(new Vector3(0, 1, 0), sp);
    // swirled round to the camera side: lift away from the face, push out and shrink
    const hb = new Vector3(dir.x, 0, dir.z).normalize().dot(new Vector3(...back).setY(0).normalize());
    const front = Math.max(0, -hb);
    dir.y += 0.7 * front * Math.sign(dir.y + 0.05);
    const r = d.r * mood.tight * (1 + 0.5 * front) * (0.35 + 0.65 * Math.min(1, Math.max(0, age / 0.6)));
    const bob = 0.03 * Math.sin(mood.tm * (1.3 + 2.5 * mood.agitation) + d.seed) * (1 + 2 * mood.agitation);
    const up = mood.dissolve * (0.25 + 0.5 * hash1(d.seed, 17));
    const p = new Vector3(center[0] + dir.x * r, center[1] + dir.y * r + bob + up, center[2] + dir.z * r);
    const s = d.size * k * (1 - mood.dissolve) * mood.show * (1 + 0.15 * mood.pulse * mood.alarm) * nearFade(p, cam) * (1 - 0.6 * front);
    mx.compose(p, q, new Vector3(s, s, s));
    mg.compose(p.clone().addScaledVector(new Vector3(...back).normalize(), 0.01), q, new Vector3(s * 3, s * 3, s * 3));
    meshes.discs.setMatrixAt(i, mx);
    meshes.glow.setMatrixAt(i, mg);
    const ic = meshes.icons[d.icon];
    const p2 = p.clone().addScaledVector(new Vector3(...cam).sub(p).normalize(), 0.004);
    mx.compose(p2, q, new Vector3(s * 1.2, s * 1.2, s * 1.2));
    ic.setMatrixAt(counters[d.icon]++, mx);
  });
  for (const m of [meshes.discs, meshes.glow, ...meshes.icons]) m.instanceMatrix.needsUpdate = true;
  const flick = 1 - mood.ghost * 0.35;
  (meshes.discs.material as MeshBasicMaterial).color.set(C.disc);
  (meshes.discs.material as MeshBasicMaterial).opacity = 0.9 * flick;
  (meshes.glow.material as MeshBasicMaterial).color.set(C.glow);
  (meshes.glow.material as MeshBasicMaterial).opacity = 0.22 + 0.2 * mood.alarm * mood.pulse;
  for (const ic of meshes.icons) {
    (ic.material as MeshBasicMaterial).color.set(C.ink);
    (ic.material as MeshBasicMaterial).opacity = flick;
  }
  return (
    <>
      <primitive object={meshes.glow} />
      <primitive object={meshes.discs} />
      {meshes.icons.map((m, k) => <primitive key={k} object={m} />)}
    </>
  );
};

// ── motes: what the thoughts dissolve into ──────────────────────────────────
const Motes: React.FC<{ t: number; from: V3[]; t0: number; cam: V3 }> = ({ t, from, t0, cam }) => {
  const N = 140;
  const mesh = useMemo(() => {
    const m = new InstancedMesh(cached("cfmote", () => new SphereGeometry(1, 8, 6)), new MeshBasicMaterial({ color: new Color("#ffe3a8"), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), N);
    m.frustumCulled = false;
    m.layers.set(FX_LAYER);
    return m;
  }, []);
  const age = t - t0;
  const mx = new Matrix4();
  for (let i = 0; i < N; i++) {
    const src = from[i % Math.max(1, from.length)] ?? [0, 0, 0];
    const life = 2.2 + 1.6 * hash1(i, 3);
    const a = Math.max(0, age - 0.25 * hash1(i, 7));
    const k = Math.min(1, a / life);
    const p = new Vector3(src[0] + (hash1(i, 11) - 0.5) * 0.3 + 0.1 * Math.sin(a * 1.3 + i), src[1] + (hash1(i, 13) - 0.5) * 0.3 + a * (0.12 + 0.12 * hash1(i, 19)), src[2] + (hash1(i, 23) - 0.5) * 0.3 + 0.1 * Math.cos(a * 1.1 + i));
    const s = age <= 0 ? 0 : 0.006 * (1 + hash1(i, 29)) * Math.sin(Math.PI * k);
    mx.compose(p, new Quaternion(), new Vector3(s, s, s));
    mesh.setMatrixAt(i, mx);
  }
  mesh.instanceMatrix.needsUpdate = true;
  void cam;
  return <primitive object={mesh} />;
};

export const ThoughtField: React.FC<{
  defs: ThoughtDef[];
  swarm?: SwarmDef;
  t: number;
  center: V3;
  head: V3;
  back: V3;
  cam: V3;
  mood: FieldMood;
  txt: Record<string, VignetteText>;
  motesAt?: number;
}> = ({ defs, swarm, t, center, head, back, cam, mood, txt, motesAt }) => {
  const C = colors(mood);
  const miniFade = (1 - 0.5 * mood.ghost) * (1 - mood.dissolve);
  for (const s of [RAKA, RAKA_OUT, BIMA, FRIEND, BOSS, NAYA]) setMiniFade(s, miniFade);
  const live = defs.filter((d) => t >= d.at);
  const positions = live.map((d, i) => slotPos(d.slot, center, back, mood, i + 1));
  return (
    <group>
      {live.map((d, i) => (
        <Bubble key={d.id} d={d} i={i} t={t} pos={positions[i]} cam={cam} head={head} mood={mood} txt={txt[d.id] ?? {}} C={C} />
      ))}
      {swarm && t >= swarm.at ? <Swarm S={swarm} t={t} center={center} back={back} cam={cam} mood={mood} C={C} /> : null}
      {motesAt !== undefined && t >= motesAt ? <Motes t={t} from={positions} t0={motesAt} cam={cam} /> : null}
    </group>
  );
};
