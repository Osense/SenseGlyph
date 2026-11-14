import { HANGUL, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import { fitStrokesToSafety } from "../safety";
import {
  beautifyStrokes,
  correctionAmounts,
  hasCorrection,
  medianPressure,
} from "./beautify";
import { decompose, slotKeys, vowelType } from "../hangul";
import { activeSeparation, effectiveSample } from "./editing";
import {
  referenceGuide,
  referencePart,
  type ReferenceSettings,
} from "./reference";
import type { FontProject, GlyphSample, Stroke } from "../types";
import type {
  Box,
  ComponentSample,
  Coverage,
  FontPreparation,
  Part,
  Separation,
} from "./types";

export const PART_LABELS: Record<Part, string> = {
  cho: "초성",
  jung: "중성",
  jong: "종성",
};
export const PART_COLORS: Record<Part, string> = {
  cho: "#387aab",
  jung: "#ba6e3c",
  jong: "#8b65b2",
};

// SPEC 해석: 자동 분리는 위치 상자와 획 중심의 거리만 사용한다. 겹치는 복합 모음은 사용자가 보정한다.
export function layoutBoxes(char: string): Partial<Record<Part, Box>> {
  const d = decompose(char);
  if (!d) return {};
  const bottom = d.jong ? 670 : 920;
  const height = bottom - 80;
  const type = vowelType(d.jung);
  return {
    cho:
      type === "V"
        ? { x: 80, y: 80, width: 450, height }
        : type === "H"
          ? { x: 80, y: 80, width: 840, height: height * 0.56 }
          : { x: 80, y: 80, width: 450, height: height * 0.56 },
    jung:
      type === "V"
        ? { x: 530, y: 80, width: 390, height }
        : type === "H"
          ? { x: 80, y: 80 + height * 0.56, width: 840, height: height * 0.44 }
          : { x: 80, y: 80, width: 840, height },
    ...(d.jong ? { jong: { x: 80, y: 690, width: 840, height: 230 } } : {}),
  };
}

export function boxesFor(
  char: string,
  separation?: Separation,
  reference?: ReferenceSettings,
) {
  return {
    ...(referenceGuide(char, reference)?.boxes ?? layoutBoxes(char)),
    ...separation?.boxes,
  };
}

export function strokeCenter(stroke: Stroke) {
  // Bounds center is insensitive to unequal sampling density and stationary pen events.
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function assignStroke(
  char: string,
  stroke: Stroke,
  separation?: Separation,
  reference?: ReferenceSettings,
  /** 이 글자의 모든 획: 견본 크기에 맞춰 판정할 때 씁니다. */
  context?: Stroke[],
): Part {
  const boxes = boxesFor(char, separation, reference);
  const manual = separation?.assignments[stroke.id];
  if (manual && boxes[manual]) return manual;
  if (!separation?.boxes) {
    const matched = referencePart(char, stroke, reference, context);
    if (matched) return matched;
  }
  const p = strokeCenter(stroke),
    d = decompose(char);
  if (!d) return "cho";
  if (boxes.jong && p.y >= boxes.jong.y - 10) return "jong";
  const cho = boxes.cho!;
  if (vowelType(d.jung) === "C") {
    return p.x <= cho.x + cho.width && p.y <= cho.y + cho.height
      ? "cho"
      : "jung";
  }
  const distance = (b: Box) => {
    const dx = Math.max(b.x - p.x, 0, p.x - b.x - b.width);
    const dy = Math.max(b.y - p.y, 0, p.y - b.y - b.height);
    return dx * dx + dy * dy;
  };
  return (Object.entries(boxes) as [Part, Box][]).sort(
    (a, b) => distance(a[1]) - distance(b[1]),
  )[0][0];
}

export function separateSample(
  sample: GlyphSample,
  separation?: Separation,
  reference?: ReferenceSettings,
): ComponentSample[] {
  separation = activeSeparation(sample, separation);
  sample = effectiveSample(sample, separation);
  const keys = slotKeys(sample.char),
    boxes = boxesFor(sample.char, separation, reference);
  return keys.flatMap((key) => {
    const part = key.split(":")[0] as Part;
    const strokes = sample.strokes.filter(
      (stroke) =>
        assignStroke(
          sample.char,
          stroke,
          separation,
          reference,
          sample.strokes,
        ) === part,
    );
    const confirmed = strokes.every(
      (stroke) => separation?.assignments[stroke.id] === part,
    );
    return strokes.length
      ? [
          {
            key,
            part,
            char: sample.char,
            strokes,
            box: boxes[part]!,
            ...(confirmed ? { confirmed: true as const } : {}),
          },
        ]
      : [];
  });
}

export function componentLibrary(project: FontProject, prep: FontPreparation) {
  return prepareHandwriting(project, prep).library;
}

/** 쓴 글자 → 출력용 획과 자모 표본.
 * - 칸 밖으로 나간 글자는 비율을 유지한 채 안전영역 안으로 줄여 넣습니다.
 * - applyCorrection이면 설정한 강도만큼 손글씨를 정돈합니다(lib/font/beautify.ts).
 *   정돈한 획은 직접 쓴 글자와 조합 글자에 똑같이 쓰이므로 둘의 모양이 어긋나지 않습니다.
 * - 원본 프로젝트는 바꾸지 않습니다. */
export type Handwriting = ReturnType<typeof baseHandwriting>;

function libraryFrom(pools: Map<string, ComponentSample[]>) {
  const library = new Map<string, ComponentSample>();
  for (const [key, pool] of pools) {
    const confirmed = pool.filter((component) => component.confirmed);
    library.set(key, confirmed[0] ?? pool[0]);
  }
  return library;
}

/** 정돈 전 단계: 자모 분리 + 칸 밖 글자 맞춰 넣기. 설정 슬라이더와 무관하므로 한 번만 계산해 재사용합니다. */
export function baseHandwriting(project: FontProject, prep: FontPreparation) {
  const pools = new Map<string, ComponentSample[]>();
  const direct = new Map<string, Stroke[]>();
  const parts = new Map<string, ComponentSample[]>();
  const chars = [
    ...new Set([...HANGUL, ...Object.keys(project.samples).sort()]),
  ];
  for (const char of chars) {
    const sample = project.samples[char];
    if (!sample?.strokes.length || RETIRED_SPECIAL_SYMBOLS.has(char)) continue;
    const effective = effectiveSample(sample, prep.separations[char]).strokes;
    const fitted = fitStrokesToSafety(effective, sample.category);
    let own = separateSample(sample, prep.separations[char], project.settings);
    if (fitted !== effective) {
      const byId = new Map(fitted.map((stroke) => [stroke.id, stroke]));
      own = own.map((part) => ({
        ...part,
        strokes: part.strokes.map((stroke) => byId.get(stroke.id) ?? stroke),
      }));
    }
    direct.set(char, fitted);
    parts.set(char, own);
    for (const part of own)
      pools.set(part.key, [...(pools.get(part.key) ?? []), part]);
  }
  return { library: libraryFrom(pools), direct, pools, parts };
}

/** 정돈 단계: 이미 나눈 결과(base)에 정돈만 다시 적용합니다. 강도가 0이면 base를 그대로 돌려줍니다. */
export function correctHandwriting(
  base: Handwriting,
  project: FontProject,
  prep: FontPreparation,
): Handwriting {
  const amounts = correctionAmounts(prep.settings);
  if (!hasCorrection(amounts)) return base;
  const pressureTarget = medianPressure([...base.direct.values()].flat());
  const direct = new Map<string, Stroke[]>();
  const parts = new Map<string, ComponentSample[]>();
  const pools = new Map<string, ComponentSample[]>();
  for (const [char, fitted] of base.direct) {
    const sample = project.samples[char];
    const own = base.parts.get(char) ?? [];
    const partOf = new Map<string, Part>();
    for (const part of own)
      for (const stroke of part.strokes) partOf.set(stroke.id, part.part);
    const strokes = beautifyStrokes(fitted, {
      amounts,
      category: sample.category,
      partOf,
      boxes: referenceGuide(char, project.settings)?.boxes,
      pressureTarget,
    });
    const byId = new Map(strokes.map((stroke) => [stroke.id, stroke]));
    const corrected =
      strokes === fitted
        ? own
        : own.map((part) => ({
            ...part,
            strokes: part.strokes.map(
              (stroke) => byId.get(stroke.id) ?? stroke,
            ),
          }));
    direct.set(char, strokes);
    parts.set(char, corrected);
    for (const part of corrected)
      pools.set(part.key, [...(pools.get(part.key) ?? []), part]);
  }
  return { library: libraryFrom(pools), direct, pools, parts };
}

/** 쓴 글자 → 출력용 획과 자모 표본.
 * - 칸 밖으로 나간 글자는 비율을 유지한 채 안전영역 안으로 줄여 넣습니다.
 * - applyCorrection이면 설정한 강도만큼 손글씨를 정돈합니다(lib/font/beautify.ts).
 *   정돈한 획은 직접 쓴 글자와 조합 글자에 똑같이 쓰이므로 둘의 모양이 어긋나지 않습니다.
 * - 원본 프로젝트는 바꾸지 않습니다. */
export function prepareHandwriting(
  project: FontProject,
  prep: FontPreparation,
  applyCorrection = false,
): Handwriting {
  const base = baseHandwriting(project, prep);
  return applyCorrection ? correctHandwriting(base, project, prep) : base;
}

const ALL_SLOTS = [...new Set(HANGUL.flatMap(slotKeys))];
export function coverage(
  project: FontProject,
  prep: FontPreparation,
): Coverage {
  const library = componentLibrary(project, prep);
  const direct = Object.values(project.samples)
    .map((sample) => effectiveSample(sample, prep.separations[sample.char]))
    .filter((s) => s.strokes.length && !RETIRED_SPECIAL_SYMBOLS.has(s.char))
    .map((s) => s.char);
  const available = new Set(direct);
  let composed = 0;
  for (let code = 0xac00; code <= 0xd7a3; code++) {
    const char = String.fromCharCode(code);
    if (
      !available.has(char) &&
      slotKeys(char).every((key) => library.has(key))
    ) {
      available.add(char);
      composed++;
    }
  }
  const missingSlots = ALL_SLOTS.filter((key) => !library.has(key));
  return {
    direct: direct.length,
    slots: library.size,
    totalSlots: 237,
    composed,
    missingSlots,
    missingSamples: HANGUL.filter((char) =>
      slotKeys(char).some((key) => missingSlots.includes(key)),
    ),
    available: [...available],
  };
}

type Frame = { x: number; y: number; width: number; height: number };
function frameOf(strokes: Stroke[]): Frame | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const stroke of strokes)
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  return minX === Infinity
    ? null
    : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 원본 글자(쓴 글자)마다 전체 범위를 한 번만 구해 둔다. */
const sourceFrames = new WeakMap<
  Map<string, ComponentSample[]>,
  Map<string, Frame | null>
>();
function sourceFrame(pools: Map<string, ComponentSample[]>, char: string) {
  let frames = sourceFrames.get(pools);
  if (!frames) {
    const byChar = new Map<string, Stroke[]>();
    for (const pool of pools.values())
      for (const component of pool)
        byChar.set(component.char, [
          ...(byChar.get(component.char) ?? []),
          ...component.strokes,
        ]);
    frames = new Map(
      [...byChar].map(([source, strokes]) => [source, frameOf(strokes)]),
    );
    sourceFrames.set(pools, frames);
  }
  return frames.get(char) ?? null;
}

/** 같은 짜임(세로·가로·섞임 모음, 받침 유무)으로 쓴 글자들의 보통 범위(중앙값). */
const typicalFrames = new WeakMap<
  Map<string, ComponentSample[]>,
  Map<string, Frame>
>();
function layoutKey(char: string) {
  const d = decompose(char)!;
  return vowelType(d.jung) + ":" + (d.jong > 0);
}
function typicalFrame(pools: Map<string, ComponentSample[]>, char: string) {
  let typical = typicalFrames.get(pools);
  if (!typical) {
    const groups = new Map<string, Frame[]>();
    const seen = new Set<string>();
    for (const pool of pools.values())
      for (const component of pool) {
        if (seen.has(component.char)) continue;
        seen.add(component.char);
        const frame = sourceFrame(pools, component.char);
        if (!frame) continue;
        const key = layoutKey(component.char);
        groups.set(key, [...(groups.get(key) ?? []), frame]);
      }
    const median = (values: number[]) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    typical = new Map(
      [...groups].map(([key, frames]) => [
        key,
        {
          x: median(frames.map((f) => f.x)),
          y: median(frames.map((f) => f.y)),
          width: median(frames.map((f) => f.width)),
          height: median(frames.map((f) => f.height)),
        },
      ]),
    );
    typicalFrames.set(pools, typical);
  }
  return typical.get(layoutKey(char)) ?? null;
}

/**
 * 다른 글자에서 가져온 자모를, 그 글자 안에서 차지하던 자리 비율대로 새 글자 범위에 옮긴다.
 * 손글씨는 글자마다 크기·위치가 조금씩 달라서 절대 좌표 그대로 모으면 자모가 겹치거나
 * 벌어진다(예: 크게 쓴 '각'의 ㄱ + 작게 쓴 '난'의 ㄴ 받침). 위치는 비율로 맞추고,
 * 자모 모양 자체는 크게 바꾸지 않도록 크기 변화는 0.8~1.25배로 묶는다.
 */
function placeComponent(
  strokes: Stroke[],
  from: Frame | null,
  to: Frame | null,
): Stroke[] {
  if (!from || !to || from.width < 40 || from.height < 40) return strokes;
  const own = frameOf(strokes);
  if (!own) return strokes;
  const clamp = (v: number) => Math.min(1.25, Math.max(0.8, v));
  const sx = clamp(to.width / from.width),
    sy = clamp(to.height / from.height);
  const cx = own.x + own.width / 2,
    cy = own.y + own.height / 2;
  const nx = to.x + ((cx - from.x) / from.width) * to.width,
    ny = to.y + ((cy - from.y) / from.height) * to.height;
  if (
    Math.abs(nx - cx) < 1 &&
    Math.abs(ny - cy) < 1 &&
    Math.abs(sx - 1) < 0.01 &&
    Math.abs(sy - 1) < 0.01
  )
    return strokes;
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: nx + (p.x - cx) * sx,
      y: ny + (p.y - cy) * sy,
    })),
  }));
}

