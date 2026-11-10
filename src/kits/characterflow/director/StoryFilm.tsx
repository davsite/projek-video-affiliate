// Generic CHARACTERFLOW film: renders any Story through the director — environment, cast, props,
// thoughts, comedy FX, cards, word captions and the automatic camera. Pure function of the frame.

import React from "react";
import { Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PerspectiveCamera, Vector3 } from "three";
import { Stage3D } from "../../../core/film/Stage3D.tsx";
import { Character } from "../character/Character.tsx";
import { skeleton, type Skeleton } from "../character/skeleton.ts";
import type { Pose } from "../character/pose.ts";
import type { V3 } from "../character/spec.ts";
import { onViewSide, orbitCam, peopleBlock, SHOTS, safeCam, SOLO_SHOTS, type Subject } from "../camera/shots.ts";
import { EnvView } from "../env/components.tsx";
import { PopBoard, Tumbleweed } from "../fx/comedy.tsx";
import { ThoughtField, type FieldMood } from "../fx/Thoughts.tsx";
import { Phone, PHONE_IN_HAND, SlingBag, Strap } from "../props/handheld.tsx";
import { xform } from "../props/attach.ts";
import { CameraRig, FilmPost, type Cam, type Grade } from "../render/FilmPost.tsx";
import { Lights, type LightState } from "../render/Lights.tsx";
import { Captions, chunkWords, ZONE_TOP, type Chunk, type Zone } from "../captions/Captions.tsx";
import { TitleCard } from "../captions/Cards.tsx";
import { bagFlap, bagMatrixFor, bagStrap, compile, phoneVisible, poseAt, type Production } from "./compile.ts";
import type { Story } from "./story.ts";

const prods = new Map<string, Production>();
export const productionOf = (story: Story) => {
  let p = prods.get(story.id);
  if (!p) { p = compile(story); prods.set(story.id, p); }
  return p;
};

type Frame = { poses: Pose[]; sks: Skeleton[] };
const frameCache = new Map<string, Frame>();
const evalFrame = (P: Production, t: number): Frame => {
  const key = `${P.story.id}@${Math.round(t * 1000)}`;
  let f = frameCache.get(key);
  if (!f) {
    const poses = P.chars.map((c, i) => poseAt(c, t, i + 1));
    f = { poses, sks: poses.map((p, i) => skeleton(p, P.chars[i].spec, t)) };
    if (frameCache.size > 300) frameCache.clear();
    frameCache.set(key, f);
  }
  return f;
};
const subjectsAt = (P: Production, t: number): Record<string, Subject> => {
  const f = evalFrame(P, t);
  const S: Record<string, Subject> = Object.fromEntries(P.chars.map((c, i) => {
    const face = xform(f.sks[i].W.headGeo, [0, -0.01, 0.06]);
    // frame where the FACE points (a look back over the shoulder is still a front close-up)
    const nose = xform(f.sks[i].W.headGeo, [0, -0.01, 1]);
    const fx = nose[0] - face[0], fz = nose[2] - face[2], l = Math.hypot(fx, fz) || 1;
    return [c.id, { face, fwd: [fx / l, 0, fz / l] as V3, pos: [f.poses[i].x, 0, f.poses[i].z] as V3 }];
  }));
  if (P.board) S.board = { face: [P.board.pos[0], 2.6, P.board.pos[2]], fwd: [0, 0, 1], pos: P.board.pos };
  return S;
};
/** The place playing at film time t, and its local time (stories with scenes switch productions). */
export const sceneAt = (P: Production, t: number): { Q: Production; tl: number } => {
  if (!P.scenes) return { Q: P, tl: t };
  const sc = P.scenes.find((x) => t >= x.t0 && t < x.t1) ?? (t < 0 ? P.scenes[0] : P.scenes[P.scenes.length - 1]);
  return { Q: sc.P, tl: t - sc.t0 };
};
/** Where the right hand holds the phone (defined all the time, so a framing that follows it never jumps). */
const handAt = (P: Production, i: number, t: number): V3 => xform(evalFrame(P, t).sks[i].W.wristR.clone().multiply(PHONE_IN_HAND), [0, 0, 0]);
/** Framings that should show what the hands hold (not the face-only close-ups). */
const HOLDS: string[] = ["medium", "mediumWide", "explain", "think", "track", "sitStand", "turn"];

