// Automated QA of a rendered video. Writes out/<id>/qa/{qa.json, contact_1fps_001.jpg …, shots_start_mid_end.jpg}
// (the 1-fps contact sheet covers the whole video in pages of 96 seconds, each tile stamped with its second)
// and prints PASS/FAIL per check. The contact sheets are for the visual review that follows.
//   node scripts/qa.mjs <video.mp4> --vo=public/audio/x.mp3 --offset=0.4 --expect=49.8 [--shots=out/<id>/shots.json] [--final]
//                       [--size=1080x1920] [--from=12]   (--from: the video is a section starting at that film second)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
const final = args.includes("--final");
if (!video || !fs.existsSync(video)) { console.error("usage: node scripts/qa.mjs <video.mp4> --vo=… --offset=… --expect=… [--shots=…] [--final]"); process.exit(1); }
const run = (c, a) => spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 30 });
const qaDir = path.join(path.dirname(video), "qa");
fs.mkdirSync(qaDir, { recursive: true });
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok, detail }); console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`); };

// streams
const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", video]).stdout);
const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
const dur = Number(probe.format.duration), expect = Number(opt("expect", dur));
const [fn, fd] = v.r_frame_rate.split("/").map(Number);
const fps = fn / fd;
const [sw, shh] = opt("size", "1080x1920").split("x").map(Number);
const portraitV = shh > sw;
// previews are half size; finals must be the exact delivery size at 60 fps
const sizeOk = final ? v.width === sw && v.height === shh && Math.abs(fps - 60) < 0.01 : Math.abs(v.width / v.height - sw / shh) < 0.01;
check("video stream", v.codec_name === "h264" && sizeOk, `${v.codec_name} ${v.width}×${v.height} @ ${fps} fps${final ? ` (final must be ${sw}×${shh} @ 60)` : ` (${portraitV ? "portrait" : "landscape"} aspect)`}`);
check("audio stream", !!a && a.codec_name === "aac", a ? `${a.codec_name} ${a.sample_rate} Hz, ${Number(a.duration ?? dur).toFixed(2)} s` : "missing");
check("duration", Math.abs(dur - expect) < 0.12, `${dur.toFixed(2)} s (expected ${expect.toFixed(2)} s)`);
if (a) check("audio length = video length", Math.abs(Number(a.duration ?? dur) - dur) < 0.15, `${Number(a.duration ?? dur).toFixed(2)} vs ${dur.toFixed(2)} s`);

// frame scan: white / black / sudden flashes
const ylog = path.join(qaDir, "yavg.txt");
run("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=192:108,signalstats,metadata=mode=print:file=${ylog}`, "-f", "null", "-"]);
const ytxt = fs.readFileSync(ylog, "utf8");
const y = (ytxt.match(/YAVG=[\d.]+/g) ?? []).map((s) => Number(s.slice(5)));
// 90th percentile luma per frame (video range: black is 16) — a frame whose p90 stays ≤ 24 is practically black
const y90 = (ytxt.match(/YHIGH=[\d.]+/g) ?? []).map((s) => Number(s.slice(6)));
// black: the opening fade, scene fades and the end card may be dark on purpose — only long runs fail
const white = y.filter((x) => x > 225).length;
// blown highlights: share of the picture burnt to white (a lamp in close-up, bloom) — the mean luma misses it
const hlog = path.join(qaDir, "hot.txt");
// the middle of the frame (a bright sky at the top is not a lamp in the lens); video range: white is 235
run("ffmpeg", ["-v", "error", "-i", video, "-vf", `crop=iw*0.7:ih*0.6:iw*0.15:ih*0.2,scale=160:120,lutyuv=y='if(gt(val,222),255,0)',signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=${hlog}`, "-f", "null", "-"]);
const hot = (fs.readFileSync(hlog, "utf8").match(/YAVG=[\d.]+/g) ?? []).map((s) => Number(s.slice(5)) / 255);
let hr = 0, hotLongest = 0, hotAt = -1;
hot.forEach((x, i) => { hr = x > 0.12 ? hr + 1 : 0; if (hr > hotLongest) { hotLongest = hr; hotAt = (i - hr + 1) / fps; } });
let run0 = 0, longest = 0;
y.slice(Math.round(fps * 0.9), y.length - Math.round(fps * 1.2)).forEach((x) => { run0 = x < 7 ? run0 + 1 : 0; longest = Math.max(longest, run0); });
const black = longest > fps * 0.7 ? longest : 0;
check("no white frames", white === 0, `${white} frames with mean luma > 225`);
check("no blown-out highlights", hotLongest < fps * 0.5, hotLongest ? `${(hotLongest / fps).toFixed(1)} s with > 12 % of the middle of the picture burnt white (from ${(hotAt + Number(opt("from", 0))).toFixed(1)} s) — a lamp / bloom too close` : "none");
check("no black gaps (outside fades)", black === 0, `longest near-black run ${(longest / fps).toFixed(2)} s (fails above 0.7 s)`);
// frozen picture (a stuck render shows as identical frames)
const fz = run("ffmpeg", ["-v", "info", "-i", video, "-vf", "scale=320:180,freezedetect=n=0.0006:d=2.5", "-an", "-f", "null", "-"]).stderr;
const freezes = [...fz.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 1 && t < dur - 6);
check("no frozen picture", freezes.length === 0, freezes.length ? `frozen from ${freezes.map((t) => t.toFixed(1)).join(", ")} s` : "none (≥ 2.5 s)");
// loudness (final delivery is mastered to −14 LUFS, true peak ≤ −1 dBTP)
if (a) {
  const lu = run("ffmpeg", ["-v", "info", "-nostats", "-i", video, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
  const I = Number((lu.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  const TP = Number((lu.match(/Peak:\s+(-?[\d.]+) dBFS/g) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  check("loudness", !final || (Math.abs(I + 14) < 1.2 && TP <= -0.8), `${I.toFixed(1)} LUFS integrated, true peak ${TP.toFixed(1)} dBTP${final ? " (target −14 LUFS, ≤ −1 dBTP)" : ""}`);
}
const jumps = [];
for (let i = 1; i < y.length; i++) if (Math.abs(y[i] - y[i - 1]) > 45) jumps.push(+(i / fps).toFixed(2));
console.log(`  info  luma ${Math.min(...y).toFixed(0)}–${Math.max(...y).toFixed(0)}, big jumps (cuts) at ${jumps.join(", ") || "none"}`);

// VO sync: cross-correlate the film's audio with the VO around the expected offset
const voFile = opt("vo"), off0 = Number(opt("offset", 0)), section = opt("from") !== "";
// a section that starts after the VO has begun: compare with the VO from that point (expected lag 0)
const voSkip = Math.max(0, -off0), off = Math.max(0, off0);
if (voFile && fs.existsSync(voFile)) {
  const SR = 8000;
  const raw = (f, ss = 0) => { const r = spawnSync("ffmpeg", ["-v", "error", ...(ss ? ["-ss", ss.toFixed(3)] : []), "-i", f, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 }); return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4)); };
  const film = raw(video), vo = raw(voFile, voSkip);
  let best = -1, lag = 0;
  for (let L = Math.round((off - 0.25) * SR); L <= Math.round((off + 0.25) * SR); L++) {
    if (L < 0) continue;
    let s = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < vo.length && i + L < film.length; i += 3) { const p = vo[i], q = film[i + L]; s += p * q; e1 += p * p; e2 += q * q; }
    const c = s / Math.sqrt(e1 * e2 + 1e-12);
    if (c > best) { best = c; lag = L; }
  }
  const err = lag / SR - off;
  check("VO sync", Math.abs(err) < 0.03 && best > 0.6, `VO found at ${(lag / SR).toFixed(3)} s (expected ${off.toFixed(3)}, error ${(err * 1000).toFixed(0)} ms, correlation ${best.toFixed(2)})`);
  const voEnd = off + vo.length / SR;
  if (!section) check("VO not cut", voEnd <= dur + 0.02, `VO ends at ${voEnd.toFixed(2)} s, video ${dur.toFixed(2)} s`);
}

// contact sheets (portrait: tall tiles): one tile per second for the WHOLE video, 96 per page
// (contact_1fps_001.jpg, _002.jpg …), every tile stamped with its film second so nothing can be skipped unseen
const tw = portraitV ? 180 : 320, thh = portraitV ? 320 : 180;
const grid = portraitV ? [12, 8] : [8, 12], perPage = grid[0] * grid[1];
for (const f of fs.readdirSync(qaDir)) if (/^contact_1fps(_\d+)?\.jpg$/.test(f)) fs.rmSync(path.join(qaDir, f));
// a second stamp on each tile when this ffmpeg has drawtext (not every build does); the page ranges are always listed
const hasDrawtext = /drawtext/.test(run("ffmpeg", ["-hide_banner", "-filters"]).stdout ?? "");
const fontFile = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"].find((f) => fs.existsSync(f));
const t0s = Number(opt("from", 0));
const stamp = hasDrawtext && fontFile ? `,drawtext=fontfile='${fontFile}':text='%{eif\\:t+${t0s}\\:d}s':x=6:y=6:fontsize=${portraitV ? 22 : 20}:fontcolor=yellow:box=1:boxcolor=black@0.6` : "";
const sheetArgs = (sync) => ["-v", "error", "-y", "-i", video, "-vf", `fps=1,scale=${tw}:${thh}${stamp},tile=${grid[0]}x${grid[1]}`, ...sync, "-start_number", "1", path.join(qaDir, "contact_1fps_%03d.jpg")];
// one output image per full (or last, partial) page: -fps_mode on ffmpeg ≥ 5.1, -vsync on older builds
if (run("ffmpeg", sheetArgs(["-fps_mode", "passthrough"])).status !== 0) run("ffmpeg", sheetArgs(["-vsync", "0"]));
const pages = fs.readdirSync(qaDir).filter((f) => /^contact_1fps_\d+\.jpg$/.test(f)).sort();
const needPages = Math.max(1, Math.ceil(Math.floor(dur) / perPage));
const pageRanges = pages.map((f, i) => ({ file: f, from: Math.round(t0s + i * perPage), to: Math.round(t0s + Math.min(dur, (i + 1) * perPage)) }));
check("contact sheet covers the whole video", pages.length >= needPages, `${pages.length} page(s) of ${perPage} s for ${dur.toFixed(1)} s: ${pageRanges.map((p) => `${p.file} ${p.from}–${p.to} s`).join(", ")}${stamp ? "" : " (tiles not stamped: this ffmpeg has no drawtext — tiles run left→right, top→bottom, one per second)"}`);
const shotsFile = opt("shots");
const from = Number(opt("from", 0));
if (shotsFile && fs.existsSync(shotsFile)) {
  const { shots: all } = JSON.parse(fs.readFileSync(shotsFile, "utf8"));
  // shots of this video (a section: only those inside it, in video time)
  const shots = all.map((s) => ({ ...s, t0: Math.max(0, s.t0 - from), t1: Math.min(dur, s.t1 - from) })).filter((s) => s.t1 - s.t0 > 0.2);
  // phone readability: the middle of every shot must not sink into black (night ≠ unreadable)
  const dark = shots.filter((s) => { const i = Math.round(((s.t0 + s.t1) / 2) * fps); return y[i] !== undefined && y[i] < 22 && !(s.t0 < 1); });
  // a shot that is practically black for its whole length shows nothing on a phone (darkness needs a sliver of light)
  const black = shots.filter((s) => { if (s.t1 - s.t0 < 1.4 || s.t0 < 1 || s.t1 > dur - 1) return false; const a = Math.round((s.t0 + 0.3) * fps), b = Math.round((s.t1 - 0.3) * fps); const seg = y.slice(a, b); return seg.length && Math.max(...y90.slice(a, b)) <= 24; });
  check("readable on a phone (not too dark)", dark.length <= Math.max(1, Math.floor(shots.length * 0.15)) && black.length === 0, `${dark.length}/${shots.length} shots with mid-frame mean luma < 22${dark.length ? ` (at ${dark.map((s) => (s.t0 + from).toFixed(1)).join(", ")} s)` : ""}${black.length ? ` · ${black.length} practically black shot(s) at ${black.map((s) => (s.t0 + from).toFixed(1)).join(", ")} s` : ""}`);
  const tmp = path.join(qaDir, "tmp");
  fs.mkdirSync(tmp, { recursive: true });
  let n = 0;
  for (const s of shots) for (const f of [0.12, 0.5, 0.88]) {
    const t = Math.min(dur - 0.05, s.t0 + (s.t1 - s.t0) * f);
    run("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-vf", `scale=${tw}:${thh}`, path.join(tmp, `f${String(n++).padStart(3, "0")}.png`)]);
  }
  const cols = portraitV ? 9 : 6;
  run("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", path.join(tmp, "f*.png"), "-vf", `tile=${cols}x${Math.ceil(n / cols)}`, "-frames:v", "1", path.join(qaDir, "shots_start_mid_end.jpg")]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`  info  ${shots.length} shots sampled at start/middle/end → ${path.join(qaDir, "shots_start_mid_end.jpg")}`);
}
fs.writeFileSync(path.join(qaDir, "qa.json"), JSON.stringify({ video, duration: dur, fps, checks, cutsAt: jumps, contactSheets: pages, contactPages: pageRanges }, null, 1));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length ? `\nQA: ${failed.length} check(s) FAILED — fix before delivering` : `\nQA: all ${checks.length} automated checks passed — now review ${qaDir}/*.jpg`);
process.exit(failed.length ? 3 : 0);
