import { METRICS } from "../../config/metrics";
import { categoryForChar, DIAMOND_RADIUS, isEmBoxed } from "../safety";
import { JA_PUNCT } from "../../data/charset";
import type { WritingScript } from "../types";
import { decompose, vowelType } from "../hangul";
import polygonClipping, {
  type MultiPolygon,
  type Ring,
} from "polygon-clipping";
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
  /** 짜임(세로·가로·섞임 모음 × 받침)별 쓴 글자 크기의 중앙값. 크기 고르기는 같은 짜임끼리 맞춘다. */
  typicalByLayout?: Map<string, number>;
  /** 짜임별 쓴 글자 폭의 중앙값(폭 고르기) */
  widthByLayout?: Map<string, number>;
  hangulScale: number;
  latinScale: number;
  symbolScale: number;
  capHeight: number;
  sideBearing: number;
  digitInkWidth: number;
  spaceWidth: number;
  /** 0~1. 작게 쓴 한글을 보통 크기 쪽으로 키우는 정도(손글씨 정돈의 '크기 고르게'). */
  sizeEvening: number;
  /** 만들 글자 */
  script: WritingScript;
  /** 가나·한자: 쓰기 칸을 통째로 키우는 배율(칸 안 위치를 그대로 지킨다) */
  emScale: number;
}
/** 전각 영숫자·기호(！？Ａ１…)는 반각 글자의 손글씨로 만든다. */
export const fullwidthSource = (char: string) => {
  const code = char.codePointAt(0)!;
  return code >= 0xff01 && code <= 0xff5e
    ? String.fromCharCode(code - 0xfee0)
    : null;
};
/** 칸 안 위치를 지키는 글자인가(일본어 가나·한자·문장 기호) */
export const isEmBoxedChar = (char: string, script: WritingScript) =>
  isEmBoxed(categoryForChar(char)) ||
  (script === "ja" && JA_PUNCT.includes(char));
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

