import { HANGUL, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import { fitStrokesToSafety } from "../safety";
import {
  beautifyStrokes,
  correctionAmounts,
  hasCorrection,
  medianPressure,
  ownLayouts,
  vowelNorms,
  writerSlant,
} from "./beautify";
import { decompose, slotKeys, vowelType } from "../hangul";
import { activeSeparation, effectiveSample } from "./editing";
import { cachedJudgement } from "./judge";
import { arrangePieces, relationsOf, type Piece } from "./relations";
import { cachedShape, shapeDistance, shapeGroup } from "./jamo-shape";
import { referenceLayout } from "./reference-layout";
import { alignPieces, averagePieces, ownChoOffset } from "./balance";
import {
  blendStrokes,
  deriveMissingSlots,
  placeInBox,
  sameShape,
} from "./interpolate";
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
const ALL_SLOTS = [...new Set(HANGUL.flatMap(slotKeys))];

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
    // 글자 전체 획을 알면 획순·획수·자리를 함께 보고 판정한다(lib/font/judge.ts).
    if (context?.some((other) => other.id === stroke.id)) {
      const judged = cachedJudgement(
        char,
        context,
        reference,
        separation?.assignments,
      )?.parts.get(stroke.id);
      if (judged && boxes[judged]) return judged;
    }
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

/**
 * 표본마다 '같은 자모의 다른 표본들과 얼마나 다른지'(거리 중앙값)와, 눈에 띄게 다른 표본(suspect)인지.
 * 자모를 잘못 나눴거나 한 글자를 삐끗한 표본이 그 자리의 대표가 되어 수백 자에 퍼지는 것을 막는 데 쓴다.
 */
const oddness = new WeakMap<
  Map<string, ComponentSample[]>,
  Map<ComponentSample, { score: number; suspect: boolean }>
>();
function oddnessOf(pools: Map<string, ComponentSample[]>) {
  let info = oddness.get(pools);
  if (info) return info;
  info = new Map();
  const groups = new Map<string, ComponentSample[]>();
  for (const pool of pools.values())
    for (const c of pool) {
      const group = !c.derived && shapeGroup(c);
      if (group && cachedShape(c.strokes))
        groups.set(group, [...(groups.get(group) ?? []), c]);
    }
  const mid = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const members of groups.values()) {
    if (members.length < 3) continue;
    const scores = members.map((m) =>
      mid(
        members
          .filter((o) => o !== m)
          .map((o) =>
            shapeDistance(cachedShape(m.strokes)!, cachedShape(o.strokes)!),
          ),
      ),
    );
    const usual = mid(scores);
    members.forEach((m, i) =>
      info!.set(m, {
        score: scores[i],
        suspect: !m.confirmed && scores[i] > Math.max(0.13, usual * 2.4),
      }),
    );
  }
  oddness.set(pools, info);
  return info;
}

/** 이 표본들을 쓸 때 고른 견본 글꼴(견본 배치 활용에 쓴다) */
const poolFont = new WeakMap<Map<string, ComponentSample[]>, string>();

