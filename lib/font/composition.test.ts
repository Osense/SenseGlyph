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

it("keeps the original upper pair ahead of a confirmed initial-final pair", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const source = {
    ...project.samples["졺"],
    char: "즣",
    strokes: project.samples["졺"].strokes.map((stroke) => ({
      ...stroke,
      id: stroke.id.replace("졺", "즣"),
    })),
  };
  project.samples[source.char] = source;
  prep.separations[source.char] = {
    sourceUpdatedAt: source.updatedAt,
    assignments: {
      "즣-cho": "cho",
      "즣-jung": "jung",
      "즣-jong": "jong",
    },
  };
  const { library, pools } = prepareHandwriting(project, prep);
  const strokes = composeGlyph("좋", library, pools)!;
  expect(strokes[0]).toBe(project.samples["졺"].strokes[0]);
  expect(strokes[1]).toBe(project.samples["졺"].strokes[1]);
  expect(strokes[2]).toBe(source.strokes[2]);
});

it("prefers the same vowel layout when borrowing a final with equal confirmation", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const original = project.samples["흖"];
  const source = {
    ...original,
    char: "콯",
    strokes: original.strokes.map((stroke) => ({
      ...stroke,
      id: stroke.id.replace("흖", "콯"),
    })),
  };
  project.samples[source.char] = source;
  prep.separations[source.char] = {
    sourceUpdatedAt: source.updatedAt,
    assignments: { "콯-cho": "cho", "콯-jung": "jung", "콯-jong": "jong" },
  };
  prep.separations[original.char] = {
    sourceUpdatedAt: original.updatedAt,
    assignments: { "흖-cho": "cho", "흖-jung": "jung", "흖-jong": "jong" },
  };
  const { library, pools } = prepareHandwriting(project, prep);
  expect(composeGlyph("좋", library, pools)?.at(-1)?.id).toBe(
    source.strokes[2].id,
  );
});

it("applies opt-in handwriting correction to output strokes without changing the written sample", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const char = "졺";
  const source = project.samples[char].strokes;
  const points = structuredClone(source.map((stroke) => stroke.points));
  prep.settings.correction = 60;
  const original = prepareHandwriting(project, prep);
  const corrected = prepareHandwriting(project, prep, true);
  expect(original.direct.get(char)).toEqual(source);
  expect(corrected.direct.get(char)).not.toEqual(source);
  expect(corrected.direct.get(char)?.map((stroke) => stroke.id)).toEqual(
    source.map((stroke) => stroke.id),
  );
  expect(source.map((stroke) => stroke.points)).toEqual(points);
});

it("places a borrowed jamo by its share of the source letter, not its absolute spot", () => {
  const project = completeFixture();
  const prep = defaultPreparation(project.name);
  const center = (stroke: { points: { x: number; y: number }[] }) => {
    const xs = stroke.points.map((p) => p.x),
      ys = stroke.points.map((p) => p.y);
    return [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
  };
  const target = "걘";
  const before = prepareHandwriting(project, prep);
  const jong = composeGlyph(target, before.library, before.pools)!.at(-1)!;
  const sourceChar = jong.id.split("-")[0];
  expect(sourceChar).not.toBe(target);
  // 받침을 빌려 오는 글자를 아주 작게, 오른쪽 아래로 치우쳐 쓴 경우
  const source = project.samples[sourceChar];
  project.samples[sourceChar] = {
    ...source,
    strokes: source.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((p) => ({
        ...p,
        x: 650 + (p.x - 500) * 0.6,
        y: 650 + (p.y - 500) * 0.6,
      })),
    })),
  };
  const after = prepareHandwriting(project, prep);
  const moved = composeGlyph(target, after.library, after.pools)!.at(-1)!;
  const [x0, y0] = center(jong),
    [x1, y1] = center(moved);
  // 절대 좌표 그대로였다면 100 이상 밀려났을 받침이 제자리 근처에 놓인다.
  expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(25);
});
