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
  /** 쓰지 않은 글자를 채울 견본 글꼴 파일 주소(앞에서부터 우선) */
  fallbackFonts?: { name: string; url: string }[];
  /** false면 기본형 글자(한글·숫자·기호·영문)만 넣습니다. */
  includePremium?: boolean;
  project: FontProject;
  preparation: FontPreparation;
}
export interface FontStats {
  direct: number;
  composed: number;
  /** 견본 글꼴로 채운 글자 수 */
  fallback?: number;
  glyphs: number;
  characters: string[];
}
/** 폰트 작업자에게 보내는 일: 글자 몫 만들기(병렬) 또는 모아서 파일 쓰기. */
export type WorkerRequest =
  | { type: "chunk"; request: BuildRequest; part: number; parts: number }
  | { type: "assemble"; request: BuildRequest; chunks: Int32Array[] };
export type WorkerReply =
  | { type: "progress"; value: number; message: string }
  | { type: "chunk-progress"; done: number; total: number }
  | { type: "chunk"; data: Int32Array }
  | { type: "result"; ttf: ArrayBuffer; otf: ArrayBuffer; stats: FontStats }
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
