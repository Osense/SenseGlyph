import { describe, it, expect } from "vitest";
import {
  assignStroke,
  boxesFor,
  componentLibrary,
  composeGlyph,
  coverage,
  prepareHandwriting,
} from "./composition";
import { defaultPreparation } from "./types";
import { completeFixture } from "./fixtures";
import { newProject } from "../defaults";

describe("Hangul component assembly", () => {
  it("separates all 237 slots and covers every modern syllable from the 138 samples", () => {
    const project = completeFixture(),
      prep = defaultPreparation(project.name);
    const report = coverage(project, prep);
    expect(report.slots).toBe(237);
    expect(report.missingSlots).toEqual([]);
    expect(report.direct).toBe(138);
    expect(report.composed).toBe(11172 - 138);
    expect(new Set(report.available).size).toBe(11172);
    const library = componentLibrary(project, prep);
    for (const char of ["가", "값", "안", "녕", "힣", "휰"])
      expect(composeGlyph(char, library)?.length).toBeGreaterThan(1);
  });
  it("keeps incomplete coverage honest and supports direct-only export", () => {
    const project = newProject(),
      prep = defaultPreparation(project.name);
    expect(coverage(project, prep).available).toEqual([]);
    const full = completeFixture();
    project.samples["겨"] = full.samples["겨"];
    expect(coverage(project, prep).available).toContain("겨");
    expect(coverage(project, prep).slots).toBe(2);
    expect(composeGlyph("힣", componentLibrary(project, prep))).toBeNull();
    prep.settings.includeComposed = false;
    expect(coverage(project, prep).composed).toBe(0);
  });
  it("manual stroke assignment and source boxes override automatic grouping", () => {
    const p = completeFixture(),
      sample = p.samples["겨"],
      stroke = sample.strokes[0];
    expect(assignStroke("겨", stroke)).toBe("cho");
    const separation = {
      assignments: { [stroke.id]: "jung" as const },
      boxes: { cho: { x: 100, y: 110, width: 200, height: 250 } },
    };
    expect(assignStroke("겨", stroke, separation)).toBe("jung");
    expect(boxesFor("겨", separation).cho).toEqual(separation.boxes.cho);
  });
  it("reuses the original strokes and groups compatible parts from the same source", () => {
    const project = completeFixture();
    const prep = defaultPreparation(project.name);
    prep.settings.shapeInterpolation = prep.settings.widthCorrection = 100;
    const { library, pools } = prepareHandwriting(project, prep);
    const strokes = composeGlyph("좋", library, pools)!;
    expect(strokes).toContain(project.samples["졺"].strokes[0]);
    expect(strokes).toContain(project.samples["졺"].strokes[1]);
    expect(strokes.some((stroke) => stroke.id === "요-jung")).toBe(false);
    const noFinal = composeGlyph("아", library, pools)!;
    expect(noFinal).toHaveLength(2);
    expect(
      noFinal.every((stroke) => {
        const char = stroke.id.split("-")[0];
        return (char.charCodeAt(0) - 0xac00) % 28 === 0;
      }),
    ).toBe(true);
  });
});

it("keeps a confirmed final consonant from the current project's source", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const source = {
    ...project.samples["펭"],
    char: "뱅",
    strokes: project.samples["펭"].strokes.map((stroke) => ({
      ...stroke,
      id: stroke.id.replace("펭", "뱅"),
    })),
  };
  project.samples[source.char] = source;
  prep.settings.positionCorrection = prep.settings.shapeInterpolation = 0;
  expect(componentLibrary(project, prep).get("jong:21:V")?.char).toBe("펭");
  prep.separations[source.char] = {
    sourceUpdatedAt: source.updatedAt,
    assignments: Object.fromEntries(
      source.strokes.map((stroke) => [
        stroke.id,
        stroke.id.endsWith("-jong")
          ? "jong"
          : stroke.id.endsWith("-jung")
            ? "jung"
            : "cho",
      ]),
    ),
  };
  const finalStroke = source.strokes.find((stroke) =>
    stroke.id.endsWith("-jong"),
  )!;
  const component = componentLibrary(project, prep).get("jong:21:V")!;
  expect(component.char).toBe(source.char);
  expect(component.strokes).toEqual([finalStroke]);
  expect(component.strokes[0]).toBe(finalStroke);
});
