// Environment check before any VOYNANN render. Prints a plain report and exits non-zero only
// when something required is missing. Installs nothing.
//   node scripts/check-env.mjs

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const rows = [];
const add = (name, ok, detail, required = true) => rows.push({ name, ok, detail, required });

const [maj, min] = process.versions.node.split(".").map(Number);
add("Node.js ≥ 22.13", maj > 22 || (maj === 22 && min >= 13), `found ${process.versions.node}`);

const has = (cmd, args = ["-version"]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.status === 0 ? (r.stdout || r.stderr).split("\n")[0].trim() : null;
};
const npmV = has(process.platform === "win32" ? "npm.cmd" : "npm", ["-v"]);
add("npm", !!npmV, npmV ?? "not found");
const ff = has("ffmpeg");
add("ffmpeg (audio analysis, contact sheets, final audio)", !!ff, ff ? ff.slice(0, 60) : "not found — rendering still works, VO analysis/delivery does not");
const fp = has("ffprobe");
add("ffprobe", !!fp, fp ? "ok" : "not found");

// optional: real word timings (whisper.cpp) and offline narration (macOS `say`)
const whisperCli = [process.env.WHISPER_CLI, spawnSync("sh", ["-c", "command -v whisper-cli"], { encoding: "utf8" }).stdout?.trim(), "/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"].filter(Boolean).find((c) => fs.existsSync(c));
const modelDirs = [`${os.homedir()}/.cache/whisper.cpp`, "models", "/opt/homebrew/share/whisper-cpp"];
const whisperModel = (process.env.WHISPER_MODEL && fs.existsSync(process.env.WHISPER_MODEL) && process.env.WHISPER_MODEL) || modelDirs.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".bin")).map((f) => `${d}/${f}`) : []))[0];
add("whisper.cpp (exact word timing from any VO)", !!(whisperCli && whisperModel), whisperCli && whisperModel ? `${whisperCli} + ${whisperModel.split("/").pop()}` : `${whisperCli ? "model" : "whisper-cli"} not found — without it the VO script text is needed (timing ≈0.3 s less precise)`, false);
const say = process.platform === "darwin" && spawnSync("say", ["-v", "?"], { encoding: "utf8" }).stdout?.includes("id_ID");
add("Offline Indonesian narration (macOS say, voice Damayanti)", !!say, say ? "available (used only with the user's approval)" : "not available — bring a recorded VO", false);

let freeGb = null;
try {
  const st = fs.statfsSync(process.cwd());
  freeGb = (st.bavail * st.bsize) / 1e9;
} catch {}
add("Free disk ≥ 5 GB", freeGb === null ? true : freeGb >= 5, freeGb === null ? "unknown" : `${freeGb.toFixed(1)} GB free`);
add("RAM", true, `${(os.totalmem() / 1e9).toFixed(0)} GB total`, false);

const plat = { darwin: "macOS (recommended)", win32: "Windows: run npm run smoke to confirm 3D rendering", linux: "Linux: run npm run smoke; without a GPU use GL=swangle (slow)" }[process.platform] ?? process.platform;
add("Platform", true, plat, false);

const deps = fs.existsSync("node_modules/remotion") && fs.existsSync("node_modules/three");
add("Project packages installed (npm ci)", deps, deps ? "ok" : "run: npm ci", false);
let browser = false;
try {
  browser = fs.readdirSync("node_modules/.remotion").some((d) => d.includes("chrome"));
} catch {}
add("Remotion headless browser downloaded", browser, browser ? "ok" : "downloads automatically on first render (~100–200 MB)", false);

for (const r of rows) console.log(`${r.ok ? "✓" : r.required ? "✗" : "!"} ${r.name}: ${r.detail}`);
const missing = rows.filter((r) => r.required && !r.ok);
console.log(missing.length ? `\n${missing.length} required item(s) missing.` : "\nReady.");
process.exit(missing.length ? 1 : 0);