const baseCam = (P: Production, t: number): Cam => {
  const s = P.shots.find((x) => t >= x.t0 && t < x.t1) ?? P.shots[P.shots.length - 1];
  const S = subjectsAt(P, t);
  let c = SHOTS[s.kind](S, s, t);
  // the side is decided once per shot (at its start) so a camera never flips mid-shot
  const key = `${P.story.id}:${s.t0}`;
  let flip = SIDE.get(key);
  if (flip === undefined) { flip = !onViewSide(SHOTS[s.kind](subjectsAt(P, s.t0 + 0.01), s, s.t0 + 0.01), P.env); SIDE.set(key, flip); }
  const spec = flip ? { ...s, side: (s.side === -1 ? 1 : -1) as 1 | -1 } : s;
  if (flip) c = SHOTS[s.kind](S, spec, t);
  // a one-person shot swings round its subject (decided once per shot) when someone else is in the way
  if (SOLO_SHOTS.includes(s.kind) && P.chars.length > 1) {
    let deg = ORBIT.get(key);
    if (deg === undefined) {
      const S0 = subjectsAt(P, s.t0 + 0.01), c0 = SHOTS[s.kind](S0, spec, s.t0 + 0.01), me = S0[s.a];
      const others = P.chars.filter((x) => x.id !== s.a).map((x) => S0[x.id]);
      deg = [0, 15, -15, 30, -30, 45, -45, 60, -60].find((d) => { const c1 = orbitCam(c0, me.face, d); return onViewSide(c1, P.env) && !peopleBlock(c1, me, others, 0.55); })
        ?? [0, 15, -15, 30, -30, 45, -45].find((d) => { const c1 = orbitCam(c0, me.face, d); return onViewSide(c1, P.env) && !peopleBlock(c1, me, others); }) ?? 0;
      ORBIT.set(key, deg);
    }
    c = orbitCam(c, S[s.a].face, deg);
  }
  return c;
};
/** Aim between the frame centre and the phone, translating the camera with it; k > 1 steps back. */
const aimAt = (c: Cam, ph: V3, k: number): Cam => {
  const view = new Vector3(...c.target).sub(new Vector3(...c.pos));
  const tg = new Vector3(...c.target).lerp(new Vector3(...ph), 0.3);
  const p = tg.clone().addScaledVector(view, -k);
  return { ...c, pos: [p.x, p.y, p.z], target: [tg.x, tg.y, tg.z] };
};
export const camAt = (P: Production, t: number): Cam => {
  const s = P.shots.find((x) => t >= x.t0 && t < x.t1) ?? P.shots[P.shots.length - 1];
  let c = baseCam(P, t);
  // a phone in the hand stays in the picture — decided once per shot (from its middle), then followed
  const ai = P.chars.findIndex((x) => x.id === s.a);
  if (ai >= 0 && HOLDS.includes(s.kind)) {
    const key = `${P.story.id}:${s.t0}`;
    let k = HOLD.get(key);
    if (k === undefined) {
      const tm = (s.t0 + Math.min(s.t1, P.duration)) / 2;
      k = 0;
      if (phoneVisible(P.chars[ai], tm)) {
        const ph = handAt(P, ai, tm), c1 = aimAt(baseCam(P, tm), ph, 1), xy = project(c1, ph);
        k = !xy || xy[0] < 1080 * 0.12 || xy[0] > 1080 * 0.88 || xy[1] > 1920 * 0.86 ? 1.28 : 1;
      }
      HOLD.set(key, k);
    }
    if (k) c = aimAt(c, handAt(P, ai, t), k);
  }
  return safeCam(c, P.env);
};
const SIDE = new Map<string, boolean>();
const ORBIT = new Map<string, number>();
const HOLD = new Map<string, number>();

const project = (cam: Cam, p: V3): [number, number] | null => {
  const c = new PerspectiveCamera(cam.fov, 1080 / 1920, 0.01, 200);
  c.position.set(...cam.pos);
  c.lookAt(...cam.target);
  c.updateMatrixWorld();
  const v = new Vector3(...p).project(c);
  if (v.z > 1 || Math.abs(v.x) > 1.1) return null;
  return [(v.x * 0.5 + 0.5) * 1080, (-v.y * 0.5 + 0.5) * 1920];
};

