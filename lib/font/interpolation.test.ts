import { expect, it } from "vitest";
import { refinePool } from "./interpolation";
import { defaultPreparation } from "./types";
import type { ComponentSample } from "./types";
import { completeFixture } from "./fixtures";
import { prepareHandwriting, separateSample } from "./composition";
import { validPreparation } from "./validate";
import { strokesAreSafe } from "../safety";

const settings = () => defaultPreparation("test").settings;
function sample(
  char: string,
  offset = 0,
  bend = 0,
  dense = false,
): ComponentSample {
  const points = [
    { x: 100 + offset, y: 100 },
    ...(dense ? [{ x: 150 + offset, y: 150 + bend / 2 }] : []),
    { x: 200 + offset, y: 200 + bend },
    { x: 300 + offset, y: 100 },
  ].map((p, i) => ({ ...p, p: 0.4 + i * 0.1, t: i * 10, tiltX: 12 }));
  return {
    key: "jung:0:false",
    char,
    part: "jung",
    box: { x: 0, y: 0, width: 1000, height: 1000 },
    strokes: [
      {
        id: char,
        order: 0,
        createdAt: 1,
        brush: "pen",
        params: { size: 35, usePressure: true },
        points,
      },
    ],
  };
}
it("uses compatible repeated samples, independent of pen sampling density, without changing pressure or source data", () => {
  const a = sample("가", 0, 0),
    b = sample("나", 40, 12, true);
  const before = JSON.stringify([a, b]);
  const s = { ...settings(), positionCorrection: 100, shapeInterpolation: 100 };
  const out = refinePool([a, b], s).refine(a);
  expect(out.strokes[0].points[0].x).toBeGreaterThan(100);
  expect(out.strokes[0].points[1].y).toBeGreaterThan(200);
  expect(out.strokes[0].points.map((p) => [p.p, p.t, p.tiltX])).toEqual(
    a.strokes[0].points.map((p) => [p.p, p.t, p.tiltX]),
  );
  expect(out.strokes[0].params).toEqual(a.strokes[0].params);
  expect(JSON.stringify([a, b])).toBe(before);
  const exact = refinePool([a, sample("다", 0, 0, true)], s).refine(a);
  exact.strokes[0].points.forEach((p, i) => {
    expect(p.x).toBeCloseTo(a.strokes[0].points[i].x);
    expect(p.y).toBeCloseTo(a.strokes[0].points[i].y);
  });
});
it("rejects different stroke topology and selects a majority prototype instead of the first outlier", () => {
  const outlier = sample("가");
  outlier.strokes.push({ ...outlier.strokes[0], id: "extra" });
  const a = sample("나"),
    b = sample("다", 5);
  const s = { ...settings(), positionCorrection: 0, shapeInterpolation: 100 };
  const model = refinePool([outlier, a, b], s);
  expect(model.representative.strokes).toHaveLength(1);
  expect(model.refine(outlier).strokes).toEqual(outlier.strokes);
  const reversed = sample("라");
  reversed.strokes[0].points.reverse();
  expect(refinePool([a, reversed], s).refine(a).strokes).toEqual(a.strokes);
});
it("keeps directly written strokes and manual geometry independent from composition", () => {
  const project = completeFixture(),
    prep = defaultPreparation("test");
  const original = JSON.stringify(project);
  const result = prepareHandwriting(project, prep);
  expect(result.library.size).toBe(237);
  for (const [char, strokes] of result.direct) {
    expect(strokes).toBe(project.samples[char].strokes);
    expect(strokesAreSafe(strokes, project.samples[char].category)).toBe(true);
  }
  expect(JSON.stringify(project)).toBe(original);
  const char = "겨";
  prep.separations[char] = {
    assignments: {},
    strokes: project.samples[char].strokes,
  };
  expect(prepareHandwriting(project, prep).direct.get(char)).toBe(
    prep.separations[char].strokes,
  );
  prep.settings.positionCorrection = prep.settings.shapeInterpolation = 0;
  const legacy = prepareHandwriting(project, prep);
  const first = separateSample(
    project.samples[char],
    prep.separations[char],
    project.settings,
  )[0];
  expect(legacy.library.get(first.key)).toEqual(first);
  expect(legacy.direct.get(char)).toEqual(project.samples[char].strokes);
});
it("validates optional saved strengths and keeps old backups valid", () => {
  const prep = defaultPreparation("test");
  expect(validPreparation(JSON.parse(JSON.stringify(prep)))).toBe(true);
  delete prep.settings.positionCorrection;
  delete prep.settings.shapeInterpolation;
  expect(validPreparation(prep)).toBe(true);
  for (const value of [-1, 101, NaN, Infinity]) {
    prep.settings.positionCorrection = value;
    expect(validPreparation(prep)).toBe(false);
  }
});

it("strengthens width normalization at the top of the range while preserving recorded pressure", () => {
  const narrow = sample("가"),
    medium = sample("나"),
    wide = sample("다");
  narrow.strokes[0].params.size = 20;
  medium.strokes[0].params.size = 40;
  wide.strokes[0].params.size = 60;
  const model = refinePool([narrow, medium, wide], {
    ...settings(),
    positionCorrection: 0,
    shapeInterpolation: 0,
    widthCorrection: 100,
  });
  const refined = model.refine(narrow).strokes[0];
  expect(refined.params.size).toBe(30);
  const halfStrength = refinePool([narrow, medium, wide], {
    ...settings(),
    positionCorrection: 0,
    shapeInterpolation: 0,
    widthCorrection: 50,
  });
  expect(halfStrength.refine(narrow).strokes[0].params.size).toBe(22);
  expect(refined.points.map((p) => p.p)).toEqual(
    narrow.strokes[0].points.map((p) => p.p),
  );
  expect(narrow.strokes[0].params.size).toBe(20);
});

it("responds to different pressure even when all strokes use the same brush size", () => {
  const light = sample("가"),
    medium = sample("나"),
    heavy = sample("다");
  [light, medium, heavy].forEach((entry, i) => {
    entry.strokes[0].points = entry.strokes[0].points.map((p) => ({
      ...p,
      p: 0.25 + i * 0.25,
    }));
  });
  const model = refinePool([light, medium, heavy], {
    ...settings(),
    positionCorrection: 0,
    shapeInterpolation: 0,
    widthCorrection: 50,
  });
  expect(model.refine(light).strokes[0].params.size).toBeGreaterThan(35);
  expect(model.refine(heavy).strokes[0].params.size).toBeLessThan(35);
  expect(model.refine(light).strokes[0].points[0].p).toBe(0.25);
});
