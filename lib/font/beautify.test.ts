import { describe, expect, it } from "vitest";
import {
  beautifyStrokes,
  correctionAmounts,
  detailFromStrength,
  NO_CORRECTION,
} from "./beautify";
import { prepareHandwriting } from "./composition";
import { completeFixture } from "./fixtures";
import { inkBounds, strokeContours } from "./layout";
import { fontPipeline } from "./pipeline";
import { defaultPreparation } from "./types";
import { validPreparation } from "./validate";
import { strokesAreSafe } from "../safety";
import type { Stroke } from "../types";

const line = (id: string, points: [number, number][], size = 40): Stroke => ({
  id,
  order: 0,
  createdAt: 1,
  brush: "pen",
  params: { size, usePressure: true },
  points: points.map(([x, y], i) => ({
    x,
    y,
    p: 0.3 + (i % 3) * 0.2,
    t: i * 8,
  })),
});
const along = (
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
  n = 20,
): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => [
    x0 + ((x1 - x0) * i) / n,
    y0 + ((y1 - y0) * i) / n,
  ]);
const full = { layout: 1, straighten: 1, smooth: 1, size: 1, weight: 1 };
const angle = (s: Stroke) => {
  const a = s.points[0],
    b = s.points.at(-1)!;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
};

describe("handwriting correction", () => {
  it("returns the written strokes untouched at strength 0", () => {
    const project = completeFixture();
    const original = JSON.stringify(project);
    const prep = defaultPreparation("test");
    const result = prepareHandwriting(project, prep, true);
    for (const [char, strokes] of result.direct)
      expect(strokes).toBe(project.samples[char].strokes);
    const stroke = line("a", along([200, 300], [700, 340]));
    expect(
      beautifyStrokes([stroke], { amounts: NO_CORRECTION, category: "digit" }),
    ).toEqual([stroke]);
    expect(JSON.stringify(project)).toBe(original);
  });

  it("levels nearly horizontal and vertical strokes but leaves diagonals alone", () => {
    const tilted = line("h", along([200, 300], [700, 360]));
    const upright = line("v", along([500, 150], [530, 800]));
    const diagonal = line("d", along([200, 200], [600, 600]));
    const [h, v, d] = beautifyStrokes([tilted, upright, diagonal], {
      amounts: { ...NO_CORRECTION, straighten: 1 },
      category: "digit",
    });
    expect(Math.abs(angle(h))).toBeLessThan(Math.abs(angle(tilted)) * 0.3);
    expect(Math.abs(90 - angle(v))).toBeLessThan(
      Math.abs(90 - angle(upright)) * 0.3,
    );
    expect(d.points).toEqual(diagonal.points);
    // Same strokes, same order, same pen data — only positions move.
    expect(h.id).toBe("h");
    expect(h.points.map((p) => [p.p, p.t])).toEqual(
      tilted.points.map((p) => [p.p, p.t]),
    );
  });

  it("keeps corners: an L-shaped stroke stays an L", () => {
    const corner = line("l", [
      ...along([200, 250], [650, 280], 15),
      ...along([650, 280], [640, 750], 15).slice(1),
    ]);
    const [fixed] = beautifyStrokes([corner], {
      amounts: full,
      category: "digit",
    });
    const k = 15;
    expect(
      Math.hypot(fixed.points[k].x - 650, fixed.points[k].y - 280),
    ).toBeLessThan(30);
    expect(Math.abs(fixed.points[0].y - fixed.points[k].y)).toBeLessThan(10);
    expect(Math.abs(fixed.points[k].x - fixed.points.at(-1)!.x)).toBeLessThan(
      5,
    );
  });

  it("stays a bounded tidy-up even at 100% and never leaves the safe area", () => {
    const project = completeFixture();
    const prep = defaultPreparation("test");
    prep.settings.correction = 100;
    const corrected = prepareHandwriting(project, prep, true);
    let largest = 0;
    for (const [char, strokes] of corrected.direct) {
      const source = project.samples[char].strokes;
      expect(strokes.map((s) => s.id)).toEqual(source.map((s) => s.id));
      expect(strokesAreSafe(strokes, project.samples[char].category)).toBe(
        true,
      );
      strokes.forEach((s, i) =>
        s.points.forEach((p, j) => {
          const q = source[i].points[j];
          largest = Math.max(largest, Math.hypot(p.x - q.x, p.y - q.y));
        }),
      );
    }
    expect(largest).toBeGreaterThan(0);
    expect(largest).toBeLessThan(120);
  });

  it("splits one strength into item strengths and reads older settings", () => {
    expect(detailFromStrength(0)).toEqual({
      layout: 0,
      straighten: 0,
      smooth: 0,
      size: 0,
      weight: 0,
    });
    const legacy = defaultPreparation("old").settings;
    delete legacy.correction;
    legacy.alignToReference = true;
    expect(correctionAmounts(legacy).layout).toBeCloseTo(0.3);
    const custom = {
      ...defaultPreparation("x").settings,
      correction: 90,
      correctionDetail: {
        layout: 10,
        straighten: 0,
        smooth: 0,
        size: 0,
        weight: 0,
      },
    };
    expect(correctionAmounts(custom)).toEqual({
      layout: 0.1,
      straighten: 0,
      smooth: 0,
      size: 0,
      weight: 0,
    });
    const prep = defaultPreparation("x");
    prep.settings.correctionDetail = custom.correctionDetail;
    expect(validPreparation(JSON.parse(JSON.stringify(prep)))).toBe(true);
    prep.settings.correctionDetail = {
      ...custom.correctionDetail,
      layout: 101,
    };
    expect(validPreparation(prep)).toBe(false);
    prep.settings.correctionDetail = undefined;
    prep.settings.correction = -1;
    expect(validPreparation(prep)).toBe(false);
  });
});

describe("output consistency", () => {
  it("gives composed glyphs the same scale and stroke weight as written glyphs", () => {
    const project = completeFixture();
    const prep = defaultPreparation("test");
    const pipeline = fontPipeline(project, prep);
    const scale = pipeline.plan.hangulScale;
    for (const char of ["곤", "안", "녕"]) {
      expect(pipeline.direct.has(char)).toBe(false);
      const raw = inkBounds(strokeContours(pipeline.strokesFor(char)!))!;
      const laid = pipeline.glyph(char)!.bounds!;
      const expected = Math.min(
        scale,
        pipeline.plan.bodySize / Math.max(raw.width, raw.height),
      );
      expect(laid.height / raw.height).toBeCloseTo(expected, 1);
    }
    const heavier = defaultPreparation("test");
    heavier.settings.strokeWeight = 150;
    const thick = fontPipeline(project, heavier).glyph("안")!.bounds!;
    const normal = pipeline.glyph("안")!.bounds!;
    expect(thick.width).toBeGreaterThan(normal.width);
  });
});
