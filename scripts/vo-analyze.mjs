// Read the real timing of a voice-over: duration, pauses and phrases (stretches of speech between
// pauses). Optional word timings when whisper.cpp is available (set WHISPER_CLI and WHISPER_MODEL).
// Write cuts in VO seconds from this output — never from a guessed script length.
//   node scripts/vo-analyze.mjs public/audio/vo.mp3 [--noise=-38] [--pause=0.25] [--lang=id]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=")[1];
if (!file || !fs.existsSync(file)) {
  console.error("usage: node scripts/vo-analyze.mjs <audio.mp3|wav> [--noise=-38] [--pause=0.25] [--lang=id]");
  process.exit(1);
}
const run = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8" });
const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.trim());
const log = run("ffmpeg", ["-v", "info", "-i", file, "-af", `silencedetect=n=${opt("noise", -38)}dB:d=${opt("pause", 0.25)}`, "-f", "null", "-"]).stderr;
const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const pauses = starts.map((s, i) => ({ start: s, end: ends[i] ?? duration }));
// phrases = speech between pauses
const phrases = [];
let cur = 0;
for (const p of pauses) {
  if (p.start - cur > 0.15) phrases.push({ start: +cur.toFixed(2), end: +p.start.toFixed(2) });
  cur = p.end;
}
if (duration - cur > 0.15) phrases.push({ start: +cur.toFixed(2), end: +duration.toFixed(2) });

let words = null;
const cli = process.env.WHISPER_CLI, model = process.env.WHISPER_MODEL;
if (cli && model && fs.existsSync(cli) && fs.existsSync(model)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vo-"));
  const wav = path.join(tmp, "vo16k.wav");
  run("ffmpeg", ["-v", "error", "-y", "-i", file, "-ar", "16000", "-ac", "1", wav]);
  run(cli, ["-m", model, "-f", wav, "-l", opt("lang", "id"), "-ml", "1", "-sow", "-ojf", "-of", path.join(tmp, "w")]);
  try {
    const j = JSON.parse(fs.readFileSync(path.join(tmp, "w.json"), "utf8"));
    words = j.transcription.map((s) => ({ t: s.offsets.from / 1000, w: s.text.trim() })).filter((x) => x.w);
  } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}

const out = { file, duration: +duration.toFixed(3), firstSpeech: phrases[0]?.start ?? 0, pauses, phrases, words };
const json = file.replace(/\.[^.]+$/, "") + ".timing.json";
fs.writeFileSync(json, JSON.stringify(out, null, 2));
console.log(`duration ${out.duration} s · speech starts ${out.firstSpeech} s · ${phrases.length} phrases · ${pauses.length} pauses${words ? ` · ${words.length} words` : ""}`);
for (const p of phrases) console.log(`  ${p.start.toFixed(2).padStart(7)} – ${p.end.toFixed(2).padStart(7)} s`);
console.log(`timing: ${json}`);
