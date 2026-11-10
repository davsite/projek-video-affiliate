// Imagined situations: tiny staged scenes that live inside thought bubbles. They are cast from the
// SAME character system (spec + presets + performance) in the "mini" material variant, so the lead is
// recognisable inside his own thoughts. Each vignette is built in a 1-unit stage (feet at y = 0,
// facing the viewer at +Z) and scaled into the bubble by Thoughts.tsx.
// Text on screens/phones comes from the topic (props), so the vignettes are reusable.

import React from "react";
import { PlaneGeometry } from "three";
import { Character } from "../character/Character.tsx";
import { perform, type Beat, type Performance } from "../character/performance.ts";
import { BIMA, BOSS, FRIEND, NAYA, RAKA, RAKA_OUT, type CharacterSpec } from "../character/spec.ts";
import { box, cached, cyl, sphere } from "../lib/geo.ts";
import { basic, phys } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";
import { labelTex } from "./icons.ts";

const perfs = new Map<string, Performance>();
const perf = (key: string, spec: CharacterSpec, x: number, z: number, yaw: number, beats: Omit<Beat, "at">[]): Performance => {
  let p = perfs.get(key);
  if (!p) {
    p = { spec, anchor: { x, y: 0, z, yaw }, beats: beats.map((b, i) => ({ at: i * 0.9, dur: 0.4, ...b })) };
    perfs.set(key, p);
  }
  return p;
};

const Mini: React.FC<{ p: Performance; t: number; seed: number }> = ({ p, t, seed }) => {
  const { pose } = perform(p, t, seed);
  return <Character pose={pose} spec={p.spec} t={t} variant="mini" shadows={false} />;
};

const plane = (w: number, h: number) => cached(`cfvplane${w},${h}`, () => new PlaneGeometry(w, h));

export type VignetteText = { speech?: string; screen?: string; phoneName?: string; phoneMsg?: string; phoneStatus?: string; clock?: string };
export type VignetteName = "talk" | "fail" | "late" | "seen" | "boss" | "laugh" | "friends" | "forgot" | "weird";
/** `a` = the thinker (default Raka), `b` = the other person (default a friend) */
export type Cast = { a?: CharacterSpec; b?: CharacterSpec };
type VP = { t: number; txt: VignetteText; cast?: Cast };

