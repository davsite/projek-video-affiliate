// Renders one product-insert frame: its own 3D stage (same post chain and grade family as the character film), the
// desk set and the shot's objects, plus the 2D layer (chips, ✓/✗ tags, product title, slot numbers, call to action)
// and the film's word captions.

import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, DirectionalLight, HemisphereLight, Object3D, PerspectiveCamera, PMREMGenerator, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Stage3D } from "../core/film/Stage3D.tsx";
import { ease, remap } from "../core/motion/easing.ts";
import { FONT } from "../core/type/fonts.ts";
import { CameraRig, FilmPost, GRADE0, type Cam, type Grade } from "../kits/characterflow/render/FilmPost.tsx";
import { Captions, type Chunk } from "../kits/characterflow/captions/Captions.tsx";
import { Cable, Chair, Clip, Phone, Ring, Room, Sparkles, type V3 } from "./world.tsx";
import { slotPoints, type Mode, type State, type Tag } from "./shots.ts";

// ── light rig: a fixed set of lights (no shader recompiles), driven per shot ─────────────────────────────────
type Rig = { hemi: [string, string, number]; key: [V3, string, number]; rim: [V3, string, number]; fill: [V3, string, number]; env: number; bg: string };
const RIGS: Record<Mode, Rig> = {
  // desk lamp from the upper left, moonlight from the window side
  night: { hemi: ["#7d90c8", "#2a2018", 0.75], key: [[-0.55, 1, 0.5], "#ffd2a0", 2.6], rim: [[0.85, 0.45, -0.5], "#a9c0ff", 1.3], fill: [[0.6, 0.35, 0.9], "#c4cff0", 0.35], env: 0.32, bg: "#0b1220" },
  // morning sun through the window on the +X side
  day: { hemi: ["#fff4e0", "#8a7058", 0.95], key: [[0.8, 0.75, 0.25], "#fff0d6", 3.0], rim: [[-0.6, 0.5, -0.7], "#d8e6ff", 0.7], fill: [[-0.3, 0.4, 0.9], "#ffffff", 0.45], env: 0.55, bg: "#dfeaf5" },
  // product reveal: the lamp plus a strong rim and a soft front fill
  hero: { hemi: ["#7d90c8", "#2a2018", 0.6], key: [[-0.5, 1, 0.55], "#ffd9b0", 2.8], rim: [[0.7, 0.6, -0.75], "#bcd0ff", 2.6], fill: [[0.55, 0.25, 0.85], "#e9eeff", 0.7], env: 0.42, bg: "#0b1220" },
};
const GRADES: Record<Mode, Grade> = {
  night: { ...GRADE0, exposure: 1.05, lift: [0.012, 0.018, 0.04], gain: [0.98, 1.0, 1.04], sat: 1.08, contrast: 1.06, vignette: 0.26, grain: 0.012, bloom: 0.14, bloomRadius: 0.5, bloomThreshold: 1.0, ao: 0.9 },
  day: { ...GRADE0, exposure: 0.95, lift: [0.01, 0.01, 0.015], gain: [1.03, 1.0, 0.95], sat: 1.1, contrast: 1.05, vignette: 0.16, grain: 0.01, bloom: 0.12, bloomRadius: 0.5, bloomThreshold: 1.2, ao: 0.9 },
  hero: { ...GRADE0, exposure: 1.05, lift: [0.012, 0.018, 0.04], gain: [0.98, 1.0, 1.05], sat: 1.1, contrast: 1.1, vignette: 0.32, grain: 0.012, bloom: 0.18, bloomRadius: 0.55, bloomThreshold: 0.95, ao: 0.9 },
};

