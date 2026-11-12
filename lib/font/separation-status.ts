import { slotKeys } from "../hangul";
import type { FontProject } from "../types";
import { assignStroke, separateSample } from "./composition";
import { activeSeparation, effectiveStrokes } from "./editing";
import { referenceVote } from "./reference";
import type { FontPreparation, Part } from "./types";

/** confirmed: 사용자가 확인함 · check: 확인이 필요해 보임 · auto: 자동 결과가 무난함 */
export type SeparationStatus = "confirmed" | "check" | "auto";

/** 자동 판정이 애매한(견본 자모 영역과 겹침이 고르게 갈리는) 획의 기준 */
const AMBIGUOUS_SHARE = 0.68;

export function separationStatus(
  project: FontProject,
  prep: FontPreparation,
  char: string,
): SeparationStatus {
  const sample = project.samples[char];
  if (!sample?.strokes.length) return "auto";
  const separation = activeSeparation(sample, prep.separations[char]);
  const strokes = effectiveStrokes(sample, separation);
  if (
    strokes.length &&
    separation &&
    strokes.every((stroke) => separation.assignments[stroke.id])
  )
    return "confirmed";
  if (
    slotKeys(char).length >
    separateSample(sample, separation, project.settings).length
  )
    return "check";
  if (separation?.boxes) return "auto";
  for (const stroke of strokes) {
    if (separation?.assignments[stroke.id]) continue;
    const vote = referenceVote(char, stroke, project.settings);
    if (vote && vote.share < AMBIGUOUS_SHARE) return "check";
  }
  return "auto";
}

/** 지금 화면에 보이는 배정을 그대로 '확인함'으로 저장합니다. */
export function confirmSeparation(
  project: FontProject,
  prep: FontPreparation,
  char: string,
): FontPreparation {
  const sample = project.samples[char];
  const separation = activeSeparation(sample, prep.separations[char]) ?? {
    assignments: {},
  };
  const strokes = effectiveStrokes(sample, separation);
  const assignments: Record<string, Part> = {};
  for (const stroke of strokes)
    assignments[stroke.id] = assignStroke(
      char,
      stroke,
      separation,
      project.settings,
    );
  return {
    ...prep,
    separations: {
      ...prep.separations,
      [char]: { ...separation, assignments, sourceUpdatedAt: sample.updatedAt },
    },
  };
}