function libraryFrom(pools: Map<string, ComponentSample[]>) {
  const library = new Map<string, ComponentSample>();
  const odd = oddnessOf(pools);
  for (const [key, pool] of pools) {
    const confirmed = pool.filter((component) => component.confirmed);
    // 대표 표본: 확인한 것 → 먼저 쓴 것. 다만 먼저 쓴 것이 같은 자모의 다른 표본들과 눈에 띄게 다르면
    // 그 자리의 다른 표본 가운데 가장 닮은 것으로 바꾼다.
    let pick = confirmed[0] ?? pool[0];
    if (!pick.confirmed && odd.get(pick)?.suspect) {
      const better = pool
        .filter((c) => odd.has(c) && !odd.get(c)!.suspect)
        .sort((a, b) => odd.get(a)!.score - odd.get(b)!.score)[0];
      if (better) pick = better;
    }
    library.set(key, pick);
  }
  // 쓰지 않은 짜임은 가까운 짜임의 내 글씨로 만들어 채운다(조합 보간).
  return deriveMissingSlots(library, ALL_SLOTS);
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
  poolFont.set(pools, project.settings.referenceFont ?? "sans");
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
  // 내 글씨의 평소 가로·세로 기울기와, 짜임별 모음 기둥 높이·보 너비(글자 사이 일관성)
  const slant = writerSlant([...base.direct.values()].flat());
  const vowelOf = (char: string) => {
    const d = decompose(char);
    return d ? { type: vowelType(d.jung), jong: d.jong > 0 } : undefined;
  };
  const norms = vowelNorms(
    [...base.parts].flatMap(([char, own]) => {
      const vowel = vowelOf(char);
      const jung = own.find((part) => part.part === "jung");
      return vowel && jung ? [{ vowel, jung: jung.strokes }] : [];
    }),
  );
  // 내 평소 자모 배치(같은 짜임끼리의 중앙값). 자모 배치 정돈은 견본 글꼴이 아니라 이쪽으로 당긴다.
  const own = ownLayouts(
    [...base.parts].flatMap(([char, list]) =>
      decompose(char) ? [{ layout: layoutKey(char), parts: list }] : [],
    ),
  );
  const direct = new Map<string, Stroke[]>();
  const parts = new Map<string, ComponentSample[]>();
  const pools = new Map<string, ComponentSample[]>();
  for (const [char, fitted] of base.direct) {
    const sample = project.samples[char];
    const mine = base.parts.get(char) ?? [];
    const partOf = new Map<string, Part>();
    for (const part of mine)
      for (const stroke of part.strokes) partOf.set(stroke.id, part.part);
    const strokes = beautifyStrokes(fitted, {
      amounts,
      category: sample.category,
      partOf,
      boxes:
        (decompose(char) && own.get(layoutKey(char))) ||
        referenceGuide(char, project.settings)?.boxes,
      pressureTarget,
      slant,
      vowel: vowelOf(char),
      norms,
    });
    const byId = new Map(strokes.map((stroke) => [stroke.id, stroke]));
    const corrected =
      strokes === fitted
        ? mine
        : mine.map((part) => ({
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
  poolFont.set(pools, project.settings.referenceFont ?? "sans");
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
      prep.settings.includeComposed !== false &&
      !available.has(char) &&
      slotKeys(char).every((key) => library.has(key))
    ) {
      available.add(char);
      composed++;
    }
  }
  // 직접 쓴 표본이 없는 자리(보간으로 만든 자리 포함): 더 써 보면 좋은 글자를 안내할 때 쓴다.
  const missingSlots = ALL_SLOTS.filter(
    (key) => !library.has(key) || library.get(key)!.derived,
  );
  return {
    direct: direct.length,
    slots: [...library.values()].filter((c) => !c.derived).length,
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

/** 내 글씨에서 가로·섞임 모음 위 초성이 짧은 기둥보다 치우친 정도(한 번만 계산) */
const choOffsets = new WeakMap<Map<string, ComponentSample[]>, number | undefined>();
function choOffsetOf(pools: Map<string, ComponentSample[]>) {
  if (choOffsets.has(pools)) return choOffsets.get(pools);
  const byChar = new Map<string, { cho?: Stroke[]; jung?: Stroke[] }>();
  for (const pool of pools.values())
    for (const c of pool) {
      if (c.derived || c.part === "jong") continue;
      const d = decompose(c.char);
      if (!d || vowelType(d.jung) === "V") continue;
      const entry = byChar.get(c.char) ?? {};
      entry[c.part] = c.strokes;
      byChar.set(c.char, entry);
    }
  const value = ownChoOffset(
    [...byChar].flatMap(([char, { cho, jung }]) => {
      const frame = sourceFrame(pools, char);
      return cho && jung && frame ? [{ cho, jung, frame }] : [];
    }),
  );
  choOffsets.set(pools, value);
  return value;
}

/**
 * 모음 갈래: 같은 짜임(세로·가로·섞임) 안에서도 초성·받침의 모양과 자리를 바꾸는 모음 묶음.
 * 세로: ㅏㅑㅣ / ㅓㅕ / ㅐㅒㅔㅖ, 가로: ㅗㅛ / ㅜㅠ / ㅡ, 섞임: ㅘㅙㅚ / ㅝㅞㅟ / ㅢ
 */
const VOWEL_FAMILY = [0, 2, 0, 2, 1, 2, 1, 2, 3, 6, 6, 6, 3, 4, 7, 7, 7, 4, 5, 8, 0];
export const vowelFamily = (jung: number) => VOWEL_FAMILY[jung];

/** Exact contextual slots already share the same writing layout and em coordinates. */
export function composeGlyph(
  char: string,
  library: Map<string, ComponentSample>,
  pools?: Map<string, ComponentSample[]>,
  /** 자모 균형 보정 강도 0~1(lib/font/balance.ts). 0이면 쓴 그대로 */
  balance = 0,
): Stroke[] | null {
  const keys = slotKeys(char);
  if (!keys.length || !keys.every((key) => library.has(key))) return null;
  if (!pools) return keys.flatMap((key) => library.get(key)!.strokes);

  const wanted = decompose(char)!;
  const odd = oddnessOf(pools);
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
      // 같은 모음은 아니어도 같은 갈래(ㅗ·ㅛ / ㅜ·ㅠ / ㅏ·ㅑ·ㅣ / ㅓ·ㅕ …)에서 쓴 자모를 먼저:
      // '고'의 ㄱ과 '구'의 ㄱ처럼 모음 갈래에 따라 초성 모양·자리가 달라진다.
      Number(vowelFamily(source.jung) === vowelFamily(wanted.jung)) * 1.5 +
      Number(source.cho === wanted.cho) -
      // 같은 자모의 다른 표본들과 눈에 띄게 다른 표본은 맨 뒤로
      Number(!!odd.get(component)?.suspect) * 8
    );
  };
  // 자모를 모아 놓을 글자 범위: 짝이 맞는 글자(anchor)가 있으면 그 글자, 없으면 같은 짜임의 보통 범위
  const anchorChar = anchor && [...anchor.values()][0].char;
  const target = anchorChar
    ? sourceFrame(pools, anchorChar)
    : typicalFrame(pools, char);
  const pieces = keys.map((key): Piece => {
    const part = key.split(":")[0] as Part;
    const original = anchor?.get(key);
    if (original) return { key, part, strokes: original.strokes, fixed: true };
    const pool = pools.get(key) ?? [];
    const source = pool.reduce(
      (best, candidate) =>
        sourceRank(candidate) > sourceRank(best) ? candidate : best,
      library.get(key)!,
    );
    // 다른 짜임에서 옮겨 만든 자모: 정해 둔 자리에 놓는다.
    if (source.place)
      return {
        key,
        part,
        fixed: false,
        strokes: placeInBox(
          source.strokes,
          source.place,
          target ?? { x: 120, y: 120, width: 760, height: 760 },
        ),
      };
    // 같은 자모를 여러 글자에서 썼다면 획 기본형이 같은 것끼리 섞는다(내 글씨의 평균 모양).
    const home = sourceFrame(pools, source.char);
    const others = pool
      .filter(
        (c) =>
          c !== source &&
          c.char !== source.char &&
          sameShape(source.strokes, c.strokes),
      )
      .sort((a, b) => sourceRank(b) - sourceRank(a))
      .slice(0, 2)
      .map((c) => placeComponent(c.strokes, sourceFrame(pools, c.char), home));
    const blended = others.length
      ? blendStrokes(source.strokes, others, 0.6, true)
      : source.strokes;
    return {
      key,
      part,
      fixed: false,
      strokes: placeComponent(blended, home, target),
    };
  });
  // 균형 보정 1: 같은 자리 자모의 평균 위치·크기로(강도만큼)
  const averaged = averagePieces(pieces, pools, target, balance);
  // 자리만 맞춘 조각들을 내 글씨에서 배운 관계(간격·맞춤·크기)대로 다시 쌓는다(lib/font/relations.ts).
  const arranged = arrangePieces(char, averaged, relationsOf(pools), target);
  // 균형 보정 2: 초성–모음 기둥 맞춤, 받침 가운데(강도만큼)
  const aligned = alignPieces(
    char,
    arranged,
    target,
    balance,
    choOffsetOf(pools),
  );
  // 균형 보정 3: 견본을 따라 쓴 만큼, 견본이 이 글자에서 자모를 두는 자리·크기 쪽으로(강도만큼)
  return followReference(char, aligned, pools, balance).flatMap(
    (piece) => piece.strokes,
  );
}

/* ---------- 견본 배치 활용 ---------- */
type Rel = [cx: number, cy: number, w: number, h: number];
interface Follow {
  /** 견본을 따라 쓴 정도 0~1 */
  degree: number;
  /** 내 글씨가 견본에서 한결같이 벗어난 만큼(자모·짜임별, 글자 범위 비율) */
  bias: Map<string, Rel>;
  residual: number;
}
const follows = new WeakMap<Map<string, ComponentSample[]>, Follow | null>();
const relOf = (box: Box, frame: Frame): Rel => [
  (box.x + box.width / 2 - frame.x) / frame.width,
  (box.y + box.height / 2 - frame.y) / frame.height,
  box.width / frame.width,
  box.height / frame.height,
];
const med = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** 견본을 따라 쓴 정도를 잴 때: 이 값보다 덜 벗어나면 그대로 따라 쓴 것, FOLLOW_NONE 보다 크면 따라 쓰지 않은 것 */
const FOLLOW_FULL = 0.015,
  FOLLOW_NONE = 0.035;

/**
 * 쓴 글자마다 자모 상자를 견본의 그 글자 자모 상자와 견준다.
 * - 한결같은 차이(bias): 펜 굵기, 초성을 크게 쓰는 버릇처럼 모든 글자에 같이 나타나는 차이.
 * - 남는 차이(residual): 견본을 따라 쓰지 않을수록 크다 → 따라 쓴 정도(degree).
 */
export function followOf(pools: Map<string, ComponentSample[]>): Follow | null {
  if (follows.has(pools)) return follows.get(pools)!;
  const font = poolFont.get(pools);
  let result: Follow | null = null;
  if (font) {
    const diffs = new Map<string, Rel[]>();
    const seen = new Set<ComponentSample>();
    for (const pool of pools.values())
      for (const c of pool) {
        if (c.derived || seen.has(c) || !decompose(c.char)) continue;
        seen.add(c);
        const frame = sourceFrame(pools, c.char),
          ref = referenceLayout(font, c.char)?.[c.part],
          own = frameOf(c.strokes);
        if (!frame || !ref || !own || frame.width < 60 || frame.height < 60)
          continue;
        const a = relOf(own, frame),
          b: Rel = [
            ref.x + ref.width / 2,
            ref.y + ref.height / 2,
            ref.width,
            ref.height,
          ];
        const key = c.part + ":" + layoutKey(c.char);
        diffs.set(key, [
          ...(diffs.get(key) ?? []),
          [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]],
        ]);
      }
    const bias = new Map<string, Rel>();
    const residuals: number[] = [];
    for (const [key, list] of diffs) {
      if (list.length < 3) continue;
      const b = [0, 1, 2, 3].map((k) => med(list.map((d) => d[k]))) as Rel;
      bias.set(key, b);
      for (const d of list)
        residuals.push(
          (Math.abs(d[0] - b[0]) +
            Math.abs(d[1] - b[1]) +
            Math.abs(d[2] - b[2]) +
            Math.abs(d[3] - b[3])) /
            4,
        );
    }
    if (residuals.length >= 30) {
      const residual = med(residuals);
      result = {
        bias,
        residual,
        degree: Math.max(
          0,
          Math.min(1, (FOLLOW_NONE - residual) / (FOLLOW_NONE - FOLLOW_FULL)),
        ),
      };
    }
  }
  follows.set(pools, result);
  return result;
}

/**
 * 견본 배치 활용: 조합한 글자의 자모를 '견본이 이 글자에서 두는 자리·크기 + 내 글씨의 한결같은 차이' 쪽으로 옮긴다.
 * 견본은 11,172자를 모두 따로 그렸기 때문에, 같은 자리 안에서 글자마다 달라지는 차이
 * (ㅃ 옆의 좁은 ㅏ, ㅗ 위의 낮은 ㄱ)를 알고 있다. 옮기는 양 = 따라 쓴 정도 × 균형 보정 강도.
 * 획 모양은 건드리지 않고 자리와 크기(0.85~1.18배)만 바꾼다. 짝이 맞는 글자에서 온 자모(fixed)는 그대로.
 */
function followReference(
  char: string,
  pieces: Piece[],
  pools: Map<string, ComponentSample[]>,
  balance: number,
): Piece[] {
  if (balance <= 0 || pieces.every((p) => p.fixed)) return pieces;
  const follow = followOf(pools);
  const font = poolFont.get(pools);
  if (!follow || !font || follow.degree <= 0.05) return pieces;
  const ref = referenceLayout(font, char);
  const frame = frameOf(pieces.flatMap((p) => p.strokes));
  if (!ref || !frame || frame.width < 60 || frame.height < 60) return pieces;
  const weight = follow.degree * Math.min(1, balance * 1.5) * 0.8;
  return pieces.map((piece) => {
    const r = ref[piece.part],
      bias = follow.bias.get(piece.part + ":" + layoutKey(char)),
      box = frameOf(piece.strokes);
    if (piece.fixed || !r || !bias || !box || box.width < 4 || box.height < 4)
      return piece;
    const want = {
      cx: frame.x + (r.x + r.width / 2 + bias[0]) * frame.width,
      cy: frame.y + (r.y + r.height / 2 + bias[1]) * frame.height,
      w: Math.max(4, (r.width + bias[2]) * frame.width),
      h: Math.max(4, (r.height + bias[3]) * frame.height),
    };
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    const limit = (v: number) => Math.max(0.85, Math.min(1.18, v));
    // 가늘고 긴 자모(ㅡ·ㅣ)는 긴 쪽만 맞춘다(얇은 쪽을 늘이면 떨림이 커진다)
    const sx =
      box.height > box.width * 2.5 ? 1 : limit((want.w / box.width) ** weight),
      sy =
        box.width > box.height * 2.5
          ? 1
          : limit((want.h / box.height) ** weight);
    const nx = cx + (want.cx - cx) * weight,
      ny = cy + (want.cy - cy) * weight;
    return {
      ...piece,
      strokes: piece.strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((p) => ({
          ...p,
          x: nx + (p.x - cx) * sx,
          y: ny + (p.y - cy) * sy,
        })),
      })),
    };
  });
}
