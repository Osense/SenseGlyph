import { HANGUL } from "../../data/charset";
import { decompose, slotKeys, vowelType } from "../hangul";
import { activeSeparation, effectiveSample, strokeBounds } from "./editing";
import {
  refinePool,
  correction,
  interpolation,
  widthCorrection,
} from "./interpolation";
import { strokesAreSafe } from "../safety";
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
    let box = boxes[part]!;
    // A guide estimates assignment; it must not crop a user's larger handwriting
    // when reusing that component in another syllable. Explicit edits still win.
    if (strokes.length && !separation?.boxes?.[part]) {
      const ink = strokeBounds(strokes)!;
      const left = Math.min(box.x, ink.x - 12),
        top = Math.min(box.y, ink.y - 12),
        right = Math.max(box.x + box.width, ink.x + ink.width + 12),
        bottom = Math.max(box.y + box.height, ink.y + ink.height + 12);
      box = { x: left, y: top, width: right - left, height: bottom - top };
    }
    return strokes.length
      ? [{ key, part, char: sample.char, strokes, box }]
      : [];
  });
}

export function componentLibrary(project: FontProject, prep: FontPreparation) {
  return prepareHandwriting(project, prep).library;
}

export function prepareHandwriting(
  project: FontProject,
  prep: FontPreparation,
) {
  const library = new Map<string, ComponentSample>();
  const pools = new Map<string, ComponentSample[]>();
  const partsByChar = new Map<string, ComponentSample[]>();
  const direct = new Map<string, Stroke[]>();
  const chars = [
    ...new Set([...HANGUL, ...Object.keys(project.samples).sort()]),
  ];
  for (const char of chars) {
    const sample = project.samples[char];
    if (!sample?.strokes.length) continue;
    direct.set(char, effectiveSample(sample, prep.separations[char]).strokes);
    const parts = separateSample(
      sample,
      prep.separations[char],
      project.settings,
    );
    partsByChar.set(char, parts);
    for (const part of parts)
      pools.set(part.key, [...(pools.get(part.key) ?? []), part]);
  }
  const refiners = new Map<string, ReturnType<typeof refinePool>>();
  for (const [key, pool] of pools) {
    const model = refinePool(pool, prep.settings);
    refiners.set(key, model);
    // Zero is a genuine comparison against the previous first-sample algorithm.
    library.set(
      key,
      !correction(prep.settings) &&
        !interpolation(prep.settings) &&
        !widthCorrection(prep.settings)
        ? pool[0]
        : model.representative,
    );
  }
  for (const [char, parts] of partsByChar) {
    const sample = project.samples[char];
    const edit = activeSeparation(sample, prep.separations[char]);
    // Explicit geometry edits win; never silently undo the user's manual work.
    if (edit?.boxes || edit?.strokes || !parts.length) continue;
    const replacements = new Map(
      parts.flatMap((part) =>
        refiners
          .get(part.key)!
          .refine(part)
          .strokes.map((s) => [s.id, s] as const),
      ),
    );
    const strokes = direct.get(char)!.map((s) => replacements.get(s.id) ?? s);
    if (strokesAreSafe(strokes, sample.category)) direct.set(char, strokes);
  }
  return { library, direct };
}

const ALL_SLOTS = [...new Set(HANGUL.flatMap(slotKeys))];
export function coverage(
  project: FontProject,
  prep: FontPreparation,
): Coverage {
  const library = componentLibrary(project, prep);
  const direct = Object.values(project.samples)
    .map((sample) => effectiveSample(sample, prep.separations[sample.char]))
    .filter((s) => s.strokes.length)
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

export function transformComponent(
  component: ComponentSample,
  target: Box,
): Stroke[] {
  const from = component.box,
    sx = target.width / from.width,
    sy = target.height / from.height;
  return component.strokes.map((stroke) => ({
    ...stroke,
    params: { ...stroke.params, size: stroke.params.size * Math.sqrt(sx * sy) },
    points: stroke.points.map((p) => ({
      ...p,
      x: target.x + (p.x - from.x) * sx,
      y: target.y + (p.y - from.y) * sy,
    })),
  }));
}

export function composeGlyph(
  char: string,
  library: Map<string, ComponentSample>,
): Stroke[] | null {
  const keys = slotKeys(char);
  if (!keys.length || !keys.every((key) => library.has(key))) return null;
  const target = layoutBoxes(char);
  return keys.flatMap((key) => {
    const component = library.get(key)!;
    return transformComponent(component, target[component.part]!);
  });
}
