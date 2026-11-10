// WebGL renderer choice for headless Chrome, shared by every render script.
// Order: GL env var > the project's .gl-mode file > "angle" (GPU). When the GPU path cannot create a WebGL
// context (no GPU, some VMs/drivers), the scripts switch to "swangle" (software, much slower) automatically
// and remember it in .gl-mode, so later renders and `npx remotion render` (remotion.config.ts) use it too.
import fs from "node:fs";

const FILE = ".gl-mode";

// When the GPU path crashes, Remotion may reject an internal "Target closed" promise that nothing awaits.
// That rejection is noise from the dead tab, not a render failure; real errors still reach the caller.
export const tolerateClosedTargets = () =>
  process.on("unhandledRejection", (e) => {
    if (/Target closed/i.test(String(e?.message ?? e))) return;
    console.error(e);
    process.exit(1);
  });

export const glMode = () =>
  process.env.GL || (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").trim() : "") || "angle";

export const isWebGLError = (e) =>
  /webgl|WebGLRenderer|GL context|BindToCurrentSequence|GL_VENDOR = Disabled/i.test(String(e?.stack ?? e?.message ?? e));

export const switchToSoftware = () => {
  fs.writeFileSync(FILE, "swangle\n");
  console.log(
    "\n! GPU 3D rendering is not available on this computer: switched to software rendering (GL=swangle, much slower)." +
      "\n  Saved in .gl-mode; delete that file to try the GPU again.\n",
  );
  return "swangle";
};
