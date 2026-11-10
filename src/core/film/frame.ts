// Frame size and the two render presets every VOYNANN 3D film ships with.

export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Preview for approval, and the final deliverable (both 9:16). */
export const PRESETS = {
  preview: { width: WIDTH / 2, height: HEIGHT / 2, fps: 30 },
  final: { width: WIDTH, height: HEIGHT, fps: 60 },
} as const;