// a small icon bubble stays inside the frame, decided once per shot (no jumps): grown with the camera distance if it
// fits, else its own size, then a little lower (still above the hair), else it sits the shot out (the face carries it)
const FIT = new Map<string, { k: number; lift: number } | null>();
const iconFit = (P: Production, th: Production["thoughts"][number], t: number) => {
  const si = P.shots.findIndex((s) => t >= s.t0 && t < s.t1);
  const key = `${P.story.id}|${th.def.id}|${si}`;
  if (FIT.has(key)) return FIT.get(key)!;
  const s = P.shots[si];
  const tr = s ? Math.min(s.t1 - 0.02, Math.max(s.t0, th.def.at) + 0.2) : t;
  const cm = camAt(P, tr), i = P.chars.findIndex((c) => c.id === th.who);
  const h = xform(evalFrame(P, tr).sks[i].W.headGeo, [0, 0, 0]);
  const k0 = Math.min(2.1, Math.max(1, new Vector3(...h).distanceTo(new Vector3(...cm.pos)) / 1.5));
  const fits = ({ k, lift }: { k: number; lift: number }) => {
    const top = project(cm, [h[0], h[1] + th.def.slot[1] * lift + 1.02 * th.def.size * k, h[2]]);
    return !!top && top[1] >= 60;
  };
  const r = [{ k: k0, lift: 0.6 + 0.4 * k0 }, { k: 1, lift: 1 }, { k: 1, lift: 0.8 }].find(fits) ?? null;
  FIT.set(key, r);
  return r;
};

const calm = (t: number): FieldMood => ({ phase: 0, tm: t, agitation: 0, ghost: 0, alarm: 0, pulse: 0, dissolve: 0, tight: 1, show: 1 });

const LAMP_PT = { pos: [-0.98, 0.88, -0.82] as V3, color: "#ffc98c", i: 1.1, dist: 4 };
const LAMP_SPOT = { pos: [-1.03, 0.92, -0.87] as V3, target: [-0.2, 0.7, -0.35] as V3, color: "#ffc78a", i: 2.4, angle: 1.25, penumbra: 0.95, dist: 7 };
const lightFor = (P: Production, t: number, focus: V3): LightState => {
  const L = P.env.light(P.time, focus);
  const lamp = P.env.id === "bedroom" ? P.lamp(t) : 0;
  if (!lamp) return L;
  const pts = [...L.pts] as LightState["pts"];
  pts[0] = LAMP_PT;
  return { ...L, spot: LAMP_SPOT, pts, env: L.env + 0.12 };
};
const gradeFor = (P: Production, t: number, black: number): Grade => {
  const g = P.env.grade(P.time);
  const lamp = P.env.id === "bedroom" && P.time === "night" ? P.lamp(t) : 0;
  return { ...g, exposure: g.exposure * (1 - 0.15 * lamp), black };
};

