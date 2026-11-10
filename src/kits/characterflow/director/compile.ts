// Automatic story director: Story (story.ts) → Production. Pure and Node-safe, so the film and the
// sound department compile the same production.
//
//   1. timing      cues → film seconds; beat windows (a beat lasts until that person's next beat)
//   2. blocking    per person: walk segments (approach & pass / meet, walk alone, stop), standing marks
//                  with turns, seats (sit down / stand up), bed (lie / sit up) — all planted-foot bodies
//   3. acting      verbs → gestures, expressions, look targets, body mods; props (phone / bag) come out
//                  when used and are put away when the hands are needed for something else
//   4. thoughts    bubbles above heads (text / icon / vignette)
//   5. camera      a shot per beat from the shot library, with variety and minimum-length rules
//   6. sound       cue list (SFX per verb, footsteps, turns, seats) + music mood sections

import { Matrix4, Vector3 } from "three";
import { perform, type Beat, type FaceSel, type Performance } from "../character/performance.ts";
import { blend, type Pose } from "../character/pose.ts";
import { BODY, type BodyName } from "../character/presets/bodies.ts";
import { explaining, HANDS, highFive, reach, waving, type Gesture } from "../character/presets/gestures.ts";
import { skeleton } from "../character/skeleton.ts";
import { ADIT, AYAH, BIMA, BOSS, DINDA, FRIEND, IBU, NAYA, RAKA_OUT, RAKA, SARI, DIMS, type CharacterSpec, type V3 } from "../character/spec.ts";
import { pairDir, type ShotKind, type ShotSpec } from "../camera/shots.ts";
import { ENVS, type EnvData, type TimeOfDay } from "../env/registry.ts";
import type { ThoughtDef } from "../fx/Thoughts.tsx";
import type { BoardFace } from "../fx/comedy.tsx";
import { distanceAt, walkBody, Walker, type SpeedKey } from "../locomotion/walk.ts";
import { seatBody, standBody, turnSteps, type Seat, type SeatChange, type Turn } from "../locomotion/stand.ts";
import { lerpMat, xform } from "../props/attach.ts";
import { BAG, gripFor, PHONE_IN_HAND, phoneReadPose } from "../props/grip.ts";
import { makeCues, type Cues } from "../timing/cues.ts";
import type { Story, StoryBeat, Verb } from "./story.ts";
import { validateStory } from "./validate.ts";

const D = Math.PI / 180;
const sm = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const remap = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

