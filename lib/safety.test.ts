import { it, expect } from "vitest";
import { sampleFontSize, strokeIsSafe, safetyBounds, DIAMOND_MARGIN } from "./safety";
import type { Stroke } from "./types";
const stroke = (x: number): Stroke => ({
  id: "a",
  brush: "marker",
  params: { size: 50, usePressure: false },
  points: [
    { x, y: 400, p: 0.5, t: 0 },
    { x: x + 50, y: 500, p: 0.5, t: 10 },
  ],
  order: 0,
  createdAt: 0,
});
it("checks brush outlines against the safety margin, not just stroke centerlines", () => {
  expect(strokeIsSafe(stroke(100))).toBe(true);
  expect(strokeIsSafe(stroke(45))).toBe(false);
  expect(strokeIsSafe(stroke(950))).toBe(false);
});
it("fits a Hangul sample's ink snugly inside the diamond", () => {
  const factor = sampleFontSize(800, 840, true);
  // Ink reaching its box corners touches the diamond, leaving only the margin.
  expect(((800 + 840) * factor) / 2).toBeCloseTo(500 - DIAMOND_MARGIN);
  expect(sampleFontSize(800, 840, false)).toBeGreaterThan(factor);
  // Rounder glyphs (empty corners) are drawn larger until their ink touches.
  const round = sampleFontSize(800, 840, true, 0.8);
  expect(round).toBeGreaterThan(factor);
  expect(((800 + 840) * round * 0.8) / 2).toBeCloseTo(500 - DIAMOND_MARGIN);
  // ...but never beyond the safe writing area.
  expect(sampleFontSize(800, 840, true, 0.3) * 840).toBeLessThanOrEqual(880);
});
it("accepts lower-case descenders and low punctuation while retaining the Hangul boundary", () => {
  const tail: Stroke = {
    id: "g-tail",
    brush: "marker",
    params: { size: 40, usePressure: false },
    points: [
      { x: 400, y: 930, p: 0.5, t: 0 },
      { x: 430, y: 970, p: 0.5, t: 10 },
    ],
    order: 0,
    createdAt: 0,
  };
  expect(strokeIsSafe(tail, "latin-lower")).toBe(true);
  expect(strokeIsSafe(tail, "ascii-symbol")).toBe(true);
  expect(strokeIsSafe(tail, "hangul-syllable")).toBe(false);
  expect(safetyBounds("latin-lower").bottom).toBe(990);
  expect(safetyBounds("ascii-symbol").top).toBeLessThan(
    safetyBounds("latin-upper").top,
  );
  const overflow = {
    ...tail,
    points: tail.points.map((point) => ({ ...point, y: point.y + 40 })),
  };
  expect(strokeIsSafe(overflow, "latin-lower")).toBe(false);
  expect(strokeIsSafe(overflow, "ascii-symbol")).toBe(false);
});
