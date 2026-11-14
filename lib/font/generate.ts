import { isPremiumCategory, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import opentype from "opentype.js";
import { fontPipeline } from "./pipeline";
import {
  fallbackGlyph,
  fallbackTargets,
  type FallbackSource,
} from "./fallback";
import type { BuildRequest, FontStats } from "./types";
import { FONT_SETTING_LIMITS as LIMITS } from "./types";
import { defaultEnglishFontName, isEnglishFontName } from "./names";
import {
  writeFonts,
  type Contour,
  type OutlineGlyph,
  type Segment,
} from "./sfnt-writer";
import { bodySize, mergeInk } from "./layout";

type Polygon = number[][];

/** 폴리곤(y 아래로 +, 기준선 기준)을 폰트 좌표(y 위로 +) 윤곽으로. */
export function polygonContour(polygon: Polygon, baseline: number): Contour | null {
  if (polygon.length < 3) return null;
  const points = polygon.map((p) => [
    Math.round(p[0]),
    Math.round(baseline - p[1]),
  ]);
  return {
    x: points[0][0],
    y: points[0][1],
    segments: points.slice(1).map(([x, y]) => [0, x, y] as Segment),
  };
}

function pathContours(path: opentype.Path): Contour[] {
  const contours: Contour[] = [];
  let current: Contour | null = null;
  for (const c of path.commands) {
    if (c.type === "M") {
      current = { x: Math.round(c.x), y: Math.round(c.y), segments: [] };
      contours.push(current);
    } else if (!current) continue;
    else if (c.type === "L") current.segments.push([0, Math.round(c.x), Math.round(c.y)]);
    else if (c.type === "Q")
      current.segments.push([1, Math.round(c.x1), Math.round(c.y1), Math.round(c.x), Math.round(c.y)]);
    else if (c.type === "C")
      current.segments.push([
        2, Math.round(c.x1), Math.round(c.y1), Math.round(c.x2), Math.round(c.y2), Math.round(c.x), Math.round(c.y),
      ]);
  }
  return contours.filter((c) => c.segments.length >= 2);
}

function validate({ project, preparation, includePremium = true }: BuildRequest) {
  const options = { ...preparation.settings, includeComposed: true };
  if (!options.familyName.trim()) throw new Error("폰트 이름을 입력하세요.");
  const explicitEnglish = options.englishFamilyName?.trim();
  const englishName =
    explicitEnglish || defaultEnglishFontName(options.familyName);
  if (!isEnglishFontName(englishName) || englishName.length > 80)
    throw new Error(
      "영문 폰트 이름은 영문자나 숫자를 포함하고, 영문 키보드의 문자와 공백으로 입력하세요.",
    );
  if (
    [options.correction, ...Object.values(options.correctionDetail ?? {})].some(
      (v) => v !== undefined && (!Number.isFinite(v) || v < 0 || v > 100),
    ) ||
    (options.strokeWeight !== undefined &&
      (!Number.isFinite(options.strokeWeight) ||
        options.strokeWeight < LIMITS.weightMin ||
        options.strokeWeight > LIMITS.weightMax)) ||
    (options.strokeFinish !== undefined &&
      !["original", "round", "pointed"].includes(options.strokeFinish)) ||
    !Number.isFinite(options.baseline) ||
    options.baseline < 650 ||
    options.baseline > 900 ||
    !Number.isFinite(options.letterSpacing) ||
    options.letterSpacing < LIMITS.spacingMin ||
    options.letterSpacing > LIMITS.spacingMax ||
    !Number.isFinite(bodySize(options)) ||
    bodySize(options) < LIMITS.bodyMin ||
    bodySize(options) > LIMITS.bodyMax
  )
    throw new Error("폰트 메트릭 범위를 확인하세요.");
  const written = Object.values(project.samples).filter(
    (s) =>
      s.strokes.length &&
      !RETIRED_SPECIAL_SYMBOLS.has(s.char) &&
      (includePremium || !isPremiumCategory(s.category)),
  );
  if (!written.length) throw new Error("먼저 한 글자 이상 써주세요.");
  return { options, englishName };
}

function entriesFor(pipeline: ReturnType<typeof fontPipeline>) {
  const chars = new Set(pipeline.direct.keys());
  for (let code = 0xac00; code <= 0xd7a3; code++)
    chars.add(String.fromCharCode(code));
  return [...chars].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}

/** 여러 작업자가 나눠 만든 글리프 묶음. 옮기기 쉽게 정수 배열 하나로 담는다.
 *  [글자 수, (코드, 너비, 조합여부, 윤곽 수, (점 수, x, y, …)…)…] */
export interface GlyphChunk {
  data: Int32Array;
}

/** 전체 글자 가운데 part 번째 몫(parts 등분)의 글리프를 만든다. */
export function buildGlyphChunk(
  request: BuildRequest,
  part = 0,
  parts = 1,
  progress: (done: number, total: number) => void = () => {},
): GlyphChunk {
  const { options } = validate(request);
  const pipeline = fontPipeline(request.project, request.preparation, {
    includePremium: request.includePremium ?? true,
  });
  const entries = entriesFor(pipeline);
  const from = Math.floor((part * entries.length) / parts),
    to = Math.floor(((part + 1) * entries.length) / parts);
  const out: number[] = [0];
  let count = 0;
  for (let i = from; i < to; i++) {
    if ((i - from) % 200 === 0) progress(i - from, to - from);
    const char = entries[i];
    const shaped = pipeline.glyph(char);
    if (!shaped || !shaped.contours.length) continue;
    const rings = mergeInk(shaped.contours);
    out.push(char.codePointAt(0)!, shaped.advanceWidth, shaped.direct ? 0 : 1, rings.length);
    for (const ring of rings) {
      out.push(ring.length);
      for (const p of ring)
        out.push(Math.round(p[0]), Math.round(options.baseline - p[1]));
    }
    count++;
  }
  progress(to - from, to - from);
  out[0] = count;
  return { data: Int32Array.from(out) };
}

export interface BuiltFont {
  /** OTF(CFF) — 예전과 같은 기본 결과 */
  buffer: ArrayBuffer;
  ttf: ArrayBuffer;
  otf: ArrayBuffer;
  stats: FontStats;
}

/** 나눠 만든 글리프를 모아 견본 글꼴로 빈 글자를 채우고 TTF·OTF 파일로 쓴다. */
export function assembleFont(
  request: BuildRequest,
  chunks: GlyphChunk[],
  progress: (value: number, message: string) => void = () => {},
  fallbacks: FallbackSource[] = [],
): BuiltFont {
  const { project, preparation } = request;
  const { options, englishName } = validate(request);
  const postScriptName =
    englishName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 55) + "-Regular";
  const pipeline = fontPipeline(project, preparation, {
    includePremium: request.includePremium ?? true,
  });
  const layout = pipeline.plan;
  const square = Math.round(layout.bodySize + layout.sideBearing * 2);
  const glyphs: OutlineGlyph[] = [
    {
      name: ".notdef",
      advanceWidth: square,
      contours: [
        { x: 160, y: 0, segments: [[0, 160, 650], [0, 700, 650], [0, 700, 0]] },
        { x: 210, y: 50, segments: [[0, 650, 50], [0, 650, 600], [0, 210, 600]] },
      ],
    },
    { name: "space", unicode: 32, advanceWidth: layout.spaceWidth, contours: [] },
    { name: "uni3000", unicode: 0x3000, advanceWidth: square, contours: [] },
  ];
  let highest = options.baseline,
    lowest = options.baseline - 1000,
    composed = 0;
  const characters: string[] = [];
  const name = (code: number) => "uni" + code.toString(16).toUpperCase().padStart(4, "0");
  const handwritten: OutlineGlyph[] = [];
  for (const { data } of chunks) {
    let i = 1;
    for (let g = 0; g < data[0]; g++) {
      const code = data[i++],
        advanceWidth = data[i++],
        isComposed = data[i++],
        rings = data[i++];
      const contours: Contour[] = [];
      for (let r = 0; r < rings; r++) {
        const n = data[i++];
        const x0 = data[i],
          y0 = data[i + 1];
        const segments: Segment[] = [];
        for (let k = 1; k < n; k++) segments.push([0, data[i + k * 2], data[i + k * 2 + 1]]);
        for (let k = 0; k < n; k++) {
          const y = data[i + k * 2 + 1];
          if (y > highest) highest = y;
          if (y < lowest) lowest = y;
        }
        i += n * 2;
        if (n >= 3) contours.push({ x: x0, y: y0, segments });
      }
      if (!contours.length) continue;
      composed += isComposed;
      characters.push(String.fromCodePoint(code));
      handwritten.push({ name: name(code), unicode: code, advanceWidth, contours });
    }
  }
  // 1번 그룹이 먼저 끝나도 글리프 순서는 코드 순서로
  handwritten.sort((a, b) => a.unicode! - b.unicode!);
  glyphs.push(...handwritten);
  // 쓰지 않은 글자(특수문자, 자모 자리가 비어 만들 수 없는 한글 등)는 견본 글꼴 모양으로 채웁니다.
  let filled = 0;
  if (fallbacks.length) {
    progress(88, "쓰지 않은 글자를 견본 글꼴로 채우고 있어요");
    const have = new Set(characters);
    const loaded = new Map<FallbackSource, opentype.Font | null>();
    for (const char of fallbackTargets()) {
      if (have.has(char)) continue;
      const glyph = fallbackGlyph(char, fallbacks, layout, options.baseline, loaded);
      if (!glyph) continue;
      highest = Math.max(highest, glyph.top);
      lowest = Math.min(lowest, glyph.bottom);
      glyphs.push({
        name: name(char.codePointAt(0)!),
        unicode: char.codePointAt(0)!,
        advanceWidth: glyph.advanceWidth,
        contours: pathContours(glyph.path),
      });
      characters.push(char);
      filled++;
    }
  }
  progress(94, "설치할 수 있는 폰트 파일로 묶고 있어요");
  const internalName =
    "Hanhoek-" + project.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const { ttf, otf } = writeFonts(
    {
      familyEnglish: englishName,
      familyKorean: options.familyName.trim(),
      postScriptName,
      uniqueID: internalName + "-1.500-" + project.updatedAt,
      version: "Version 1.500",
      unitsPerEm: 1000,
      ascender: Math.ceil(highest),
      descender: Math.min(-1, Math.floor(lowest)),
    },
    glyphs,
  );
  return {
    buffer: otf,
    ttf,
    otf,
    stats: {
      direct: pipeline.direct.size,
      composed,
      fallback: filled,
      glyphs: glyphs.length,
      characters,
    },
  };
}

/** 한 번에(작업자 하나로) 폰트를 만든다. 테스트와 예비용. */
export function generateFont(
  request: BuildRequest,
  progress: (value: number, message: string) => void = () => {},
  fallbacks: FallbackSource[] = [],
): BuiltFont {
  validate(request);
  progress(2, "손글씨 외곽선을 준비하고 있어요");
  const chunk = buildGlyphChunk(request, 0, 1, (done, total) =>
    progress(
      5 + Math.round((done / Math.max(1, total)) * 80),
      `${done.toLocaleString()} / ${total.toLocaleString()} 글자를 만들고 있어요`,
    ),
  );
  return assembleFont(request, [chunk], progress, fallbacks);
}
