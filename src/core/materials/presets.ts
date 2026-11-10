// Starting points for physically plausible materials (MatState, see sweep.ts). Tune per brief —
// these are recipes that read correctly under the bright studio, not a finished look.
// Use them with `plainMaterial()` + `applyMat()` (any mesh) or `sweepMaterial()` (Slab meshes).

import { mat, type MatState } from "./sweep.ts";

export const MATERIALS = {
  /** Injection-moulded plastic, slightly satin (1990s devices, appliances). */
  mattePlastic: (color = "#2b2a28") => mat(color, { rough: 0.62, sheen: 0.35 }),
  /** Glossy painted plastic or lacquer. */
  glossPlastic: (color = "#f1efea") => mat(color, { rough: 0.32, cc: 0.6, ccRough: 0.12 }),
  /** Brushed / anodised aluminium. */
  aluminium: (color = "#c7c9cc") => mat(color, { rough: 0.33, metal: 1, aniso: 0.5 }),
  /** Polished steel or chrome trim (use sparingly: needs the softbox reflections to read). */
  polishedMetal: (color = "#d9dadc") => mat(color, { rough: 0.12, metal: 1 }),
  /** Pearl ceramic / premium matte-gloss shell. */
  ceramic: (color = "#efece6") => mat(color, { rough: 0.45, cc: 0.6, ccRough: 0.2 }),
  /** Dark cover glass over a display. */
  darkGlass: (color = "#0b0d10") => mat(color, { rough: 0.05, cc: 1, ccRough: 0.02 }),
  /** Rubber, silicone, gaskets. */
  rubber: (color = "#2a2b2d") => mat(color, { rough: 0.85 }),
  /** Matte card / paper (PAPERWORLD-like; add edge thickness in geometry). */
  paper: (color = "#f2ebdd") => mat(color, { rough: 0.95, sheen: 0.15 }),
  /** Raw architectural concrete. */
  concrete: (color = "#c9c5bd") => mat(color, { rough: 0.9 }),
  /** Natural oiled wood. */
  wood: (color = "#b88a5c") => mat(color, { rough: 0.6, sheen: 0.2 }),
} satisfies Record<string, (c?: string) => MatState>;
