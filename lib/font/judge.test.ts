import { expect, it } from "vitest";
import { judgeStrokes, strokeRanges } from "./judge";
import type { Stroke } from "../types";

const settings = { referenceFont: "sans", grid: { diamond: true } } as never;
let order = 0;
const line = (
  id: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Stroke => ({
  id,
  order: order++,
  createdAt: order,
  brush: "pen",
  params: { size: 30, usePressure: false },
  points: Array.from({ length: 8 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / 7,
    y: y0 + ((y1 - y0) * i) / 7,
    p: 1,
    t: i,
  })),
});

it("knows the standard stroke counts of each jamo (강 = ㄱ1 + ㅏ2 + ㅇ1)", () => {
  expect(strokeRanges("강")!.map((r) => r.range[1])).toEqual([1, 2, 1]);
  expect(strokeRanges("닭")!.map((r) => r.range[1])).toEqual([2, 2, 4]);
});

it("splits 강 by stroke order: 1 → 초성, 2·3 → 중성, 4 → 종성", () => {
  order = 0;
  const strokes = [
    line("ㄱ", 250, 220, 520, 230), // ㄱ (가로 후 세로를 한 획으로 대신)
    line("ㅏ1", 640, 120, 640, 640),
    line("ㅏ2", 640, 380, 760, 380),
    line("ㅇ", 380, 720, 620, 860),
  ];
  const judged = judgeStrokes("강", strokes, settings)!;
  expect([...judged.parts.values()]).toEqual(["cho", "jung", "jung", "jong"]);
  expect(judged.ordered).toBe(true);
});

it("always finds an initial even when the first stroke drifts into the vowel area", () => {
  order = 0;
  // 크게 써서 첫 획(ㄱ)이 견본의 모음 자리 쪽으로 치우친 경우
  const strokes = [
    line("ㄱ", 420, 300, 700, 320),
    line("ㅏ1", 760, 150, 760, 820),
    line("ㅏ2", 760, 480, 900, 480),
  ];
  const judged = judgeStrokes("가", strokes, settings)!;
  expect(judged.parts.get("ㄱ")).toBe("cho");
  expect(judged.parts.get("ㅏ1")).toBe("jung");
});

it("treats the last strokes of a syllable with a final as the final", () => {
  order = 0;
  const strokes = [
    line("ㄴ", 250, 150, 250, 380),
    line("ㅡ", 150, 470, 850, 470),
    line("ㄹ1", 330, 640, 640, 650),
    line("ㄹ2", 340, 740, 640, 750),
    line("ㄹ3", 340, 840, 660, 850),
  ];
  const judged = judgeStrokes("늘", strokes, settings)!;
  expect([...judged.parts.values()]).toEqual([
    "cho",
    "jung",
    "jong",
    "jong",
    "jong",
  ]);
});

it("follows position when someone writes the strokes in an unusual order", () => {
  order = 0;
  // 받침 ㅇ을 맨 먼저 쓴 경우
  const strokes = [
    line("ㅇ", 380, 760, 620, 880),
    line("ㄱ", 220, 220, 480, 240),
    line("ㅏ1", 640, 120, 640, 620),
    line("ㅏ2", 640, 370, 770, 370),
  ];
  const judged = judgeStrokes("강", strokes, settings)!;
  expect(judged.parts.get("ㅇ")).toBe("jong");
  expect(judged.parts.get("ㄱ")).toBe("cho");
});

it("keeps manual choices", () => {
  order = 0;
  const strokes = [
    line("a", 250, 220, 520, 230),
    line("b", 640, 120, 640, 640),
  ];
  const judged = judgeStrokes("가", strokes, settings, {
    a: "jung",
    b: "jung",
  })!;
  expect(judged.parts.get("a")).toBe("jung");
});