function ringArea(ring: number[][]) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i],
      [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/**
 * 합치기 전에 좌표를 격자에 맞추고, 붙어 있는 같은 점과 넓이가 없는 고리를 지운다.
 * polygon-clipping 은 1e-13 만큼 떨어진 점이나 길이가 거의 0인 선분을 만나면
 * "Unable to find segment … in SweepLine tree" 오류로 멈추기 때문이다.
 * 글리프 좌표는 결국 정수 폰트 단위로 저장되므로 1/8 단위 반올림은 모양에 영향이 없다.
 */
export function cleanRings(contours: Contours, grid = 8): Contours {
  const out: Contours = [];
  for (const ring of contours) {
    const cleaned: number[][] = [];
    for (const point of ring) {
      const x = Math.round(point[0] * grid) / grid,
        y = Math.round(point[1] * grid) / grid;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const last = cleaned.at(-1);
      if (last && last[0] === x && last[1] === y) continue;
      cleaned.push([x, y]);
    }
    while (
      cleaned.length > 1 &&
      cleaned[0][0] === cleaned.at(-1)![0] &&
      cleaned[0][1] === cleaned.at(-1)![1]
    )
      cleaned.pop();
    if (cleaned.length >= 3 && Math.abs(ringArea(cleaned)) > 0.5 / grid)
      out.push(cleaned);
  }
  return out;
}

function union(contours: Contours): Contours {
  return polygonClipping
    .union(contours.map((ring) => [ring as Ring]))
    .flatMap((polygon) => polygon.map((ring) => ring.slice(0, -1)));
}

/** 획 윤곽을 하나로 합친다. 계산이 실패해도 폰트 만들기가 멈추지 않도록 단계적으로 물러난다. */
export function mergeInk(contours: Contours): Contours {
  if (!contours.length) return [];
  // 1) 1/8 격자, 2) 정수 격자에서 한 번에 합치기
  for (const grid of [8, 1]) {
    const rings = cleanRings(contours, grid);
    if (!rings.length) return [];
    try {
      return cleanRings(union(rings), grid);
    } catch {
      /* 다음 방법으로 */
    }
  }
  // 3) 하나씩 더해 가며, 합쳐지지 않는 고리는 따로 둔다(겹쳐도 같은 방향이면 채워진다).
  let merged: MultiPolygon = [];
  const separate: Contours = [];
  for (const ring of cleanRings(contours, 1)) {
    try {
      merged = polygonClipping.union(merged, [ring as Ring]);
    } catch {
      separate.push(ringArea(ring) < 0 ? [...ring].reverse() : ring);
    }
  }
  return [
    ...cleanRings(
      merged.flatMap((polygon) => polygon.map((ring) => ring.slice(0, -1))),
      1,
    ),
    ...separate,
  ];
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
/** 한글 음절의 짜임: 모음 모양(V·H·C) + 받침 유무 */
function syllableLayout(char: string) {
  const d = decompose(char);
  return d ? vowelType(d.jung) + (d.jong ? "j" : "") : null;
}

export function bodySize(settings: FontBuildSettings) {
  return settings.bodySize ?? 840;
}

export function createLayoutPlan(
  direct: Map<string, Contours>,
  settings: FontBuildSettings,
  sizeEvening = 0,
  script: WritingScript = "ko",
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
  // 같은 짜임끼리의 보통 크기: '이'와 '뷁'처럼 짜임이 다르면 원래 크기가 다르므로 섞어 맞추지 않는다.
  const byLayout = new Map<string, number[]>();
  const widths = new Map<string, number[]>();
  for (const item of measurements) {
    const key = syllableLayout(item.char);
    const size = Math.max(item.bounds.width, item.bounds.height);
    if (key && size > 40) {
      byLayout.set(key, [...(byLayout.get(key) ?? []), size]);
      widths.set(key, [...(widths.get(key) ?? []), item.bounds.width / size]);
    }
  }
  const widthByLayout = new Map(
    [...widths]
      .filter(([, list]) => list.length >= 3)
      .map(([key, list]) => [key, median(list, 1)]),
  );
  const typicalByLayout = new Map(
    [...byLayout]
      .filter(([, sizes]) => sizes.length >= 3)
      .map(([key, sizes]) => [key, median(sizes, typicalHangulSize)]),
  );
  const sizeOf = (test: (category: string) => boolean) =>
    measurements
      .filter((item) => test(categoryForChar(item.char)))
      .map((item) => Math.max(item.bounds.width, item.bounds.height))
      .filter((size) => size > 40);
  // 한자가 3자 이상이면 한자 크기, 아니면 가나 크기(가나는 한자보다 조금 작게 쓰므로 0.9로 나눔)
  const kanji = sizeOf((c) => c === "kanji"),
    kana = sizeOf((c) => c === "hiragana" || c === "katakana");
  const typicalCjk =
    kanji.length >= 3
      ? median(kanji, 0)
      : kana.length
        ? median(kana, 0) / 0.9
        : typicalHangulSize;
  const emScale = Math.max(0.5, Math.min(8, target / typicalCjk));
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
    typicalByLayout,
    widthByLayout,
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
    sizeEvening: Math.max(0, Math.min(1, sizeEvening)),
    script,
    emScale,
  };
}

/** 직접 쓴 글자와 조합 글자에 똑같은 배율을 적용합니다.
 * 조합 글자는 쓴 글자의 자모를 같은 em 좌표 그대로 가져오므로, 같은 배율이어야
 * 문장 안에서 크기가 들쭉날쭉하지 않습니다. */
export function layoutGlyph(
  char: string,
  source: Contours,
  plan: LayoutPlan,
  reference: Contours = source,
): LaidOutGlyph {
  const wide = fullwidthSource(char);
  if (wide) {
    // 전각: 반각 손글씨를 같은 크기로 두고 네모 칸 가운데에 놓는다.
    const half = layoutGlyph(wide, source, plan, reference);
    const square = Math.round(plan.bodySize + plan.sideBearing * 2);
    const dx = Math.round((square - half.advanceWidth) / 2);
    const contours = half.contours.map((ring) =>
      ring.map(([x, y]) => [x + dx, y]),
    );
    const moved = inkBounds(contours);
    return {
      contours,
      advanceWidth: square,
      bounds: moved,
      leftSideBearing: moved?.left ?? 0,
    };
  }
  if (isEmBoxedChar(char, plan.script)) {
    // 가나·한자: 쓰기 칸(0~1000)을 통째로 같은 배율로 옮긴다. 작은 가나·、。의 자리가 그대로 남는다.
    const square = Math.round(plan.bodySize + plan.sideBearing * 2);
    const k = plan.emScale;
    const contours = source.map((ring) =>
      ring.map(([x, y]) => [
        Math.round(square / 2 + (x - 500) * k),
        Math.round(500 + (y - 500) * k),
      ]),
    );
    const placed = inkBounds(contours);
    return {
      contours,
      advanceWidth: square,
      bounds: placed,
      leftSideBearing: placed?.left ?? 0,
    };
  }
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
  if (hangul) {
    const own = Math.max(1, bounds.width, bounds.height);
    if (category === "hangul-syllable" && plan.sizeEvening > 0) {
      // 같은 짜임 글자의 보통 크기 쪽으로(커도 작아도) 강도만큼 맞춘다. 한 번에 0.8~1.25배까지만.
      const layout = syllableLayout(char);
      const typical =
        (layout && plan.typicalByLayout?.get(layout)) ||
        plan.typicalHangulSize;
      scale *= Math.max(
        0.8,
        Math.min(1.25, (typical / own) ** (plan.sizeEvening * 0.8)),
      );
    }
    scale = Math.min(scale, plan.bodySize / own);
  }
  // 폭 고르기: 같은 짜임 글자의 보통 가로세로비 쪽으로 가로만 살짝(0.9~1.1배)
  let sx = 1;
  if (category === "hangul-syllable" && plan.sizeEvening > 0) {
    const layout = syllableLayout(char);
    const ratio = layout && plan.widthByLayout?.get(layout);
    const own = bounds.width / Math.max(1, bounds.width, bounds.height);
    if (ratio && own > 0.2)
      sx = Math.max(0.9, Math.min(1.1, (ratio / own) ** (plan.sizeEvening * 0.6)));
  }
  const cy = (bounds.top + bounds.bottom) / 2;
  const referenceWidth = bounds.width * scale * sx;
  const contentWidth =
    category === "digit"
      ? Math.max(plan.digitInkWidth, referenceWidth)
      : referenceWidth;
  const left = plan.sideBearing + (contentWidth - referenceWidth) / 2;
  const paths = source.map((polygon) =>
    polygon.map(([x, y]) => [
      Math.round(left + (x - bounds.left) * scale * sx),
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
