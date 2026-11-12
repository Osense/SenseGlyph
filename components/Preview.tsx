"use client";
import { useEffect, useRef } from "react";
import { drawGrid, drawSample } from "../lib/drawing";
import { paintStroke } from "../lib/brushes";
import type {
  ProjectSettings,
  Stroke,
  BrushId,
  CharCategory,
} from "../lib/types";
import { loadReferenceFont } from "../lib/reference-fonts";
export function Reference({
  char,
  settings,
  latin,
  dark,
  category,
}: {
  char: string;
  settings: ProjectSettings;
  latin: boolean;
  dark: boolean;
  category: CharCategory;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    loadReferenceFont(settings.referenceFont, char).then(() => {
      if (!alive) return;
      const ctx = ref.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 1000, 1000);
        drawGrid(ctx, settings, category, dark);
        drawSample(ctx, char, latin, 1, dark, settings, false);
      }
    });
    return () => {
      alive = false;
    };
  }, [char, settings, latin, dark, category]);
  return (
    <canvas
      width={1000}
      height={1000}
      ref={ref}
      className="reference-canvas"
      aria-label={char + " 견본"}
    />
  );
}
export function BrushPreview({ brush }: { brush: BrushId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 240, 60);
    ctx.save();
    ctx.scale(0.24, 0.24);
    ctx.fillStyle = "#456957";
    paintStroke(ctx, {
      id: "preview",
      brush,
      params: { size: 65, usePressure: true, nibAngle: 30 },
      order: 0,
      createdAt: 0,
      points: Array.from({ length: 40 }, (_, i) => ({
        x: 70 + i * 22,
        y: 120 + Math.sin(i / 6) * 55,
        p: 0.25 + 0.7 * Math.sin((i / 39) * Math.PI),
        t: i * 10,
      })),
    });
    ctx.restore();
  }, [brush]);
  return <canvas ref={ref} width={240} height={60} aria-hidden="true" />;
}
export function Thumbnail({
  strokes,
  tone = "normal",
  colorOf,
  size = 80,
}: {
  strokes: Stroke[];
  tone?: "normal" | "error";
  /** 획마다 다른 색(예: 초·중·종성)으로 칠할 때 */
  colorOf?: (stroke: Stroke) => string;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.scale(size / 1000, size / 1000);
    for (const s of strokes) {
      ctx.fillStyle =
        colorOf?.(s) ?? (tone === "error" ? "#bd4b43" : "#456957");
      paintStroke(ctx, s);
    }
    ctx.restore();
  }, [strokes, tone, colorOf, size]);
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" />;
}
