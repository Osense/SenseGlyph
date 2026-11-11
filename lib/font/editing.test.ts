import { it, expect } from "vitest";
import { completeFixture } from "./fixtures";
import {
  deformStroke,
  effectiveStrokes,
  moveStrokes,
  selectStrokes,
  selectStrokesLasso,
} from "./editing";
import { defaultPreparation } from "./types";
import { componentLibrary } from "./composition";
import { parseProject } from "../storage";
it("lasso uses its concave boundary rather than its bounding rectangle, and catches crossing ink", () => {
  const base = completeFixture().samples["갛"].strokes[0];
  const dot = (id: string, x: number, y: number) => ({
    ...base,
    id,
    points: [{ x, y, p: 0.5, t: 0 }],
    params: { ...base.params, size: 20 },
  });
  const polygon = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 400 },
    { x: 0, y: 400 },
  ];
  expect(
    selectStrokesLasso(
      [dot("inside", 50, 250), dot("outside", 250, 250)],
      polygon,
    ),
  ).toEqual(["inside"]);
  const crossing = {
    ...base,
    id: "crossing",
    points: [
      { x: -50, y: 50, p: 0.5, t: 0 },
      { x: 450, y: 50, p: 0.5, t: 1 },
    ],
  };
  expect(selectStrokesLasso([crossing], polygon)).toEqual(["crossing"]);
  expect(
    selectStrokesLasso(
      [base],
      [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
      ],
    ),
  ).toEqual([]);
});

it("selects intersecting stroke segments and moves a group while preserving unselected vectors and metadata", () => {
  const p = completeFixture(),
    strokes = p.samples["갛"].strokes;
  const ids = selectStrokes(strokes, {
    x: 150,
    y: 250,
    width: 700,
    height: 250,
  });
  expect(ids).toEqual(["갛-cho", "갛-jung"]);
  const original = JSON.stringify(strokes),
    moved = moveStrokes(strokes, ids, 30, 20);
  expect(moved[0].points[0]).toEqual({
    ...strokes[0].points[0],
    x: strokes[0].points[0].x + 30,
    y: strokes[0].points[0].y + 20,
  });
  expect(moved[2]).toBe(strokes[2]);
  expect(JSON.stringify(strokes)).toBe(original);
});
it("partial editing changes a local region, retaining all pressure, time and original points", () => {
  const p = completeFixture(),
    strokes = p.samples["갛"].strokes,
    original = JSON.stringify(strokes);
  const next = deformStroke(strokes, strokes[0].id, 1, 12, -20, 50);
  expect(next[0].points[1].x).toBe(strokes[0].points[1].x + 12);
  expect(next[0].points[0]).toEqual(strokes[0].points[0]);
  expect(next[0].points.map((point) => [point.p, point.t])).toEqual(
    strokes[0].points.map((point) => [point.p, point.t]),
  );
  expect(JSON.stringify(strokes)).toBe(original);
});
it("saves corrected vectors in backups, feeds components, and invalidates corrections after original handwriting changes", () => {
  const p = completeFixture(),
    sample = p.samples["겨"];
  p.fontPreparation = defaultPreparation(p.name);
  const correction = {
    assignments: {},
    sourceUpdatedAt: sample.updatedAt,
    strokes: moveStrokes(sample.strokes, ["겨-cho"], 20, 10),
  };
  p.fontPreparation.separations["겨"] = correction;
  const imported = parseProject(JSON.stringify(p));
  expect(imported.fontPreparation?.separations["겨"].strokes).toEqual(
    correction.strokes,
  );
  const component = [...componentLibrary(p, p.fontPreparation).values()].find(
    (item) => item.char === "겨" && item.part === "cho",
  )!;
  expect(component.strokes[0].points[0].x).toBe(
    sample.strokes[0].points[0].x + 20,
  );
  expect(
    effectiveStrokes(
      { ...sample, updatedAt: sample.updatedAt + 1 },
      correction,
    ),
  ).toBe(sample.strokes);
  correction.strokes[0].points[0].p = 2;
  expect(() => parseProject(JSON.stringify(p))).toThrow("폰트 제작 설정");
});

it("ignores edited strokes detached from the current written sample even in legacy backups", () => {
  const project = completeFixture();
  const sample = project.samples["겨"];
  const foreign = project.samples["구"].strokes;
  expect(effectiveStrokes(sample, { assignments: {}, strokes: foreign })).toBe(
    sample.strokes,
  );
  expect(
    effectiveStrokes(sample, {
      assignments: {},
      sourceUpdatedAt: sample.updatedAt,
      strokes: foreign,
    }),
  ).toBe(sample.strokes);
});
