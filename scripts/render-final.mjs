// Final delivery, cross-platform and restartable: bundle once, render the composition muted in
// segments (finished segments are kept and skipped when re-run — delete out/seg after a source
// edit), join them, lay the voice-over in at its offset, then master the audio to -14 LUFS.
//   node scripts/render-final.mjs --comp=<id> --out=out/film.mp4 [--vo=public/audio/vo.mp3 --offset=0.4]
//                                 [--parts=3] [--concurrency=2] [--crf=17] [--seg=out/seg]
// Bounded concurrency + segments: one-pass high-concurrency 1080p renders have filled disks via swap.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { glMode, isWebGLError, switchToSoftware, tolerateClosedTargets } from "./gl.mjs";

tolerateClosedTargets();

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
const comp = arg("comp"), out = arg("out"), vo = arg("vo"), offset = Number(arg("offset", "0"));
const parts = Number(arg("parts", "3")), concurrency = Number(arg("concurrency", "2")), crf = Number(arg("crf", "17"));
if (!comp || !out) {
  console.error("usage: node scripts/render-final.mjs --comp=<id> --out=<file.mp4> [--vo=<audio> --offset=<s>] [--parts=3] [--concurrency=2]");
  process.exit(1);
}
const ff = (a) => {
  const r = spawnSync("ffmpeg", a, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
};
const segDir = arg("seg", path.join("out", "seg"));
fs.mkdirSync(segDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: comp });
const N = composition.durationInFrames;
const count = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim() || 0);
const list = [];
let gl = glMode();
for (let i = 0; i < parts; i++) {
  const a = Math.floor((N * i) / parts), b = Math.floor((N * (i + 1)) / parts) - 1;
  const part = path.join(segDir, `part${i}.mp4`);
  list.push(`file 'part${i}.mp4'`);
  if (fs.existsSync(part) && count(part) === b - a + 1) {
    console.log(`part ${i} (${a}-${b}) done, skipping`);
    continue;
  }
  console.log(`part ${i}: frames ${a}-${b}`);
  let shown = 0;
  const tmp = path.join(segDir, `part${i}.tmp.mp4`);
  const renderPart = () => renderMedia({
    composition, serveUrl, codec: "h264", crf, pixelFormat: "yuv420p", muted: true, frameRange: [a, b], outputLocation: tmp,
    concurrency, imageFormat: "jpeg", jpegQuality: 95, chromiumOptions: { gl }, timeoutInMilliseconds: 300000,
    // a line per quarter (a \r counter floods logs that are read by an agent)
    onProgress: ({ progress }) => { const q = Math.floor(progress * 4); if (q > shown) { shown = q; process.stdout.write(`  ${q * 25}%`); } },
  });
  try {
    await renderPart();
  } catch (e) {
    if (gl === "swangle" || !isWebGLError(e)) throw e;
    gl = switchToSoftware();
    await renderPart();
  }
  process.stdout.write("\n");
  fs.renameSync(tmp, part);
}
fs.rmSync(serveUrl, { recursive: true, force: true });
fs.writeFileSync(path.join(segDir, "list.txt"), list.join("\n") + "\n");
fs.mkdirSync(path.dirname(out), { recursive: true });
const dur = (N / composition.fps).toFixed(4);
const joined = path.join(segDir, "joined.mp4");
if (vo) {
  ff(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segDir, "list.txt"), "-i", vo, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", `adelay=${Math.round(offset * 1000)}:all=1,apad`, "-t", dur, "-c:a", "aac", "-b:a", "320k", "-ar", "48000", joined]);
  const r = spawnSync("node", [path.join("scripts", "deliver.mjs"), joined, out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  ff(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segDir, "list.txt"), "-c", "copy", "-movflags", "+faststart", out]);
}
fs.rmSync(segDir, { recursive: true, force: true });
console.log(`final: ${out} (${N} frames, ${composition.width}×${composition.height} @ ${composition.fps} fps)`);
// a part that failed on the GPU path leaves its timeout timer behind; do not wait for it
process.exit(0);
