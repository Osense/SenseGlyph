import type { FontProject, Stroke } from "../types";

export type Part = "cho" | "jung" | "jong";
export const FONT_SETTING_LIMITS = {
  bodyMin: 600,
  bodyMax: 1200,
  spacingMin: -250,
  spacingMax: 200,
  weightMin: 55,
  weightMax: 165,
} as const;
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Separation {
  assignments: Record<string, Part>;
  boxes?: Partial<Record<Part, Box>>;
  strokes?: Stroke[];
  sourceUpdatedAt?: number;
}
export type StrokeFinish = "original" | "round" | "pointed";

/** 손글씨 정돈 항목별 강도(0~100). */
export interface CorrectionDetail {
  /** 자모 위치·비율을 견본 글꼴 쪽으로 */
  layout: number;
  /** 거의 가로·세로인 획을 반듯하게 */
  straighten: number;
  /** 획의 잔떨림 완화 */
  smooth: number;
  /** 글자 크기 편차 줄이기 */
  size: number;
  /** 획 굵기(필압) 고르게 */
  weight: number;
}
export const CORRECTION_KEYS = [
  "layout",
  "straighten",
  "smooth",
  "size",
  "weight",
] as const satisfies readonly (keyof CorrectionDetail)[];

export interface FontBuildSettings {
  /** 손글씨 정돈 강도 0~100. 0이면 쓴 획 그대로입니다. */
  correction?: number;
  /** 고급 설정: 있으면 항목별 강도를 그대로 사용합니다. */
  correctionDetail?: CorrectionDetail;
  /** @deprecated 이전 버전 설정. 읽기 호환용입니다. */
  widthCorrection?: number;
  /** @deprecated 이전 버전 설정. 읽기 호환용입니다. */
  alignToReference?: boolean;
  /** @deprecated 이전 버전 설정. 읽기 호환용입니다. */
  averageStrokes?: boolean;
  strokeWeight?: number;
  strokeFinish?: StrokeFinish;
  /** @deprecated */
  positionCorrection?: number;
  /** @deprecated */
  shapeInterpolation?: number;
  bodySize?: number;
  familyName: string;
  englishFamilyName?: string;
  letterSpacing: number;
  baseline: number;
  includeComposed: boolean;
}
export interface FontPreparation {
  separations: Record<string, Separation>;
  settings: FontBuildSettings;
}
export interface ComponentSample {
  key: string;
  char: string;
  part: Part;
  confirmed?: true;
  strokes: Stroke[];
  box: Box;
}
export interface Coverage {
  direct: number;
  slots: number;
  totalSlots: 237;
  composed: number;
  missingSlots: string[];
  missingSamples: string[];
  available: string[];
}
export interface BuildRequest {
  /** false면 기본형 글자(한글·숫자·기호·영문)만 넣습니다. */
  includePremium?: boolean;
  project: FontProject;
  preparation: FontPreparation;
}
export interface FontStats {
  direct: number;
  composed: number;
  glyphs: number;
  characters: string[];
}
export type WorkerReply =
  | { type: "progress"; value: number; message: string }
  | { type: "result"; buffer: ArrayBuffer; stats: FontStats }
  | { type: "error"; message: string };

export function defaultPreparation(name: string): FontPreparation {
  return {
    separations: {},
    settings: {
      correction: 0,
      bodySize: 840,
      familyName: name || "나의 손글씨",
      letterSpacing: 0,
      baseline: 800,
      includeComposed: true,
    },
  };
}
