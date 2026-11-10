// Full-frame 2D cards for storytelling beats: a cartoon "time skip" title card and a VHS-style rewind
// overlay. Laid out at 1080 × 1920; text comes from the topic.

import React from "react";
import { ease, remap } from "../../../core/motion/easing.ts";
import { FONT } from "../../../core/type/fonts.ts";

/** Bouncy title card over the shot (e.g. "5 DETIK KEMUDIAN…"). */
export const TitleCard: React.FC<{ t: number; t0: number; t1: number; text: string; sub?: string; top?: number }> = ({ t, t0, t1, text, sub, top = 300 }) => {
  if (t < t0 || t > t1) return null;
  const inK = ease.out(remap(t, t0, t0 + 0.3));
  const outK = 1 - ease.in(remap(t, t1 - 0.25, t1));
  const pop = 0.7 + 0.3 * inK + 0.06 * Math.sin(Math.min(1, (t - t0) / 0.5) * Math.PI);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", opacity: outK }}>
      <div style={{ transform: `scale(${pop}) rotate(${-3 + 1.5 * Math.sin(t * 2)}deg)`, background: "#ffd166", color: "#1d2a4d", fontFamily: FONT, fontWeight: 600, fontSize: 78, letterSpacing: "0.02em", padding: "22px 46px 26px", borderRadius: 30, border: "8px solid #1d2a4d", boxShadow: "0 14px 0 #1d2a4d, 0 24px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
        {text}
        {sub ? <div style={{ fontSize: 38, fontWeight: 500, marginTop: 6 }}>{sub}</div> : null}
      </div>
    </div>
  );
};

/** VHS rewind: scan lines, a rolling bar, ◀◀ icon. */
export const RewindOverlay: React.FC<{ t: number; t0: number; t1: number; label?: string }> = ({ t, t0, t1, label }) => {
  if (t < t0 || t > t1) return null;
  const a = ease.out(remap(t, t0, t0 + 0.12)) * (1 - ease.in(remap(t, t1 - 0.15, t1)));
  const bar = ((t - t0) * 1.7) % 1;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: a, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 3px, transparent 3px, transparent 7px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: `${bar * 100}%`, height: 90, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.22), transparent)" }} />
      <div style={{ position: "absolute", left: 70, top: 120, fontFamily: FONT, fontWeight: 600, fontSize: 96, color: "#ffffff", textShadow: "4px 4px 0 #ff4fa3, -4px -2px 0 #4fd8ff", opacity: Math.floor(t * 4) % 2 ? 1 : 0.65 }}>
        ◀◀ {label ?? ""}
      </div>
    </div>
  );
};
