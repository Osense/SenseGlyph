import opentype from "opentype.js";
import polygonClipping, { type Ring } from "polygon-clipping";
import { slotKeys } from "../hangul";
import {
  prepareHandwriting,
  layoutBoxes,
  transformComponent,
} from "./composition";
import type { BuildRequest, FontStats } from "./types";
import { FONT_SETTING_LIMITS as LIMITS } from "./types";
import { defaultEnglishFontName, isEnglishFontName } from "./names";
import { replaceCmap } from "./cmap";
import { effectiveSample } from "./editing";
import { strokesAreSafe, SAFE_INSET, SAFE_MAX } from "../safety";
import {
  bodySize,
  createLayoutPlan,
  layoutGlyph,
  strokeContours as contours,
} from "./layout";

type Polygon = number[][];

export function appendContour(
  path: opentype.Path,
  polygon: Polygon,
  baseline: number,
) {
  if (polygon.length < 3) return;
  const points = polygon.map((p) => [
    Math.round(p[0]),
    Math.round(baseline - p[1]),
  ]);
  path.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) path.lineTo(p[0], p[1]);
  path.close();
}

export function generateFont(
  { project, preparation }: BuildRequest,
  progress: (value: number, message: string) => void = () => {},
): { buffer: ArrayBuffer; stats: FontStats } {
  const options = { ...preparation.settings, includeComposed: true };
  if (!options.familyName.trim()) throw new Error("폰트 이름을 입력하세요.");
  const explicitEnglish = options.englishFamilyName?.trim();
  const englishName =
    explicitEnglish || defaultEnglishFontName(options.familyName);
  if (!isEnglishFontName(englishName) || englishName.length > 80)
    throw new Error(
      "영문 폰트 이름은 영문자나 숫자를 포함하고, 영문 키보드의 문자와 공백으로 입력하세요.",
    );
  const postScriptName =
    englishName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 55) + "-Regular";
  if (
    [options.positionCorrection, options.shapeInterpolation].some(
      (v) => v !== undefined && (!Number.isFinite(v) || v < 0 || v > 100),
    ) ||
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
  const samples = Object.values(project.samples)
    .map((sample) =>
      effectiveSample(sample, preparation.separations[sample.char]),
    )
    .filter((s) => s.strokes.length);
  if (!samples.length) throw new Error("먼저 한 글자 이상 써주세요.");
  const unsafe = samples.filter(
    (sample) => !strokesAreSafe(sample.strokes, sample.category),
  );
  if (unsafe.length)
    throw new Error(
      "안전영역을 벗어난 글자가 있습니다: " +
        unsafe.map((sample) => sample.char).join(" ") +
        ". 쓰기 또는 자모 보정 화면에서 수정해 주세요.",
    );
  progress(2, "손글씨 외곽선을 준비하고 있어요");
  const handwriting = prepareHandwriting(project, preparation);
  const direct = new Map(
    samples.map((s) => [
      s.char,
      contours(handwriting.direct.get(s.char) ?? s.strokes),
    ]),
  );
  const components = new Map<string, Polygon[]>();
  if (options.includeComposed)
    for (const [key, component] of handwriting.library) {
      components.set(
        key,
        contours(
          transformComponent(
            component,
            layoutBoxes(component.char)[component.part]!,
          ),
        ),
      );
      if (
        components
          .get(key)!
          .some((polygon) =>
            polygon.some(
              ([x, y]) =>
                x < SAFE_INSET ||
                y < SAFE_INSET ||
                x > SAFE_MAX ||
                y > SAFE_MAX,
            ),
          )
      )
        throw new Error(
          component.char +
            "의 자모 위치 상자가 너무 작아 조합 획이 안전영역을 벗어납니다. 자모 위치 상자를 수정해 주세요.",
        );
    }
  const polygons = new Map(direct);
  const layout = createLayoutPlan(direct, options);
  let composed = 0;
  if (options.includeComposed)
    for (let code = 0xac00; code <= 0xd7a3; code++) {
      const char = String.fromCharCode(code),
        keys = slotKeys(char);
      if (!polygons.has(char) && keys.every((key) => components.has(key))) {
        polygons.set(
          char,
          keys.flatMap((key) => components.get(key)!),
        );
        composed++;
      }
    }
  const missingPath = new opentype.Path();
  missingPath.moveTo(160, 0);
  missingPath.lineTo(160, 650);
  missingPath.lineTo(700, 650);
  missingPath.lineTo(700, 0);
  missingPath.close();
  missingPath.moveTo(210, 50);
  missingPath.lineTo(650, 50);
  missingPath.lineTo(650, 600);
  missingPath.lineTo(210, 600);
  missingPath.close();
  const glyphs = [
    new opentype.Glyph({
      name: ".notdef",
      advanceWidth: Math.round(layout.bodySize + layout.sideBearing * 2),
      leftSideBearing: 160,
      path: missingPath,
    }),
    new opentype.Glyph({
      name: "space",
      unicode: 32,
      advanceWidth: layout.spaceWidth,
      path: new opentype.Path(),
    }),
    new opentype.Glyph({
      name: "uni3000",
      unicode: 0x3000,
      advanceWidth: Math.round(layout.bodySize + layout.sideBearing * 2),
      path: new opentype.Path(),
    }),
  ];
  const entries = [...polygons].sort(
    (a, b) => a[0].codePointAt(0)! - b[0].codePointAt(0)!,
  );
  let highest = options.baseline,
    lowest = options.baseline - 1000;
  for (let i = 0; i < entries.length; i++) {
    const [char, paths] = entries[i],
      path = new opentype.Path();
    const shaped = layoutGlyph(char, paths, layout);
    // Merge ink before writing CFF so renderers see the boundary, not stacked faces.
    const polygons = shaped.contours.map((ring) => [ring as Ring]);
    if (polygons.length) {
      for (const polygon of polygonClipping.union(polygons)) {
        for (const ring of polygon) {
          // The union winds holes opposite to outer rings. Preserve that winding.
          appendContour(path, ring.slice(0, -1), options.baseline);
        }
      }
    }
    for (const polygon of shaped.contours) {
      for (const p of polygon) {
        highest = Math.max(highest, options.baseline - p[1]);
        lowest = Math.min(lowest, options.baseline - p[1]);
      }
    }
    glyphs.push(
      new opentype.Glyph({
        name: "uni" + char.codePointAt(0)!.toString(16).toUpperCase(),
        unicode: char.codePointAt(0),
        advanceWidth: shaped.advanceWidth,
        leftSideBearing: shaped.leftSideBearing,
        path,
      }),
    );
    if (i % 100 === 0)
      progress(
        10 + Math.round((i / entries.length) * 65),
        `${i + 1} / ${entries.length} 글자를 만들고 있어요`,
      );
  }
  progress(80, "설치 가능한 OTF 파일로 묶고 있어요");
  // opentype.js 1.x ignores leftSideBearing in Glyph constructor options.
  // Assign it explicitly so hmtx agrees with the actual CFF outline origin.
  for (const glyph of glyphs)
    glyph.leftSideBearing = glyph.path.commands.length
      ? Math.round(glyph.getBoundingBox().x1)
      : 0;
  const internalName =
    "Hanhoek-" + project.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const font = new opentype.Font({
    familyName: englishName,
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: Math.ceil(highest),
    descender: Math.min(-1, Math.floor(lowest)),
    glyphs,
  });
  for (const key of ["fontFamily", "fullName"] as const)
    font.names[key] = { en: englishName, ko: options.familyName.trim() };
  font.names.postScriptName = { en: postScriptName };
  font.names.version = { en: "Version 1.400" };
  Object.assign(font.names, {
    uniqueID: { en: internalName + "-1.400-" + project.updatedAt },
  });
  const mapping = glyphs.flatMap((glyph, index) =>
    glyph.unicodes.map((code) => ({ code, index })),
  );
  // opentype.js 1.x emits one format-4 segment per character (overflows at ~8k glyphs).
  // Avoid that quadratic/oversized legacy cmap; keep ASCII aliases for metric lookup,
  // retain each glyph.unicode for OS/2 ranges, then install compact full Unicode mappings.
  for (const glyph of glyphs)
    glyph.unicodes = glyph.unicodes.filter((code) => code < 128);
  const buffer = replaceCmap(font.toArrayBuffer(), mapping);
  return {
    buffer,
    stats: {
      direct: direct.size,
      composed,
      glyphs: glyphs.length,
      characters: entries.map((e) => e[0]),
    },
  };
}
