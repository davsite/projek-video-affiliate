// Expression presets. Each is a full Face (gaze left at 0 — the performance aims the eyes).
// Names describe the feeling, not a topic, so any script can cast them.

import { FACE0, type Face } from "../pose.ts";

const f = (o: Partial<Face>): Face => ({ ...FACE0, ...o });

export const EXPR = {
  neutral: f({}),
  content: f({ smile: 0.35, squint: 0.3, lid: 0.92, browUp: 0.05 }),
  happy: f({ smile: 0.85, squint: 0.55, lid: 0.9, browUp: 0.3, open: 0.18, blush: 0.4 }),
  sleepy: f({ lid: 0.32, smile: 0.05, browUp: -0.1, squint: 0.2 }),
  asleep: f({ lid: 0, smile: 0.12, squint: 0.15, browUp: -0.1 }),
  asleepSmile: f({ lid: 0, smile: 0.42, squint: 0.35, browUp: 0.05, blush: 0.3 }),
  startled: f({ lid: 1.32, browUp: 1, browIn: 0.25, smile: -0.1, open: 0.12, squint: 0 }),
  alert: f({ lid: 1.14, browUp: 0.5, browIn: 0.2, smile: -0.05, squint: 0.05 }),
  thinking: f({ lid: 0.96, browUp: 0.25, browAsym: 0.7, browIn: 0.1, smile: -0.08, wide: -0.35 }),
  worried: f({ lid: 1.04, browUp: 0.45, browIn: 0.9, smile: -0.32, wide: -0.1, squint: 0.1 }),
  anxious: f({ lid: 1.12, browUp: 0.55, browIn: 1, smile: -0.45, open: 0.08, wide: 0.15, squint: 0.15 }),
  overwhelmed: f({ lid: 0.55, browUp: 0.2, browIn: 1, smile: -0.6, open: 0.22, wide: 0.55, squint: 0.6 }),
  dread: f({ lid: 1.2, browUp: 0.8, browIn: 1, smile: -0.55, open: 0.32, wide: 0.25 }),
  exhale: f({ lid: 0.35, browUp: 0.15, browIn: 0.3, smile: 0.0, open: 0.3, wide: -0.45, squint: 0.2 }),
  calm: f({ lid: 0.88, browUp: 0.05, browIn: 0.1, smile: 0.15, squint: 0.25 }),
  focused: f({ lid: 0.82, browUp: -0.15, browIn: -0.35, smile: 0.0, wide: -0.15, squint: 0.3 }),
  relieved: f({ lid: 0.8, browUp: 0.35, browIn: 0.35, smile: 0.45, squint: 0.4, blush: 0.2 }),
  embarrassed: f({ lid: 0.9, browUp: 0.4, browIn: 0.7, smile: -0.15, wide: 0.25, blush: 1 }),
  angry: f({ lid: 0.95, browUp: -0.6, browIn: -1, smile: -0.5, open: 0.2, wide: 0.4, squint: 0.35 }),
  laughing: f({ lid: 0.6, smile: 1, squint: 0.85, open: 0.55, wide: 0.4, browUp: 0.4 }),
  sad: f({ lid: 0.85, browUp: 0.3, browIn: 1, smile: -0.55, squint: 0.1 }),
  talk: f({ lid: 1, browUp: 0.3, smile: 0.2, open: 0.3 }),
  confused: f({ lid: 1.0, browUp: 0.35, browAsym: 0.85, browIn: 0.35, smile: -0.22, wide: -0.3, open: 0.06 }),
  surprised: f({ lid: 1.36, browUp: 1, browIn: 0.1, smile: 0.05, open: 0.42, wide: -0.2, squint: 0 }),
  shy: f({ lid: 0.85, browUp: 0.3, browIn: 0.5, smile: 0.3, squint: 0.35, blush: 1 }),
  proud: f({ lid: 0.9, browUp: 0.2, smile: 0.6, squint: 0.4 }),
} satisfies Record<string, Face>;

export type ExprName = keyof typeof EXPR;
