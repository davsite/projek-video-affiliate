// Fixed light rig for a whole film. The set of lights never changes (so three.js never recompiles
// a shader mid-film); shots only move them and change colour/intensity. Two lights cast shadows:
// the key (directional, frustum fitted to the shot box) and one spot (a practical lamp).

import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Matrix4,
  Object3D,
  PMREMGenerator,
  PointLight,
  SpotLight,
  Vector3,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { V3 } from "../character/spec.ts";

export type PointL = { pos: V3; color: string; i: number; dist: number };
export type LightState = {
  bg: string;
  fog: { color: string; density: number };
  env: number;
  hemi: { sky: string; ground: string; i: number };
  moon: { dir: V3; color: string; i: number; box: { min: V3; max: V3 } };
  spot: { pos: V3; target: V3; color: string; i: number; angle: number; penumbra: number; dist: number };
  pts: [PointL, PointL, PointL, PointL];
};

export const P_OFF: PointL = { pos: [0, -50, 0], color: "#ffffff", i: 0, dist: 1 };

export const Lights: React.FC<{ s: LightState }> = ({ s }) => {
  const { scene, gl } = useThree();
  const rig = useMemo(() => {
    const hemi = new HemisphereLight("#8899bb", "#221a14", 0.5);
    const moon = new DirectionalLight("#9fb8ff", 1);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.025;
    moon.shadow.radius = 3;
    const mt = new Object3D();
    moon.target = mt;
    const spot = new SpotLight("#ffd9a8", 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = 4;
    spot.shadow.camera.near = 0.1;
    const st = new Object3D();
    spot.target = st;
    const pts = [0, 1, 2, 3].map(() => {
      const p = new PointLight("#fff", 0, 1, 2);
      p.castShadow = false;
      return p;
    });
    const pm = new PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    return { hemi, moon, mt, spot, st, pts, env };
  }, [gl]);

  useLayoutEffect(() => {
    scene.environment = rig.env;
    scene.background = new Color(s.bg);
    if (!(scene.fog instanceof FogExp2)) scene.fog = new FogExp2(s.fog.color, s.fog.density);
    (scene.fog as FogExp2).color.set(s.fog.color);
    (scene.fog as FogExp2).density = s.fog.density;
    scene.environmentIntensity = s.env;

    rig.hemi.color.set(s.hemi.sky);
    rig.hemi.groundColor.set(s.hemi.ground);
    rig.hemi.intensity = s.hemi.i;

    // moon: fixed frustum fitted around the shot box in light space
    const { min, max } = s.moon.box;
    const L = new Vector3(...s.moon.dir).normalize();
    const c = new Vector3(...min).add(new Vector3(...max)).multiplyScalar(0.5);
    rig.mt.position.copy(c);
    rig.mt.updateMatrixWorld();
    rig.moon.position.copy(c).addScaledVector(L, 120);
    const view = new Matrix4().lookAt(rig.moon.position, c, Math.abs(L.y) > 0.98 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0));
    const inv = new Matrix4().makeTranslation(rig.moon.position.x, rig.moon.position.y, rig.moon.position.z).multiply(view).invert();
    const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let k = 0; k < 8; k++) {
      const p = new Vector3(k & 1 ? max[0] : min[0], k & 2 ? max[1] : min[1], k & 4 ? max[2] : min[2]).applyMatrix4(inv);
      lo.min(p);
      hi.max(p);
    }
    const sc = rig.moon.shadow.camera;
    sc.left = lo.x; sc.right = hi.x; sc.bottom = lo.y; sc.top = hi.y;
    sc.near = Math.max(0.5, -hi.z - 5);
    sc.far = -lo.z + 5;
    sc.updateProjectionMatrix();
    rig.moon.color.set(s.moon.color);
    rig.moon.intensity = s.moon.i;
    // shadow maps render every frame even for a dark light: an unrendered shadow map makes WebGL
    // reject every draw call ("mismatch between texture format and sampler type")
    rig.moon.shadow.autoUpdate = true;

    rig.spot.position.set(...s.spot.pos);
    rig.st.position.set(...s.spot.target);
    rig.st.updateMatrixWorld();
    rig.spot.color.set(s.spot.color);
    rig.spot.intensity = s.spot.i;
    rig.spot.angle = s.spot.angle;
    rig.spot.penumbra = s.spot.penumbra;
    rig.spot.distance = s.spot.dist;
    rig.spot.decay = 2;
    rig.spot.shadow.camera.far = s.spot.dist;
    rig.spot.shadow.autoUpdate = true;

    s.pts.forEach((p, i) => {
      const l = rig.pts[i];
      l.position.set(...p.pos);
      l.color.set(p.color);
      l.intensity = p.i;
      l.distance = p.dist;
      l.decay = 2;
    });
  }, [s, rig, scene]);

  return (
    <>
      <primitive object={rig.hemi} />
      <primitive object={rig.moon} />
      <primitive object={rig.mt} />
      <primitive object={rig.spot} />
      <primitive object={rig.st} />
      {rig.pts.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
    </>
  );
};