/** Exact contextual slots already share the same writing layout and em coordinates. */
export function composeGlyph(
  char: string,
  library: Map<string, ComponentSample>,
  pools?: Map<string, ComponentSample[]>,
): Stroke[] | null {
  const keys = slotKeys(char);
  if (!keys.length || !keys.every((key) => library.has(key))) return null;
  if (!pools) return keys.flatMap((key) => library.get(key)!.strokes);

  const wanted = decompose(char)!;
  const [initialKey, medialKey] = keys;
  const matches = new Map<string, Map<string, ComponentSample>>();
  for (const key of keys) {
    for (const component of pools.get(key) ?? []) {
      const parts = matches.get(component.char) ?? new Map();
      parts.set(key, component);
      matches.set(component.char, parts);
    }
  }

  // Keep the upper pair together when sources supply the same number of parts.
  // 졺 preserves the ㅈ–ㅗ relationship in 좋 even if a source with ㅈ–ㅎ
  // and a different horizontal vowel has confirmed assignments.
  const anchorRank = (parts: Map<string, ComponentSample>) =>
    parts.size * 8 +
    Number(parts.has(initialKey) && parts.has(medialKey)) * 4 +
    [...parts.values()].filter((part) => part.confirmed).length;
  let anchor: Map<string, ComponentSample> | undefined;
  let bestRank = 0;
  for (const parts of matches.values()) {
    if (parts.size < 2) continue;
    const rank = anchorRank(parts);
    if (rank > bestRank) {
      anchor = parts;
      bestRank = rank;
    }
  }

  const sourceRank = (component: ComponentSample) => {
    const source = decompose(component.char)!;
    return (
      Number(!!component.confirmed) * 4 +
      Number(source.jung === wanted.jung) * 2 +
      Number(source.cho === wanted.cho)
    );
  };
  // 자모를 모아 놓을 글자 범위: 짝이 맞는 글자(anchor)가 있으면 그 글자, 없으면 같은 짜임의 보통 범위
  const anchorChar = anchor && [...anchor.values()][0].char;
  const target = anchorChar
    ? sourceFrame(pools, anchorChar)
    : typicalFrame(pools, char);
  return keys.flatMap((key) => {
    const original = anchor?.get(key);
    if (original) return original.strokes;
    const source = (pools.get(key) ?? []).reduce(
      (best, candidate) =>
        sourceRank(candidate) > sourceRank(best) ? candidate : best,
      library.get(key)!,
    );
    return placeComponent(
      source.strokes,
      sourceFrame(pools, source.char),
      target,
    );
  });
}
