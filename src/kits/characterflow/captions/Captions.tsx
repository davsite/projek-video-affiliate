// Word-timed captions for 9:16. Chunks of ≤ 4 words, karaoke-style progression, highlighted phrases,
// and a placement per chunk (top or bottom band) chosen by the scene so captions never cover the face.
// Laid out at 1080 × 1920 overlay pixels.

import React from "react";
import { ease, remap } from "../../../core/motion/easing.ts";
import { FONT } from "../../../core/type/fonts.ts";
import type { Word } from "../timing/cues.ts";

export type CapWord = { text: string; t0: number; t1: number; hi: boolean };
export type Chunk = { words: CapWord[]; t0: number; t1: number };

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Split a transcript into caption chunks; `highlights` are phrases (any number of words). */
export const chunkWords = (words: Word[], offset: number, highlights: string[], maxWords = 4, maxChars = 24): Chunk[] => {
  const hiSet = new Set<number>();
  const keys = words.map((w) => norm(w[0]));
  for (const h of highlights) {
    const hw = h.split(/\s+/).map(norm);
    for (let i = 0; i + hw.length <= keys.length; i++) if (hw.every((x, k) => keys[i + k] === x)) for (let k = 0; k < hw.length; k++) hiSet.add(i + k);
  }
  const out: Chunk[] = [];
  let cur: CapWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ words: cur, t0: cur[0].t0, t1: cur[cur.length - 1].t1 });
    cur = [];
  };
  words.forEach(([text, a, b], i) => {
    const len = cur.reduce((s, w) => s + w.text.length + 1, 0) + text.length;
    // keep highlighted phrases together
    const inPhrase = hiSet.has(i) && i > 0 && hiSet.has(i - 1);
    if (cur.length && !inPhrase && (cur.length >= maxWords || len > maxChars)) flush();
    cur.push({ text, t0: offset + a, t1: offset + b, hi: hiSet.has(i) });
    if (/[.?!,]$/.test(text) && !(hiSet.has(i) && hiSet.has(i + 1))) flush();
  });
  flush();
  // merge single-word orphans into the previous chunk when it is short
  const merged: Chunk[] = [];
  for (const c of out) {
    const prev = merged[merged.length - 1];
    if (prev && c.words.length === 1 && prev.words.length < 4 && c.t0 - prev.t1 < 0.3 && !/[.?!]$/.test(prev.words[prev.words.length - 1].text)) {
      prev.words.push(...c.words);
      prev.t1 = c.t1;
    } else merged.push({ ...c, words: [...c.words] });
  }
  return merged;
};

export type Zone = "top" | "mid" | "bottom";
/** top edge of each caption band (px in the 1080×1920 frame) */
export const ZONE_TOP: Record<Zone, number> = { top: 250, mid: 860, bottom: 1350 };

export const Captions: React.FC<{ chunks: Chunk[]; t: number; zone: (c: Chunk) => Zone; accent?: string }> = ({ chunks, t, zone, accent = "#ffd25e" }) => {
  const idx = chunks.findIndex((c, i) => t >= c.t0 - 0.1 && t < (chunks[i + 1]?.t0 ?? c.t1 + 0.6) - 0.02 && t < c.t1 + 0.6);
  if (idx < 0) return null;
  const c = chunks[idx];
  const inK = ease.out(remap(t, c.t0 - 0.1, c.t0 + 0.12));
  const next = chunks[idx + 1];
  const outK = 1 - ease.in(remap(t, Math.min(c.t1 + 0.45, (next?.t0 ?? 999) - 0.12), Math.min(c.t1 + 0.6, (next?.t0 ?? 999) - 0.02)));
  const a = inK * outK;
  const z = zone(c);
  const top = ZONE_TOP[z];
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top, display: "flex", justifyContent: "center", opacity: a, transform: `translateY(${(1 - inK) * 18}px) scale(${0.96 + 0.04 * inK})` }}>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 64, lineHeight: 1.18, textAlign: "center", letterSpacing: "-0.01em", maxWidth: 900, padding: "14px 30px 18px", borderRadius: 28, background: "rgba(8,12,28,0.38)", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", backdropFilter: "blur(6px)" }}>
        {c.words.map((w, i) => {
          const said = t >= w.t0 - 0.03;
          const cur = said && t < w.t1 + 0.05;
          const pop = w.hi ? 1 + 0.05 * ease.out(remap(t, w.t0 - 0.03, w.t0 + 0.12)) * (1 - ease.inOut(remap(t, w.t1, w.t1 + 0.35))) : 1;
          return (
            <React.Fragment key={i}>
            <span style={{ display: "inline-block", transform: `scale(${pop})`, margin: w.hi ? "0 0.06em" : undefined, color: w.hi && said ? accent : "#ffffff", opacity: said ? 1 : 0.42, textShadow: w.hi && said ? `0 0 26px ${accent}88, 0 3px 10px rgba(0,0,0,0.6)` : "0 3px 10px rgba(0,0,0,0.6)", fontWeight: w.hi ? 600 : cur ? 600 : 500 }}>
              {w.text}
            </span>
            {i < c.words.length - 1 ? " " : ""}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
