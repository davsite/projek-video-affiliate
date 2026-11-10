// The story spec — the ONLY thing written per video. The AI reads the voice-over transcript, splits it
// into visual beats and writes this JSON; the director (compile.ts) turns it into blocking, acting,
// props, thoughts, camera shots and sound cues. Cues are VO words ("lewat", "dia#1" = 2nd "dia") or
// film seconds. See references/story-format.md in the skill for the full guide and examples.

import type { V3 } from "../character/spec.ts";
import type { ExprName } from "../character/presets/expressions.ts";
import type { ShotKind } from "../camera/shots.ts";
import type { EnvId, TimeOfDay } from "../env/registry.ts";
import type { IconName } from "../fx/icons.ts";
import type { VignetteName } from "../fx/vignettes.tsx";
import type { BoardFace } from "../fx/comedy.tsx";
import type { Word } from "../timing/cues.ts";
import type { HairStyle, TopKind } from "../character/spec.ts";

export type CastLook = "raka" | "bima" | "naya" | "dimas" | "boss" | "sari" | "dinda" | "ibu" | "ayah" | "adit";
/** Optional changes to a look (colours as "#rrggbb"). */
export type Outfit = {
  top?: string; topKind?: TopKind; sleeve?: "short" | "long";
  bottom?: string; bottomKind?: "pants" | "shorts" | "skirt";
  hair?: string; hairStyle?: HairStyle; scarf?: string; glasses?: boolean; skin?: string; shoes?: string;
};
/** How someone starts a scene: walking the path, standing, seated, in bed — or the name of a seat / mark. */
export type StartAs = "walk" | "stand" | "sit" | "lie" | "sitBed" | (string & {});
/** A cut to another place at a VO cue (the story's own env / time / start are the first scene). */
export type Scene = { at: Cue; env: EnvId; time?: TimeOfDay; start?: Record<string, StartAs>; cast?: string[] };
export type Cue = string | number;

/** Blocking verbs move people; acting verbs play on top of whatever the body is doing. */
export const BLOCKING_VERBS = ["walk", "stop", "pass", "meet", "sitDown", "standUp", "turn", "lieDown", "sitUp"] as const;
export const ACTING_VERBS = [
  "idle", "talk", "explain", "point", "think", "confused", "happy", "laugh", "sad", "embarrassed", "surprised", "wave",
  "facepalm", "notice", "eyeContact", "phone", "bag", "lookBack", "highFive", "nod", "shake", "shrug", "overwhelmed",
  "calm", "smile", "proud", "shy", "lampOff", "lampOn",
] as const;
export type Verb = (typeof BLOCKING_VERBS)[number] | (typeof ACTING_VERBS)[number];

export type StoryBeat = {
  at: Cue;
  do: Verb;
  /** cast id(s); default: the first cast member (both for eyeContact / pass / meet / highFive) */
  who?: string | string[];
  /** another cast id to look at / wave at / point at / notice */
  target?: string;
  /** a thought bubble above `who` while the beat lasts */
  thought?: { text?: string; icon?: IconName; vignette?: VignetteName; cast?: [string, string] };
  /** override the automatic camera choice */
  shot?: ShotKind;
  /** override the expression */
  face?: ExprName;
};

export type Story = {
  id: string;
  title: string;
  /** VO file inside public/ and where it starts in the film (s) */
  vo: { file: string; offset?: number };
  /** transcript words (VO seconds), from scripts/transcribe.mjs */
  words: Word[];
  env: EnvId;
  time?: TimeOfDay;
  cast: { id: string; look: CastLook; prop?: "phone" | "bag" | "both"; outfit?: Outfit }[];
  /** how each person starts: walking the path, standing, seated, (bedroom) lying / sitting in bed, or a seat / mark name */
  start?: Record<string, StartAs>;
  /** who is in the first scene (default: everyone) */
  inScene?: string[];
  /** later places: each cuts to a new environment at its cue */
  scenes?: Scene[];
  beats: StoryBeat[];
  highlights?: string[];
  cards?: { at: Cue; until?: Cue; text: string }[];
  board?: { at: Cue; swap?: Cue; until: Cue; face1: BoardFace; face2?: BoardFace };
  tumbleweed?: { at: Cue; until: Cue };
  /** music baseline */
  mood?: "playful" | "warm" | "tense" | "calm";
  /** seconds of picture after the VO ends (default 1.8) */
  tail?: number;
};

export type { V3 };
