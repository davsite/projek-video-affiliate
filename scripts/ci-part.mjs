// Project helper (not part of the kit): renders one slice of a composition, so a long film can be split over parallel CI jobs.
//   node scripts/ci-part.mjs --comp=<id> --part=<i> --parts=<n> --out=<file.mp4> [--concurrency=2] [--crf=17]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { glMode, tolerateClosedTargets } from "./gl.mjs";

tolerateClosedTargets();
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ""}`).split("=").slice(1).join("=");
const comp = arg("comp"), out = arg("out"), i = Number(arg("part")), n = Number(arg("parts"));
const concurrency = Number(arg("concurrency", "2")), crf = Number(arg("crf", "17"));
if (!comp || !out || !Number.isInteger(i) || !n) { console.error("usage: node scripts/ci-part.mjs --comp=<id> --part=<i> --parts=<n> --out=<file.mp4>"); process.exit(1); }
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const gl = glMode();
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions: { gl } });
const N = composition.durationInFrames;
const a = Math.floor((N * i) / n), b = Math.floor((N * (i + 1)) / n) - 1;
fs.mkdirSync(path.dirname(out), { recursive: true });
const t0 = Date.now();
let shown = -1;
console.log(`part ${i + 1}/${n}: frames ${a}-${b} of ${N}, gl=${gl}, concurrency=${concurrency}`);
await renderMedia({
  composition, serveUrl, codec: "h264", crf, pixelFormat: "yuv420p", muted: true, frameRange: [a, b], outputLocation: out,
  concurrency, imageFormat: "jpeg", jpegQuality: 95, chromiumOptions: { gl }, timeoutInMilliseconds: 600000,
  onProgress: ({ progress, renderedFrames }) => {
    const q = Math.floor(progress * 20);
    if (q > shown) { shown = q; const s = (Date.now() - t0) / 1000; console.log(`  ${q * 5}%  ${renderedFrames} frames  ${s.toFixed(0)} s  ${(renderedFrames ? s / renderedFrames : 0).toFixed(2)} s/frame`); }
  },
});
console.log(`done: ${out} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
process.exit(0);
