import { expect, it } from "vitest";
import { completeFixture } from "./fixtures";
import { confirmSeparation, separationStatus } from "./separation-status";
import { defaultPreparation } from "./types";

it("marks glyphs as confirmed after confirming the visible assignment", () => {
  const project = completeFixture();
  let prep = defaultPreparation(project.name);
  expect(separationStatus(project, prep, "겨")).not.toBe("confirmed");
  prep = confirmSeparation(project, prep, "겨");
  expect(separationStatus(project, prep, "겨")).toBe("confirmed");
  // A rewrite invalidates the confirmation.
  project.samples["겨"] = { ...project.samples["겨"], updatedAt: 99 };
  expect(separationStatus(project, prep, "겨")).not.toBe("confirmed");
});

it("asks to check a glyph whose part is missing", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const sample = project.samples["곧"];
  project.samples["곧"] = { ...sample, strokes: sample.strokes.slice(0, 1) };
  expect(separationStatus(project, prep, "곧")).toBe("check");
});
