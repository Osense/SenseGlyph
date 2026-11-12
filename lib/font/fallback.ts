// 손글씨로 쓰지 않은 글자를 견본 글꼴의 모양으로 채웁니다.
// 쓴 글자와 조합 글자는 절대 덮어쓰지 않고, 비어 있는 글자에만 씁니다.
import opentype from "opentype.js";
import { CHARSET, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import { METRICS } from "../../config/metrics";
import { categoryForChar } from "../safety";
import type { LayoutPlan } from "./layout";

/** 견본 글꼴 하나. 필요할 때만 파싱하도록 load를 늦게 부릅니다. */
export interface FallbackSource {
  name: string;
  load: () => opentype.Font | null;
}

/** 폰트를 채울 대상: 앱에서 쓰는 모든 글자 + 현대 한글 11,172자 */
export function fallbackTargets(): string[] {
  const chars = new Set(
    CHARSET.map(({ char }) => char).filter(
      (char) => !RETIRED_SPECIAL_SYMBOLS.has(char),
    ),
  );
  for (let code = 0xac00; code <= 0xd7a3; code++)
    chars.add(String.fromCharCode(code));
  return [...chars];
}

const hangulSize = new WeakMap<opentype.Font, number>();
function referenceHangulSize(font: opentype.Font) {
  let size = hangulSize.get(font);
  if (size) return size;
  const glyph =
    font.charToGlyphIndex("한") > 0 ? font.charToGlyph("한") : undefined;
  const box = glyph?.getBoundingBox();
  size =
    box && box.x2 > box.x1
      ? Math.max(box.x2 - box.x1, box.y2 - box.y1)
      : font.unitsPerEm * 0.88;
  hangulSize.set(font, size);
  return size;
}

export interface FallbackGlyph {
  path: opentype.Path;
  advanceWidth: number;
  top: number;
  bottom: number;
  source: string;
}

/** 견본 글꼴의 글자를 내 폰트의 크기·기준선·간격에 맞춰 옮깁니다.
 * 한글은 내 손글씨 한글과 같은 몸 크기·세로 중심에, 나머지는 같은 기준선에 맞춥니다. */
export function fallbackGlyph(
  char: string,
  sources: FallbackSource[],
  plan: LayoutPlan,
  baseline: number,
  loaded: Map<FallbackSource, opentype.Font | null>,
): FallbackGlyph | null {
  for (const source of sources) {
    if (!loaded.has(source)) {
      let font: opentype.Font | null = null;
      try {
        font = source.load();
      } catch {
        font = null;
      }
      loaded.set(source, font);
    }
    const font = loaded.get(source);
    if (!font || font.charToGlyphIndex(char) <= 0) continue;
    const glyph = font.charToGlyph(char);
    const box = glyph.getBoundingBox();
    if (!glyph.path.commands.length || !(box.x2 > box.x1)) continue;
    const k = plan.bodySize / referenceHangulSize(font);
    const hangul = categoryForChar(char).startsWith("hangul");
    const centerY = (box.y1 + box.y2) / 2;
    const tx = (x: number) => Math.round((x - box.x1) * k + plan.sideBearing);
    const ty = (y: number) =>
      Math.round(
        hangul
          ? (y - centerY) * k + (baseline - 500)
          : y * k + (baseline - METRICS.baseline),
      );
    const path = new opentype.Path();
    for (const c of glyph.path.commands) {
      if (c.type === "M") path.moveTo(tx(c.x), ty(c.y));
      else if (c.type === "L") path.lineTo(tx(c.x), ty(c.y));
      else if (c.type === "Q")
        path.quadraticCurveTo(tx(c.x1), ty(c.y1), tx(c.x), ty(c.y));
      else if (c.type === "C")
        path.curveTo(tx(c.x1), ty(c.y1), tx(c.x2), ty(c.y2), tx(c.x), ty(c.y));
      else if (c.type === "Z") path.close();
    }
    return {
      path,
      advanceWidth: Math.max(
        1,
        Math.round((box.x2 - box.x1) * k + plan.sideBearing * 2),
      ),
      top: ty(box.y2),
      bottom: ty(box.y1),
      source: source.name,
    };
  }
  return null;
}
