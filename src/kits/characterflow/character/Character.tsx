// The CHARACTERFLOW character: one procedural rig, any spec (spec.ts), any pose (pose.ts). Every joint
// group takes its matrix from skeleton.ts, so props, cameras and IK agree with what is drawn.
// Built from lathe/sphere primitives with fabric/skin/hair materials — appealing stylised proportions
// (large head, big eyes, soft hands) with clean silhouettes that read on a phone screen.

import React from "react";
import { CapsuleGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { box, cached, cyl, lathe, sphere, torus } from "../lib/geo.ts";
import { Head } from "./Head.tsx";
import { charMats, type CharMats, type Variant } from "./materials.ts";
import type { Hand, Pose } from "./pose.ts";
import { skeleton, type Skeleton } from "./skeleton.ts";
import { DIMS, type CharacterSpec } from "./spec.ts";

const _p = new Vector3(), _q = new Quaternion(), _s = new Vector3();
/** A joint group placed by a local matrix. */
const J: React.FC<{ m: Matrix4; children: React.ReactNode }> = ({ m, children }) => {
  m.decompose(_p, _q, _s);
  return <group position={[_p.x, _p.y, _p.z]} quaternion={[_q.x, _q.y, _q.z, _q.w]} scale={[_s.x, _s.y, _s.z]}>{children}</group>;
};

/** Tapered limb along −Y from 0 to −len with round caps. */
export const limb = (len: number, r0: number, r1: number, mid = 0) =>
  cached(`cflimb${len},${r0},${r1},${mid}`, () => {
    const pts: [number, number][] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push([Math.sin(a) * r1, -len - Math.cos(a) * r1]);
    }
    for (let i = 1; i < 10; i++) {
      const k = i / 10;
      pts.push([r1 + (r0 - r1) * k + Math.sin(k * Math.PI) * mid, -len + len * k]);
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push([Math.cos(a) * r0, Math.sin(a) * r0]);
    }
    return lathe(`cflimbL${len},${r0},${r1},${mid}`, pts, 28);
  });

// loose tee: soft shoulders, slight flare and a rolled hem
const TORSO: [number, number][] = [
  [0.0, -0.375], [0.19, -0.37], [0.205, -0.35], [0.198, -0.3], [0.188, -0.2], [0.192, -0.08], [0.207, 0.05], [0.222, 0.15],
  [0.218, 0.205], [0.19, 0.243], [0.14, 0.268], [0.085, 0.281], [0.0, 0.285],
];
const PELVIS: [number, number][] = [[0, -0.135], [0.118, -0.128], [0.16, -0.08], [0.168, 0.0], [0.166, 0.09], [0.0, 0.105]];
const capsule = (r: number, l: number) => cached(`cfcap${r},${l}`, () => new CapsuleGeometry(r, l, 6, 14));

const HandMesh: React.FC<{ s: number; h: Hand; m: CharMats; t: number; tremble: number; cs: boolean }> = ({ s, h, m, t, tremble, cs }) => {
  const fingers = [0.025, 0.0085, -0.0085, -0.024];
  const lens = [1, 1.08, 1.02, 0.84];
  const tr = tremble * 0.08;
  return (
    <group>
      <mesh geometry={box(0.032, 0.088, 0.076, 0.015)} material={m.skin} position={[0, -0.05, 0.002]} castShadow={cs} receiveShadow />
      {fingers.map((fz, i) => {
        const c = i === 0 ? h.index : h.curl * (1 + 0.08 * i);
        const jit = tr * Math.sin(t * 41 + i * 1.7);
        const a = -s * (c * 1.45 + jit);
        const sp = (i - 1.5) * 0.09 * h.spread;
        const L = lens[i];
        return (
          <group key={i} position={[0, -0.091, fz]} rotation={new Euler(sp, 0, a, "XZY")}>
            <mesh geometry={capsule(0.0095, 0.03 * L)} material={m.skin} position={[0, -0.022 * L, 0]} castShadow={cs} />
            <group position={[0, -0.045 * L, 0]} rotation={[0, 0, a * 0.95]}>
              <mesh geometry={capsule(0.0089, 0.021 * L)} material={m.skin} position={[0, -0.016 * L, 0]} castShadow={cs} />
            </group>
          </group>
        );
      })}
      <group position={[-s * 0.006, -0.024, 0.037]} rotation={new Euler(0.55 - 0.3 * h.thumb, 0, -s * (0.3 + h.thumb * 0.85))}>
        <mesh geometry={capsule(0.0115, 0.034)} material={m.skin} position={[0, -0.025, 0]} castShadow={cs} />
      </group>
    </group>
  );
};