export const LOOKS: Record<string, CharacterSpec> = { raka: RAKA_OUT, bima: BIMA, naya: NAYA, dimas: FRIEND, boss: BOSS, sari: SARI, dinda: DINDA, ibu: IBU, ayah: AYAH, adit: ADIT };
const RAKA_HOME: CharacterSpec = { ...RAKA, id: "raka-home", feet: { kind: "socks", color: "#e8e4dc" } };
const hashStr = (x: string) => { let h = 2166136261; for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
/** The spec of a cast member: the look (socks at home for raka) plus any outfit changes from the story. */
export const lookSpec = (c: Story["cast"][number], home: boolean): CharacterSpec => {
  const base = c.look === "raka" && home ? RAKA_HOME : LOOKS[c.look] ?? RAKA_OUT;
  const o = c.outfit;
  if (!o) return base;
  const style = o.hairStyle ?? base.hairStyle;
  return {
    ...base,
    // own id: materials are cached per spec id
    id: `${base.id}~${hashStr(JSON.stringify(o))}`,
    skin: o.skin ?? base.skin,
    hair: o.hair ?? base.hair,
    hairStyle: style,
    scarf: o.scarf ?? base.scarf ?? (style === "hijab" ? "#c98fa4" : undefined),
    glasses: o.glasses ?? base.glasses,
    top: { ...base.top, color: o.top ?? base.top.color, kind: o.topKind ?? base.top.kind, sleeve: o.sleeve ?? base.top.sleeve },
    bottom: { ...base.bottom, color: o.bottom ?? base.bottom.color, kind: o.bottomKind ?? base.bottom.kind },
    feet: o.shoes ? { kind: "shoes", color: o.shoes } : base.feet,
  };
};

// ── types ───────────────────────────────────────────────────────────────────
type Seg =
  | { k: "walk"; t0: number; w: Walker }
  | { k: "stand"; t0: number; pos: V3; yaw: number; turns: Turn[] }
  | { k: "seat"; t0: number; seat: Seat; seated: boolean; changes: SeatChange[] }
  | { k: "bed"; t0: number; changes: SeatChange[] };
export type Win = { verb: Verb; t0: number; t1: number; beat: StoryBeat; target?: string };
export type CharProd = {
  id: string;
  spec: CharacterSpec;
  segs: Seg[];
  /** body from blocking only (no acting) — positions, eyes, hips for props */
  body: (t: number, base?: BodyName, mod?: (p: Pose, t: number) => void) => Pose;
  eye: (t: number) => V3;
  fwd: (t: number) => V3;
  perf: Performance;
  wins: Win[];
  phone: { on: [number, number][] };
  bag: { on: [number, number][] };
  hasBag: boolean;
  inBed: boolean;
  /** lying down in bed at t (not sitting up) */
  lying: (t: number) => boolean;
};
export type SoundCue = { t: number; kind: string; who?: string; pan?: number };
export type MusicSection = { t0: number; t1: number; mood: "playful" | "warm" | "tense" | "calm" | "sad" | "awkward" };
export type Production = {
  story: Story;
  env: EnvData;
  time: TimeOfDay;
  cues: Cues;
  duration: number;
  chars: CharProd[];
  thoughts: { who: string; def: ThoughtDef }[];
  shots: ShotSpec[];
  cards: { t0: number; t1: number; text: string }[];
  board?: { up: number; swap: number; down: number; face1: BoardFace; face2?: BoardFace; pos: V3 };
  tumbleweed?: { t0: number; t1: number };
  lamp: (t: number) => number;
  sound: SoundCue[];
  music: MusicSection[];
  /** places in order (only for stories with scenes); times are film seconds */
  scenes?: { t0: number; t1: number; P: Production }[];
};

// ── blocking ────────────────────────────────────────────────────────────────
const SLOW: Verb[] = ["phone", "bag", "eyeContact", "notice", "think", "confused", "surprised", "embarrassed", "lookBack", "facepalm", "sad", "shy"];
const yawOf = (d: V3) => Math.atan2(d[0], d[2]);
const fwdOf = (yaw: number): V3 => [Math.sin(yaw), 0, Math.cos(yaw)];
const rightOf = (d: V3): V3 => [-d[2], 0, d[0]];

const segBody = (spec: CharacterSpec, env: EnvData, s: Seg, t: number, base: BodyName = "stand", mod?: (p: Pose, t: number) => void): Pose => {
  if (s.k === "walk") return walkBody(s.w, base, mod)(t);
  if (s.k === "stand") return standBody(spec, s.pos, s.yaw, s.turns, base, mod)(t);
  if (s.k === "seat") return seatBody(spec, s.seat, s.seated, s.changes, mod)(t);
  // bed: lying ↔ sitting up, as in the bedroom demo
  const bed = env.bed!;
  let k = 0;
  for (const c of s.changes) { if (t < c.at) break; k = k + ((c.sit ? 1 : 0) - k) * sm((t - c.at) / (c.dur ?? 1.05)); }
  const aL = { x: bed.lie[0], y: bed.top, z: bed.lie[2], yaw: 0 }, aS = { x: bed.sit[0], y: bed.top, z: bed.sit[2], yaw: 0 };
  const p = blend(BODY.lie(aL, spec, t), BODY.sit({ ...aS, z: aL.z + (aS.z - aL.z) * k }, spec, t), sm(k));
  p.z = aL.z + (aS.z - aL.z) * sm(k);
  if (mod) mod(p, t);
  return p;
};

type Plan = { segs: Seg[]; walkers: Walker[] };

const planBlocking = (story: Story, env: EnvData, at: (c: StoryBeat["at"]) => number, duration: number): Record<string, Plan> => {
  const ids = story.cast.map((c) => c.id);
  const beatsOf = (id: string) => story.beats.filter((b) => whoOf(story, b).includes(id)).map((b) => ({ b, t: at(b.at) })).sort((x, y) => x.t - y.t);
  const startOf = (id: string, i: number): string => {
    const s = story.start?.[id];
    if (s && env.seats[s]) return "sit";
    if (s && env.marks[s]) return "stand";
    if (s) return s;
    const verbs = beatsOf(id).map((x) => x.b.do);
    if (env.bed && i === 0 && (verbs.includes("lieDown") || verbs.includes("sitUp") || verbs.includes("lampOff"))) return "lie";
    if (verbs.includes("pass") || verbs.includes("meet") || (env.path && verbs[0] === "walk")) return "walk";
    if (verbs.includes("sitDown") || verbs.includes("standUp")) return verbs.indexOf("standUp") >= 0 && (verbs.indexOf("sitDown") < 0 || verbs.indexOf("standUp") < verbs.indexOf("sitDown")) ? "sit" : "stand";
    return "stand";
  };
  const out: Record<string, Plan> = {};
  const passT = story.beats.find((b) => b.do === "pass"), meetT = story.beats.find((b) => b.do === "meet");
  const walkersIdx = ids.filter((id, i) => startOf(id, i) === "walk");
  ids.forEach((id, i) => {
    const mode = startOf(id, i);
    const spec = lookSpec(story.cast[i], env.home);
    const named = story.start?.[id];
    const mine = beatsOf(id);
    const segs: Seg[] = [];
    const walkers: Walker[] = [];
    if (mode === "walk" && env.path) {
      const path = env.path;
      const wi = walkersIdx.indexOf(id);
      const dir: V3 = wi === 1 ? [-path.dir[0], 0, -path.dir[2]] : [path.dir[0], 0, path.dir[2]];
      const right = rightOf(dir);
      const tPass = passT ? at(passT.at) : undefined, tMeet = meetT ? at(meetT.at) : undefined;
      // stop: an explicit "stop", else (after a pass) the first beat that is not walking any more
      const stopB = mine.find((x) => x.b.do === "stop") ?? (tPass !== undefined ? mine.find((x) => x.t > tPass + 0.3 && !["walk", "pass", "phone", "bag"].includes(x.b.do)) : undefined);
      const tEnd = tMeet ?? (stopB ? Math.max(stopB.t, (tPass ?? 0) + 1.5) : duration);
      const keys = (cruise: number): SpeedKey[] => {
        const k: SpeedKey[] = [[0, cruise]];
        for (const x of mine) {
          if (!SLOW.includes(x.b.do) || x.t >= tEnd) continue;
          const nxt = mine.find((y) => y.t > x.t)?.t ?? x.t + 2.5;
          k.push([x.t, k[k.length - 1][1]], [x.t + 0.45, 0.42], [Math.min(nxt, tEnd) - 0.1, 0.42], [Math.min(nxt, tEnd) + 0.35, cruise]);
        }
        if (tPass !== undefined && !tMeet) k.push([tPass - 1.2, k[k.length - 1][1]], [tPass - 0.6, 0.72]);
        k.push([tEnd - 0.6, k[k.length - 1][1] > 0.1 ? Math.min(0.72, k[k.length - 1][1]) : 0.72], [tEnd, 0], [duration + 3, 0]);
        return k.filter((x, j, arr) => j === 0 || x[0] > arr[j - 1][0]).sort((a, b) => a[0] - b[0]);
      };
      const ks = keys(0.9);
      let start: V3;
      if (tMeet !== undefined && walkersIdx.length >= 2) {
        const dM = distanceAt(ks, tMeet);
        // stop 0.8 m apart, nearly face to face: close enough to reach each other (high five)
        start = [path.meet[0] - dir[0] * (dM + 0.4) + right[0] * path.lane * 0.12, 0, path.meet[2] - dir[2] * (dM + 0.4) + right[2] * path.lane * 0.12];
      } else if (tPass !== undefined && walkersIdx.length >= 2) {
        const dP = distanceAt(ks, tPass);
        start = [path.meet[0] - dir[0] * dP + right[0] * path.lane, 0, path.meet[2] - dir[2] * dP + right[2] * path.lane];
      } else {
        const dE = distanceAt(ks, tEnd);
        start = [path.meet[0] - dir[0] * dE * 0.6 + right[0] * path.lane * 0.5, 0, path.meet[2] - dir[2] * dE * 0.6 + right[2] * path.lane * 0.5];
      }
      const w = new Walker({ start, dir, speed: ks, spec }, duration + 1);
      walkers.push(w);
      segs.push({ k: "walk", t0: 0, w });
      if (tEnd < duration) {
        const st = w.at(tEnd + 0.8);
        // face each other after a meet
        const yaw = tMeet !== undefined ? yawOf(dir) : st.yaw;
        segs.push({ k: "stand", t0: tEnd + 0.8, pos: st.pos, yaw, turns: turnsOf(mine, yaw, tEnd + 0.8) });
      }
    } else if (mode === "lie" || mode === "sitBed") {
      const changes: SeatChange[] = mine.filter((x) => x.b.do === "sitUp" || x.b.do === "lieDown").map((x) => ({ at: x.t, sit: x.b.do === "sitUp", dur: 1.05 }));
      if (mode === "sitBed") changes.unshift({ at: -10, sit: true, dur: 0.01 });
      segs.push({ k: "bed", t0: 0, changes });
    } else {
      const usesSeat = mode === "sit" || mine.some((x) => x.b.do === "sitDown" || x.b.do === "standUp");
      if (usesSeat) {
        const seats = Object.values(env.seats);
        const seat = (named && env.seats[named]) || seats[i % seats.length];
        const changes: SeatChange[] = mine.filter((x) => x.b.do === "sitDown" || x.b.do === "standUp").map((x) => ({ at: x.t, sit: x.b.do === "sitDown", dur: 1.15 }));
        segs.push({ k: "seat", t0: 0, seat, seated: mode === "sit", changes });
      } else {
        const marks = ids.length > 1 ? [env.marks.talkL, env.marks.talkR] : [env.marks.center];
        const m = (named && env.marks[named]) || (marks[i % marks.length] ?? Object.values(env.marks)[0]);
        segs.push({ k: "stand", t0: 0, pos: m.pos, yaw: m.yaw, turns: turnsOf(mine, m.yaw, 0) });
      }
    }
    out[id] = { segs, walkers };
  });
  return out;
};

/** Someone standing who waves / smiles / talks / points at a person behind them turns round first. */
const FACING_VERBS: Verb[] = ["wave", "smile", "talk", "explain", "point", "highFive", "laugh", "happy", "nod", "shrug", "proud"];
const posAt = (pl: Plan, t: number): V3 => {
  let s = pl.segs[0];
  for (const x of pl.segs) if (t >= x.t0) s = x;
  if (s.k === "walk") return s.w.at(t).pos;
  if (s.k === "stand") return s.pos;
  if (s.k === "seat") return s.seat.pos;
  return [0, 0, 0];
};
const autoTurns = (story: Story, plans: Record<string, Plan>, at: (c: StoryBeat["at"]) => number) => {
  for (const b of story.beats) {
    if (!FACING_VERBS.includes(b.do)) continue;
    const t = at(b.at);
    for (const id of whoOf(story, b)) {
      const tgt = b.target ?? story.cast.find((c) => c.id !== id)?.id;
      if (!tgt || !plans[tgt]) continue;
      const seg = [...plans[id].segs].reverse().find((x) => t >= x.t0);
      if (!seg || seg.k !== "stand") continue;
      const me = posAt(plans[id], t), them = posAt(plans[tgt], t);
      const want = Math.atan2(them[0] - me[0], them[2] - me[2]);
      let cur = seg.yaw;
      for (const tr of seg.turns) if (tr.at <= t) cur = tr.to;
      let d = want - cur;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > 1.6 && !seg.turns.some((tr) => Math.abs(tr.at - t) < 1.2)) {
        const start = Math.max(seg.t0 + 0.1, t - 0.9);
        seg.turns.push({ at: start, dur: 0.9, to: cur + d });
        seg.turns.sort((x, y) => x.at - y.at);
      }
    }
  }
};

