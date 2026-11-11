import { METRICS } from "../../config/metrics";
import { categoryForChar, DIAMOND_RADIUS } from "../safety";
import polygonClipping, { type Ring } from "polygon-clipping";
import { hitsStroke } from "../geometry";
import type { FontBuildSettings, StrokeFinish } from "./types";
import type { Stroke } from "../types";
import { outlines } from "../brushes";
import { simplifyContour } from "./polygon";

export type Contours = number[][][];
export interface InkBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}
export interface LayoutPlan {
  bodySize: number;
  typicalHangulSize: number;
  hangulScale: number;
  latinScale: number;
  symbolScale: number;
  capHeight: number;
  sideBearing: number;
  digitInkWidth: number;
  spaceWidth: number;
}
export interface LaidOutGlyph {
  contours: Contours;
  advanceWidth: number;
  bounds: InkBounds | null;
  leftSideBearing: number;
}
export function createStrokeRenderer(settings?: FontBuildSettings) {
  const weight = (settings?.strokeWeight ?? 100) / 100;
  const finish = settings?.strokeFinish ?? "original";
  const cache = new WeakMap<Stroke, Map<StrokeFinish, Contours>>();
  return (strokes: Stroke[]): Contours =>
    strokes.flatMap((stroke, index) => {
      const start = stroke.points[0],
        end = stroke.points.at(-1);
      const radius = (stroke.params.size * weight) / 2;
      const style =
        finish !== "original" &&
        start &&
        end &&
        stroke.brush !== "nib" &&
        stroke.brush !== "pixel" &&
        Math.hypot(end.x - start.x, end.y - start.y) > radius &&
        !strokes.some(
          (other, i) =>
            i !== index &&
            hitsStroke(end, other.points, radius, other.params.size * weight),
        )
          ? finish
          : "original";
      let styles = cache.get(stroke);
      if (!styles) {
        styles = new Map();
        cache.set(stroke, styles);
      }
      let paths = styles.get(style);
      if (!paths) {
        paths = outlines(
          stroke.points,
          stroke.brush,
          {
            ...stroke.params,
            size: stroke.params.size * weight,
          },
          style,
        )
          .map((poly) => simplifyContour(poly))
          .filter((path) => path.length >= 3);
        styles.set(style, paths);
      }
      return paths;
    });
}

export const strokeContours = createStrokeRenderer();

export function mergeInk(contours: Contours): Contours {
  return contours.length
    ? polygonClipping
        .union(contours.map((ring) => [ring as Ring]))
        .flatMap((polygon) => polygon.map((ring) => ring.slice(0, -1)))
    : [];
}

export function inkBounds(contours: Contours): InkBounds | null {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const polygon of contours)
    for (const [x, y] of polygon) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  return Number.isFinite(left)
    ? { left, top, right, bottom, width: right - left, height: bottom - top }
    : null;
}
function median(values: number[], fallback: number) {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function bodySize(settings: FontBuildSettings) {
  return settings.bodySize ?? 840;
}

export function createLayoutPlan(
  direct: Map<string, Contours>,
  settings: FontBuildSettings,
): LayoutPlan {
  const target = bodySize(settings),
    measurements = [...direct].flatMap(([char, paths]) => {
      const bounds = inkBounds(paths);
      return bounds ? [{ char, bounds }] : [];
    });
  const hangul = measurements
    .filter((item) => categoryForChar(item.char) === "hangul-syllable")
    .map((item) => Math.max(item.bounds.width, item.bounds.height))
    .filter((size) => size > 40);
  const typicalHangulSize = median(hangul, DIAMOND_RADIUS - 22);
  const hangulScale = Math.max(0.5, Math.min(8, target / typicalHangulSize));
  const capHeight = target * 0.8;
  const capitals = measurements
    .filter((item) => /^[A-Z0-9]$/.test(item.char))
    .map((item) => METRICS.baseline - item.bounds.top)
    .filter((height) => height > 80);
  const ascenders = measurements
    .filter((item) => /^[bdhkl]$/.test(item.char))
    .map((item) => METRICS.baseline - item.bounds.top)
    .filter((height) => height > 80);
  const lower = measurements
    .filter((item) => /^[acegmnopqrsuvwxyz]$/.test(item.char))
    .map((item) => METRICS.baseline - item.bounds.top)
    .filter((height) => height > 80);
  const sourceCap = capitals.length
    ? median(capitals, 570)
    : ascenders.length
      ? median(ascenders, 570)
      : lower.length
        ? (median(lower, 380) * 570) / 380
        : 570;
  const latinScale = Math.max(0.5, Math.min(4, capHeight / sourceCap));
  const symbolDimensions = measurements
    .filter((item) =>
      ["ascii-symbol", "korean-punct"].includes(categoryForChar(item.char)),
    )
    .map((item) => Math.max(item.bounds.width, item.bounds.height));
  // Share one scale for punctuation: never blow up a dot/comma to a full-size letter.
  const symbolScale = Math.min(
    latinScale,
    target / Math.max(1, ...symbolDimensions),
  );
  // Negative bearings allow tighter spacing, including deliberate ink overlap.
  const sideBearing = (100 + settings.letterSpacing) / 2;
  const digitInkWidth = Math.max(
    0,
    ...measurements
      .filter((item) => /^[0-9]$/.test(item.char))
      .map((item) => item.bounds.width * latinScale),
  );
  return {
    bodySize: target,
    typicalHangulSize,
    hangulScale,
    latinScale,
    symbolScale,
    capHeight,
    sideBearing,
    digitInkWidth,
    spaceWidth: Math.max(
      80,
      Math.round(target * 0.42 + settings.letterSpacing),
    ),
  };
}

export function layoutGlyph(
  char: string,
  source: Contours,
  plan: LayoutPlan,
  reference: Contours = source,
  preserveScale = false,
): LaidOutGlyph {
  const bounds = inkBounds(reference);
  if (!bounds)
    return {
      contours: [],
      advanceWidth: plan.spaceWidth,
      bounds: null,
      leftSideBearing: 0,
    };
  const category = categoryForChar(char),
    hangul = category.startsWith("hangul");
  let scale = hangul
    ? plan.hangulScale
    : category === "ascii-symbol" || category === "korean-punct"
      ? plan.symbolScale
      : plan.latinScale;
  if (preserveScale) scale = 1;
  else if (hangul)
    scale = Math.min(
      scale,
      plan.bodySize / Math.max(1, bounds.width, bounds.height),
    );
  const cy = (bounds.top + bounds.bottom) / 2;
  const referenceWidth = bounds.width * scale;
  const contentWidth =
    category === "digit"
      ? Math.max(plan.digitInkWidth, referenceWidth)
      : referenceWidth;
  const left = plan.sideBearing + (contentWidth - referenceWidth) / 2;
  const paths = source.map((polygon) =>
    polygon.map(([x, y]) => [
      Math.round(left + (x - bounds.left) * scale),
      Math.round(
        hangul
          ? 500 + (y - cy) * scale
          : METRICS.baseline + (y - METRICS.baseline) * scale,
      ),
    ]),
  );
  const finalBounds = inkBounds(paths)!;
  return {
    contours: paths,
    advanceWidth: Math.max(1, Math.round(contentWidth + plan.sideBearing * 2)),
    bounds: finalBounds,
    leftSideBearing: finalBounds.left,
  };
}
