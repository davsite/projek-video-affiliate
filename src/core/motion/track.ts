// Keyframe tracks with C1 continuity. Interior keys pass through with Catmull-Rom tangents
// (so a camera never "kinks" when one move hands over to the next); `hold` keys and the
// ends get zero tangents (a soft ease in/out). Tangents are clamped Fritsch–Carlson style
// so a curve never overshoots its keys — no accidental bounces.

/**
 * `m` overrides the tangent (units per frame), e.g. to arrive at speed for a magnetic snap;
 * `stop` makes the key an impact: it is reached at `m` and left at rest.
 */
export type Key = { f: number; v: number[]; hold?: boolean; m?: number[]; stop?: boolean };

const hermite = (p0: number, p1: number, m0: number, m1: number, t: number, h: number) => {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
};

const tangent = (keys: Key[], i: number, c: number) => {
  const k = keys[i];
  if (k.m) return k.m[c];
  if (k.hold || i === 0 || i === keys.length - 1) return 0;
  const a = keys[i - 1], b = keys[i + 1];
  const m = (b.v[c] - a.v[c]) / (b.f - a.f);
  // Monotone clamp: no overshoot past either neighbour.
  const d0 = (k.v[c] - a.v[c]) / (k.f - a.f);
  const d1 = (b.v[c] - k.v[c]) / (b.f - k.f);
  if (d0 * d1 <= 0) return 0;
  const lim = 3 * Math.min(Math.abs(d0), Math.abs(d1));
  return Math.sign(m) * Math.min(Math.abs(m), lim);
};

/** Sample a multi-channel track at `frame`. */
export const sample = (keys: Key[], frame: number): number[] => {
  if (frame <= keys[0].f) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (frame >= last.f) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && frame >= keys[i + 1].f) i++;
  const a = keys[i], b = keys[i + 1];
  const h = b.f - a.f;
  const t = (frame - a.f) / h;
  return a.v.map((_, c) =>
    hermite(a.v[c], b.v[c], a.stop ? 0 : tangent(keys, i, c), tangent(keys, i + 1, c), t, h),
  );
};

/** Convenience: build keys from [frame, ...values] tuples; append "hold" to pin a key. */
export const keys = (...rows: (number | "hold")[][]): Key[] =>
  rows.map((r) => {
    const hold = r[r.length - 1] === "hold";
    const nums = r.filter((x): x is number => typeof x === "number");
    return { f: nums[0], v: nums.slice(1), hold };
  });
