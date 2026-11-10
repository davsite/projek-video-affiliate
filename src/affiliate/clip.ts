// The product of this video: an adhesive silicone cable clip with five slots of growing size (thin cable → thick
// cable). Units are centimetres. Local frame: the slots sit side by side along +X, the clip stands on +Y and a
// cable runs through a slot along Z. The origin is the bottom of the adhesive pad (the point that touches the desk).

import { ExtrudeGeometry, Shape } from "three";
import { cached } from "../kits/characterflow/lib/geo.ts";

/** Hole radius of each slot (cm). A 4 mm phone cable fits slot 1, a 6 mm laptop cable needs slot 4. */
export const SLOT_R = [0.17, 0.21, 0.25, 0.3, 0.36];
const WALL = 0.32, END = 0.42;
export const CLIP_H = 1.3;
const YC = 0.75; // hole centre height above the bottom of the (uninflated) silicone shape
export const CLIP_D = 1.8; // length along the cable
const BEVEL = 0.05;
export const PAD = 0.09; // foam pad under the body
export const CLIP_L = 2 * END + SLOT_R.reduce((s, r) => s + 2 * r, 0) + (SLOT_R.length - 1) * WALL;

/** X of every slot centre. */
export const SLOT_X = (() => {
  let u = -CLIP_L / 2 + END;
  return SLOT_R.map((r) => {
    u += r;
    const x = u;
    u += r + WALL;
    return x;
  });
})();

/** Neck (opening) half width: narrower than the hole so a cable snaps in and stays. */
export const neckHalf = (r: number) => r * 0.72;

/** Height (local Y) of the centre of a cable of radius rc resting in slot i. */
export const seatY = (i: number, rc: number) => PAD + BEVEL + YC - SLOT_R[i] + Math.min(rc, SLOT_R[i]);
/** Height of the top of the clip (local). */
export const TOP_Y = PAD + CLIP_H;

export const clipGeometry = () =>
  cached("affiliate-clip", () => {
    // the bevel inflates the contour by BEVEL, so the shape is drawn that much smaller (holes that much bigger)
    const B = BEVEL, L = CLIP_L - 2 * B, H = CLIP_H - 2 * B, rc = 0.3, lip = 0.05, ox = 0;
    const s = new Shape();
    s.moveTo(-L / 2 + 0.1, 0);
    s.lineTo(L / 2 - 0.1, 0);
    s.quadraticCurveTo(L / 2, 0, L / 2, 0.1);
    s.lineTo(L / 2, H - rc);
    s.quadraticCurveTo(L / 2, H, L / 2 - rc, H);
    for (let i = SLOT_R.length - 1; i >= 0; i--) {
      const R = SLOT_R[i] + B, cx = SLOT_X[i] + ox;
      const nh = neckHalf(SLOT_R[i]) + B, yn = YC + Math.sqrt(R * R - nh * nh), th = Math.atan2(yn - YC, nh);
      s.lineTo(cx + nh + lip, H);
      s.quadraticCurveTo(cx + nh, H, cx + nh, H - lip);
      s.lineTo(cx + nh, yn);
      s.absarc(cx, YC, R, th, Math.PI - th, true);
      s.lineTo(cx - nh, H - lip);
      s.quadraticCurveTo(cx - nh, H, cx - nh - lip, H);
    }
    s.lineTo(-L / 2 + rc, H);
    s.quadraticCurveTo(-L / 2, H, -L / 2, H - rc);
    s.lineTo(-L / 2, 0.1);
    s.quadraticCurveTo(-L / 2, 0, -L / 2 + 0.1, 0);
    const g = new ExtrudeGeometry(s, { depth: CLIP_D - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 3, curveSegments: 28 });
    g.translate(0, B + PAD, -(CLIP_D - 2 * B) / 2);
    g.computeVertexNormals();
    return g;
  });