const Lights: React.FC<{ mode: Mode; focus: V3; size: number }> = ({ mode, focus, size }) => {
  const { scene, gl } = useThree();
  const rig = useMemo(() => {
    const hemi = new HemisphereLight("#fff", "#000", 0.5);
    const key = new DirectionalLight("#fff", 1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const kt = new Object3D();
    key.target = kt;
    const rim = new DirectionalLight("#fff", 1), rt = new Object3D();
    rim.target = rt;
    const fill = new DirectionalLight("#fff", 1), ft = new Object3D();
    fill.target = ft;
    const env = new PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    return { hemi, key, kt, rim, rt, fill, ft, env };
  }, [gl]);
  useLayoutEffect(() => {
    const R = RIGS[mode];
    scene.environment = rig.env;
    scene.environmentIntensity = R.env;
    scene.background = new Color(R.bg);
    scene.fog = null;
    rig.hemi.color.set(R.hemi[0]);
    rig.hemi.groundColor.set(R.hemi[1]);
    rig.hemi.intensity = R.hemi[2];
    const f = new Vector3(...focus);
    const place = (l: DirectionalLight, t: Object3D, [d, c, i]: [V3, string, number], dist: number) => {
      l.position.copy(f).addScaledVector(new Vector3(...d).normalize(), dist);
      t.position.copy(f);
      t.updateMatrixWorld();
      l.color.set(c);
      l.intensity = i;
    };
    place(rig.key, rig.kt, R.key, 260);
    place(rig.rim, rig.rt, R.rim, 200);
    place(rig.fill, rig.ft, R.fill, 200);
    const sc = rig.key.shadow.camera;
    sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.near = 20; sc.far = 520;
    sc.updateProjectionMatrix();
  }, [mode, focus, size, rig, scene]);
  return (
    <>
      <primitive object={rig.hemi} />
      <primitive object={rig.key} />
      <primitive object={rig.kt} />
      <primitive object={rig.rim} />
      <primitive object={rig.rt} />
      <primitive object={rig.fill} />
      <primitive object={rig.ft} />
    </>
  );
};

// ── 2D layer ──────────────────────────────────────────────────────────────────────────────────────────────
const NAVY = "#1d2a4d", YELLOW = "#ffd166", GREEN = "#2fbf71", RED = "#ef5b5b";
const popIn = (t: number, t0: number) => {
  const k = ease.out(remap(t, t0, t0 + 0.28));
  const over = 0.08 * Math.sin(Math.min(1, (t - t0) / 0.42) * Math.PI);
  return { k, s: 0.6 + 0.4 * k + (t > t0 ? over : 0) };
};

const Mark: React.FC<{ ok: boolean; size: number }> = ({ ok, size }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill={ok ? GREEN : RED} stroke={NAVY} strokeWidth="3.5" />
    {ok ? <path d="M11 20.5 L17.5 27 L29.5 13.5" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M13 13 L27 27 M27 13 L13 27" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />}
  </svg>
);

const Chip: React.FC<{ t: number; t0: number; t1: number; text: string }> = ({ t, t0, t1, text }) => {
  if (t < t0) return null;
  const { k, s } = popIn(t, t0);
  const out = 1 - ease.in(remap(t, t1 - 0.18, t1));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 168, display: "flex", justifyContent: "center", opacity: k * out }}>
      <div style={{ transform: `scale(${s}) rotate(-2deg)`, background: YELLOW, color: NAVY, fontFamily: FONT, fontWeight: 600, fontSize: 46, letterSpacing: "0.03em", padding: "12px 34px 15px", borderRadius: 24, border: `6px solid ${NAVY}`, boxShadow: `0 9px 0 ${NAVY}, 0 18px 40px rgba(0,0,0,0.25)` }}>{text}</div>
    </div>
  );
};

const TagView: React.FC<{ t: number; t1: number; tag: Tag; row: number }> = ({ t, t1, tag, row }) => {
  if (t < tag.t0) return null;
  const { k, s } = popIn(t, tag.t0);
  const out = 1 - ease.in(remap(t, t1 - 0.18, t1));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 300 + row * 118, display: "flex", justifyContent: "center", opacity: k * out }}>
      <div style={{ transform: `scale(${s})`, display: "flex", alignItems: "center", gap: 16, background: "#ffffff", color: NAVY, fontFamily: FONT, fontWeight: 600, fontSize: 50, padding: "10px 34px 12px 14px", borderRadius: 999, border: `6px solid ${NAVY}`, boxShadow: `0 8px 0 ${NAVY}, 0 16px 36px rgba(0,0,0,0.22)` }}>
        <Mark ok={tag.ok} size={66} />
        <span>{tag.text}</span>
      </div>
    </div>
  );
};

const project = (cam: Cam, p: V3): [number, number] | null => {
  const c = new PerspectiveCamera(cam.fov, 1080 / 1920, 0.1, 2000);
  c.position.set(...cam.pos);
  c.lookAt(...cam.target);
  c.updateMatrixWorld();
  const v = new Vector3(...p).project(c);
  if (v.z > 1) return null;
  return [(v.x * 0.5 + 0.5) * 1080, (-v.y * 0.5 + 0.5) * 1920];
};