const turnsOf = (mine: { b: StoryBeat; t: number }[], yaw0: number, from: number): Turn[] => {
  const turns: Turn[] = [];
  let y = yaw0;
  for (const x of mine) if (x.b.do === "turn" && x.t >= from) { y = y + Math.PI; turns.push({ at: x.t, dur: 0.95, to: y }); }
  return turns;
};

export const whoOf = (story: Story, b: StoryBeat): string[] => {
  if (b.who) return Array.isArray(b.who) ? b.who : [b.who];
  if (["eyeContact", "pass", "meet", "highFive"].includes(b.do)) return story.cast.map((c) => c.id);
  return [story.cast[0].id];
};

// ── acting ──────────────────────────────────────────────────────────────────
type Uses = "R" | "L" | "both" | "none";
const USES: Partial<Record<Verb, Uses>> = {
  wave: "R", point: "R", explain: "R", talk: "R", think: "R", confused: "R", embarrassed: "R", shy: "R", calm: "R", highFive: "R",
  lampOff: "R", lampOn: "R", phone: "R", facepalm: "L", bag: "both", overwhelmed: "both", shrug: "both", proud: "both",
};
/** seconds after which a hand gesture is released when the next beat does not replace it */
const RELEASE: Partial<Record<Verb, number>> = { talk: 3.5, explain: 3.5, point: 2.6, think: 3.2, confused: 2.4, embarrassed: 2.4, shy: 2.4 };
/** gestures that are dropped (face + bubble only) when the hand is already holding the phone */
const SOFT: Verb[] = ["think", "confused", "embarrassed", "shy", "calm"];
const FACE: Partial<Record<Verb, FaceSel>> = {
  idle: "content", talk: { base: "talk", add: { open: 0.12 } }, explain: "happy", point: "alert", think: "thinking", confused: "confused",
  happy: "happy", laugh: "laughing", sad: "sad", embarrassed: "embarrassed", surprised: "surprised", wave: { base: "happy", add: { open: 0.25 } },
  facepalm: { base: "sad", add: { lid: 0.2 } }, notice: "alert", eyeContact: "startled", phone: { base: "focused", add: { smile: -0.1 } },
  bag: { base: "focused", add: { smile: -0.15 } }, lookBack: { base: "sad", add: { lid: 1.0 } }, highFive: { base: "happy", add: { open: 0.35 } },
  nod: "content", shake: { base: "worried", add: { smile: -0.2 } }, shrug: { base: "confused", add: { smile: 0.1 } }, overwhelmed: "overwhelmed",
  calm: "calm", smile: { base: "happy", add: { open: 0.08, lid: 1.0 } }, proud: "proud", shy: "shy", walk: "content", stop: "neutral",
  pass: { base: "embarrassed", add: { lid: 0.85, smile: -0.2 } }, meet: "happy", sitDown: "content", standUp: "neutral", turn: "neutral",
  lieDown: "content", sitUp: "worried", lampOff: "sleepy", lampOn: "calm",
};

const laugh = (seed: number) => (p: Pose, t: number) => {
  const k = Math.max(0, Math.sin(t * 9 + seed)) * (0.6 + 0.4 * Math.sin(t * 1.7 + seed));
  p.shrug += 0.25 * k;
  p.chest = [p.chest[0] - 0.03 * k - 0.015, p.chest[1], p.chest[2]];
  p.head = [p.head[0] - 0.08 * k, p.head[1], p.head[2]];
};
const recoil = (t0: number) => (p: Pose, t: number) => {
  const k = Math.max(0, Math.sin(Math.min(1, (t - t0) / 0.6) * Math.PI)) * Math.exp(-Math.max(0, t - t0 - 0.6) * 2);
  p.chest = [p.chest[0] - 0.12 * k, p.chest[1], p.chest[2]];
  p.head = [p.head[0] - 0.1 * k, p.head[1], p.head[2]];
  p.shrug += 0.4 * k;
};
const nodMod = (t0: number, shake: boolean) => (p: Pose, t: number) => {
  const u = t - t0;
  if (u < 0 || u > 1.2) return;
  const a = Math.sin(u * Math.PI * 4) * 0.12 * (1 - u / 1.2);
  if (shake) p.head = [p.head[0], p.head[1] + a, p.head[2]];
  else p.head = [p.head[0] + a, p.head[1], p.head[2]];
};
const happyBounce = (p: Pose, t: number) => { p.hipY += 0.01 * Math.max(0, Math.sin(t * 7)); p.shrug += 0.1 * Math.max(0, Math.sin(t * 7)); };
const twist = (dir: number) => (p: Pose) => {
  p.spine = [p.spine[0], p.spine[1] + dir * 22 * D, p.spine[2]];
  p.chest = [p.chest[0], p.chest[1] + dir * 26 * D, p.chest[2]];
};
const slump = (p: Pose) => { p.shrug = Math.max(p.shrug, 0.25); p.spine = [p.spine[0] + 0.08, p.spine[1], p.spine[2]]; p.chest = [p.chest[0] + 0.1, p.chest[1], p.chest[2]]; };

// ── compile ─────────────────────────────────────────────────────────────────
/** A story with `scenes` becomes one production per place, played one after the other on the VO clock. */
export type SceneProd = { t0: number; t1: number; P: Production };