const Talk: React.FC<VP> = ({ t, txt }) => {
  const a = perf("talk-r", RAKA, -0.42, 0, 0.55, [{ body: "stand", armL: "explain", armR: "rest", face: "talk", look: [0.5, 1.5, 0] }]);
  const b = perf("talk-f", FRIEND, 0.42, 0, -0.55, [{ body: "stand", arms: "crossArms", face: "angry", look: [-0.5, 1.5, 0] }]);
  const sp = labelTex(`speech${txt.speech}`, 256, 160, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 50, 36);
    g.fill();
    g.beginPath();
    g.moveTo(60, h - 46); g.lineTo(40, h - 6); g.lineTo(100, h - 46);
    g.fill();
    g.fillStyle = "#e4572e";
    g.font = `600 70px ${FONT}, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(txt.speech ?? "!?", w / 2, (h - 40) / 2 + 6);
  });
  return (
    <group>
      <Mini p={a} t={t} seed={3} />
      <Mini p={b} t={t + 0.7} seed={4} />
      <mesh geometry={plane(0.55, 0.34)} material={basic(`cfspeech${txt.speech}`, { map: sp, transparent: true })} position={[-0.42, 2.05, 0.3]} />
    </group>
  );
};

const Fail: React.FC<VP> = ({ t, txt }) => {
  const a = perf("fail-r", RAKA, 0.05, 0.25, 0.2, [{ body: "standCower", armL: "coverMouth", armR: "rest", face: "dread" }]);
  const scr = labelTex(`screen${txt.screen}`, 512, 320, (g, w, h) => {
    g.fillStyle = "#f6f7fb";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d9dde6";
    g.lineWidth = 3;
    for (let y = 70; y < h; y += 50) { g.beginPath(); g.moveTo(30, y); g.lineTo(w - 30, y); g.stroke(); }
    g.strokeStyle = "#e5383b";
    g.lineWidth = 16;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(40, 80); g.lineTo(160, 130); g.lineTo(240, 110); g.lineTo(380, 250); g.lineTo(470, 280);
    g.stroke();
    g.fillStyle = "#1f2430";
    g.font = `600 46px ${FONT}, sans-serif`;
    g.fillText(txt.screen ?? "", 34, 50);
  });
  return (
    <group>
      <mesh geometry={box(1.5, 0.95, 0.06, 0.03)} material={phys("cfvscreenbody", { color: "#2c3038", roughness: 0.4 })} position={[0, 1.55, -0.35]} />
      <mesh geometry={plane(1.38, 0.84)} material={basic(`cfvscreen${txt.screen}`, { map: scr })} position={[0, 1.55, -0.315]} />
      <mesh geometry={cyl(0.03, 0.03, 1.05, 10)} material={phys("cfvstand", { color: "#5a5f6a" })} position={[0, 0.55, -0.37]} />
      <Mini p={a} t={t} seed={5} />
    </group>
  );
};

const Late: React.FC<VP> = ({ t, txt }) => {
  const a = perf("late-r", RAKA, 0.45, 0.2, -1.2, [{ body: "run", armL: "rest", armR: "rest", face: "dread" }]);
  const shake = Math.sin(t * 60) * 0.06;
  const face = labelTex(`clock${txt.clock}`, 256, 256, (g, w, h) => {
    g.fillStyle = "#fffaf0";
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e5383b";
    g.font = `600 64px ${FONT}, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(txt.clock ?? "08:47", w / 2, h / 2 + 4);
  });
  return (
    <group>
      <group position={[-0.35, 1.0, -0.1]} rotation={[0, 0, shake]}>
        <mesh geometry={cyl(0.48, 0.48, 0.22, 40)} material={phys("cfvclock", { color: "#e5383b", roughness: 0.35, clearcoat: 0.6 })} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={cached("cfvclockface", () => new PlaneGeometry(0.82, 0.82))} material={basic(`cfvclockface${txt.clock}`, { map: face, transparent: true })} position={[0, 0, 0.115]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={sphere(0.17, 20, 12, Math.PI * 2, Math.PI / 2)} material={phys("cfvbell", { color: "#f4c95d", metalness: 0.6, roughness: 0.3 })} position={[s * 0.33, 0.45, 0]} rotation={[0, 0, -s * 0.5]} />
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`l${s}`} geometry={cyl(0.04, 0.04, 0.25, 8)} material={phys("cfvclockleg", { color: "#2c3038" })} position={[s * 0.3, -0.5, 0]} rotation={[0, 0, s * 0.4]} />
        ))}
      </group>
      <Mini p={a} t={t} seed={6} />
    </group>
  );
};