const ArmSide: React.FC<{ s: number; sk: Skeleton; hand: Hand; spec: CharacterSpec; m: CharMats; t: number; tremble: number; cs: boolean; children?: React.ReactNode }> = ({ s, sk, hand, spec, m, t, tremble, cs, children }) => {
  const rig = s > 0 ? sk.armL : sk.armR;
  const short = spec.top.sleeve === "short";
  const jit = tremble * 0.04;
  return (
    <J m={rig.shoulder}>
      <mesh geometry={sphere(0.064, 20, 14)} material={m.top} scale={[0.95, 0.8, 0.95]} castShadow={cs} />
      {short ? (
        <>
          <mesh geometry={limb(0.13, 0.077, 0.072, 0.004)} material={m.top} castShadow={cs} receiveShadow />
          <mesh geometry={torus(0.07, 0.008, 8, 28)} material={m.top} position={[0, -0.135, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={limb(DIMS.upperArm, 0.051, 0.043, 0.004)} material={m.skin} castShadow={cs} receiveShadow />
        </>
      ) : (
        <mesh geometry={limb(DIMS.upperArm, 0.066, 0.056, 0.006)} material={m.top} castShadow={cs} receiveShadow />
      )}
      <J m={rig.elbow}>
        {short ? (
          <mesh geometry={limb(DIMS.foreArm, 0.044, 0.034, 0.007)} material={m.skin} castShadow={cs} receiveShadow />
        ) : (
          <>
            <mesh geometry={limb(DIMS.foreArm - 0.02, 0.055, 0.047, 0.004)} material={m.top} castShadow={cs} receiveShadow />
            <mesh geometry={cyl(0.044, 0.042, 0.036, 20)} material={spec.top.kind === "hoodie" ? m.topTrim : m.top} position={[0, -DIMS.foreArm + 0.025, 0]} castShadow={cs} />
            <mesh geometry={limb(0.05, 0.034, 0.032)} material={m.skin} position={[0, -DIMS.foreArm + 0.05, 0]} />
          </>
        )}
        <J m={rig.wrist}>
          <group scale={spec.handScale} rotation={[jit * Math.sin(t * 37), 0, jit * Math.sin(t * 29 + 1)]}>
            <HandMesh s={s} h={hand} m={m} t={t} tremble={tremble} cs={cs} />
            {children}
          </group>
        </J>
      </J>
    </J>
  );
};

const LegSide: React.FC<{ s: number; sk: Skeleton; spec: CharacterSpec; m: CharMats; cs: boolean }> = ({ s, sk, spec, m, cs }) => {
  const rig = s > 0 ? sk.legL : sk.legR;
  const shorts = spec.bottom.kind === "shorts";
  return (
    <J m={rig.hip}>
      <mesh geometry={limb(shorts ? 0.22 : DIMS.thigh, 0.094, 0.072, 0.006)} material={m.bottom} castShadow={cs} receiveShadow />
      {shorts ? <mesh geometry={limb(DIMS.thigh, 0.066, 0.054)} material={m.skin} castShadow={cs} receiveShadow /> : null}
      <J m={rig.knee}>
        <mesh geometry={limb(DIMS.shin, 0.07, 0.054, 0.012)} material={shorts ? m.skin : m.bottom} castShadow={cs} receiveShadow />
        {!shorts ? <mesh geometry={cyl(0.058, 0.062, 0.05, 20)} material={m.bottom} position={[0, -DIMS.shin + 0.04, 0]} /> : null}
        <J m={rig.ankle}>
          {spec.feet.kind === "shoes" ? (
            <>
              <mesh geometry={box(0.108, 0.034, 0.28, 0.014)} material={m.sole} position={[0, -0.07, 0.055]} castShadow={cs} receiveShadow />
              <mesh geometry={box(0.1, 0.082, 0.24, 0.036)} material={m.foot} position={[0, -0.034, 0.045]} castShadow={cs} receiveShadow />
            </>
          ) : (
            <mesh geometry={box(0.09, 0.07, 0.24, 0.034)} material={m.foot} position={[0, -0.055, 0.05]} castShadow={cs} receiveShadow />
          )}
        </J>
      </J>
    </J>
  );
};

/** Lathe profile [radius, y] of a hijab's drape in neck space, top to bottom. */
const HIJAB_DRAPE: [number, number][] = [[0.07, 0.13], [0.085, 0.08], [0.115, 0.035], [0.16, -0.005], [0.195, -0.045], [0.212, -0.09], [0.218, -0.14], [0.216, -0.19], [0.2, -0.205]];

export type CharacterProps = {
  pose: Pose;
  spec: CharacterSpec;
  t: number;
  variant?: Variant;
  shadows?: boolean;
  visible?: boolean;
  /** extra objects held in each hand (hand space, palm faces −X for the left hand) */
  holdL?: React.ReactNode;
  holdR?: React.ReactNode;
};

export const Character: React.FC<CharacterProps> = ({ pose, spec, t, variant = "hero", shadows = true, visible = true, holdL, holdR }) => {
  const m = charMats(spec, variant);
  const sk = skeleton(pose, spec, t);
  const cs = shadows;
  const bw = spec.build;
  const breathS = 1 + 0.012 * pose.breath * Math.sin(t * pose.breathRate * Math.PI * 2);
  return (
    <group visible={visible}>
      <J m={sk.root}>
        <J m={sk.hips}>
          <mesh geometry={lathe("cfpelvis", PELVIS, 40)} material={m.bottom} scale={[bw, 1, 0.7]} castShadow={cs} receiveShadow />
          {spec.bottom.kind === "skirt" ? <mesh geometry={cyl(0.15, 0.2, 0.3, 40, true)} material={m.skirt} position={[0, -0.17, 0.0]} scale={[bw, 1, 0.82]} castShadow={cs} receiveShadow /> : null}
          <J m={sk.spine}>
            <J m={sk.chest}>
              <mesh geometry={lathe("cftorso", TORSO, 48)} material={m.top} scale={[bw, 1, 0.67 * breathS]} castShadow={cs} receiveShadow />
              {spec.top.kind === "hoodie" ? (
                <mesh geometry={torus(0.085, 0.034, 12, 36, Math.PI * 1.55)} material={m.top} position={[0, 0.262, -0.018]} rotation={[Math.PI / 2, 0, Math.PI * 1.225]} scale={[1.08, 1, 1.15]} castShadow={cs} />
              ) : spec.top.kind === "shirt" ? (
                <>
                  <mesh geometry={torus(0.07, 0.016, 8, 30)} material={m.topTrim} position={[0, 0.268, 0.004]} rotation={[Math.PI / 2 + 0.12, 0, 0]} />
                  {[1, -1].map((s) => (
                    <mesh key={s} geometry={box(0.05, 0.004, 0.06, 0.002)} material={m.topTrim} position={[s * 0.035, 0.255, 0.075]} rotation={[0.9, s * 0.5, s * 0.4]} />
                  ))}
                  <mesh geometry={box(0.012, 0.5, 0.004, 0.002)} material={m.topTrim} position={[0, 0.0, 0.137]} />
                </>
              ) : (
                <mesh geometry={torus(0.069, 0.0105, 8, 32)} material={m.topTrim} position={[0, 0.27, 0.006]} rotation={[Math.PI / 2 + 0.16, 0, 0]} scale={[1, 0.86, 1]} />
              )}
              <J m={sk.neck}>
                <mesh geometry={cyl(0.056, 0.062, 0.12, 24)} material={m.skin} position={[0, 0.035, 0]} castShadow={cs} />
                {spec.hairStyle === "hijab" ? (
                  // the hijab's drape: from under the chin over the neck and the tops of the shoulders
                  // soft fall over the shoulders: snug at the neck, rounding over the shoulder line, then hanging down
                  <mesh geometry={lathe("cfhijabdrape", HIJAB_DRAPE, 48)} material={m.scarf} position={[0, 0, 0.008]} scale={[bw, 1, 0.96]} castShadow={cs} receiveShadow />
                ) : null}
                <J m={sk.head}>
                  <J m={sk.headGeo}>
                    <Head f={pose.face} spec={spec} m={m} shadows={cs} />
                  </J>
                </J>
              </J>
              <ArmSide s={1} sk={sk} hand={pose.handL} spec={spec} m={m} t={t} tremble={pose.tremble} cs={cs}>{holdL}</ArmSide>
              <ArmSide s={-1} sk={sk} hand={pose.handR} spec={spec} m={m} t={t + 3.1} tremble={pose.tremble} cs={cs}>{holdR}</ArmSide>
            </J>
          </J>
          <LegSide s={1} sk={sk} spec={spec} m={m} cs={cs} />
          <LegSide s={-1} sk={sk} spec={spec} m={m} cs={cs} />
        </J>
      </J>
    </group>
  );
};