export const compile = (story: Story): Production => {
  const problems = validateStory(story);
  if (problems.length) throw new Error(`story "${story.id}" has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  if (!story.scenes?.length) return compileOne(story);
  const off = story.vo.offset ?? 0.4;
  const cues = makeCues(story.words, off);
  const at = (c: StoryBeat["at"]) => { if (typeof c === "number") return c; const [w, n] = c.split("#"); return cues.at(w, n ? Number(n) : 0); };
  const total = Math.round((cues.voEnd + (story.tail ?? 1.8)) * 10) / 10;
  const parts = [{ at: 0 as StoryBeat["at"], env: story.env, time: story.time, start: story.start, cast: story.inScene }, ...story.scenes];
  // a cut lands 0.12 s before its word, so the new place is on screen as the word starts
  const T = parts.map((p, k) => (k === 0 ? 0 : Math.max(0, at(p.at) - 0.12)));
  // scenes play in order: a cue that lands before the previous scene is usually a repeated word ("sampai" in "1 sampai 5")
  for (let k = 1; k < T.length; k++) if (T[k] <= T[k - 1] + 0.5) {
    const c = String(parts[k].at), n = typeof parts[k].at === "string" ? story.words.filter((w) => w[0].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") === c.split("#")[0].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")).length : 0;
    throw new Error(`scene ${k + 1} (at "${c}", ${T[k].toFixed(1)} s) does not come after scene ${k} (${T[k - 1].toFixed(1)} s) — scenes must follow the VO${n > 1 ? `; "${c.split("#")[0]}" is spoken ${n}× — use "${c.split("#")[0]}#1" … "#${n - 1}" for a later one` : ""}`);
  }
  const scenes: SceneProd[] = parts.map((p, k) => {
    const t0 = T[k], t1 = T[k + 1] ?? total;
    const ids = p.cast ?? story.cast.map((c) => c.id);
    const inWin = (c: StoryBeat["at"]) => { const t = at(c); return t >= t0 - 1e-6 && t < t1 - 1e-6; };
    const sub: Story = {
      ...story,
      id: `${story.id}--s${k}`,
      env: p.env,
      time: p.time,
      start: p.start,
      cast: story.cast.filter((c) => ids.includes(c.id)),
      beats: story.beats.filter((b) => inWin(b.at)),
      vo: { ...story.vo, offset: off - t0 },
      cards: [],
      board: story.board && inWin(story.board.at) ? story.board : undefined,
      tumbleweed: story.tumbleweed && inWin(story.tumbleweed.at) ? story.tumbleweed : undefined,
      scenes: undefined,
      inScene: undefined,
    };
    const issues = validateStory(sub);
    if (issues.length) throw new Error(`scene ${k + 1} (${p.env}, from ${t0.toFixed(1)} s) has ${issues.length} problem(s):\n  - ${issues.join("\n  - ")}`);
    return { t0, t1, P: compileOne(sub, t1 - t0) };
  });
  const first = scenes[0].P;
  const shift = <X extends { t0: number; t1: number }>(x: X, d: number): X => ({ ...x, t0: x.t0 + d, t1: x.t1 + d });
  const cards = (story.cards ?? []).map((c) => ({ t0: at(c.at), t1: c.until !== undefined ? at(c.until) : at(c.at) + 1.6, text: c.text }));
  return {
    ...first,
    story,
    cues,
    duration: total,
    cards,
    shots: scenes.flatMap((s) => s.P.shots.map((x) => ({ ...shift(x, s.t0), t1: Math.min(s.t1, x.t1 + s.t0) })).filter((x) => x.t1 - x.t0 > 0.01)),
    sound: [...scenes.flatMap((s) => s.P.sound.filter((c) => c.t + s.t0 < s.t1).map((c) => ({ ...c, t: c.t + s.t0 }))), ...cards.flatMap((c) => [{ t: c.t0, kind: "tick" }, { t: c.t1 - 0.1, kind: "ding" }])].sort((a, b) => a.t - b.t),
    music: scenes.flatMap((s) => s.P.music.map((m) => ({ ...shift(m, s.t0), t1: Math.min(s.t1, m.t1 + s.t0) })).filter((m) => m.t1 > m.t0)),
    scenes,
  };
};

const compileOne = (story: Story, dur?: number): Production => {
  const env = ENVS[story.env];
  const time = story.time ?? env.times[0];
  const cues = makeCues(story.words, story.vo.offset ?? 0.4);
  const at = (c: StoryBeat["at"]) => {
    if (typeof c === "number") return c;
    const [w, n] = c.split("#");
    return cues.at(w, n ? Number(n) : 0);
  };
  const duration = dur ?? Math.round((cues.voEnd + (story.tail ?? 1.8)) * 10) / 10;
  const plans = planBlocking(story, env, at, duration);
  autoTurns(story, plans, at);
  const ids = story.cast.map((c) => c.id);

  // per-person body/eye functions from blocking (cached)
  const chars: CharProd[] = story.cast.map((c, i) => {
    const spec = lookSpec(c, env.home);
    const segs = plans[c.id].segs;
    const segAt = (t: number) => { let k = 0; for (let j = 0; j < segs.length; j++) if (t >= segs[j].t0) k = j; return k; };
    const body = (t: number, base: BodyName = "stand", mod?: (p: Pose, t: number) => void) => {
      const k = segAt(t), s = segs[k];
      const p = segBody(spec, env, s, t, base, mod);
      if (k > 0 && t - s.t0 < 0.4) return blend(segBody(spec, env, segs[k - 1], t, base, mod), p, sm((t - s.t0) / 0.4));
      return p;
    };
    const cache = new Map<number, { eye: V3; fwd: V3 }>();
    const probe = (t: number) => {
      const key = Math.round(t * 120);
      let v = cache.get(key);
      if (!v) {
        const p = body(key / 120);
        const sk = skeleton(p, spec, key / 120);
        const e = new Vector3(0, 0.0, 0.06).applyMatrix4(sk.W.headGeo);
        v = { eye: [e.x, e.y, e.z], fwd: fwdOf(p.yaw) };
        if (cache.size > 4000) cache.clear();
        cache.set(key, v);
      }
      return v;
    };
    return {
      id: c.id, spec, segs, body, eye: (t) => probe(t).eye, fwd: (t) => probe(t).fwd,
      perf: { spec, anchor: { x: 0, y: 0, z: 0, yaw: 0 }, beats: [] }, wins: [], phone: { on: [] }, bag: { on: [] },
      hasBag: c.prop === "bag" || c.prop === "both", inBed: segs.some((s) => s.k === "bed"), _i: i,
      lying: (t: number) => { const bs = segs.find((x) => x.k === "bed"); if (!bs || bs.k !== "bed") return false; let sit = false; for (const ch of bs.changes) if (ch.at <= t) sit = ch.sit; return !sit; },
    } as CharProd & { _i: number };
  });
  const byId = Object.fromEntries(chars.map((c) => [c.id, c]));
  const other = (id: string) => chars.find((c) => c.id !== id);

  // beat windows per person
  const all = story.beats.map((b) => ({ b, t: at(b.at) })).sort((x, y) => x.t - y.t);
  for (const ch of chars) {
    const mine = all.filter((x) => whoOf(story, x.b).includes(ch.id));
    ch.wins = mine.map((x, j) => ({ verb: x.b.do, t0: x.t, t1: mine[j + 1]?.t ?? duration, beat: x.b, target: x.b.target ?? (ids.length > 1 ? other(ch.id)?.id : undefined) }));
  }

  // props: phone / bag windows (out from the verb until the hands are needed)
  for (const ch of chars) {
    let phoneFrom = -1, bagFrom = -1;
    for (const w of ch.wins) {
      const u = USES[w.verb] ?? "none";
      if (phoneFrom >= 0 && w.verb !== "phone" && !SOFT.includes(w.verb) && (u === "R" || u === "both")) { ch.phone.on.push([phoneFrom, w.t0]); phoneFrom = -1; }
      if (bagFrom >= 0 && w.verb !== "bag" && u !== "none") { ch.bag.on.push([bagFrom, w.t0]); bagFrom = -1; }
      if (w.verb === "phone" && phoneFrom < 0) phoneFrom = w.t0;
      if (w.verb === "bag" && bagFrom < 0 && ch.hasBag) bagFrom = w.t0;
    }
    if (phoneFrom >= 0) ch.phone.on.push([phoneFrom, duration + 1]);
    if (bagFrom >= 0) ch.bag.on.push([bagFrom, duration + 1]);
  }

  // acting → performance beats
  const thoughts: { who: string; def: ThoughtDef }[] = [];
  const sound: SoundCue[] = [];
  let bubbleN = 0;
  for (const ch of chars) {
    const i = (ch as CharProd & { _i: number })._i;
    const pan = ids.length > 1 ? (i === 0 ? -0.25 : 0.25) : 0;
    const hs = ch.spec.scale * ch.spec.handScale;
    const B: Beat[] = [];
    const eyeOfT = (id?: string) => (t: number): V3 => (id && byId[id] ? byId[id].eye(t) : (() => { const e = ch.eye(t), f = ch.fwd(t); return [e[0] + f[0] * 5, e[1] - 0.1, e[2] + f[2] * 5] as V3; })());
    const ahead = (t: number): V3 => { const e = ch.eye(t), f = ch.fwd(t); return [e[0] + f[0] * 5, e[1] - 0.15, e[2] + f[2] * 5]; };
    const bodySel = (base: BodyName = "stand", mod?: (p: Pose, t: number) => void) => (t: number) => ch.body(t, base, mod);
    // phone + bag gestures
    const phoneM = (t: number) => phoneReadPose(ch.eye(t), ch.fwd(t), rightOf(ch.fwd(t)));
    const readPhone = (t: number): Gesture => {
      const g = gripFor(phoneM(t), PHONE_IN_HAND, hs);
      return { arm: { sw: 0, ab: 0, tw: 0, el: 1, wr: [0, 0, 0], ik: { t: g.wrist, space: "world", pole: [1, -0.9, -0.5], w: 1, q: g.q } }, hand: HANDS.grip };
    };
    const bagM = (t: number) => bagMatrixFor(ch, t);
    const bagHold = (t: number): Gesture => ({ arm: { sw: 0, ab: 0, tw: 0, el: 1, wr: [0.3, 0, 0.5], ik: { t: xform(bagM(t), [0.13, 0.06, 0.06]), space: "world", pole: [1, -0.8, -0.2], w: 1 } }, hand: HANDS.grip });
    const rummage = (t: number): Gesture => {
      const m = bagM(t);
      return { arm: { sw: 0, ab: 0, tw: 0, el: 1, wr: [0.5, 0, 0.2], ik: { t: xform(m, [-0.02 + 0.05 * Math.sin(t * 7.3), 0.12 + 0.02 * Math.sin(t * 11), 0.015 * Math.sin(t * 9.7)]), space: "world", pole: [1, -0.6, -0.4], w: 1 } }, hand: { curl: 0.55 + 0.25 * Math.sin(t * 8), index: 0.5, thumb: 0.4, spread: 0.3 } };
    };
    B.push({ at: 0, body: bodySel(), armL: null, armR: null, face: ch.inBed ? { base: "sleepy", add: { lid: 0.45 } } : "content", look: ch.inBed ? [-0.16, 2.7, -0.5] : ids.length > 1 ? eyeOfT(other(ch.id)!.id) : ahead, headFollow: ch.segs[0].k === "walk" ? 0.55 : 0.7, breath: { rate: 0.28 } });
    const phoneOn = (t: number) => ch.phone.on.some(([a, b]) => t >= a && t < b);
    for (const w of ch.wins) {
      const t0 = w.t0, t1 = w.t1, tgt = w.target;
      const face = w.beat.face ?? FACE[w.verb];
      const look = (id?: string) => (id && byId[id] ? eyeOfT(id) : ahead);
      // lying in bed: the acting is face, gaze and bubbles (standing arm/body gestures do not apply)
      const flat = ch.lying(t0) && !["lampOff", "lampOn", "sitUp", "lieDown"].includes(w.verb);
      if (flat && (w.verb === "phone" || w.verb === "bag")) throw new Error(`"${ch.id}" is lying in bed at "${w.beat.at}" — "${w.verb}" needs sitting up: add a "sitUp" beat before it`);
      const add = (b: Omit<Beat, "at"> & { at?: number }) => {
        const x = { at: t0, ...b } as Beat & Record<string, unknown>;
        if (flat) { delete x.armL; delete x.armR; delete x.arms; delete x.body; delete x.tremble; }
        B.push(x as Beat);
      };
      if (face) add({ face, dur: w.verb === "surprised" || w.verb === "eyeContact" ? 0.12 : 0.35, curve: w.verb === "surprised" || w.verb === "eyeContact" ? "snap" : "act" });
      // put a prop away if this verb needs the hands
      const uses = USES[w.verb] ?? "none";
      const closing = ch.phone.on.find(([, b]) => Math.abs(b - t0) < 1e-6);
      if (closing && (uses === "R" || uses === "both")) { add({ armR: "pocket", dur: 0.25 }); B.push({ at: t0 + 0.32, armR: null, dur: 0.3 }); sound.push({ t: t0, kind: "pocket", who: ch.id, pan }); }
      const ts = closing && (uses === "R" || uses === "both") ? t0 + 0.4 : t0;
      switch (w.verb) {
        case "walk": case "stop": case "meet": case "turn": case "sitDown": case "standUp": case "lieDown": case "sitUp":
          if (!phoneOn(t0)) add({ look: tgt && w.verb === "meet" ? look(tgt) : ahead, headFollow: 0.6 });
          if (w.verb === "turn") sound.push(...turnSteps([{ at: t0, dur: 0.95, to: 0 }]).map((tt) => ({ t: tt, kind: "step", who: ch.id, pan })));
          if (w.verb === "sitDown" || w.verb === "standUp" || w.verb === "lieDown" || w.verb === "sitUp") sound.push({ t: t0, kind: "rustle", who: ch.id, pan });
          break;
        case "pass":
          sound.push({ t: t0 - 0.3, kind: "whoosh", who: ch.id, pan });
          break;
        case "idle": add({ look: tgt ? look(tgt) : ahead, headFollow: 0.6 }); break;
        case "talk": add({ armR: explaining(1.1), look: look(tgt), headFollow: 0.8, at: ts }); break;
        case "explain": add({ armR: explaining(1.4), look: look(tgt), headFollow: 0.7, at: ts }); sound.push({ t: t0, kind: "pop", who: ch.id, pan }); break;
        case "point": {
          const tg = tgt ? byId[tgt] : undefined;
          add({ at: ts, armR: tg ? (t: number) => { const s = ch.eye(t), e = tg.eye(t); const d = new Vector3(...e).sub(new Vector3(...s)).normalize(); return reach([s[0] + d.x * 0.62, s[1] - 0.25 + d.y * 0.62, s[2] + d.z * 0.62], [1, -0.4, -0.6], HANDS.point); } : "pointFwd", look: look(tgt), headFollow: 0.8 });
          sound.push({ t: t0, kind: "pop", who: ch.id, pan });
          break;
        }
        case "think": add({ at: ts, ...(phoneOn(t0) ? {} : { armR: "chin" as const }), look: (t: number) => { const e = ch.eye(t), f = ch.fwd(t), r = rightOf(f); return [e[0] + f[0] * 2 + r[0] * 1.2, e[1] + 0.9, e[2] + f[2] * 2 + r[2] * 1.2]; }, headFollow: 0.6, nervous: 0.3 }); break;
        case "confused": add({ at: ts, ...(phoneOn(t0) ? {} : { armR: "scratchHead" as const }), look: look(tgt), headFollow: 0.5 }); sound.push({ t: t0, kind: "squeak", who: ch.id, pan }); break;
        case "happy": add({ body: bodySel("stand", happyBounce), dur: 0.4, look: look(tgt), headFollow: 0.7 }); B.push({ at: t1 - 0.01, body: bodySel(), dur: 0.4 }); sound.push({ t: t0, kind: "sparkle", who: ch.id, pan }); break;
        case "laugh": add({ body: bodySel("stand", laugh(i * 1.3)), dur: 0.4, look: look(tgt), headFollow: 0.6 }); B.push({ at: t1 - 0.01, body: bodySel(), dur: 0.4 }); sound.push({ t: t0, kind: "sparkle", who: ch.id, pan }); break;
        case "sad": add({ body: bodySel("standSlump", slump), dur: 0.6, look: (t: number) => { const e = ch.eye(t), f = ch.fwd(t); return [e[0] + f[0] * 2, e[1] - 1.2, e[2] + f[2] * 2]; }, headFollow: 0.6 }); B.push({ at: t1 - 0.01, body: bodySel(), dur: 0.6 }); break;
        case "embarrassed": case "shy":
          if (!phoneOn(t0)) add({ at: ts, armR: "rubNeck", look: (t: number) => { const e = ch.eye(t), f = ch.fwd(t), r = rightOf(f); return [e[0] + f[0] * 2 - r[0], e[1] - 0.8, e[2] + f[2] * 2 - r[2]]; }, headFollow: 0.6 });
          sound.push({ t: t0, kind: "squeak", who: ch.id, pan });
          break;
        case "surprised": add({ body: bodySel("stand", recoil(t0)), dur: 0.15, look: look(tgt), headFollow: 0.9 }); B.push({ at: t0 + 1.4, body: bodySel(), dur: 0.5 }); sound.push({ t: t0, kind: "boing", who: ch.id, pan }); break;
        case "wave": add({ at: ts, armR: waving(2.2, 1), look: look(tgt), headFollow: 0.85, dur: 0.35 }); B.push({ at: Math.min(t1, t0 + 2.4) - 0.01, armR: null, dur: 0.4 }); sound.push({ t: t0, kind: "popHi", who: ch.id, pan }); break;
        case "facepalm": add({ body: bodySel("standSlump", slump), dur: 0.45, armL: "facepalm", look: (t: number) => { const e = ch.eye(t), f = ch.fwd(t); return [e[0] + f[0] * 3, e[1] - 0.5, e[2] + f[2] * 3]; }, headFollow: 0.6 }); B.push({ at: t1 - 0.01, body: bodySel(), armL: null, dur: 0.45 }); sound.push({ t: t0 + 0.4, kind: "slap", who: ch.id, pan }); break;
        case "notice": add({ look: look(tgt), headFollow: 0.6, dur: 0.3 }); sound.push({ t: t0, kind: "ding", who: ch.id, pan }); break;
        case "eyeContact": add({ look: look(tgt), headFollow: 0.9, dur: 0.12 }); sound.push({ t: t0 + 0.12 * i, kind: "ding", who: ch.id, pan }); break;
        case "phone":
          if (!phoneOn(t0 - 0.01)) {
            add({ armR: "pocket", dur: 0.24, curve: "snap", look: (t: number) => { const e = ch.eye(t), f = ch.fwd(t); return [e[0] + f[0] * 0.4, e[1] - 0.9, e[2] + f[2] * 0.4]; }, headFollow: 0.6 });
            B.push({ at: t0 + 0.3, armR: readPhone, dur: 0.34, curve: "snap", look: (t: number) => xform(phoneM(t), [0, 0, 0]), headFollow: 1 });
            sound.push({ t: t0, kind: "whoosh", who: ch.id, pan });
          }
          break;
        case "bag":
          if (ch.hasBag) {
            add({ armL: bagHold, dur: 0.3, curve: "snap", look: (t: number) => xform(bagM(t), [0, 0, 0]), headFollow: 1 });
            B.push({ at: t0 + 0.9, armR: rummage, dur: 0.35 });
            sound.push({ t: t0, kind: "whoosh", who: ch.id, pan }, { t: t0 + 0.9, kind: "zip", who: ch.id, pan });
          }
          break;
        case "lookBack": {
          const dirSign = i === 0 ? 1 : 1;
          add({ body: bodySel("stand", twist(dirSign)), dur: 0.42, look: tgt ? (t: number) => { const e = byId[tgt].eye(t), r = rightOf(ch.fwd(t)); return [e[0] - r[0] * 1.2, e[1], e[2] - r[2] * 1.2]; } : ahead, headFollow: 1 });
          B.push({ at: t1 - 0.01, body: bodySel(), dur: 0.42 });
          sound.push({ t: t0, kind: "pop", who: ch.id, pan });
          break;
        }
        case "highFive": {
          const o = other(ch.id);
          if (o) {
            const pt = (t: number): V3 => { const a = ch.eye(t), b = o.eye(t); return [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.02, (a[2] + b[2]) / 2]; };
            const side = i === 0 ? { armR: (t: number) => highFive(pt(t)) } : { armL: (t: number) => highFive(pt(t)) };
            B.push({ at: Math.max(0, t0 - 0.7), ...side, dur: 0.6 } as Beat);
            B.push({ at: t0 + 0.35, ...(i === 0 ? { armR: null } : { armL: null }), dur: 0.6, body: bodySel("stand", laugh(i * 1.3)), face: "laughing" } as Beat);
            if (i === 0) sound.push({ t: t0, kind: "clap" }, { t: t0 + 0.02, kind: "sparkle" });
          }
          break;
        }
        case "nod": case "shake": add({ body: bodySel("stand", nodMod(t0, w.verb === "shake")), dur: 0.2, look: look(tgt), headFollow: 0.7 }); break;
        case "shrug": add({ at: ts, arms: "palmUp", dur: 0.35, look: look(tgt) }); B.push({ at: Math.min(t1, t0 + 1.6) - 0.01, arms: null, dur: 0.4 }); sound.push({ t: t0, kind: "squeak", who: ch.id, pan }); break;
        case "overwhelmed": add({ at: ts, arms: "headInHands", body: bodySel("standSlump", slump), dur: 0.6, tremble: 0.4, breath: { rate: 0.6, amp: 1.3 }, nervous: 0.8, look: null }); B.push({ at: t1 - 0.01, arms: null, body: bodySel(), dur: 0.6, tremble: 0, nervous: 0.1, breath: { rate: 0.28, amp: 1 } }); sound.push({ t: t0, kind: "heartbeat", who: ch.id, pan }); break;
        case "calm": add({ at: ts, ...(phoneOn(t0) ? {} : { armR: "onChest" as const }), sigh: true, look: ahead, headFollow: 0.6 }); if (!phoneOn(t0)) B.push({ at: t0 + 2.6, armR: null, dur: 0.5 }); sound.push({ t: t0, kind: "breath", who: ch.id, pan }); break;
        case "smile": add({ look: look(tgt), headFollow: 0.8 }); sound.push({ t: t0, kind: "sparkle", who: ch.id, pan }); break;
        case "proud": add({ at: ts, arms: "onHip", dur: 0.4, look: look(tgt) }); B.push({ at: Math.min(t1, t0 + 2.5) - 0.01, arms: null, dur: 0.4 }); break;
        case "lampOff": case "lampOn": {
          const bed = env.bed;
          if (bed) {
            const tap = (t: number): Gesture => { void t; const p = ch.body(t0).z < -0.25 ? bed.lampTapSit : bed.lampTapLie; return reach(p, [1, -0.1, 0.45], HANDS.flat, [0, 0.3, 0.2]); };
            add({ at: ts - 0.55, armR: tap, dur: 0.6, look: env.props.lamp, headFollow: 0.7 });
            B.push({ at: ts + 0.15, armR: null, dur: 0.7 });
            sound.push({ t: ts, kind: "click", who: ch.id, pan });
          }
          break;
        }
      }
      // hands come down after a while: a gesture never sticks through the next beats
      const rel = RELEASE[w.verb];
      if (rel && !flat && (!SOFT.includes(w.verb) || !phoneOn(t0))) B.push({ at: Math.max(t0 + 0.6, Math.min(t1, t0 + rel) - 0.01), armR: null, dur: 0.45 });
      // thought bubbles
      const th = w.beat.thought ?? (w.verb === "confused" ? { icon: "question" as const } : w.verb === "surprised" ? { icon: "exclaim" as const } : undefined);
      if (th) {
        const big = !!(th.vignette || th.text);
        const side = bubbleN++ % 2 ? -1 : 1;
        const cast = th.cast ? { a: byId[th.cast[0]]?.spec, b: byId[th.cast[1]]?.spec } : ids.length > 1 ? { a: ch.spec, b: other(ch.id)!.spec } : { a: ch.spec };
        thoughts.push({ who: ch.id, def: { id: `th${thoughts.length}`, at: t0 + (big ? 0.1 : 0.05), until: big ? Math.min(t1, t0 + 4.5) - 0.1 : t0 + 1.4, text: th.text, icon: th.icon, vignette: th.vignette, cast, slot: big ? [0.16 * side, 0.6, 0.05] : [0, 0.36, 0], size: big ? 0.18 : 0.085, trail: big } });
        sound.push({ t: t0 + 0.1, kind: "popThought", who: ch.id, pan });
      }
    }
    ch.perf.beats = B;
    // footsteps
    for (const s of ch.segs) if (s.k === "walk") for (const h of s.w.heelStrikes(0, duration)) sound.push({ t: h.t, kind: "step", who: ch.id, pan });
    for (const s of ch.segs) if (s.k === "stand") for (const tt of turnSteps(s.turns)) sound.push({ t: tt, kind: "step", who: ch.id, pan });
  }

  // lamp (bedroom): starts on when the first lamp verb is lampOff
  const lampTimes = all.filter((x) => x.b.do === "lampOff" || x.b.do === "lampOn").map((x) => ({ t: x.t, on: x.b.do === "lampOn" }));
  const lamp = (t: number) => { let on = lampTimes.length ? !lampTimes[0].on : false; for (const x of lampTimes) if (t >= x.t) on = x.on; return on ? 1 : 0; };

  const cards = (story.cards ?? []).map((c) => ({ t0: at(c.at), t1: c.until !== undefined ? at(c.until) : at(c.at) + 1.6, text: c.text }));
  for (const c of cards) sound.push({ t: c.t0, kind: "tick" }, { t: c.t1 - 0.1, kind: "ding" });
  const board = story.board ? (() => {
    const up = at(story.board.at);
    const e = chars[0].eye(up + 1.2);
    // beside the path, where nothing (trees, posts) stands within 2.7 m
    let best: V3 = [e[0] + 1.6, 0, e[2] - 2.4], bestC = -1;
    for (let dx = -4; dx <= 4; dx += 0.25) {
      const p: V3 = [e[0] + 1.6 + dx, 0, e[2] - 2.4];
      const c = Math.min(...env.blockers.map((b) => Math.hypot(b.c[0] - p[0], b.c[2] - p[2]) - (b.r > 1 ? 1.2 : 0.3)));
      const score = Math.min(c, 2.7) - Math.abs(dx) * 0.05;
      if (score > bestC) { bestC = score; best = p; }
    }
    return { up, swap: story.board.swap !== undefined ? at(story.board.swap) : 1e9, down: at(story.board.until), face1: story.board.face1, face2: story.board.face2, pos: best };
  })() : undefined;
  if (board) sound.push({ t: board.up, kind: "board" });
  const tumbleweed = story.tumbleweed ? { t0: at(story.tumbleweed.at), t1: at(story.tumbleweed.until) } : undefined;
  if (tumbleweed) sound.push({ t: tumbleweed.t0, kind: "tumbleweed" });

  const prod: Production = { story, env, time, cues, duration, chars, thoughts, shots: [], cards, board, tumbleweed, lamp, sound: sound.sort((a, b) => a.t - b.t), music: [] };
  prod.shots = pickShots(prod, all);
  const CLOSE: ShotKind[] = ["closeUp", "reaction", "bedClose", "medium"];
  for (const th of thoughts) {
    const end = th.def.until ?? Infinity, cut = prod.shots.find((s) => s.t0 > th.def.at + 0.3 && s.t0 < end && CLOSE.includes(s.kind));
    if (cut) th.def.until = Math.max(th.def.at + 0.5, cut.t0 - 0.04);
  }
  prod.music = musicSections(prod, all);
  return prod;
};

// ── bag pose (from the blocking body: hips only, no recursion through the arms) ──
const BAG_REST = (build: number) => new Matrix4().makeRotationY(Math.PI / 2).setPosition(0.2 * build, -0.13, 0.02);
const BAG_FRONT = new Matrix4().makeRotationX(-0.5).setPosition(0, -0.02, 0.23);
export const bagFrontAmount = (ch: CharProd, t: number) => {
  let k = 0;
  for (const [a, b] of ch.bag.on) k = Math.max(k, sm((t - a) / 0.55) * (1 - sm((t - b) / 0.6)));
  return k;
};
export const bagFlap = (ch: CharProd, t: number) => {
  let k = 0;
  for (const [a, b] of ch.bag.on) k = Math.max(k, sm((t - a - 0.65) / 0.3) * (1 - sm((t - b) / 0.25)));
  return k;
};
export const bagMatrixFor = (ch: CharProd, t: number, hips?: Matrix4) => {
  const h = hips ?? skeleton(ch.body(t), ch.spec, t).W.hips;
  return h.clone().multiply(lerpMat(BAG_REST(ch.spec.build), BAG_FRONT, bagFrontAmount(ch, t)));
};
export const bagStrap = (ch: CharProd, t: number, sk: ReturnType<typeof skeleton>): V3[] => {
  const m = bagMatrixFor(ch, t, sk.W.hips), c = sk.W.chest;
  return [
    xform(m, [-BAG.w / 2 + 0.02, -0.01, 0]),
    xform(c, [0.14, -0.3, 0.145]), xform(c, [0.0, -0.05, 0.158]), xform(c, [-0.1, 0.13, 0.135]), xform(c, [-0.15, 0.215, 0.05]), xform(c, [-0.155, 0.225, -0.03]), xform(c, [-0.1, 0.12, -0.13]),
    xform(c, [0.0, -0.06, -0.145]), xform(c, [0.14, -0.3, -0.13]),
    xform(m, [BAG.w / 2 - 0.02, -0.01, 0]),
  ];
};
export const phoneVisible = (ch: CharProd, t: number) => ch.phone.on.some(([a, b]) => t >= a + 0.22 && t < b + 0.28);

/** Final pose of a person (performance on top of blocking). */
export const poseAt = (ch: CharProd, t: number, seed = 1) => perform(ch.perf, t, seed).pose;

// ── camera planning ─────────────────────────────────────────────────────────
type Pick = { kind: ShotKind; a: string; b?: string };
const SINGLE: Partial<Record<Verb, ShotKind[]>> = {
  walk: ["track", "mediumWide"], stop: ["mediumWide", "medium"], idle: ["medium", "closeUp"], talk: ["medium", "explain"], explain: ["explain", "medium"], point: ["explain", "mediumWide"],
  think: ["think", "medium"], confused: ["think", "medium"], happy: ["reaction", "medium"], laugh: ["medium", "reaction"], sad: ["closeUp", "medium"],
  embarrassed: ["reaction", "closeUp"], shy: ["closeUp", "medium"], surprised: ["reaction", "medium"], wave: ["mediumWide", "medium"], facepalm: ["closeUp", "medium"], notice: ["ots", "pathDown"],
  phone: ["medium", "closeUp"], bag: ["medium", "mediumWide"], lookBack: ["closeUp", "medium"], nod: ["closeUp", "medium"], shake: ["closeUp", "medium"], shrug: ["medium", "mediumWide"], overwhelmed: ["medium", "closeUp"],
  calm: ["medium", "closeUp"], smile: ["closeUp", "medium"], proud: ["mediumWide", "medium"], sitDown: ["sitStand", "mediumWide"], standUp: ["sitStand", "mediumWide"], turn: ["turn", "mediumWide"],
  lieDown: ["wide"], sitUp: ["wide"], lampOff: ["wide"], lampOn: ["wide"],
};
const FAMILY: Partial<Record<ShotKind, ShotKind>> = { explain: "medium", reaction: "closeUp" };
const family = (k: ShotKind) => FAMILY[k] ?? k;
const pickShots = (P: Production, all: { b: StoryBeat; t: number }[]): ShotSpec[] => {
  const ids = P.story.cast.map((c) => c.id);
  const two = ids.length > 1;
  const sep = (t: number) => (two ? new Vector3(...P.chars[0].eye(t)).distanceTo(new Vector3(...P.chars[1].eye(t))) : 0);
  const shots: ShotSpec[] = [];
  let last: Pick | null = null, side: 1 | -1 = 1;
  const push = (p: Pick, t0: number, t1: number) => {
    if (t1 - t0 < 0.05) return;
    if (last && last.kind === p.kind && last.a === p.a && last.b === p.b) side = side === 1 ? -1 : 1;
    shots.push({ ...p, side, t0, t1 });
    last = p;
  };
  // group beats at the same moment (both people)
  const times = [...new Set(all.map((x) => Math.round(x.t * 100) / 100))].sort((a, b) => a - b);
  const starts = times[0] > 0.6 ? [0, ...times] : [0, ...times.slice(1)];
  for (let k = 0; k < starts.length; k++) {
    const t0 = starts[k], t1 = starts[k + 1] ?? P.duration + 1;
    const here = all.filter((x) => Math.abs(x.t - t0) < 0.011 || (k === 0 && x.t <= t0 + 0.6));
    const b = here[0]?.b;
    const verb = b?.do ?? "walk";
    const who = b ? whoOf(P.story, b) : [ids[0]];
    const a = who[0], o = two ? ids.find((x) => x !== a)! : undefined;
    if (b?.shot) { push({ kind: b.shot, a, b: o }, t0, t1); continue; }
    if (k === 0) {
      const est = Math.min(t1, 2.6);
      const lyingStart = P.chars[0].inBed && P.chars[0].lying(0);
      // a room with two people opens on both when a camera position inside the set fits them
      const o2 = two ? ids.find((x) => x !== a) : undefined;
      const subj = (id: string, tt: number) => { const c = P.chars.find((x) => x.id === id)!; const e = c.eye(tt); return { face: e, fwd: c.fwd(tt), pos: [e[0], 0, e[2]] as V3 }; };
      const { min, max } = P.env.bounds;
      const dir = P.env.indoor && o2 ? pairDir(subj(a, 0.5), subj(o2, 0.5), (p) => p[0] > min[0] && p[0] < max[0] && p[2] > min[2] && p[2] < max[2]) : null;
      push({ kind: lyingStart ? (b?.thought ? "bedThink" : "bedWide") : P.env.indoor ? "wide" : "establish", a, b: dir ? o2 : undefined }, 0, est);
      if (dir) shots[shots.length - 1].dir = dir;
      if (t1 > est + 0.8) push({ kind: P.chars[0].segs[0].k === "walk" ? "track" : P.chars[0].inBed && P.chars[0].lying(est) ? "bedClose" : "medium", a }, est, t1);
      else if (shots.length) shots[shots.length - 1].t1 = t1;
      continue;
    }
    let pick: Pick[];
    const inBed = P.chars.find((c) => c.id === a);
    const bedNow = !!inBed?.inBed && (inBed.lying(t0 + 0.01) || ["sitUp", "lieDown"].includes(verb) || inBed.lying(Math.min(t1, P.duration) - 0.01));
    if (bedNow) {
      const close = ["closeUp", "reaction"].includes((SINGLE[verb] ?? ["medium"])[0]);
      const bubble = !!b?.thought || verb === "think" || verb === "confused";
      let kind: ShotKind = bubble && !["sitUp", "lieDown"].includes(verb) ? "bedThink" : ["sitUp", "lieDown", "lampOff", "lampOn"].includes(verb) || !close ? "bedWide" : "bedClose";
      if (last && (last as Pick).kind === kind && (last as Pick).a === a && !["sitUp", "lieDown"].includes(verb) && kind !== "bedThink") kind = kind === "bedWide" ? "bedClose" : "bedWide";
      push({ kind, a }, t0, t1);
      continue;
    }
    if (two && (verb === "pass" || verb === "meet" || verb === "highFive" || (verb === "talk" && sep(t0) < 2.5))) pick = [{ kind: "twoShot", a: ids[0], b: ids[1] }];
    else if (two && (verb === "eyeContact" || (who.length > 1 && ["lookBack", "facepalm", "sad", "happy", "surprised", "laugh", "smile", "embarrassed"].includes(verb)))) pick = [{ kind: verb === "lookBack" ? "closeUp" : "closeUp", a: ids[0] }, { kind: "closeUp", a: ids[1] }];
    else if (verb === "notice" && o) pick = [{ kind: sep(t0) > 6 ? "pathDown" : "ots", a, b: o }];
    else pick = [{ kind: (SINGLE[verb] ?? ["medium"]).find((k) => o || !["ots", "pathDown", "twoShot"].includes(k)) ?? "medium", a }];
    // a text / vignette bubble needs headroom above the head
    const bigThought = !!(b?.thought && (b.thought.text || b.thought.vignette));
    if (bigThought && pick.length === 1 && !["twoShot", "ots", "pathDown"].includes(pick[0].kind)) pick = [{ kind: "think", a }];
    // variety: the same framing twice in a row → the alternative
    // (medium / explain and closeUp / reaction look the same on screen: they count as one framing)
    if (pick.length === 1 && !bigThought && last && family((last as Pick).kind) === family(pick[0].kind) && (last as Pick).a === pick[0].a) {
      const alts = SINGLE[verb] ?? ["medium"];
      const fam = family(pick[0].kind);
      const alt = alts.find((x) => family(x) !== fam && (o || !["ots", "pathDown", "twoShot"].includes(x))) ?? (two && o && sep(t0) < 4 ? "ots" : fam === "closeUp" ? "medium" : fam === "medium" ? "closeUp" : "medium");
      pick = [{ kind: alt, a: alt === "ots" ? o! : a, b: alt === "ots" ? a : o }];
    }
    // a pass is seen from 1.4 s before it happens, a high five from its wind-up
    const lead = verb === "pass" ? 1.4 : verb === "highFive" ? 0.9 : 0;
    if (lead && shots.length) { const prev = shots[shots.length - 1]; const cut = Math.max(prev.t0 + 0.8, t0 - lead); prev.t1 = cut; push(pick[0], cut, t1); continue; }
    const span = t1 - t0;
    if (pick.length === 2) { const m = t0 + span / 2; push(pick[0], t0, m); push(pick[1], m, t1); continue; }
    // long beats get a second angle
    if (span > 5) {
      const second: Pick = two && o && sep(t0 + span / 2) < 6 ? { kind: "ots", a: o, b: a } : { kind: pick[0].kind === "medium" ? "closeUp" : "medium", a };
      push(pick[0], t0, t0 + span * 0.55);
      push(second, t0 + span * 0.55, t1);
      continue;
    }
    push(pick[0], t0, t1);
  }
  // a scoreboard gag is framed while it is up
  if (P.board) {
    const b0 = P.board.up - 0.1, b1 = Math.min(P.board.down, P.board.up + 4.5);
    const keep = shots.filter((s) => s.t1 <= b0 || s.t0 >= b1);
    for (const s of shots) { if (s.t0 < b0 && s.t1 > b0) keep.push({ ...s, t1: b0 }); if (s.t0 < b1 && s.t1 > b1) keep.push({ ...s, t0: b1 }); }
    keep.push({ kind: "boardWide", a: ids[0], b: "board", side: 1, t0: b0, t1: b1 });
    shots.length = 0;
    shots.push(...keep.filter((s) => s.t1 - s.t0 > 0.05).sort((x, y) => x.t0 - y.t0));
  }
  // merge shots shorter than 1 s into their neighbour
  const out: ShotSpec[] = [];
  for (const s of shots) {
    const len = Math.min(s.t1, P.duration) - s.t0;
    if (out.length && (len < 0.7 || (len < 1.0 && s.kind !== "closeUp" && s.kind !== "sitStand"))) { out[out.length - 1].t1 = s.t1; continue; }
    out.push({ ...s });
  }
  for (let i = 0; i < out.length; i++) { out[i].t0 = i === 0 ? 0 : out[i - 1].t1; }
  out[out.length - 1].t1 = P.duration + 1;
  return out;
};

const MOOD: Partial<Record<Verb, MusicSection["mood"]>> = {
  happy: "warm", laugh: "warm", smile: "warm", highFive: "warm", calm: "calm", proud: "warm", wave: "warm",
  sad: "sad", facepalm: "sad", lookBack: "sad", overwhelmed: "tense", surprised: "playful", pass: "awkward", eyeContact: "playful",
};
const musicSections = (P: Production, all: { b: StoryBeat; t: number }[]): MusicSection[] => {
  const base: MusicSection["mood"] = P.story.mood ?? (P.env.id === "bedroom" && P.time === "night" ? "calm" : "playful");
  const pts: { t: number; mood: MusicSection["mood"] }[] = [{ t: 0, mood: base }];
  for (const x of all) { const m = MOOD[x.b.do]; if (m && m !== pts[pts.length - 1].mood && x.t - pts[pts.length - 1].t > 3) pts.push({ t: x.t, mood: m }); }
  if (P.tumbleweed) pts.push({ t: P.tumbleweed.t0, mood: "awkward" });
  pts.sort((a, b) => a.t - b.t);
  return pts.map((p, i) => ({ t0: p.t, t1: pts[i + 1]?.t ?? P.duration, mood: p.mood }));
};

export { DIMS, remap };
