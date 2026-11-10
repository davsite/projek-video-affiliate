// Word timings for a voice-over → JSON [[word, start, end], …] (VO seconds).
//   node scripts/transcribe.mjs <vo.mp3> --out=stories/<id>/words.json [--script=script.txt] [--lang=id]
//   node scripts/transcribe.mjs <any/path/vo.mp3> --id=<id> [--script=…]   copies the VO to public/audio/<id>.<ext>
//                                                                          and writes stories/<id>/words.json
//
// 1. whisper.cpp when available (WHISPER_CLI + WHISPER_MODEL, or `whisper-cli` on PATH with a model in
//    ~/.cache/whisper.cpp or ./models) — real word timings.
// 2. otherwise, with the script text: the VO's speech segments (silence detection) are matched to the
//    script's sentences and words are spread by length inside each segment — close enough for beats
//    and captions, not exact per word.
// Without whisper and without a script there is nothing to align: the script text must be provided.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
const id = opt("id");
if (id && !/^[a-z0-9-]+$/.test(id)) { console.error(`--id "${id}" must use only a-z, 0-9 and "-"`); process.exit(1); }
const out = opt("out") || (id ? `stories/${id}/words.json` : "");
if (file && fs.existsSync(file) && id) {
  const dst = path.join("public", "audio", `${id}${path.extname(file).toLowerCase() || ".mp3"}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (path.resolve(dst) !== path.resolve(file)) fs.copyFileSync(file, dst);
  console.log(`vo: ${dst}  →  story.json "vo": { "file": "${path.relative("public", dst)}", "offset": 0.4 }`);
}
if (!file || !fs.existsSync(file) || !out) {
  console.error("usage: node scripts/transcribe.mjs <vo.mp3> (--id=<id> | --out=stories/<id>/words.json) [--script=script.txt] [--lang=id]");
  process.exit(1);
}
const run = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 1 << 28 });
const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());

const findWhisper = () => {
  const home = os.homedir();
  const cands = [process.env.WHISPER_CLI, run("sh", ["-c", "command -v whisper-cli"]).stdout.trim(), "/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"].filter(Boolean);
  const cli = cands.find((c) => fs.existsSync(c));
  const modelDirs = [path.join(home, ".cache/whisper.cpp"), path.resolve("models"), "/opt/homebrew/share/whisper-cpp"];
  let model = process.env.WHISPER_MODEL && fs.existsSync(process.env.WHISPER_MODEL) ? process.env.WHISPER_MODEL : null;
  if (!model) for (const d of modelDirs) { if (!fs.existsSync(d)) continue; const m = fs.readdirSync(d).filter((f) => f.endsWith(".bin")).sort((a, b) => (b.includes("large") ? 1 : 0) - (a.includes("large") ? 1 : 0))[0]; if (m) { model = path.join(d, m); break; } }
  return cli && model ? { cli, model } : null;
};

let words = null, method = "";
const W = findWhisper();
if (W) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-vo-"));
  const wav = path.join(tmp, "vo16k.wav");
  run("ffmpeg", ["-v", "error", "-y", "-i", file, "-ar", "16000", "-ac", "1", wav]);
  run(W.cli, ["-m", W.model, "-f", wav, "-l", opt("lang", "id"), "-ml", "1", "-sow", "-ojf", "-of", path.join(tmp, "w")]);
  try {
    const j = JSON.parse(fs.readFileSync(path.join(tmp, "w.json"), "utf8"));
    words = j.transcription.map((s) => [s.text.trim(), s.offsets.from / 1000, s.offsets.to / 1000]).filter((w) => w[0]);
    method = `whisper.cpp (${path.basename(W.model)})`;
  } catch { words = null; }
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (!words) {
  const scriptFile = opt("script");
  if (!scriptFile || !fs.existsSync(scriptFile)) {
    console.error("No whisper.cpp found and no --script given. Provide the narration text (e.g. --script=stories/<id>/script.txt) or install whisper.cpp (see the skill's references/setup.md).");
    process.exit(2);
  }
  const text = fs.readFileSync(scriptFile, "utf8").replace(/\s+/g, " ").trim();
  // speech segments from silence detection
  const log = run("ffmpeg", ["-v", "info", "-i", file, "-af", "silencedetect=n=-38dB:d=0.18", "-f", "null", "-"]).stderr;
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const segs = [];
  let cur = 0;
  st.forEach((s, i) => { if (s - cur > 0.12) segs.push([cur, s]); cur = en[i] ?? duration; });
  if (duration - cur > 0.12) segs.push([cur, duration]);
  const toks = text.split(" ").filter(Boolean);
  // sentences / clauses = groups ending in punctuation; map groups to segments by cumulative length
  const total = toks.reduce((s, w) => s + w.length + 1, 0);
  const speech = segs.reduce((s, [a, b]) => s + (b - a), 0);
  // speech-time position for a fraction of the text, then into real time through the segments
  const toTime = (frac) => {
    let need = frac * speech;
    for (const [a, b] of segs) { if (need <= b - a) return a + need; need -= b - a; }
    return segs.length ? segs[segs.length - 1][1] : duration;
  };
  // snap clause ends to the nearest segment end when one is close
  let acc = 0;
  words = toks.map((w) => {
    const a = acc / total;
    acc += w.length + 1;
    const b = (acc - 1) / total;
    let t0 = toTime(a), t1 = toTime(b);
    if (/[.,?!;:]$/.test(w)) { const near = segs.map((s) => s[1]).reduce((best, e) => (Math.abs(e - t1) < Math.abs(best - t1) ? e : best), t1); if (Math.abs(near - t1) < 0.6) t1 = near; }
    return [w, +t0.toFixed(2), +Math.max(t0 + 0.08, t1).toFixed(2)];
  });
  // keep times monotonic
  for (let i = 1; i < words.length; i++) if (words[i][1] < words[i - 1][2]) words[i][1] = words[i - 1][2];
  method = `script aligned to ${segs.length} speech segments (approximate word timing)`;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(words.map(([w, a, b]) => [w, +a.toFixed(2), +b.toFixed(2)])));
console.log(`words: ${out} — ${words.length} words, ${duration.toFixed(2)} s, via ${method}`);
console.log(words.map(([w, a]) => `${a.toFixed(2)} ${w}`).join("  "));
