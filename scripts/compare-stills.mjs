// Regression check for refactors: compare two folders of stills (same file names).
// WebGL renders are not bit-exact run to run: re-rendering the same frame with the same code
// measured 52.0–75.6 dB PSNR depending on the frame (GPU/AO noise, a few pixels off by up to
// ~10 levels). A frame passes when it is pixel-identical or its PSNR is at least the threshold
// (default 50 dB). This guards against visible regressions only; to prove a refactor changes
// nothing, compare film state numerically with scripts/snapshot-state.mjs.
//   node scripts/compare-stills.mjs <dirA> <dirB> [minPsnrDb=50]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [a, b, minArg = "50"] = process.argv.slice(2);
const min = Number(minArg);
if (!a || !b) {
  console.error("usage: node scripts/compare-stills.mjs <dirA> <dirB>");
  process.exit(1);
}
const md5 = (f) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "framemd5", "-"], { encoding: "utf8" });
  return r.stdout.trim().split("\n").pop().split(",").pop().trim();
};
const psnr = (x, y) => {
  const r = spawnSync("ffmpeg", ["-v", "info", "-i", x, "-i", y, "-filter_complex", "psnr", "-f", "null", "-"], { encoding: "utf8" });
  return /average:(\S+)/.exec(r.stderr)?.[1] ?? "?";
};
const files = fs.readdirSync(a).filter((f) => f.endsWith(".png")).sort();
let diff = 0;
for (const f of files) {
  const fb = path.join(b, f);
  if (!fs.existsSync(fb)) {
    console.log(`${f}: missing in ${b}`);
    diff++;
    continue;
  }
  if (md5(path.join(a, f)) === md5(fb)) {
    console.log(`${f}: identical`);
    continue;
  }
  const db = psnr(path.join(a, f), fb);
  const ok = db === "inf" || Number(db) >= min;
  if (!ok) diff++;
  console.log(`${f}: ${ok ? "within render noise" : "CHANGED"} (PSNR ${db} dB)`);
}
console.log(`${files.length - diff}/${files.length} pass (threshold ${min} dB)`);
process.exit(diff ? 2 : 0);
