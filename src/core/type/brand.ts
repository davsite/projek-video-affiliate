// The buyer's shared VOYNANN brand kit (voynann-brand.json, see BRAND_KIT.md), copied to src/brand.json.
// In VOYNANN Motion the brand lives in overlays (title, kicker, end card, labels); the 3D world keeps the
// style's art direction unless the buyer explicitly asks for brand colours in the scene.
import brandFile from "../../brand.json";

export type BrandKit = {
  brand?: string; handle?: string; cta?: string; logo?: string; font?: string;
  colors?: { primary?: string; accent?: string; background?: string };
};
export const BRAND = brandFile as unknown as BrandKit;

const isHex = (c?: string): c is string => !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
const lum = (c: string) => {
  let h = c.trim().slice(1);
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio of two hex colours (1–21). */
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** The brand accent when it stays readable on `background` (≥ 3:1), otherwise the style's own `fallback`. */
export const brandAccent = (background: string, fallback: string) => {
  const a = BRAND.colors?.accent;
  return isHex(a) && isHex(background) && contrast(a, background) >= 3 ? a : fallback;
};
/** Brand name for overlays, or the fallback text. */
export const brandName = (fallback = "") => BRAND.brand?.trim() || fallback;
