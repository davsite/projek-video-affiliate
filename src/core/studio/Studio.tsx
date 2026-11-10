// VOYNANN bright studio (light stage from PRECISION, used by PRECISION and TIMEFORGE): a
// procedural HDR environment for controlled softbox reflections, a bright seamless cyclorama
// with an optional tint pool behind the subject, an optional pearl plinth with a hairline ring,
// a soft key light that casts contact shadows, and a blob shadow under a floating object.
// Calibrated for hand-held objects about 5–20 world units across; pass `shadow` bounds and a
// `plinth` for other scales (large outdoor scenes should use an outdoor sky setup instead).

import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  BackSide, CanvasTexture, Color, CylinderGeometry, type DirectionalLight, Euler, Mesh, MeshBasicMaterial, PlaneGeometry,
  PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, type Texture, TorusGeometry,
} from "three";
import { plainMaterial } from "../materials/sweep.ts";

export type StudioLook = {
  envRotation: number;
  envIntensity: number;
  keyAz: number;
  keyEl: number;
  keyIntensity: number;
  /** Backdrop tint: rgb and amount (0 = neutral pearl). */
  tint: [number, number, number];
  tintAmount: number;
  /** Time-ring inlay glow 0..1. */
  ring: number;
};

export type Plinth = { top: number; r: number; h: number; ring?: boolean };
/** Default plinth (top surface y, radius, height) — the TIMEFORGE calibration. */
export const PLINTH: Plinth = { top: -9.6, r: 5.8, h: 0.9, ring: true };
export type ShadowBounds = { left: number; right: number; top: number; bottom: number; near: number; far: number };
const SHADOW: ShadowBounds = { left: -12, right: 12, top: 14, bottom: -12, near: 10, far: 70 };

/** A neutral look: no tint, standard key. Spread and override per film. */
export const NEUTRAL_LOOK: StudioLook = { envRotation: 0.35, envIntensity: 1, keyAz: (18 * Math.PI) / 180, keyEl: (66 * Math.PI) / 180, keyIntensity: 1.5, tint: [1, 1, 1], tintAmount: 0, ring: 0 };

