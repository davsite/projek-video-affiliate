// Visual QA: bundle once, render chosen frames of a composition, tile them into a contact sheet.
//   node scripts/stills.mjs <outDir> <frame,frame,...> <compositionId> [scale]
// Frames may be given in seconds with an "s" suffix (e.g. 4.5s), using the composition's fps.

import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { glMode, isWebGLError, switchToSoftware, tolerateClosedTargets } from "./gl.mjs";

tolerateClosedTargets();

const [outDir, list, id, scaleArg = "1"] = process.argv.slice(2);
if (!outDir || !list || !id) {
  console.error("usage: node scripts/stills.mjs <outDir> <frame,frame,...|4.5s,...> <compositionId> [scale]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
// bundles are ~50 MB each; never leave them in the temp dir, even when a render throws
const cleanup = () => fs.rmSync(serveUrl, { recursive: true, force: true });
process.on("exit", cleanup);
const composition = await selectComposition({ serveUrl, id });
const frames = list.split(",").map((t) => (t.endsWith("s") ? Math.round(parseFloat(t) * composition.fps) : parseInt(t, 10)));
const files = [];
const renderAll = async (gl) => {
  // one browser for all stills: WebGL contexts are expensive to create and tear down
  const puppeteerInstance = await openBrowser("chrome", { chromiumOptions: { gl } });
  try {
    files.length = 0;
    for (const frame of frames) {
      const output = path.join(outDir, `f${String(frame).padStart(4, "0")}.png`);
      await renderStill({ composition, serveUrl, output, frame, scale: Number(scaleArg), chromiumOptions: { gl }, timeoutInMilliseconds: 180000, puppeteerInstance });
      files.push(output);
      process.stdout.write(`${frame} `);
    }
  } finally {
    // after a WebGL crash the tab may already be gone; closing must not hide the original error
    await puppeteerInstance.close({ silent: true }).catch(() => {});
  }
};
const gl = glMode();
try {
  await renderAll(gl);
} catch (e) {
  if (gl === "swangle" || !isWebGLError(e)) throw e;
  await renderAll(switchToSoftware());
}
console.log();
cleanup();

// contact sheet (needs ffmpeg; skipped if missing)
try {
  const w = Math.round(composition.width * Number(scaleArg)), h = Math.round(composition.height * Number(scaleArg));
  const cols = Math.min(4, files.length), rows = Math.ceil(files.length / cols), n = cols * rows;
  if (n > 1) {
    const inputs = files.flatMap((f) => ["-i", f]);
    const pads = Array.from({ length: n - files.length }, () => ["-f", "lavfi", "-i", `color=c=black:s=${w}x${h}`]).flat();
    const filter =
      Array.from({ length: n }, (_, i) => `[${i}:v]scale=${w}:${h},setsar=1[v${i}]`).join(";") + ";" +
      Array.from({ length: n }, (_, i) => `[v${i}]`).join("") +
      `xstack=inputs=${n}:layout=` + Array.from({ length: n }, (_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|") +
      `,scale='min(2160,iw)':-2`;
    execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, ...pads, "-filter_complex", filter, "-frames:v", "1", path.join(outDir, "_sheet.jpg")]);
    console.log(`sheet: ${path.join(outDir, "_sheet.jpg")}`);
  }
} catch {
  console.log("(contact sheet skipped: ffmpeg not available)");
}
// a render that failed on the GPU path leaves its timeout timer behind; do not wait for it
process.exit(0);
