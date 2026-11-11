import { expect, it } from "vitest";
import type { Stroke } from "../types";
import {
  createLayoutPlan,
  createStrokeRenderer,
  inkBounds,
  layoutGlyph,
  strokeContours,
} from "./layout";
import { defaultPreparation } from "./types";

const settings = defaultPreparation("Test Hand").settings;
const line: Stroke = {
  id: "line",
  order: 0,
  createdAt: 0,
  brush: "pen",
  params: { size: 50, usePressure: false },
  points: Array.from({ length: 18 }, (_, i) => ({
    x: 200 + i * 30,
    y: 500,
    p: 0.5,
    t: i * 10,
  })),
};

it("changes thickness without moving the advance or modifying the saved stroke", () => {
  const reference = strokeContours([line]);
  const plan = createLayoutPlan(new Map([["一", reference]]), settings);
  const thin = layoutGlyph(
    "一",
    createStrokeRenderer({ ...settings, strokeWeight: 80 })([line]),
    plan,
    reference,
  );
  const bold = layoutGlyph(
    "一",
    createStrokeRenderer({ ...settings, strokeWeight: 120 })([line]),
    plan,
    reference,
  );
  expect(thin.advanceWidth).toBe(bold.advanceWidth);
  expect(bold.bounds!.height).toBeGreaterThan(thin.bounds!.height);
  expect(line.params.size).toBe(50);
});

it("changes exposed endings and preserves joins, loops and the pixel pen finish", () => {
  const render = createStrokeRenderer({ ...settings, strokeFinish: "pointed" });
  expect(render([line])).not.toEqual(strokeContours([line]));
  const tail = line.points.at(-1)!;
  const cross = {
    ...line,
    id: "cross",
    points: line.points.map((p, i) => ({ ...p, x: tail.x, y: 290 + i * 30 })),
  };
  expect(render([line, cross])[0]).toEqual(strokeContours([line])[0]);
  const loop = {
    ...line,
    points: line.points.map((p, i) => ({
      ...p,
      x: 500 + 130 * Math.cos((i / 17) * 2 * Math.PI),
      y: 500 + 130 * Math.sin((i / 17) * 2 * Math.PI),
    })),
  };
  expect(render([loop])).toEqual(strokeContours([loop]));
  const pixel: Stroke = { ...line, brush: "pixel" };
  expect(render([pixel])).toEqual(strokeContours([pixel]));
  const brush: Stroke = { ...line, brush: "brush" };
  const round = createStrokeRenderer({ ...settings, strokeFinish: "round" })([
    brush,
  ]);
  expect(inkBounds(round)!.right).toBeGreaterThan(
    inkBounds(strokeContours([brush]))!.right,
  );
});
