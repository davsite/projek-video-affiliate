// Environment smoke test and minimal example of the core: a bright studio, one parametric object
// that physically changes shape (fixed-topology Slab) with a material scan, a turned part, a
// keyframed camera, post-processing and a 2D title. If this renders correctly, the machine can
// render VOYNANN 3D films. It is a technical check, not a style demo.

import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Matrix4, Quaternion, Euler, Vector3 } from "three";
import { shotAt } from "../../core/camera/director.ts";
import { Slab } from "../../core/geometry/slab.ts";
import { BARREL, lathe } from "../../core/geometry/lathe.ts";
import { applyMat, plainMaterial, sweepMaterial } from "../../core/materials/sweep.ts";
import { MATERIALS } from "../../core/materials/presets.ts";
import { ease, mix, remap } from "../../core/motion/easing.ts";
import { keys, sample } from "../../core/motion/track.ts";
import { CameraRig, Post } from "../../core/render/Post.tsx";
import { NEUTRAL_LOOK, PLINTH, Studio } from "../../core/studio/Studio.tsx";
import { Posed } from "../../core/film/Posed.tsx";
import { Stage3D } from "../../core/film/Stage3D.tsx";
import { FONT, INK, INK_SOFT } from "../../core/type/fonts.ts";

const A = { hw: 3.6, hh: 2.6, d: 2.6, rc: 0.3, reF: 0.15, reB: 0.15 };
const B = { hw: 3.2, hh: 3.2, d: 1.2, rc: 1.4, reF: 0.5, reB: 0.6 };
const MA = MATERIALS.mattePlastic("#3a3936");
const MB = MATERIALS.ceramic();
const TRIM_A = MATERIALS.polishedMetal();
const TRIM_B = MATERIALS.aluminium("#b9babd");

// seconds
const RIG = keys([0, 0, -4.5, 0, -18, 6, 46, 24], [3, 0, -4.2, 0, 4, 8, 40, 24], [6, 0, -4.4, 0, 22, 10, 42, 24]);
const YAW = keys([0, -30], [6, 25]);

const Object3D: React.FC<{ t: number }> = ({ t }) => {
  const slab = useMemo(() => new Slab(), []);
  const body = useMemo(() => [sweepMaterial(), sweepMaterial(), sweepMaterial()], []);
  const trim = useMemo(() => plainMaterial(), []);
  const barrel = useMemo(() => lathe(BARREL), []);
  const k = ease.inOut(remap(t, 1.2, 4.2));
  const p = Object.fromEntries(Object.entries(A).map(([key, v]) => [key, mix(v, B[key as keyof typeof B], k)])) as typeof A;
  const scan = { progress: ease.inOut(remap(t, 1.6, 3.8)), top: p.hh, bottom: -p.hh, band: 1.4 };
  useLayoutEffect(() => {
    slab.update(p);
    for (const m of body) applyMat(m, MA, MB, scan);
    applyMat(trim, TRIM_A, TRIM_B, { ...scan, band: 0 });
  });
  const lens = mix(0.9, 1.6, k);
  return (
    <>
      <mesh geometry={slab.geometry} material={body} castShadow receiveShadow />
      <mesh geometry={barrel} material={trim} position={[0, -0.1, p.d / 2 - 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1.1, lens, 1.1]} castShadow />
    </>
  );
};

export const Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const shot = shotAt(RIG, t, { aperture: 0.0009, maxBlur: 0.004, exposure: 1 });
  const hover = mix(A.hh, B.hh, ease.inOut(remap(t, 1.2, 4.2)));
  const pos = new Vector3(0, PLINTH.top + 2.2 + hover, 0);
  const q = new Quaternion().setFromEuler(new Euler(0, (sample(YAW, t)[0] * Math.PI) / 180, 0));
  const matrix = new Matrix4().compose(pos, q, new Vector3(1, 1, 1));
  const title = ease.type(remap(t, 0.2, 0.9));
  return (
    <Stage3D
      overlay={() => (
        <div style={{ position: "absolute", top: 90, left: 0, right: 0, textAlign: "center", fontFamily: FONT, opacity: title }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.42em", paddingLeft: "0.42em", color: INK_SOFT }}>VOYNANN MOTION</div>
          <div style={{ fontSize: 96, fontWeight: 200, color: INK, marginTop: 8 }}>Studio check</div>
        </div>
      )}
    >
      <Studio look={NEUTRAL_LOOK} blob={{ x: 0, z: 0, sx: 14, sz: 10, rot: 0, opacity: 0.3 }} />
      <Posed matrix={matrix}>
        <Object3D t={t} />
      </Posed>
      <CameraRig shot={shot} />
      <Post shot={shot} frame={frame} aoRadius={0.45} />
    </Stage3D>
  );
};
