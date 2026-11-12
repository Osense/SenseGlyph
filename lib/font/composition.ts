import { HANGUL, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import { fitStrokesToSafety } from "../safety";
import {
  beautifyStrokes,
  correctionAmounts,
  hasCorrection,
  medianPressure,
  NO_CORRECTION,
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
): Part {
  const boxes = boxesFor(char, separation, reference);
  const manual = separation?.assignments[stroke.id];
  if (manual && boxes[manual]) return manual;
  if (!separation?.boxes) {
    const matched = referencePart(char, stroke, reference);
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
        assignStroke(sample.char, stroke, separation, reference) === part,
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
export function prepareHandwriting(
  project: FontProject,
  prep: FontPreparation,
  applyCorrection = false,
) {
  const library = new Map<string, ComponentSample>();
  const pools = new Map<string, ComponentSample[]>();
  const direct = new Map<string, Stroke[]>();
  const amounts = applyCorrection
    ? correctionAmounts(prep.settings)
    : NO_CORRECTION;
  const correcting = hasCorrection(amounts);
  const chars = [
    ...new Set([...HANGUL, ...Object.keys(project.samples).sort()]),
  ];
  const written = chars.flatMap((char) => {
    const sample = project.samples[char];
    return sample?.strokes.length && !RETIRED_SPECIAL_SYMBOLS.has(char)
      ? [sample]
      : [];
  });
  const pressureTarget = correcting
    ? medianPressure(
        written.flatMap(
          (sample) =>
            effectiveSample(sample, prep.separations[sample.char]).strokes,
        ),
      )
    : NaN;
  for (const sample of written) {
    const char = sample.char;
    const effective = effectiveSample(sample, prep.separations[char]).strokes;
    const fitted = fitStrokesToSafety(effective, sample.category);
    let parts = separateSample(
      sample,
      prep.separations[char],
      project.settings,
    );
    let strokes = fitted;
    if (correcting || fitted !== effective) {
      const partOf = new Map<string, Part>();
      for (const part of parts)
        for (const stroke of part.strokes) partOf.set(stroke.id, part.part);
      strokes = correcting
        ? beautifyStrokes(fitted, {
            amounts,
            category: sample.category,
            partOf,
            boxes: referenceGuide(char, project.settings)?.boxes,
            pressureTarget,
          })
        : fitted;
      const byId = new Map(strokes.map((stroke) => [stroke.id, stroke]));
      parts = parts.map((part) => ({
        ...part,
        strokes: part.strokes.map((stroke) => byId.get(stroke.id) ?? stroke),
      }));
    }
    direct.set(char, strokes);
    for (const part of parts)
      pools.set(part.key, [...(pools.get(part.key) ?? []), part]);
  }
  for (const [key, pool] of pools) {
    const confirmed = pool.filter((component) => component.confirmed);
    library.set(key, confirmed[0] ?? pool[0]);
  }
  return { library, direct, pools };
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

/** Exact contextual slots already share the same writing layout and em coordinates. */
export function composeGlyph(
  char: string,
  library: Map<string, ComponentSample>,
  pools?: Map<string, ComponentSample[]>,
): Stroke[] | null {
  const keys = slotKeys(char);
  if (!keys.length || !keys.every((key) => library.has(key))) return null;
  if (!pools) return keys.flatMap((key) => library.get(key)!.strokes);

  const target = decompose(char)!;
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
      Number(source.jung === target.jung) * 2 +
      Number(source.cho === target.cho)
    );
  };
  return keys.flatMap((key) => {
    const original = anchor?.get(key);
    if (original) return original.strokes;
    const source = (pools.get(key) ?? []).reduce(
      (best, candidate) =>
        sourceRank(candidate) > sourceRank(best) ? candidate : best,
      library.get(key)!,
    );
    return source.strokes;
  });
}
