export type BrushId = "pen" | "marker" | "brush" | "pencil" | "nib" | "pixel";
export interface BrushParams {
  size: number;
  usePressure: boolean;
  nibAngle?: number;
  pixelSize?: number;
}
export interface StrokePoint {
  x: number;
  y: number;
  p: number;
  t: number;
  tiltX?: number;
  tiltY?: number;
}
export interface Stroke {
  id: string;
  points: StrokePoint[];
  brush: BrushId;
  params: BrushParams;
  order: number;
  createdAt: number;
}
export type CharCategory =
  | "hangul-syllable"
  | "digit"
  | "ascii-symbol"
  | "latin-upper"
  | "latin-lower"
  | "hangul-jamo"
  | "korean-punct";
export interface GlyphSample {
  needsReview?: boolean;
  rewritePending?: boolean;
  char: string;
  category: CharCategory;
  strokes: Stroke[];
  updatedAt: number;
  status: "empty" | "done" | "skipped";
}
export interface ProjectSettings {
  writingSize?: number;
  referenceFont?: import("./reference-fonts").ReferenceFontId;
  grid: {
    halfVertical: boolean;
    halfHorizontal: boolean;
    diamond: boolean;
    sizeGuide: boolean;
  };
  sampleMode: "inside-faint" | "outside" | "hidden";
  sampleOpacity: number;
  penOnly: boolean;
  allowMouse: boolean;
  activeBrush: BrushId;
  brushParams: Record<BrushId, BrushParams>;
  eraserSize: number;
  eraserMode: "stroke" | "partial";
}
export interface FontProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  samples: Record<string, GlyphSample>;
  settings: ProjectSettings;
  schemaVersion: 1;
  // Optional extension: existing Phase 1 backups remain valid.
  fontPreparation?: import("./font/types").FontPreparation;
}
