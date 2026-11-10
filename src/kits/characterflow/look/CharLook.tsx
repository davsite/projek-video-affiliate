// Look development + QA sheet for the character system. Each frame is one test card: turnarounds,
// face close-ups for every expression, and the body presets with gestures. Render with
//   node scripts/stills.mjs out/look 0,1,2,... CharLook
// Nothing here is topic specific — it is the character system's proof sheet.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Stage3D } from "../../../core/film/Stage3D.tsx";
import { FONT } from "../../../core/type/fonts.ts";
import { Character } from "../character/Character.tsx";
import { perform, type Beat } from "../character/performance.ts";
import { EXPR, type ExprName } from "../character/presets/expressions.ts";
import type { GestureName } from "../character/presets/gestures.ts";
import type { BodyName } from "../character/presets/bodies.ts";
import { facePoint, skeleton } from "../character/skeleton.ts";
import { BOSS, FRIEND, NAYA, RAKA, type CharacterSpec, type V3 } from "../character/spec.ts";
import { CameraRig, FilmPost, GRADE0, type Cam } from "../render/FilmPost.tsx";
import { Lights, P_OFF, type LightState } from "../render/Lights.tsx";
import { box, cyl } from "../lib/geo.ts";
import { phys } from "../lib/mats.ts";

type Card = { title: string; spec?: CharacterSpec; body: BodyName; armL?: GestureName; armR?: GestureName; face: ExprName; cam: "full" | "face" | "face34" | "profile" | "bed" | "bedTop" | "mid"; yaw?: number; look?: V3 };

export const CARDS: Card[] = [
  { title: "turnaround · front", body: "stand", face: "content", cam: "full" },
  { title: "turnaround · 3/4", body: "stand", face: "neutral", cam: "full", yaw: 0.65 },
  { title: "turnaround · side", body: "stand", face: "neutral", cam: "full", yaw: 1.5708 },
  { title: "turnaround · back", body: "stand", face: "neutral", cam: "full", yaw: 3.1416 },
  ...(["neutral", "content", "happy", "sleepy", "asleep", "startled", "worried", "anxious", "overwhelmed", "thinking", "calm", "focused", "relieved", "exhale", "sad", "angry"] as ExprName[]).map(
    (e): Card => ({ title: `face · ${e}`, body: "stand", face: e, cam: "face" }),
  ),
  { title: "face 3/4 · worried", body: "stand", face: "worried", cam: "face34" },
  { title: "face profile", body: "stand", face: "neutral", cam: "profile" },
  { title: "lie", body: "lie", armL: "lieSide", armR: "lieSide", face: "asleep", cam: "bed" },
  { title: "lie · behind head", body: "lie", armL: "lieSide", armR: "behindHead", face: "asleepSmile", cam: "bed" },
  { title: "sit · lap", body: "sit", armL: "onLap", armR: "onLap", face: "worried", cam: "mid" },
  { title: "sit · temple", body: "sit", armL: "onLap", armR: "temple", face: "thinking", cam: "mid" },
  { title: "sit · rub neck", body: "sit", armL: "onLap", armR: "rubNeck", face: "worried", cam: "mid" },
  { title: "sit hunch · head in hands", body: "sitHunch", armL: "headInHands", armR: "headInHands", face: "overwhelmed", cam: "mid" },
  { title: "sit · grab hair", body: "sitHunch", armL: "grabHair", armR: "grabHair", face: "dread", cam: "mid" },
  { title: "sit · hand on chest", body: "sit", armL: "onLap", armR: "onChest", face: "exhale", cam: "mid" },
  { title: "sit write · hold book", body: "sitWrite", armL: "holdBook", armR: "clasp", face: "focused", cam: "mid" },
  { title: "sit · reach right", body: "sitReachRight", armL: "onLap", armR: "point", face: "neutral", cam: "mid" },
  { title: "stand · explain", spec: FRIEND, body: "stand", armL: "explain", armR: "rest", face: "talk", cam: "full" },
  { title: "stand · cross arms", spec: FRIEND, body: "stand", armL: "crossArms", armR: "crossArms", face: "angry", cam: "full" },
  { title: "boss · point", spec: BOSS, body: "standProud", armL: "rest", armR: "point", face: "angry", cam: "full" },
  { title: "naya · wave", spec: NAYA, body: "stand", armL: "wave", armR: "rest", face: "happy", cam: "full" },
  { title: "cower", body: "standCower", armL: "coverMouth", armR: "rest", face: "dread", cam: "full" },
];

