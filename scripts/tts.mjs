// Offline narration with the operating system's voice (only with the user's approval — it is a
// stand-in for a real voice-over). macOS: `say` (Indonesian voice "Damayanti"). Writes an MP3 and,
// because the text is known, the word timings too.
//   node scripts/tts.mjs <script.txt> <public/audio/<id>.mp3> --words=stories/<id>/words.json [--voice=Damayanti] [--rate=170]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [scriptFile, outMp3] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
if (!scriptFile || !outMp3) {
  console.error("usage: node scripts/tts.mjs <script.txt> <out.mp3> --words=stories/<id>/words.json [--voice=Damayanti] [--rate=170]");
  process.exit(1);
}
if (process.platform !== "darwin") {
  console.error("Built-in TTS is only wired for macOS (`say`). On other systems record or generate the voice-over elsewhere and use scripts/transcribe.mjs.");
  process.exit(2);
}
const voice = opt("voice", "Damayanti"), rate = opt("rate", "170");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-tts-"));
const aiff = path.join(tmp, "vo.aiff");
const r = spawnSync("say", ["-v", voice, "-r", rate, "-o", aiff, "-f", scriptFile], { encoding: "utf8" });
if (r.status !== 0) { console.error(r.stderr || `say failed (voice "${voice}" installed?)`); process.exit(3); }
fs.mkdirSync(path.dirname(outMp3), { recursive: true });
spawnSync("ffmpeg", ["-v", "error", "-y", "-i", aiff, "-af", "apad=pad_dur=0.2", "-ar", "44100", "-ac", "1", "-b:a", "160k", outMp3]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`tts: ${outMp3} (${voice}, rate ${rate})`);
const words = opt("words");
if (words) {
  const t = spawnSync("node", [path.join("scripts", "transcribe.mjs"), outMp3, `--out=${words}`, `--script=${scriptFile}`], { stdio: "inherit" });
  process.exit(t.status ?? 0);
}
