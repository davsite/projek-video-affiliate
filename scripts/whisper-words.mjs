// Project helper (not part of the kit): exact word timing from whisper.cpp, keeping the words of the script.
//   WHISPER_CLI=… WHISPER_MODEL=… node scripts/whisper-words.mjs <vo> <script.txt> <out words.json>
// Whisper may spell a word differently, so its timings are mapped onto the script with a sequence alignment; words it
// missed are spread between their neighbours, and no word may start or end inside a measured silence.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [vo, scriptFile, out] = process.argv.slice(2);
const { WHISPER_CLI: cli, WHISPER_MODEL: model } = process.env;
if (!vo || !scriptFile || !out || !cli || !model) { console.error("usage: WHISPER_CLI=… WHISPER_MODEL=… node scripts/whisper-words.mjs <vo> <script.txt> <out.json>"); process.exit(1); }
const run = (c, a) => {
  const r = spawnSync(c, a, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
  return r;
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vo-"));
const wav = path.join(tmp, "vo.wav");
run("ffmpeg", ["-v", "error", "-y", "-i", vo, "-ar", "16000", "-ac", "1", wav]);
const text = fs.readFileSync(scriptFile, "utf8").replace(/\s+/g, " ").trim();
// no --prompt: with the script as prompt, whisper echoed it over the first 30-second window and the timings collapsed there
run(cli, ["-m", model, "-f", wav, "-l", "id", "-ml", "1", "-sow", "-ojf", "-of", path.join(tmp, "w")]);
const W = JSON.parse(fs.readFileSync(path.join(tmp, "w.json"), "utf8")).transcription.map((s) => ({ w: s.text.trim(), a: s.offsets.from / 1000, b: s.offsets.to / 1000 })).filter((x) => x.w);

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const S = text.split(" ").filter(Boolean);
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const sim = (a, b) => { const m = Math.max(a.length, b.length); return m ? 2 * (1 - lev(a, b) / m) - 1 : 0; };
const ns = S.map(norm), nw = W.map((x) => norm(x.w));
const GAP = -0.55;
const dp = Array.from({ length: ns.length + 1 }, () => new Float64Array(nw.length + 1));
const bk = Array.from({ length: ns.length + 1 }, () => new Int8Array(nw.length + 1));
for (let i = 1; i <= ns.length; i++) { dp[i][0] = i * GAP; bk[i][0] = 1; }
for (let j = 1; j <= nw.length; j++) { dp[0][j] = j * GAP; bk[0][j] = 2; }
for (let i = 1; i <= ns.length; i++) for (let j = 1; j <= nw.length; j++) {
  const m = dp[i - 1][j - 1] + sim(ns[i - 1], nw[j - 1]), u = dp[i - 1][j] + GAP, l = dp[i][j - 1] + GAP;
  dp[i][j] = Math.max(m, u, l);
  bk[i][j] = dp[i][j] === m ? 0 : dp[i][j] === u ? 1 : 2;
}
const map = Array(S.length).fill(-1);
for (let i = S.length, j = W.length; i > 0 || j > 0;) {
  const b = bk[i][j];
  if (b === 0) { if (sim(ns[i - 1], nw[j - 1]) > -0.2) map[i - 1] = j - 1; i--; j--; }
  else if (b === 1) i--;
  else j--;
}
const syl = (w) => Math.max(1, (norm(w).match(/[aiueo]+/g) ?? []).length) + 0.25;
const words = S.map((w, i) => (map[i] >= 0 ? [w, W[map[i]].a, W[map[i]].b] : [w, null, null]));
for (let i = 0; i < words.length;) {
  if (words[i][1] !== null) { i++; continue; }
  let e = i;
  while (e < words.length && words[e][1] === null) e++;
  const from = i ? words[i - 1][2] : 0, to = e < words.length ? words[e][1] : W[W.length - 1].b;
  const tot = words.slice(i, e).reduce((s, x) => s + syl(x[0]), 0);
  let t = from;
  for (let k = i; k < e; k++) { const d = ((to - from) * syl(words[k][0])) / tot; words[k][1] = t; words[k][2] = t + d; t += d; }
  i = e;
}
const log = spawnSync("ffmpeg", ["-v", "info", "-nostats", "-i", vo, "-af", "silencedetect=n=-40dB:d=0.16", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr;
const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1])), en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
for (const w of words) st.forEach((a, i) => { const b = en[i] ?? a; if (w[1] >= a && w[1] < b && w[2] > b) w[1] = b; if (w[2] > a && w[2] <= b && w[1] < a) w[2] = a; });
for (let i = 1; i < words.length; i++) if (words[i][1] < words[i - 1][2]) words[i - 1][2] = Math.max(words[i - 1][1] + 0.04, words[i][1]);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(words.map(([w, a, b]) => [w, +a.toFixed(2), +b.toFixed(2)])));
console.log(`words: ${out} — ${S.length} script words, ${W.length} whisper words, ${map.filter((x) => x >= 0).length} matched`);
console.log(words.map(([w, a]) => `${a.toFixed(2)} ${w}`).join("  "));
