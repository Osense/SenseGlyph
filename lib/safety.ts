import { outline } from "./brushes";
import type { CharCategory, Stroke } from "./types";
import { SAFETY_PROFILES } from "../config/metrics";

export const SAFE_INSET = 40;
export const SAFE_MAX = 1000 - SAFE_INSET;
export const DIAMOND_RADIUS = 500;
export function safetyBounds(category: CharCategory = "hangul-syllable") {
  if (category === "ascii-symbol" || category === "korean-punct")
    return SAFETY_PROFILES.symbol;
  return category.startsWith("hangul")
    ? SAFETY_PROFILES.hangul
    : SAFETY_PROFILES.latin;
}
export function categoryForChar(char: string): CharCategory {
  if (/^[가-힣]$/.test(char)) return "hangul-syllable";
  if (/^[ㄱ-ㅣ]$/.test(char)) return "hangul-jamo";
  if (/^[a-z]$/.test(char)) return "latin-lower";
  if (/^[A-Z]$/.test(char)) return "latin-upper";
  if (/^[0-9]$/.test(char)) return "digit";
  return /^[\x21-\x7e]$/.test(char) ? "ascii-symbol" : "korean-punct";
}
export function strokeIsSafe(
  stroke: Stroke,
  category: CharCategory = "hangul-syllable",
): boolean {
  const box = safetyBounds(category);
  return (
    stroke.points.length > 0 &&
    outline(stroke.points, stroke.brush, stroke.params).every(
      ([x, y]) =>
        x >= box.left && y >= box.top && x <= box.right && y <= box.bottom,
    )
  );
}
export function strokesAreSafe(
  strokes: Stroke[],
  category: CharCategory = "hangul-syllable",
) {
  return strokes.every((stroke) => strokeIsSafe(stroke, category));
}
/** Scale for a reference glyph of the given box size.
 * `fit` is how far the glyph's real ink reaches towards the diamond, relative
 * to its box corners (1 = ink in a corner, smaller = rounded/empty corners;
 * see scripts/build-reference-regions.py). Using the ink instead of the box
 * lets every sample touch the diamond guide instead of floating inside it. */
export function sampleFontSize(
  width: number,
  height: number,
  diamond: boolean,
  fit = 1,
) {
  const safe = 1000 - 2 * (SAFE_INSET + 20);
  return Math.min(
    safe / (width || 1),
    safe / (height || 1),
    diamond
      ? ((DIAMOND_RADIUS - DIAMOND_MARGIN) * 2) /
          ((width + height) * Math.min(1, Math.max(0.3, fit)) || 1)
      : Infinity,
  );
}
/** Room left for the guide line itself between the sample ink and the diamond. */
export const DIAMOND_MARGIN = 6;
