import type { FontProject, Stroke } from "../types";

export type Part = "cho" | "jung" | "jong";
export const FONT_SETTING_LIMITS = {
  bodyMin: 600,
  bodyMax: 1200,
  spacingMin: -250,
  spacingMax: 200,
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
export interface FontBuildSettings {
  bodySize?: number;
  familyName: string;
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
      bodySize: 840,
      familyName: name || "나의 손글씨",
      letterSpacing: 0,
      baseline: 800,
      includeComposed: true,
    },
  };
}
