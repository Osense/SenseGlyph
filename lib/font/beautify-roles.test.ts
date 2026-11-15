import { expect, it } from "vitest";
import { beautifyStrokes, NO_CORRECTION, writerSlant } from "./beautify";
import type { Stroke } from "../types";
import type { Part } from "./types";

const line = (id: string, pts: [number, number][]): Stroke => ({
  id,
  order: 0,
  createdAt: 0,
  brush: "pen",
  params: { size: 24, usePressure: false },
  points: pts.flatMap(([x, y], k) =>
    k === 0
      ? [{ x, y, p: 0.5, t: 0 }]
      : Array.from({ length: 10 }, (_, i) => ({
          x: pts[k - 1][0] + ((x - pts[k - 1][0]) * (i + 1)) / 10,
          y: pts[k - 1][1] + ((y - pts[k - 1][1]) * (i + 1)) / 10,
          p: 0.5,
          t: k * 10 + i,
        })),
  ),
});
const width = (s: Stroke) =>
  Math.max(...s.points.map((p) => p.x)) - Math.min(...s.points.map((p) => p.x));

it("evens out the two branches of ㅑ while keeping them attached to the pillar", () => {
  const strokes = [
    line("ㅇ", [
      [300, 300],
      [380, 300],
    ]), // 초성(간단히)
    line("기둥", [
      [620, 150],
      [620, 850],
    ]),
    line("위", [
      [620, 380],
      [800, 380],
    ]),
    line("아래", [
      [620, 560],
      [700, 560],
    ]),
  ];
  const partOf = new Map<string, Part>([
    ["ㅇ", "cho"],
    ["기둥", "jung"],
    ["위", "jung"],
    ["아래", "jung"],
  ]);
  const result = beautifyStrokes(strokes, {
    amounts: { ...NO_CORRECTION, layout: 1 },
    category: "hangul-syllable",
    partOf,
    vowel: { type: "V", jong: false },
  });
  const [w1, w2] = [width(result[2]), width(result[3])];
  expect(Math.abs(w1 - w2)).toBeLessThan(Math.abs(180 - 80) * 0.75);
  // 기둥 쪽 끝(620)은 그대로
  expect(Math.min(...result[2].points.map((p) => p.x))).toBeCloseTo(620, 0);
  expect(Math.min(...result[3].points.map((p) => p.x))).toBeCloseTo(620, 0);
});

it("straightens horizontals to the writer's own slight upward slant, not to dead flat", () => {
  const rising = Array.from({ length: 8 }, (_, i) =>
    line("h" + i, [
      [200, 300 + i * 40],
      [700, 300 + i * 40 - 30],
    ]),
  );
  const slant = writerSlant(rising);
  expect(slant.horizontal).toBeLessThan(0); // 오른쪽이 올라감(y 아래가 +)
  const wobbly = line("w", [
    [200, 500],
    [450, 510],
    [700, 470],
  ]);
  const [result] = beautifyStrokes([wobbly], {
    amounts: { ...NO_CORRECTION, straighten: 1 },
    category: "hangul-syllable",
    slant,
  });
  const first = result.points[0],
    last = result.points.at(-1)!;
  expect(last.y).toBeLessThan(first.y); // 여전히 살짝 오름
});
