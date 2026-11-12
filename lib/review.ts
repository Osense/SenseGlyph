import { CHARSET } from "../data/charset";
import { slotKeys } from "./hangul";
import { strokesAreSafe } from "./safety";
import { separateSample } from "./font/composition";
import { effectiveStrokes } from "./font/editing";
import type { FontProject, GlyphSample } from "./types";
import type { Separation } from "./font/types";
import type { ReferenceSettings } from "./font/reference";

export type ReviewKind =
  "unsafe" | "skipped" | "empty" | "components" | "manual" | "invalid";
export interface ReviewIssue {
  kind: ReviewKind;
  label: string;
}
const cache = new WeakMap<
  GlyphSample,
  { separation?: Separation; reference?: string; issues: ReviewIssue[] }
>();

export function glyphIssues(
  sample?: GlyphSample,
  separation?: Separation,
  reference?: ReferenceSettings,
): ReviewIssue[] {
  if (!sample) return [];
  const previous = cache.get(sample);
  const referenceKey = reference
    ? `${reference.referenceFont}:${reference.grid.diamond}`
    : undefined;
  if (
    previous &&
    previous.separation === separation &&
    previous.reference === referenceKey
  )
    return previous.issues;
  const issues: ReviewIssue[] = [];
  if (sample.needsReview)
    issues.push({ kind: "manual", label: "직접 확인 표시" });
  if (sample.status === "skipped")
    issues.push({ kind: "skipped", label: "건너뛴 글자" });
  if (
    !sample.strokes.length &&
    (sample.status === "done" || sample.rewritePending)
  )
    issues.push({
      kind: "empty",
      label: sample.rewritePending
        ? "다시 작성 필요"
        : "완료 표시만 있고 획이 없음",
    });
  if (sample.strokes.length) {
    try {
      const effective = effectiveStrokes(sample, separation);
      if (
        !strokesAreSafe(sample.strokes, sample.category) ||
        !strokesAreSafe(effective, sample.category)
      )
        issues.push({ kind: "unsafe", label: "점선 밖으로 나간 획" });
      if (!effective.length)
        issues.push({ kind: "empty", label: "보정 후 남은 획이 없음" });
      else if (
        slotKeys(sample.char).length >
        separateSample(sample, separation, reference).length
      )
        issues.push({ kind: "components", label: "초·중·종성 배정 확인 필요" });
    } catch {
      issues.push({ kind: "invalid", label: "획 데이터 확인 필요" });
    }
  }
  cache.set(sample, { separation, reference: referenceKey, issues });
  return issues;
}

export function projectIssues(project: FontProject | null) {
  const result: Record<string, ReviewIssue[]> = {};
  if (project)
    for (const { char } of CHARSET) {
      const issues = glyphIssues(
        project.samples[char],
        project.fontPreparation?.separations[char],
        project.settings,
      );
      if (issues.length) result[char] = issues;
    }
  return result;
}
