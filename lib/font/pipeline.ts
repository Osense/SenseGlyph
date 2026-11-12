// 폰트 파일 생성과 화면 미리보기가 같은 계산을 쓰도록 모은 출력 파이프라인입니다.
import { isPremiumCategory, RETIRED_SPECIAL_SYMBOLS } from "../../data/charset";
import type { FontProject, Stroke } from "../types";
import { correctionAmounts } from "./beautify";
import {
  composeGlyph,
  prepareHandwriting,
  type Handwriting,
} from "./composition";
import {
  createLayoutPlan,
  createStrokeRenderer,
  layoutGlyph,
  strokeContours,
  type Contours,
  type LaidOutGlyph,
} from "./layout";
import type { FontBuildSettings, FontPreparation } from "./types";

export interface PipelineOptions {
  /** 손글씨 정돈을 적용할지(미리보기의 '보정 전'은 false) */
  correct?: boolean;
  /** false면 기본형 글자만 */
  includePremium?: boolean;
}

/** 출력 배치 단계: 정돈까지 끝난 손글씨(handwriting)에 크기·간격·굵기를 적용합니다.
 * 획 외곽선은 획 객체별로 캐시되므로, 간격·크기 슬라이더는 이 단계만 다시 계산하면 됩니다. */
export function fontLayout(
  project: FontProject,
  handwriting: Handwriting,
  settings: FontBuildSettings,
  { includePremium = true, sizeEvening = 0 } = {},
) {
  const direct = new Map<string, Stroke[]>();
  for (const sample of Object.values(project.samples)) {
    if (
      !sample.strokes.length ||
      RETIRED_SPECIAL_SYMBOLS.has(sample.char) ||
      (!includePremium && isPremiumCategory(sample.category))
    )
      continue;
    const strokes = handwriting.direct.get(sample.char);
    if (strokes?.length) direct.set(sample.char, strokes);
  }
  const references = new Map<string, Contours>(
    [...direct].map(([char, strokes]) => [char, strokeContours(strokes)]),
  );
  const plan = createLayoutPlan(references, settings, sizeEvening);
  const render = createStrokeRenderer(settings);
  const strokesFor = (char: string) =>
    direct.get(char) ??
    (/^[가-힣]$/.test(char)
      ? composeGlyph(char, handwriting.library, handwriting.pools)
      : null);
  const glyph = (char: string): (LaidOutGlyph & { direct: boolean }) | null => {
    const strokes = strokesFor(char);
    if (!strokes?.length) return null;
    return {
      ...layoutGlyph(
        char,
        render(strokes),
        plan,
        references.get(char) ?? strokeContours(strokes),
      ),
      direct: direct.has(char),
    };
  };
  return { handwriting, direct, plan, glyph, strokesFor };
}

export function fontPipeline(
  project: FontProject,
  preparation: FontPreparation,
  { correct = true, includePremium = true }: PipelineOptions = {},
) {
  const handwriting = prepareHandwriting(project, preparation, correct);
  return fontLayout(project, handwriting, preparation.settings, {
    includePremium,
    sizeEvening: correct ? correctionAmounts(preparation.settings).size : 0,
  });
}
