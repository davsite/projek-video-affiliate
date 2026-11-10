import { continueRender, delayRender, staticFile } from "remotion";

// Default typeface: Manrope (SIL Open Font License, see public/fonts/OFL-manrope.txt).
// Bundled locally in public/fonts so rendering never depends on Google Fonts being reachable
// and every OS renders the same glyph metrics.
const FAMILY = "Manrope";
const WEIGHTS = ["200", "300", "400", "500", "600"] as const;

let ready: Promise<void> | null = null;
const load = (): Promise<void> => {
  if (ready) return ready;
  if (typeof document === "undefined") return (ready = Promise.resolve());
  const handle = delayRender("Loading bundled Manrope font");
  ready = Promise.all(
    WEIGHTS.map(async (w) => {
      const face = new FontFace(FAMILY, `url(${staticFile(`fonts/manrope-latin-${w}-normal.woff2`)}) format("woff2")`, {
        weight: w,
        style: "normal",
      });
      await face.load();
      (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    }),
  ).then(
    () => continueRender(handle),
    (err) => {
      continueRender(handle);
      throw err;
    },
  );
  return ready;
};
load();

export const MANROPE = FAMILY;
export const manropeReady = load;

/** The font every overlay and canvas texture uses. */
export const FONT = MANROPE;
export const fontReady = manropeReady;

export const INK = "#1f2426";
export const INK_SOFT = "#6a7174";
