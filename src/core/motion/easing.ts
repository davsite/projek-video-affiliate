// PRECISION easing vocabulary. Every curve is a pure function of normalised time, so the
// whole film stays deterministic: same frame in, same pose out.

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const remap = (x: number, a: number, b: number) => clamp((x - a) / (b - a));

export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

/** C2-continuous: zero velocity and acceleration at both ends. The house curve. */
export const smootherstep = (t: number) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** CSS-style cubic bezier easing (x1,y1,x2,y2), solved by Newton + bisection. */
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    const X = clamp(x);
    let t = X;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - X;
      const d = dx(t);
      if (Math.abs(e) < 1e-6) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = X;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - X) < 1e-6) break;
      if (v < X) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
};

// Named curves, tuned for product cinematography (long, confident tails; no bounce).
export const ease = {
  /** Default move: decisive start, very long settle. */
  glide: bezier(0.45, 0, 0.12, 1),
  /** Symmetric, weighty. Camera and large objects. */
  inOut: bezier(0.65, 0, 0.35, 1),
  /** Soft symmetric for subtle drifts. */
  sine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t)),
  /** Starts with energy (a magnet letting go), long deceleration. */
  release: bezier(0.2, 0.7, 0.1, 1),
  /** Gathers speed and arrives fast (magnetic pull into a dock). */
  attract: bezier(0.55, 0, 0.95, 0.55),
  /** Typographic reveal. */
  type: bezier(0.2, 0, 0, 1),
  out: bezier(0, 0, 0.2, 1),
  in: bezier(0.6, 0, 1, 1),
  smoother: smootherstep,
};

/** Eased progress of `frame` through [start, end]. */
export const seg = (frame: number, start: number, end: number, curve: (t: number) => number = ease.inOut) =>
  curve(remap(frame, start, end));

/**
 * Critically damped settle used after a mechanical stop: decays to zero with at most one
 * tiny overshoot. `t` in frames since the stop, `amp` the initial offset.
 */
export const settle = (t: number, amp: number, freq = 0.11, damping = 0.16) =>
  t <= 0 ? 0 : amp * Math.exp(-damping * t) * Math.cos(freq * t * Math.PI);
