import { it, expect, beforeEach } from "vitest";
import { completeFixture } from "./font/fixtures";
import { glyphIssues, projectIssues } from "./review";
import { useStudio } from "./store";
import { parseProject } from "./storage";
import type { GlyphSample } from "./types";

it("keeps a new project empty and identifies unsafe, skipped, empty, missing-component and manual problems", () => {
  const p = completeFixture();
  expect(Object.keys(projectIssues(p))).toHaveLength(0);
  p.samples["겨"] = {
    ...p.samples["겨"],
    strokes: p.samples["겨"].strokes.map((stroke, i) =>
      i
        ? stroke
        : {
            ...stroke,
            points: stroke.points.map((point) => ({
              ...point,
              x: point.x - 400,
            })),
          },
    ),
  };
  p.samples["구"] = { ...p.samples["구"], needsReview: true };
  p.samples["귀"] = { ...p.samples["귀"], status: "skipped" };
  p.samples["갛"] = { ...p.samples["갛"], strokes: [] };
  p.samples["겪"] = {
    ...p.samples["겪"],
    strokes: p.samples["겪"].strokes.slice(0, 1),
  };
  const issues = projectIssues(p);
  expect(Object.keys(issues)).toHaveLength(5);
  expect(issues["겨"].some((issue) => issue.kind === "unsafe")).toBe(true);
  expect(issues["구"][0].kind).toBe("manual");
  expect(issues["귀"][0].kind).toBe("skipped");
  expect(issues["갛"][0].kind).toBe("empty");
  expect(issues["겪"][0].kind).toBe("components");
  expect(glyphIssues()).toEqual([]);
});

it("does not invalidate corrected vectors when setting a manual note and persists flags in JSON", () => {
  const p = completeFixture();
  useStudio.getState().setProject(p);
  const before = p.samples["겨"].updatedAt;
  useStudio.getState().markReview("겨", "hangul-syllable", true);
  const marked = useStudio.getState().project!;
  expect(marked.samples["겨"].updatedAt).toBe(before);
  expect(parseProject(JSON.stringify(marked)).samples["겨"].needsReview).toBe(
    true,
  );
  useStudio.getState().markReview("겨", "hangul-syllable", false);
  expect(projectIssues(useStudio.getState().project)["겨"]).toBeUndefined();
});

it("keeps a cleared problem in the rewrite list until valid writing returns and restores flags after undo", () => {
  const p = completeFixture();
  useStudio.getState().setProject(p);
  const store = useStudio.getState();
  store.commit("겨", "hangul-syllable", []);
  expect(projectIssues(useStudio.getState().project)["겨"][0].kind).toBe(
    "empty",
  );
  store.undo("겨");
  expect(projectIssues(useStudio.getState().project)["겨"]).toBeUndefined();
  store.redo("겨");
  expect(projectIssues(useStudio.getState().project)["겨"][0].kind).toBe(
    "empty",
  );
  store.commit("겨", "hangul-syllable", p.samples["겨"].strokes);
  expect(projectIssues(useStudio.getState().project)["겨"]).toBeUndefined();
});
it("does not mark a valid g descender red, but still flags a stroke beyond the Latin bottom limit", () => {
  const sample: GlyphSample = {
    char: "g",
    category: "latin-lower",
    status: "done",
    updatedAt: 1,
    strokes: [
      {
        id: "tail",
        brush: "marker",
        params: { size: 40, usePressure: false },
        order: 0,
        createdAt: 1,
        points: [
          { x: 400, y: 930, p: 0.5, t: 0 },
          { x: 430, y: 970, p: 0.5, t: 10 },
        ],
      },
    ],
  };
  expect(glyphIssues(sample)).toEqual([]);
  const outside = {
    ...sample,
    strokes: sample.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point, y: point.y + 40 })),
    })),
  };
  expect(glyphIssues(outside).some((issue) => issue.kind === "unsafe")).toBe(
    true,
  );
});
