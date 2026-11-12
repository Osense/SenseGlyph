import { outline } from "./brushes";
import type { CharCategory, Stroke } from "./types";
import { SAFETY_PROFILES } from "../config/metrics";

export const SAFE_INSET = 40;
export const SAFE_MAX = 1000 - SAFE_INSET;
export const DIAMOND_RADIUS = 500;
export function isSymbolCategory(category: CharCategory) {
  return (
    category === "ascii-symbol" ||
    category === "korean-punct" ||
    category === "special-symbol"
  );
}
export function safetyBounds(category: CharCategory = "hangul-syllable") {
  if (isSymbolCategory(category)) return SAFETY_PROFILES.symbol;
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
    stroke.points.every(
      (p) =>
        p.x >= box.left &&
        p.x <= box.right &&
        p.y >= box.top &&
        p.y <= box.bottom,
    ) &&
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

/** 칸 밖으로 나간 글자를 버리지 않고, 비율을 유지한 채 안전영역 안으로 줄여 넣습니다.
 * 원본 획은 바꾸지 않고 출력용 사본만 만듭니다. 이미 안전하면 같은 배열을 돌려줍니다. */
export function fitStrokesToSafety(
  strokes: Stroke[],
  category: CharCategory = "hangul-syllable",
): Stroke[] {
  if (!strokes.length || strokesAreSafe(strokes, category)) return strokes;
  const box = safetyBounds(category);
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const stroke of strokes)
    for (const [x, y] of [
      ...outline(stroke.points, stroke.brush, stroke.params),
      ...stroke.points.map((p) => [p.x, p.y]),
    ]) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  if (!Number.isFinite(left)) return strokes;
  const room = 0.98;
  const scale = Math.min(
    1,
    ((box.right - box.left) * room) / Math.max(1, right - left),
    ((box.bottom - box.top) * room) / Math.max(1, bottom - top),
  );
  const cx = (left + right) / 2,
    cy = (top + bottom) / 2;
  const halfW = ((right - left) * scale) / 2,
    halfH = ((bottom - top) * scale) / 2;
  const tx = Math.max(box.left + halfW, Math.min(box.right - halfW, cx)),
    ty = Math.max(box.top + halfH, Math.min(box.bottom - halfH, cy));
  return strokes.map((stroke) => ({
    ...stroke,
    params: { ...stroke.params, size: stroke.params.size * scale },
    points: stroke.points.map((p) => ({
      ...p,
      x: tx + (p.x - cx) * scale,
      y: ty + (p.y - cy) * scale,
    })),
  }));
}
