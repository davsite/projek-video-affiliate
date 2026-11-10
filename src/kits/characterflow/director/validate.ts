// Story checks with plain-language errors, run before compiling. A story is written by an AI from a
// transcript, so every mistake it can make should stop the build with a message that says what to fix.

import { EXPR } from "../character/presets/expressions.ts";
import type { ShotKind } from "../camera/shots.ts";
import { ENVS } from "../env/registry.ts";
import type { IconName } from "../fx/icons.ts";
import type { VignetteName } from "../fx/vignettes.tsx";
import { ACTING_VERBS, BLOCKING_VERBS, type Story } from "./story.ts";

const LOOK_NAMES = ["raka", "bima", "naya", "dimas", "boss", "sari", "dinda", "ibu", "ayah", "adit"];
const HAIR_NAMES = ["swoop", "crop", "bun", "curly", "long", "hijab"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ICON_NAMES = ["question", "exclaim", "cross", "clock", "chat", "cloud", "heart", "chart", "bell", "dots"] satisfies IconName[];
// only the vignettes cast from the story's own people (the others carry topic-specific text/cast)
const VIGNETTE_NAMES = ["friends", "forgot", "weird"] satisfies VignetteName[];
const SHOT_NAMES = ["establish", "wide", "closeUp", "medium", "mediumWide", "twoShot", "ots", "track", "pathDown", "reaction", "explain", "think", "sitStand", "turn", "boardWide", "bedWide", "bedClose", "bedThink"] satisfies ShotKind[];
const BED_ONLY = ["lieDown", "sitUp", "lampOff", "lampOn"];
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Every problem in the story, in plain words (empty = fine). */
export const validateStory = (s: Story): string[] => {
  const e: string[] = [];
  const one = (v: unknown, list: readonly string[], what: string) => { if (typeof v === "string" && !list.includes(v)) e.push(`${what} "${v}" is not available (use one of: ${list.join(", ")})`); };
  if (!s.id || !/^[a-z0-9-]+$/.test(s.id)) e.push(`id "${s.id}" must use only a-z, 0-9 and "-"`);
  const env = ENVS[s.env];
  if (!env) { e.push(`env "${s.env}" does not exist (use one of: ${Object.keys(ENVS).join(", ")})`); return e; }
  if (s.time && !env.times.includes(s.time)) e.push(`time "${s.time}" is not available in ${s.env} (use one of: ${env.times.join(", ")})`);
  if (!Array.isArray(s.words) || !s.words.length) e.push("words is empty — run scripts/transcribe.mjs (or tts.mjs) first");
  if (!s.cast?.length) e.push("cast is empty — at least one character is needed");
  const most = s.scenes?.length ? 4 : 2;
  if (s.cast?.length > most) e.push(`cast has ${s.cast.length} people — at most 2 in one place${s.scenes?.length ? " and 4 in the whole story" : " (with scenes: up to 4 in the story, 2 per scene)"}`);
  if (s.scenes?.length && s.cast?.length > 2 && !s.inScene) e.push(`the story has ${s.cast.length} people: say who is in the first scene with "inScene" (at most 2)`);
  for (const [k, sc] of (s.scenes ?? []).entries()) if (s.cast?.length > 2 && !sc.cast) e.push(`scene ${k + 2} (at "${sc.at}"): the story has ${s.cast.length} people — list who is in this scene with "cast" (at most 2)`);
  const ids = (s.cast ?? []).map((c) => c.id);
  for (const c of s.cast ?? []) {
    one(c.look, LOOK_NAMES, `look of "${c.id}"`);
    if (c.prop && !["phone", "bag", "both"].includes(c.prop)) e.push(`prop "${c.prop}" of "${c.id}" is not available (phone, bag, both)`);
    const o = c.outfit;
    if (o) {
      for (const k of ["top", "bottom", "hair", "scarf", "skin", "shoes"] as const) if (o[k] !== undefined && !HEX.test(o[k]!)) e.push(`outfit.${k} of "${c.id}" must be a colour like "#3a7bd5"`);
      one(o.hairStyle, HAIR_NAMES, `outfit.hairStyle of "${c.id}"`);
      one(o.topKind, ["tee", "shirt", "hoodie"], `outfit.topKind of "${c.id}"`);
      one(o.bottomKind, ["pants", "shorts", "skirt"], `outfit.bottomKind of "${c.id}"`);
      one(o.sleeve, ["short", "long"], `outfit.sleeve of "${c.id}"`);
    }
  }
  const multi = !!s.scenes?.length;
  const startCheck = (start: Record<string, string> | undefined, e2: typeof env, where: string, cast: string[]) => {
    for (const [id, st] of Object.entries(start ?? {})) {
      if (!cast.includes(id)) e.push(`${where}start: "${id}" is not in ${where ? "this scene's" : "the"} cast (${cast.join(", ")})`);
      const named = [...Object.keys(e2.seats), ...Object.keys(e2.marks)];
      if (!["walk", "stand", "sit", "lie", "sitBed", ...named].includes(st)) e.push(`${where}start "${st}" for "${id}" is not available in ${e2.id} (walk, stand, sit${e2.bed ? ", lie, sitBed" : ""}; seats: ${Object.keys(e2.seats).join(", ") || "none"}; marks: ${Object.keys(e2.marks).join(", ")})`);
      if ((st === "lie" || st === "sitBed") && !e2.bed) e.push(`${where}start "${st}" for "${id}" needs a bed — only in: ${Object.values(ENVS).filter((x) => x.bed).map((x) => x.id).join(", ")}`);
      if (st === "walk" && !e2.path) e.push(`${where}start "walk" for "${id}": ${e2.id} has no walking path`);
    }
  };
  for (const id of s.inScene ?? []) if (!ids.includes(id)) e.push(`inScene: "${id}" is not in the cast`);
  startCheck(s.start, env, "", s.inScene ?? ids);
  for (const [k, sc] of (s.scenes ?? []).entries()) {
    const where = `scene ${k + 2} (at "${sc.at}"): `;
    const e2 = ENVS[sc.env];
    if (!e2) { e.push(`${where}env "${sc.env}" does not exist (use one of: ${Object.keys(ENVS).join(", ")})`); continue; }
    if (sc.time && !e2.times.includes(sc.time)) e.push(`${where}time "${sc.time}" is not available in ${sc.env} (use one of: ${e2.times.join(", ")})`);
    for (const id of sc.cast ?? []) if (!ids.includes(id)) e.push(`${where}cast "${id}" is not in the story's cast`);
    if (sc.cast && !sc.cast.length) e.push(`${where}cast is empty`);
    startCheck(sc.start, e2, where, sc.cast ?? ids);
  }
  const words = new Map<string, number>();
  for (const w of s.words ?? []) words.set(norm(w[0]), (words.get(norm(w[0])) ?? 0) + 1);
  const cue = (c: unknown, where: string) => {
    if (typeof c === "number") return;
    if (typeof c !== "string") { e.push(`${where}: cue must be a VO word or seconds`); return; }
    const [w, n] = c.split("#");
    const have = words.get(norm(w)) ?? 0;
    if (!have) e.push(`${where}: word "${w}" is not in the transcript (cues are spoken words, written without punctuation)`);
    else if (n && Number(n) >= have) e.push(`${where}: "${c}" — "${w}" is spoken only ${have}× (#0 … #${have - 1})`);
  };
  const verbs: readonly string[] = [...BLOCKING_VERBS, ...ACTING_VERBS];
  (s.beats ?? []).forEach((b, i) => {
    const where = `beat ${i + 1} (${b.do} at "${b.at}")`;
    cue(b.at, where);
    if (!verbs.includes(b.do)) e.push(`${where}: action "${b.do}" does not exist (see references/actions.md)`);
    for (const w of [b.who ?? []].flat()) if (!ids.includes(w)) e.push(`${where}: who "${w}" is not in the cast (${ids.join(", ")})`);
    if (b.target && !ids.includes(b.target)) e.push(`${where}: target "${b.target}" is not in the cast`);
    if (!multi && BED_ONLY.includes(b.do) && !env.bed) e.push(`${where}: "${b.do}" needs the bedroom`);
    if (!multi && (b.do === "pass" || b.do === "meet") && (!env.path || ids.length < 2)) e.push(`${where}: "${b.do}" needs two people and an environment with a path (campus)`);
    if (!multi && (b.do === "walk") && !env.path) e.push(`${where}: ${s.env} has no walking path`);
    if ((b.do === "eyeContact" || b.do === "highFive") && ids.length < 2) e.push(`${where}: "${b.do}" needs two people`);
    if ((b.do === "phone" || b.do === "bag") && !s.cast.some((c) => (c.prop === b.do || c.prop === "both") && [b.who ?? s.cast[0].id].flat().includes(c.id))) e.push(`${where}: give that person prop "${b.do}" (or "both") in cast`);
    one(b.shot, SHOT_NAMES, `${where}: shot`);
    one(b.face, Object.keys(EXPR), `${where}: face`);
    if (b.thought) { one(b.thought.icon, ICON_NAMES, `${where}: icon`); one(b.thought.vignette, VIGNETTE_NAMES, `${where}: vignette`); if (!b.thought.text && !b.thought.icon && !b.thought.vignette) e.push(`${where}: thought needs text, icon or vignette`); }
  });
  // blocking limits: a person walks only from the first frame (campus path) until stop / meet / after a pass
  for (const id of multi ? [] : ids) {
    const mine = (s.beats ?? []).filter((b) => (b.who ? [b.who].flat() : ["eyeContact", "pass", "meet", "highFive"].includes(b.do) ? ids : [ids[0]]).includes(id)).map((b) => b.do as string);
    const walks = s.start?.[id] ? s.start[id] === "walk" : mine.includes("pass") || mine.includes("meet") || (!!env.path && mine[0] === "walk");
    if (!walks && mine.some((v) => v === "walk" || v === "stop")) e.push(`"${id}" does not start walking, so "walk"/"stop" cannot be used — walking only starts at the beginning: make "walk" their first beat (campus) or set start.${id} = "walk"`);
    if (walks && mine.some((v) => v === "sitDown" || v === "standUp")) e.push(`"${id}" walks, so "sitDown"/"standUp" cannot be used — a person who sits starts at a seat (start.${id} = "sit" or "stand")`);
  }
  for (const [i, c] of (s.cards ?? []).entries()) { cue(c.at, `card ${i + 1}`); if (c.until !== undefined) cue(c.until, `card ${i + 1} until`); }
  for (const [k, sc] of (s.scenes ?? []).entries()) cue(sc.at, `scene ${k + 2}`);
  if (s.board) { if (!multi && !env.path) e.push("board needs the campus path"); cue(s.board.at, "board"); cue(s.board.until, "board until"); if (s.board.swap !== undefined) cue(s.board.swap, "board swap"); }
  if (s.tumbleweed) { if (!multi && !env.path) e.push("tumbleweed needs the campus path"); cue(s.tumbleweed.at, "tumbleweed"); cue(s.tumbleweed.until, "tumbleweed until"); }
  if (s.mood && !["playful", "warm", "tense", "calm"].includes(s.mood)) e.push(`mood "${s.mood}" is not available (playful, warm, tense, calm)`);
  return e;
};
