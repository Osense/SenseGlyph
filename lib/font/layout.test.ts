import { it, expect } from "vitest";
import {
  createLayoutPlan,
  layoutGlyph,
  inkBounds,
  type Contours,
} from "./layout";
import { defaultPreparation } from "./types";

const rectangle = (x: number, y: number, w: number, h: number): Contours => [
  [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
];
it("enlarges diamond-sized Hangul to the output body and removes cell whitespace", () => {
  const raw = rectangle(280, 260, 440, 480),
    original = JSON.stringify(raw),
    settings = defaultPreparation("Test").settings;
  const plan = createLayoutPlan(new Map([["가", raw]]), settings),
    glyph = layoutGlyph("가", raw, plan);
  expect(plan.hangulScale).toBeCloseTo(1.75);
  expect(glyph.bounds!.height).toBe(840);
  expect(glyph.bounds!.width).toBe(770);
  expect(glyph.bounds!.left).toBe(50);
  expect(glyph.advanceWidth).toBe(870);
  expect(glyph.advanceWidth - glyph.bounds!.right).toBe(50);
  expect(JSON.stringify(raw)).toBe(original);
});
it("gives narrow and wide glyphs the same visible edge gap without stretching their proportions", () => {
  const wide = rectangle(260, 260, 480, 480),
    narrow = rectangle(410, 260, 180, 480),
    settings = defaultPreparation("Test").settings;
  const plan = createLayoutPlan(
      new Map([
        ["가", wide],
        ["너", narrow],
      ]),
      settings,
    ),
    a = layoutGlyph("가", wide, plan),
    b = layoutGlyph("너", narrow, plan);
  expect(a.advanceWidth).toBeGreaterThan(b.advanceWidth);
  expect(a.bounds!.height).toBe(b.bounds!.height);
  expect(b.bounds!.width / b.bounds!.height).toBeCloseTo(180 / 480, 2);
  expect(a.advanceWidth - a.bounds!.right + b.bounds!.left).toBe(100);
});
it("preserves small punctuation and descenders and keeps digits tabular", () => {
  const zero = rectangle(300, 230, 400, 570),
    one = rectangle(440, 230, 120, 570),
    g = rectangle(400, 420, 200, 560),
    comma = rectangle(450, 860, 30, 100);
  const plan = createLayoutPlan(
    new Map([
      ["0", zero],
      ["1", one],
      ["g", g],
      [",", comma],
    ]),
    defaultPreparation("Test").settings,
  );
  const a = layoutGlyph("0", zero, plan),
    b = layoutGlyph("1", one, plan),
    tail = layoutGlyph("g", g, plan),
    punct = layoutGlyph(",", comma, plan);
  expect(a.advanceWidth).toBe(b.advanceWidth);
  expect(b.bounds!.left).toBeGreaterThan(a.bounds!.left);
  expect(tail.bounds!.bottom).toBeGreaterThan(800);
  expect(punct.bounds!.top).toBeGreaterThan(800);
  expect(punct.bounds!.height).toBeLessThan(150);
});
it("applies output size and spacing controls to geometry and widths, with legacy defaults", () => {
  const raw = rectangle(280, 260, 440, 480),
    settings = defaultPreparation("Test").settings,
    map = new Map([["가", raw]]);
  const normal = layoutGlyph("가", raw, createLayoutPlan(map, settings));
  const bigger = layoutGlyph(
    "가",
    raw,
    createLayoutPlan(map, { ...settings, bodySize: 940 }),
  );
  const spaced = layoutGlyph(
    "가",
    raw,
    createLayoutPlan(map, { ...settings, letterSpacing: 60 }),
  );
  expect(bigger.bounds!.height).toBe(940);
  expect(spaced.advanceWidth - normal.advanceWidth).toBe(60);
  expect(spaced.bounds!.width).toBe(normal.bounds!.width);
  expect(spaced.bounds!.left - normal.bounds!.left).toBe(30);
  const { bodySize: _, ...legacy } = settings;
  expect(createLayoutPlan(map, legacy).bodySize).toBe(840);
  expect(inkBounds([])).toBeNull();
});
it("enlarges beyond one em and exports negative side bearings for tighter tracking", () => {
  const raw = rectangle(280, 260, 440, 480),
    settings = {
      ...defaultPreparation("Test").settings,
      bodySize: 1200,
      letterSpacing: -250,
    },
    plan = createLayoutPlan(new Map([["가", raw]]), settings),
    glyph = layoutGlyph("가", raw, plan);
  expect(glyph.bounds!.height).toBe(1200);
  expect(glyph.bounds!.top).toBe(-100);
  expect(glyph.leftSideBearing).toBe(-75);
  expect(glyph.advanceWidth - glyph.bounds!.right + glyph.bounds!.left).toBe(
    -150,
  );
  expect(glyph.advanceWidth).toBeGreaterThan(0);
});

it("keeps composed ink at original em dimensions even with larger output size", () => {
  const raw = rectangle(280, 260, 440, 480);
  const settings = { ...defaultPreparation("Test").settings, bodySize: 1200 };
  const plan = createLayoutPlan(new Map([["가", raw]]), settings);
  const composed = layoutGlyph("좋", raw, plan, raw, true);
  expect(composed.bounds?.width).toBe(440);
  expect(composed.bounds?.height).toBe(480);
});
