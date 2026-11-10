// Project helper (not part of the kit): joins the CI slices, lays in the film's mix, masters to −14 LUFS and runs the kit's QA.
//   node scripts/ci-join.mjs --id=<id> --parts-dir=<dir> --count=<n> --mix=public/audio/<id>-final-mix.wav --vo=public/audio/<id>.mp3
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
const id = arg("id"), dir = arg("parts-dir"), count = Number(arg("count")), vo = arg("vo"), mix = arg("mix");
const sh = (c, a) => { const r = spawnSync(c, a, { stdio: "inherit" }); if (r.status !== 0) { console.error(`✗ ${c} ${a.join(" ")}`); process.exit(r.status ?? 1); } };
const outDir = path.join("out", id);
const { duration, voOffset } = JSON.parse(fs.readFileSync(path.join(outDir, "shots.json"), "utf8"));
const files = Array.from({ length: count }, (_, i) => path.resolve(dir, `part${i}.mp4`));
const missing = files.filter((f) => !fs.existsSync(f));
if (missing.length) { console.error(`✗ missing parts: ${missing.join(", ")}`); process.exit(1); }
const list = path.resolve(dir, "list.txt");
fs.writeFileSync(list, files.map((f) => `file '${f}'`).join("\n") + "\n");
const joined = path.resolve(dir, "joined.mp4"), video = path.join(outDir, `${id}_1080x1920_60fps.mp4`);
sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "apad", "-t", duration.toFixed(4), "-c:a", "aac", "-b:a", "320k", "-ar", "48000", joined]);
sh("node", ["scripts/deliver.mjs", joined, video]);
sh("node", ["scripts/qa.mjs", video, `--vo=${vo}`, `--offset=${voOffset}`, `--expect=${duration}`, `--shots=${path.join(outDir, "shots.json")}`, "--final"]);
console.log(`✓ ${video}`);