const Seen: React.FC<VP> = ({ t, txt }) => {
  const a = perf("seen-r", RAKA, 0.48, 0.25, -0.5, [{ body: "standSlump", armL: "rest", armR: "chin", face: "worried", look: [-0.3, 1.2, 0] }]);
  const ui = labelTex(`phone${txt.phoneMsg}${txt.phoneStatus}`, 300, 560, (g, w, h) => {
    g.fillStyle = "#eef2f7";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#2b59c3";
    g.fillRect(0, 0, w, 80);
    g.fillStyle = "#fff";
    g.font = `600 30px ${FONT}, sans-serif`;
    g.fillText(txt.phoneName ?? "Dimas", 24, 52);
    g.fillStyle = "#c9f2c7";
    g.beginPath();
    g.roundRect(60, 200, w - 80, 110, 26);
    g.fill();
    g.fillStyle = "#1f2430";
    g.font = `500 26px ${FONT}, sans-serif`;
    const words = (txt.phoneMsg ?? "").split(" ");
    let line = "", y = 245;
    for (const wd of words) {
      if (g.measureText(line + wd).width > w - 120) { g.fillText(line, 80, y); line = ""; y += 34; }
      line += wd + " ";
    }
    g.fillText(line, 80, y);
    g.fillStyle = "#6b7280";
    g.font = `500 22px ${FONT}, sans-serif`;
    g.textAlign = "right";
    g.fillText(txt.phoneStatus ?? "Dibaca ✓✓", w - 24, 340);
    g.textAlign = "left";
    g.fillStyle = "#d4d8e0";
    g.beginPath();
    g.roundRect(24, 380, 120, 56, 26);
    g.fill();
    g.fillStyle = "#8a909c";
    for (const k of [0, 1, 2]) { g.beginPath(); g.arc(56 + k * 28, 408, 8, 0, Math.PI * 2); g.fill(); }
  });
  return (
    <group>
      <group position={[-0.35, 1.05, -0.05]} rotation={[0, 0.25, -0.06]}>
        <mesh geometry={box(0.62, 1.15, 0.07, 0.08)} material={phys("cfvphone", { color: "#1d1f24", roughness: 0.3, metalness: 0.5 })} />
        <mesh geometry={plane(0.56, 1.05)} material={basic(`cfvphoneui${txt.phoneMsg}`, { map: ui })} position={[0, 0, 0.037]} />
      </group>
      <Mini p={a} t={t} seed={7} />
    </group>
  );
};

const Boss: React.FC<VP> = ({ t }) => {
  const a = perf("boss-b", BOSS, -0.4, -0.1, 0.55, [{ body: "standProud", armL: "rest", armR: "point", face: "angry", look: [0.5, 1.0, 0.3] }]);
  const b = perf("boss-r", RAKA, 0.45, 0.25, -0.6, [{ body: "standCower", armL: "rest", armR: "rest", face: "embarrassed", look: [-0.4, 1.9, 0] }]);
  return (
    <group>
      <Mini p={a} t={t} seed={8} />
      <Mini p={b} t={t + 0.3} seed={9} />
    </group>
  );
};

const Laugh: React.FC<VP> = ({ t }) => {
  const c = perf("laugh-r", RAKA, 0, 0.3, 0, [{ body: "standSlump", armL: "rest", armR: "coverMouth", face: "embarrassed" }]);
  const a = perf("laugh-f", FRIEND, -0.55, -0.2, 0.6, [{ body: "stand", armL: "rest", armR: "point", face: "laughing", look: [0, 1.4, 0.3] }]);
  const b = perf("laugh-n", NAYA, 0.55, -0.2, -0.6, [{ body: "stand", armL: "coverMouth", armR: "rest", face: "laughing", look: [0, 1.4, 0.3] }]);
  const bob = (k: number) => Math.abs(Math.sin(t * 9 + k)) * 0.03;
  return (
    <group>
      <group position={[0, bob(0), 0]}><Mini p={a} t={t} seed={10} /></group>
      <group position={[0, bob(1.4), 0]}><Mini p={b} t={t + 0.4} seed={11} /></group>
      <Mini p={c} t={t} seed={12} />
    </group>
  );
};