const L: LightState = {
  bg: "#d9dde4", fog: { color: "#d9dde4", density: 0 }, env: 0.55,
  hemi: { sky: "#f4f1ec", ground: "#7a6f66", i: 0.75 },
  moon: { dir: [0.55, 0.75, 0.6], color: "#fff4e6", i: 2.4, box: { min: [-1.6, -0.1, -1.6], max: [1.6, 2.2, 1.6] } },
  spot: { pos: [-1.8, 2.6, -1.6], target: [0, 1.2, 0], color: "#bcd6ff", i: 14, angle: 0.6, penumbra: 0.8, dist: 8 },
  pts: [{ pos: [-1.4, 1.6, 1.8], color: "#d8e6ff", i: 3, dist: 7 }, P_OFF, P_OFF, P_OFF],
};

export const CharLook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = CARDS[Math.min(CARDS.length - 1, frame)];
  const spec = card.spec ?? RAKA;
  const t = 1.3 + frame * 0.37;
  const anchor = card.body === "lie" || card.body.startsWith("sit") ? { x: 0, y: 0.5, z: 0, yaw: 0 } : { x: 0, y: 0, z: 0, yaw: card.yaw ?? 0 };
  const beats: Beat[] = [{ at: 0, body: card.body, armL: card.armL ?? "rest", armR: card.armR ?? "rest", face: card.face, nervous: 0, breath: { amp: 0.3 } }];
  const perf = { spec, anchor, beats };
  const { pose } = perform(perf, t);
  if (card.cam === "face" || card.cam === "face34" || card.cam === "profile") pose.face = { ...EXPR[card.face], eyeX: card.cam === "face" ? 0 : pose.face.eyeX, eyeY: 0 };
  const sk = skeleton(pose, spec, t);
  const fp = facePoint(sk);
  let cam: Cam;
  if (card.cam === "full") cam = { pos: [0, 1.0, 5.6], target: [0, 0.88, 0], fov: 26 };
  else if (card.cam === "face") cam = { pos: [fp[0], fp[1] + 0.03, fp[2] + 1.6], target: [fp[0], fp[1] + 0.01, fp[2]], fov: 17 };
  else if (card.cam === "face34") cam = { pos: [fp[0] + 1.0, fp[1] + 0.08, fp[2] + 1.25], target: [fp[0], fp[1] + 0.01, fp[2] - 0.03], fov: 17 };
  else if (card.cam === "profile") cam = { pos: [fp[0] + 1.6, fp[1] + 0.03, fp[2] - 0.05], target: [fp[0], fp[1] + 0.01, fp[2] - 0.07], fov: 17 };
  else if (card.cam === "bed") cam = { pos: [1.6, 1.9, 1.6], target: [0, 0.6, -0.15], fov: 30 };
  else cam = { pos: [0.9, 1.25, 2.6], target: [0, 0.92, 0.1], fov: 30 };
  return (
    <Stage3D background="#d9dde4" overlay={() => (
      <div style={{ position: "absolute", left: 40, top: 40, fontFamily: FONT, fontSize: 40, fontWeight: 600, color: "#2a2f38" }}>
        {card.title}
        <div style={{ fontSize: 26, fontWeight: 500, opacity: 0.6 }}>CHARACTERFLOW · {spec.id} · card {frame} · {fps} fps</div>
      </div>
    )}>
      <Lights s={L} />
      <mesh geometry={cyl(3, 3, 0.02, 64)} material={phys("lookFloor", { color: "#c9ccd2", roughness: 0.9 })} position={[0, -0.01, 0]} receiveShadow />
      {anchor.y > 0 ? <mesh geometry={box(1.4, 0.5, 2.1, 0.08)} material={phys("lookBed", { color: "#e8e6e1", roughness: 0.9 })} position={[0, 0.25, 0.2]} receiveShadow castShadow /> : null}
      <Character pose={pose} spec={spec} t={t} />
      <CameraRig cam={cam} />
      <FilmPost cam={cam} grade={{ ...GRADE0, exposure: 1.0, vignette: 0.12, grain: 0.01, bloom: 0.12, bloomThreshold: 1.2 }} frame={frame} />
    </Stage3D>
  );
};
