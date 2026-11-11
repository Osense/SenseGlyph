import { expect, it } from "vitest";
import { outlines, paintStroke } from "./index";
import { strokeContours } from "../font/layout";
import { parseProject } from "../storage";
import { newProject } from "../defaults";
import { defaultPreparation } from "../font/types";
import { generateFont } from "../font/generate";
import { strokeIsSafe } from "../safety";
import { selectStrokesLasso } from "../font/editing";
import { useStudio } from "../store";
import opentype from "opentype.js";
import type { Stroke } from "../types";

const points = (xy: number[][]) =>
  xy.map(([x, y], i) => ({ x, y, p: 0.6, t: i * 10 }));
const stroke = (brush: Stroke["brush"], xy: number[][]): Stroke => ({
  id: "test",
  order: 0,
  createdAt: 1,
  brush,
  params: { size: 50, usePressure: false, nibAngle: 30, pixelSize: 12 },
  points: points(xy),
});
const area = (p: number[][]) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
function inside(p: number[], polygon: number[][]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
it("keeps retraced and crossing nib ink filled with consistent winding, including taps and nib-parallel lines", () => {
  for (const xy of [
    [
      [200, 300],
      [700, 300],
      [200, 300],
    ],
    [
      [200, 200],
      [700, 700],
      [200, 700],
      [700, 200],
    ],
    [[400, 400]],
    [
      [200, 200],
      [600, 200 + 400 * Math.tan(Math.PI / 6)],
    ],
  ]) {
    const s = stroke("nib", xy),
      polygons = outlines(s.points, s.brush, s.params);
    expect(polygons.length).toBeGreaterThan(0);
    expect(polygons.every((p) => area(p) > 0)).toBe(true);
    expect(polygons.some((poly) => inside(xy[0], poly))).toBe(true);
  }
  const retrace = stroke("nib", [
    [200, 300],
    [700, 300],
    [200, 300],
  ]);
  const polygons = outlines(retrace.points, "nib", retrace.params);
  expect(polygons.filter((poly) => inside([450, 300], poly))).toHaveLength(2);
  expect(strokeContours([retrace])).toHaveLength(2);
});
it("paints separate solid subpaths and uses the same geometry for SVG/font consumers", () => {
  const s = stroke("nib", [
    [200, 300],
    [700, 300],
    [200, 300],
  ]);
  let moves = 0,
    closes = 0,
    rule = "";
  paintStroke(
    {
      beginPath() {},
      moveTo() {
        moves++;
      },
      lineTo() {},
      closePath() {
        closes++;
      },
      fill(r: string) {
        rule = r;
      },
    } as unknown as CanvasRenderingContext2D,
    s,
  );
  expect(moves).toBe(2);
  expect(closes).toBe(2);
  expect(rule).toBe("nonzero");
});
it("creates grid-aligned pixel ink independent of sample density and changes the grid with particle size", () => {
  const s = stroke("pixel", [
    [200, 300],
    [600, 300],
  ]);
  const sparse = outlines(s.points, "pixel", s.params);
  const dense = outlines(
    points(Array.from({ length: 101 }, (_, i) => [200 + i * 4, 300])),
    "pixel",
    s.params,
  );
  expect(sparse).toEqual(dense);
  expect(sparse.flat(2).every((v) => v % 12 === 0)).toBe(true);
  const coarse = outlines(s.points, "pixel", { ...s.params, pixelSize: 40 });
  expect(coarse).not.toEqual(sparse);
  expect(coarse.flat(2).every((v) => v % 40 === 0)).toBe(true);
  expect(
    outlines(points([[400, 400]]), "pixel", s.params).length,
  ).toBeGreaterThan(0);
  expect(strokeIsSafe(stroke("pixel", [[1e12, 1e12]]))).toBe(false);
});
it("preserves the empty middle of a pixel loop and selects only actual ink with the lasso", () => {
  const s = stroke("pixel", [
    [250, 250],
    [650, 250],
    [650, 650],
    [250, 650],
    [250, 250],
  ]);
  const contours = outlines(s.points, s.brush, s.params);
  expect(contours.some((p) => inside([450, 450], p))).toBe(false);
  expect(
    selectStrokesLasso(
      [s],
      [
        { x: 420, y: 420 },
        { x: 480, y: 420 },
        { x: 480, y: 480 },
        { x: 420, y: 480 },
      ],
    ),
  ).toEqual([]);
  expect(
    selectStrokesLasso(
      [s],
      [
        { x: 240, y: 240 },
        { x: 280, y: 240 },
        { x: 280, y: 280 },
        { x: 240, y: 280 },
      ],
    ),
  ).toEqual([s.id]);
});
it("migrates old backups and device projects, roundtrips pixel settings and validates bounds", () => {
  const old = newProject();
  delete (old.settings.brushParams as Partial<typeof old.settings.brushParams>)
    .pixel;
  old.settings.sampleMode = "hidden";
  const migrated = parseProject(JSON.stringify(old));
  expect(migrated.settings.brushParams.pixel.pixelSize).toBe(12);
  useStudio.getState().setProject(old);
  expect(
    useStudio.getState().project!.settings.brushParams.pixel.pixelSize,
  ).toBe(12);
  expect(useStudio.getState().project!.settings.sampleMode).toBe(
    "inside-faint",
  );
  migrated.settings.activeBrush = "pixel";
  migrated.settings.writingSize = 700;
  migrated.settings.brushParams.pixel.pixelSize = 28;
  expect(parseProject(JSON.stringify(migrated)).settings).toEqual(
    migrated.settings,
  );
  migrated.settings.brushParams.pixel.pixelSize = 0;
  expect(() => parseProject(JSON.stringify(migrated))).toThrow();
  migrated.settings.brushParams.pixel.pixelSize = 12;
  migrated.settings.writingSize = 901;
  expect(() => parseProject(JSON.stringify(migrated))).toThrow();
});
it("exports nib retracing and pixel strokes as nonempty, parseable OTF glyphs without mutating original vectors", () => {
  const project = newProject();
  project.samples.A = {
    char: "A",
    category: "latin-upper",
    status: "done",
    updatedAt: 1,
    strokes: [
      stroke("nib", [
        [250, 350],
        [650, 350],
        [250, 350],
      ]),
    ],
  };
  project.samples.B = {
    char: "B",
    category: "latin-upper",
    status: "done",
    updatedAt: 1,
    strokes: [
      stroke("pixel", [
        [250, 250],
        [650, 650],
      ]),
    ],
  };
  const before = JSON.stringify(project);
  const font = opentype.parse(
    generateFont({ project, preparation: defaultPreparation("Solid pens") })
      .buffer,
  );
  expect(
    font.charToGlyph("A").path.commands.filter((c) => c.type === "Z"),
  ).toHaveLength(1);
  expect(font.charToGlyph("B").path.commands.length).toBeGreaterThan(20);
  expect(JSON.stringify(project)).toBe(before);
});