const speechTex = (text: string, color: string) =>
  labelTex(`speech2${text}${color}`, 256, 160, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 50, 36);
    g.fill();
    g.beginPath();
    g.moveTo(60, h - 46); g.lineTo(40, h - 6); g.lineTo(100, h - 46);
    g.fill();
    g.fillStyle = color;
    g.font = `600 76px ${FONT}, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, (h - 40) / 2 + 6);
  });
const Speech: React.FC<{ text: string; color: string; at: [number, number, number] }> = ({ text, color, at }) => (
  <mesh geometry={plane(0.55, 0.34)} material={basic(`cfspeech2${text}${color}`, { map: speechTex(text, color), transparent: true })} position={at} />
);

/** The two of them back when they were close: a high five. */
const Friends: React.FC<VP> = ({ t, cast }) => {
  const A = cast?.a ?? RAKA_OUT, B = cast?.b ?? BIMA;
  const hi = { arm: { sw: 2.35, ab: 0.28, tw: 0, el: 0.25, wr: [0, 0, 0] as [number, number, number] }, hand: { curl: 0.05, index: 0.03, thumb: 0.1, spread: 0.5 } };
  const a = perf(`friends-a${A.id}`, A, -0.36, 0, Math.PI / 2, [{ body: "stand", armL: "rest", armR: hi, face: "laughing", look: [0.4, 1.5, 0] }]);
  const b = perf(`friends-b${B.id}`, B, 0.36, 0, -Math.PI / 2, [{ body: "stand", armL: hi, armR: "rest", face: "laughing", look: [-0.4, 1.5, 0] }]);
  return (
    <group>
      <Mini p={a} t={t} seed={13} />
      <Mini p={b} t={t + 0.2} seed={14} />
    </group>
  );
};

/** "Does he still remember me?" — he waves, the other one draws a blank. */
const Forgot: React.FC<VP> = ({ t, cast }) => {
  const A = cast?.a ?? RAKA_OUT, B = cast?.b ?? BIMA;
  const a = perf(`forgot-a${A.id}`, A, -0.42, 0.1, 0.6, [{ body: "stand", armL: "rest", armR: "wave", face: "happy", look: [0.5, 1.5, 0] }]);
  const b = perf(`forgot-b${B.id}`, B, 0.42, 0, -0.6, [{ body: "stand", armL: "rest", armR: "chin", face: { base: "thinking", add: { browUp: 0.7 } }, look: [-0.5, 1.5, 0.2] }]);
  return (
    <group>
      <Mini p={a} t={t} seed={15} />
      <Mini p={b} t={t + 0.5} seed={16} />
      <Speech text="?" color="#2b59c3" at={[0.5, 2.05, 0.3]} />
    </group>
  );
};

/** "Would it be weird if I said hi first?" — a huge wave, a baffled stare. */
const Weird: React.FC<VP> = ({ t, cast }) => {
  const A = cast?.a ?? BIMA, B = cast?.b ?? RAKA_OUT;
  const wave = (tt: number) => ({ arm: { sw: 0.35, ab: 1.05 + 0.22 * Math.sin(tt * 12), tw: 0.4, el: 1.5 + 0.2 * Math.sin(tt * 12 + 1), wr: [0, 0, 0] as [number, number, number] }, hand: { curl: 0.05, index: 0.03, thumb: 0.1, spread: 0.6 } });
  const a = perf(`weird-a${A.id}`, A, -0.42, 0.1, 0.6, [{ body: "standProud", armL: "rest", armR: wave, face: "laughing", look: [0.5, 1.5, 0] }]);
  const b = perf(`weird-b${B.id}`, B, 0.45, 0, -0.6, [{ body: "standCower", armL: "rest", armR: "rest", face: { base: "startled", add: { smile: -0.4 } }, look: [-0.5, 1.6, 0] }]);
  return (
    <group>
      <Mini p={a} t={t} seed={17} />
      <Mini p={b} t={t + 0.3} seed={18} />
      <Speech text="…?" color="#e4572e" at={[0.55, 2.0, 0.3]} />
    </group>
  );
};

export const VIGNETTES: Record<VignetteName, React.FC<VP>> = { talk: Talk, fail: Fail, late: Late, seen: Seen, boss: Boss, laugh: Laugh, friends: Friends, forgot: Forgot, weird: Weird };

export const Vignette: React.FC<{ name: VignetteName; t: number; txt: VignetteText; cast?: Cast }> = ({ name, t, txt, cast }) => {
  const V = VIGNETTES[name];
  return <V t={t} txt={txt} cast={cast} />;
};

