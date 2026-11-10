// Delivery master: measure integrated loudness, apply gain + a true limiter so the file
// lands at the target without clipping, copy the video stream untouched, then verify.
//   node scripts/deliver.mjs <in.mp4> <out.mp4> [targetLUFS=-14] [ceilingDb=-2]
// (loudnorm alone can't stop AAC inter-sample overshoot; a limiter before the encoder can.)

import { spawnSync } from "node:child_process";

const [input, output, targetArg = "-14", ceilArg = "-2"] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node scripts/deliver.mjs <in.mp4> <out.mp4> [targetLUFS] [ceilingDb]");
  process.exit(1);
}
const target = Number(targetArg);
const ceiling = 10 ** (Number(ceilArg) / 20);

const ffmpeg = (args) => {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
};

/** ebur128 prints its summary to stderr. */
const loudness = (file) => {
  const log = ffmpeg(["-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const s = log.slice(log.lastIndexOf("Summary"));
  return {
    I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)?.[1]),
    peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(s)?.[1]),
  };
};

const before = loudness(input);
let gain = target - before.I + 0.4; // the limiter shaves a little; aim slightly high
let after;
// Peaky voices make the limiter eat more than expected, so measure and correct (max 5 passes).
for (let pass = 1; pass <= 5; pass++) {
  ffmpeg([
    "-v", "error", "-y", "-i", input, "-c:v", "copy",
    "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=${ceiling.toFixed(3)}:level=false:attack=2:release=80,aresample=48000`,
    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", output,
  ]);
  after = loudness(output);
  if (Math.abs(after.I - target) <= 0.5) break;
  gain += 1.6 * (target - after.I); // the limiter absorbs part of every boost
}
const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_frames", "-of", "csv=p=0", output],
  { encoding: "utf8" },
).stdout.trim();
console.log(`in : ${before.I} LUFS, true peak ${before.peak} dBFS`);
console.log(`out: ${after.I} LUFS, true peak ${after.peak} dBFS (gain ${gain.toFixed(2)} dB)`);
console.log(`video: ${probe}`);
if (Math.abs(after.I - target) > 0.5) console.warn(`WARNING: integrated loudness ${after.I} LUFS is more than 0.5 LU from the ${target} LUFS target; report this honestly.`);