const Overlay: React.FC<{ t: number; t1: number; s: State; chunks: Chunk[] }> = ({ t, t1, s, chunks }) => {
  return (
    <>
      {s.chip ? <Chip t={t} t0={s.chip.t0} t1={t1} text={s.chip.text} /> : null}
      {s.tags.map((g, i) => <TagView key={i} t={t} t1={t1} tag={g} row={g.y ?? 0} />)}
      {s.title ? (() => {
        const tt1 = s.title.t1 ?? t1;
        if (t < s.title.t0 || t > tt1) return null;
        const { k, s: sc } = popIn(t, s.title.t0);
        const out = 1 - ease.in(remap(t, tt1 - 0.25, tt1));
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", flexDirection: "column", alignItems: "center", opacity: k * out }}>
            <div style={{ transform: `scale(${sc}) rotate(-2deg)`, background: YELLOW, color: NAVY, fontFamily: FONT, fontWeight: 600, fontSize: 76, letterSpacing: "0.02em", padding: "18px 44px 22px", borderRadius: 30, border: `8px solid ${NAVY}`, boxShadow: `0 12px 0 ${NAVY}, 0 24px 60px rgba(0,0,0,0.25)`, textAlign: "center" }}>{s.title.text}</div>
            <div style={{ marginTop: 34, fontFamily: FONT, fontWeight: 600, fontSize: 44, color: "#ffffff", textShadow: "0 3px 12px rgba(0,0,0,0.7)", opacity: ease.out(remap(t, s.title.t0 + 0.25, s.title.t0 + 0.6)) }}>{s.title.sub}</div>
          </div>
        );
      })() : null}
      {s.slotMarks && t >= s.slotMarks.t0 ? slotPoints().map((p, i) => {
        const xy = project(s.cam, [p[0], p[1] + 0.35, p[2]]);
        if (!xy) return null;
        const { k, s: sc } = popIn(t, s.slotMarks!.t0 + i * 0.08);
        const out = 1 - ease.in(remap(t, t1 - 0.2, t1));
        return (
          <div key={i} style={{ position: "absolute", left: xy[0] - 30, top: xy[1] - 74, width: 60, height: 60, borderRadius: 30, background: "#ffffff", border: `5px solid ${NAVY}`, color: NAVY, fontFamily: FONT, fontWeight: 600, fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sc * (0.8 + i * 0.07)})`, opacity: k * out, boxShadow: `0 5px 0 ${NAVY}` }}>{i + 1}</div>
        );
      }) : null}
      {s.cta && t >= s.cta.t0 ? (() => {
        const { k, s: sc } = popIn(t, s.cta.t0);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: 1150, display: "flex", justifyContent: "center", opacity: k }}>
            <div style={{ transform: `scale(${sc})`, display: "flex", alignItems: "center", gap: 18, background: YELLOW, color: NAVY, fontFamily: FONT, fontWeight: 600, fontSize: 54, padding: "16px 40px 18px 26px", borderRadius: 999, border: `7px solid ${NAVY}`, boxShadow: `0 10px 0 ${NAVY}, 0 20px 50px rgba(0,0,0,0.3)` }}>
              <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.4 4.5" />
                <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.42-1.41" />
              </svg>
              <span>Tautan di profil</span>
            </div>
          </div>
        );
      })() : null}
      <Captions chunks={chunks} t={t} zone={() => "bottom"} />
    </>
  );
};

export const InsertFrame: React.FC<{ s: State; t: number; t1: number; frame: number; chunks: Chunk[] }> = ({ s, t, t1, frame, chunks }) => {
  const grade = { ...GRADES[s.mode], black: s.fade ?? 0 };
  return (
    <Stage3D background="#000" overlay={() => <Overlay t={t} t1={t1} s={s} chunks={chunks} />}>
      <Lights mode={s.mode} focus={s.focus} size={s.shadow} />
      <Room />
      {s.chair ? <Chair p={s.chair} /> : null}
      {s.clip ? <Clip s={s.clip} /> : null}
      {s.cables.map((c) => <Cable key={c.key} c={c} />)}
      {s.phone ? <Phone p={s.phone.p} yaw={s.phone.yaw} tilt={s.phone.tilt} roll={s.phone.roll} morning={s.mode === "day"} /> : null}
      {s.rings.map((r, i) => <Ring key={i} {...r} />)}
      {s.sparkles.map((sp, i) => <Sparkles key={i} {...sp} />)}
      <CameraRig cam={s.cam} />
      <FilmPost cam={s.cam} grade={grade} frame={frame} />
    </Stage3D>
  );
};