export const StoryFilm: React.FC<{ story: Story; audio?: string }> = ({ story, audio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const F = productionOf(story);
  // the place on screen now (a story with scenes switches productions; captions and cards stay global)
  const { Q: P, tl } = sceneAt(F, t);
  const f = evalFrame(P, tl);
  const cam = camAt(P, tl);
  const chunks = React.useMemo(() => chunkWords(F.cues.words, F.cues.offset, story.highlights ?? []), [F, story.highlights]);
  const zones = React.useMemo(() => new Map<Chunk, Zone>(), []);
  // a caption band never covers a face or a thought bubble: the first free band (bottom, top, middle), else the least covered
  const zone = (c: Chunk) => {
    let z = zones.get(c);
    if (!z) {
      const hit: Record<Zone, number> = { bottom: 0, top: 0, mid: 0 };
      for (const tt of [c.t0, (c.t0 + c.t1) / 2, c.t1]) {
        const { Q, tl: l } = sceneAt(F, tt);
        const cm = camAt(Q, l), S = subjectsAt(Q, l), fr = evalFrame(Q, l);
        const right = new Vector3(...cm.target).sub(new Vector3(...cm.pos)).cross(new Vector3(0, 1, 0)).normalize();
        const disk = (p: V3, r: number): [number, number] | null => {
          const a = project(cm, p), b = project(cm, [p[0] + right.x * r, p[1], p[2] + right.z * r]);
          return a && b ? [a[1], Math.hypot(b[0] - a[0], b[1] - a[1])] : null;
        };
        const obstacles = [
          ...Object.values(S).map((s) => disk(s.face, 0.13)),
          ...Q.thoughts.filter((th) => l >= th.def.at && l <= (th.def.until ?? th.def.at)).map((th) => { const i = Q.chars.findIndex((x) => x.id === th.who); const h = xform(fr.sks[i].W.headGeo, [0, 0, 0]); return disk([h[0], h[1] + th.def.slot[1], h[2]], th.def.size * 1.15); }),
        ].filter((x): x is [number, number] => !!x);
        for (const zn of Object.keys(hit) as Zone[]) {
          const y0 = ZONE_TOP[zn], y1 = y0 + 130;
          for (const [y, r] of obstacles) hit[zn] += Math.max(0, Math.min(y1, y + r) - Math.max(y0, y - r));
        }
      }
      z = (["bottom", "top", "mid"] as Zone[]).find((zn) => hit[zn] === 0) ?? (["bottom", "top", "mid"] as Zone[]).reduce((a, b2) => (hit[b2] < hit[a] ? b2 : a), "bottom");
      zones.set(c, z);
    }
    return z;
  };
  const bedChar = P.chars.findIndex((c) => c.inBed);
  const bedEdge = bedChar >= 0 ? (() => { const p = f.poses[bedChar]; const sitting = p.hips[0] > -1.2; return sitting ? p.z + 0.14 : p.z - 0.34; })() : -0.62;
  const head = (i: number) => xform(f.sks[i].W.headGeo, [0, 0, 0]);
  const c0 = P.chars[0];
  const boardPos: V3 | null = P.board ? P.board.pos : null;
  const twPos = P.tumbleweed ? (() => { const a = c0.eye(P.tumbleweed.t0), b = (P.chars[1] ?? c0).eye(P.tumbleweed.t0); return (a[0] + b[0]) / 2; })() : 0;
  const black = Math.max(1 - Math.min(1, t / 0.4), Math.min(1, Math.max(0, (t - (F.duration - 0.6)) / 0.6)));
  return (
    <>
      <Stage3D background="#000" overlay={() => (
        <>
          {F.cards.map((c, i) => <TitleCard key={i} t={t} t0={c.t0} t1={c.t1} text={c.text} />)}
          <Captions chunks={chunks} t={t} zone={zone} />
        </>
      )}>
        <Lights s={lightFor(P, tl, cam.target)} />
        <EnvView id={P.env.id} time={P.time} cam={cam} lamp={P.lamp(tl)} bedSk={bedChar >= 0 ? { sk: f.sks[bedChar], scale: P.chars[bedChar].spec.scale, edge: bedEdge } : undefined} />
        {P.chars.map((c, i) => <Character key={c.id} pose={f.poses[i]} spec={c.spec} t={tl + i * 7} />)}
        {P.chars.map((c, i) => (phoneVisible(c, tl) ? <Phone key={`ph${c.id}`} m={f.sks[i].W.wristR.clone().multiply(PHONE_IN_HAND)} on={1} /> : null))}
        {P.chars.map((c, i) => (c.hasBag ? (
          <group key={`bag${c.id}`}>
            <SlingBag m={bagMatrixFor(c, tl, f.sks[i].W.hips)} flap={bagFlap(c, tl)} />
            <Strap pts={bagStrap(c, tl, f.sks[i])} />
          </group>
        ) : null))}
        {P.board && boardPos ? <PopBoard scale={1.45} p={boardPos} t={tl} upAt={P.board.up} swapAt={P.board.swap} downAt={P.board.down} face1={P.board.face1} face2={P.board.face2 ?? P.board.face1} /> : null}
        {P.tumbleweed ? <Tumbleweed a={[twPos + 0.6, 0, -5.5]} b={[twPos - 0.6, 0, 5]} t={tl} t0={P.tumbleweed.t0} t1={P.tumbleweed.t1} r={0.42} /> : null}
        {P.thoughts.map((th) => {
          const i = P.chars.findIndex((c) => c.id === th.who);
          const h = head(i);
          const back = new Vector3(...h).sub(new Vector3(...cam.pos)).setY(0).normalize();
          // a small icon bubble grows with the camera distance so it reads in wider framings — as far as the frame allows
          const live = tl >= th.def.at && tl <= (th.def.until ?? Infinity) + 0.3;
          const fit = th.def.text || th.def.vignette || !live ? { k: 1, lift: 1 } : iconFit(P, th, tl);
          if (!fit) return null;
          const { k, lift } = fit;
          const def = k === 1 && lift === 1 ? th.def : { ...th.def, size: th.def.size * k, slot: [th.def.slot[0] * k, th.def.slot[1] * lift, th.def.slot[2]] as V3 };
          return <ThoughtField key={th.def.id} defs={[def]} t={tl} center={h} head={h} back={[back.x, 0, back.z]} cam={cam.pos} mood={calm(tl)} txt={{}} />;
        })}
        <CameraRig cam={cam} />
        <FilmPost cam={cam} grade={gradeFor(P, tl, black)} frame={frame} />
      </Stage3D>
      {audio ? (
        <Sequence from={0} layout="none">
          <Html5Audio src={staticFile(audio)} />
        </Sequence>
      ) : null}
    </>
  );
};