const stage = () => {
  const scene = new Scene();
  scene.add(
    new Mesh(
      new SphereGeometry(30, 64, 32),
      new ShaderMaterial({
        side: BackSide,
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            float y = vDir.y;
            vec3 c = mix(vec3(0.2, 0.195, 0.19), vec3(0.52, 0.51, 0.5), smoothstep(-0.45, 0.02, y));
            c = mix(c, vec3(0.78, 0.78, 0.77), smoothstep(0.05, 0.75, y));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  );
  const panel = (w: number, h: number, k: number, pos: [number, number, number], tint = "#ffffff") => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(tint).multiplyScalar(k), side: 2 }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(14, 14, 2.0, [0, 22, 0]); // overhead softbox
  panel(1.5, 26, 7.0, [-20, 3, -7], "#fff6ec"); // warm rim strip
  panel(1.2, 26, 6.0, [20, 3, -9], "#eefcff"); // cool rim strip
  panel(11, 9, 3.4, [-12, 11, 16], "#fffaf4"); // key box
  panel(12, 6, 1.8, [11, 5, 19]); // fill
  panel(30, 1.3, 5.0, [0, 15, 11]); // long strip: the line that sweeps across glass
  // graphite flags give glossy white parts a defined edge
  panel(9, 22, 0.04, [21, -1, 9]);
  panel(9, 22, 0.04, [-21, -1, 4]);
  panel(30, 4, 0.07, [0, -5, 24]);
  return scene;
};

const backdrop = () =>
  new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new Color("#f3f1ec") },
      uMid: { value: new Color("#e7e4de") },
      uLow: { value: new Color("#d6d2cb") },
      uTint: { value: new Color("#ffffff") },
      uTintAmt: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec4 vClip;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; vClip = projectionMatrix * viewMatrix * w; gl_Position = vClip; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uTint; uniform float uTintAmt;
      varying vec3 vWorld; varying vec4 vClip;
      void main(){
        vec2 s = vClip.xy / vClip.w;
        vec3 dir = normalize(vWorld - cameraPosition);
        float t = clamp(0.5 + 0.5 * (0.7 * s.y + 0.3 * dir.y * 1.6), 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.55, t));
        c = mix(c, uTop, smoothstep(0.5, 1.0, t));
        float r = length(s * vec2(1.0, 0.6) - vec2(0.0, 0.1));
        // the tint lives in the soft pool of light behind the subject
        c = mix(c, c * uTint, uTintAmt * (1.0 - smoothstep(0.0, 1.25, r)));
        c *= 1.0 + 0.1 * (1.0 - smoothstep(0.0, 1.1, r)) - 0.06 * smoothstep(0.7, 1.5, r);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const blobTexture = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(40,36,32,1)");
  g.addColorStop(0.45, "rgba(40,36,32,0.45)");
  g.addColorStop(1, "rgba(40,36,32,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  return new CanvasTexture(cv);
};

export type Blob = { x: number; z: number; sx: number; sz: number; rot: number; opacity: number };

export const Studio: React.FC<{ look: StudioLook; blob?: Blob; plinth?: Plinth | false; shadow?: ShadowBounds }> = ({ look, blob, plinth = PLINTH, shadow = SHADOW }) => {
  const P = plinth || PLINTH;
  const { gl, scene } = useThree();
  const env = useMemo<Texture>(() => {
    const pm = new PMREMGenerator(gl);
    const t = pm.fromScene(stage(), 0.035).texture;
    pm.dispose();
    return t;
  }, [gl]);
  const parts = useMemo(() => {
    const bg = new Mesh(new SphereGeometry(400, 64, 32), backdrop());
    const plinthMat = plainMaterial();
    plinthMat.color.set("#ecebe6");
    plinthMat.roughness = 0.5;
    plinthMat.clearcoat = 0.4;
    plinthMat.clearcoatRoughness = 0.3;
    const ringMat = new MeshBasicMaterial({ color: new Color("#bfeff2") });
    const blobMat = new MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.3 });
    return {
      bg,
      plinth: new CylinderGeometry(P.r, P.r * 1.01, P.h, 128, 1),
      plinthMat,
      ring: new TorusGeometry(P.r - 0.45, 0.03, 8, 192),
      ringMat,
      blobGeo: new PlaneGeometry(1, 1),
      blobMat,
    };
  }, [P.r, P.h]);

  useLayoutEffect(() => {
    scene.environment = env;
    scene.background = null;
    scene.environmentRotation = new Euler(0, look.envRotation, 0, "YXZ");
    scene.environmentIntensity = look.envIntensity;
    const u = (parts.bg.material as ShaderMaterial).uniforms;
    u.uTint.value.setRGB(...look.tint);
    u.uTintAmt.value = look.tintAmount;
    const k = 0.75 + 1.6 * look.ring;
    parts.ringMat.color.setRGB(0.75 * k, 0.94 * k, 0.95 * k);
    parts.blobMat.opacity = blob?.opacity ?? 0;
  });

  const key = useMemo(() => {
    const d = 34;
    return [d * Math.cos(look.keyEl) * Math.sin(look.keyAz), d * Math.sin(look.keyEl), d * Math.cos(look.keyEl) * Math.cos(look.keyAz)] as [number, number, number];
  }, [look.keyAz, look.keyEl]);

  return (
    <>
      <primitive object={parts.bg} />
      {plinth ? <mesh geometry={parts.plinth} material={parts.plinthMat} position={[0, P.top - P.h / 2, 0]} receiveShadow /> : null}
      {plinth && P.ring ? <mesh geometry={parts.ring} material={parts.ringMat} position={[0, P.top + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} /> : null}
      {blob ? (
        <mesh
          geometry={parts.blobGeo}
          material={parts.blobMat}
          position={[blob.x, P.top + 0.01, blob.z]}
          rotation={[-Math.PI / 2, 0, blob.rot]}
          scale={[blob.sx, blob.sz, 1]}
        />
      ) : null}
      <directionalLight
        position={key}
        intensity={look.keyIntensity}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-intensity={0.6}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={9}
        onUpdate={(l: DirectionalLight) => {
          const c = l.shadow.camera;
          c.left = shadow.left;
          c.right = shadow.right;
          c.top = shadow.top;
          c.bottom = shadow.bottom;
          c.near = shadow.near;
          c.far = shadow.far;
          c.updateProjectionMatrix();
        }}
      />
    </>
  );
};
