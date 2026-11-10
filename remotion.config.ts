// See all configuration options: https://remotion.dev/docs/config
import fs from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// WebGL film: GPU-backed ANGLE path in headless Chrome, or software "swangle" when scripts/gl.mjs found
// no usable GPU on this computer (remembered in .gl-mode). The GL env var overrides both.
type GL = Parameters<typeof Config.setChromiumOpenGlRenderer>[0];
const gl = (process.env.GL || (fs.existsSync(".gl-mode") ? fs.readFileSync(".gl-mode", "utf8").trim() : "") || "angle") as GL;
Config.setChromiumOpenGlRenderer(gl);
