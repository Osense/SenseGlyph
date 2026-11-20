// 손글씨로 쓰지 않은 글자를 견본 글꼴의 모양으로 채웁니다.
// 쓴 글자와 조합 글자는 절대 덮어쓰지 않고, 비어 있는 글자에만 씁니다.
import opentype from "opentype.js";
import {
  charsetFor,
  JA_FALLBACK_EXTRA,
  RETIRED_SPECIAL_SYMBOLS,
} from "../../data/charset";
import type { WritingScript } from "../types";
import { fullwidthSource, isEmBoxedChar } from "./layout";
import { METRICS } from "../../config/metrics";
import { categoryForChar } from "../safety";
import type { LayoutPlan } from "./layout";

/** 견본 글꼴 하나. 필요할 때만 파싱하도록 load를 늦게 부릅니다. */
export interface FallbackSource {
  name: string;
  load: () => opentype.Font | null;
  /** 탈네모 견본: 글자마다 가운데로 옮기지 않고 모든 한글을 이 틀(글꼴 단위 x0·y0·x1·y1)에 둔다.
   * 받침 없는 글자는 위에 붙고 아래가 비는 타자기 짜임과 고정 너비가 그대로 남는다. */
  frame?: readonly [number, number, number, number];
}

/** 폰트를 채울 대상: 앱에서 쓰는 모든 글자 + (한글) 현대 한글 11,172자 / (일본어) 나머지 상용한자·전각 기호 */
export function fallbackTargets(script: WritingScript = "ko"): string[] {
  const chars = new Set(
    charsetFor(script)
      .map(({ char }) => char)
      .filter((char) => !RETIRED_SPECIAL_SYMBOLS.has(char)),
  );
  if (script === "ja") {
    for (const char of JA_FALLBACK_EXTRA) chars.add(char);
    for (let code = 0xff01; code <= 0xff5e; code++)
      chars.add(String.fromCharCode(code));
  } else
    for (let code = 0xac00; code <= 0xd7a3; code++)
      chars.add(String.fromCharCode(code));
  return [...chars];
}

const cjkBox = new WeakMap<opentype.Font, { size: number; cy: number }>();
/** 견본 글꼴의 '国' 크기와 세로 중심: 가나·한자를 네모 칸째로 옮길 기준 */
function referenceCjkBox(font: opentype.Font) {
  let box = cjkBox.get(font);
  if (box) return box;
  const glyph =
    font.charToGlyphIndex("国") > 0 ? font.charToGlyph("国") : undefined;
  const b = glyph?.getBoundingBox();
  box =
    b && b.y2 > b.y1
      ? { size: Math.max(b.x2 - b.x1, b.y2 - b.y1), cy: (b.y1 + b.y2) / 2 }
      : { size: font.unitsPerEm * 0.88, cy: font.unitsPerEm * 0.38 };
  cjkBox.set(font, box);
  return box;
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
    if (isEmBoxedChar(char, plan.script) || fullwidthSource(char)) {
      // 가나·한자·전각 기호: 글꼴의 네모 칸 그대로(작은 가나·、。 자리 유지), 칸 가운데에.
      const ref = referenceCjkBox(font);
      const k = plan.bodySize / ref.size;
      const square = Math.round(plan.bodySize + plan.sideBearing * 2);
      const half = (glyph.advanceWidth ?? font.unitsPerEm) / 2;
      const tx = (x: number) => Math.round(square / 2 + (x - half) * k);
      const ty = (y: number) => Math.round((y - ref.cy) * k + (baseline - 500));
      const path = new opentype.Path();
      for (const c of glyph.path.commands) {
        if (c.type === "M") path.moveTo(tx(c.x), ty(c.y));
        else if (c.type === "L") path.lineTo(tx(c.x), ty(c.y));
        else if (c.type === "Q")
          path.quadraticCurveTo(tx(c.x1), ty(c.y1), tx(c.x), ty(c.y));
        else if (c.type === "C")
          path.curveTo(
            tx(c.x1),
            ty(c.y1),
            tx(c.x2),
            ty(c.y2),
            tx(c.x),
            ty(c.y),
          );
        else if (c.type === "Z") path.close();
      }
      return {
        path,
        advanceWidth: square,
        top: ty(box.y2),
        bottom: ty(box.y1),
        source: source.name,
      };
    }
    const k = plan.bodySize / referenceHangulSize(font);
    const hangul = categoryForChar(char).startsWith("hangul");
    const frame =
      source.frame && hangul
        ? {
            x1: source.frame[0],
            y1: source.frame[1],
            x2: source.frame[2],
            y2: source.frame[3],
          }
        : box;
    const centerY = (frame.y1 + frame.y2) / 2;
    const tx = (x: number) => Math.round((x - frame.x1) * k + plan.sideBearing);
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
        Math.round(
          (Math.max(box.x2, frame.x2) - frame.x1) * k + plan.sideBearing * 2,
        ),
      ),
      top: ty(box.y2),
      bottom: ty(box.y1),
      source: source.name,
    };
  }
  return null;
}
