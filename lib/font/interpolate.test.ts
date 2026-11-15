import { expect, it } from "vitest";
import {
  blendStrokes,
  deriveMissingSlots,
  frameOf,
  placeInBox,
} from "./interpolate";
import type { ComponentSample } from "./types";
import type { Stroke } from "../types";

const line = (id: string, pts: [number, number][]): Stroke => ({
  id,
  order: 0,
  createdAt: 0,
  brush: "pen",
  params: { size: 30, usePressure: false },
  points: pts.flatMap(([x, y], k) =>
    k === 0
      ? [{ x, y, p: 1, t: 0 }]
      : Array.from({ length: 8 }, (_, i) => ({
          x: pts[k - 1][0] + ((x - pts[k - 1][0]) * (i + 1)) / 8,
          y: pts[k - 1][1] + ((y - pts[k - 1][1]) * (i + 1)) / 8,
          p: 1,
          t: k * 8 + i,
        })),
  ),
});
const component = (
  key: string,
  char: string,
  strokes: Stroke[],
): ComponentSample => ({
  key,
  char,
  part: key.split(":")[0] as never,
  strokes,
  box: { x: 0, y: 0, width: 1000, height: 1000 },
});

it("makes the ㅏ of 각 from the ㅏ of 가: the pillar gets shorter, the branch keeps its length", () => {
  // ㅏ = 0번 모음, 받침 없음
  const ga = component("jung:0:false", "가", [
    line("p", [
      [650, 120],
      [650, 880],
    ]),
    line("b", [
      [650, 470],
      [790, 470],
    ]),
  ]);
  const library = deriveMissingSlots(new Map([["jung:0:false", ga]]), [
    "jung:0:true",
  ]);
  const made = library.get("jung:0:true")!;
  expect(made.derived).toBe(true);
  const pillar = frameOf([made.strokes[0]])!,
    branch = frameOf([made.strokes[1]])!;
  expect(pillar.height).toBeLessThan(760 * 0.8);
  expect(pillar.y).toBeCloseTo(120, 0); // 위쪽은 그대로
  expect(branch.width).toBeCloseTo(140, 0); // 곁줄기 길이는 그대로
});

it("moves an initial consonant down into the final slot when the final was never written", () => {
  const giyeok = component("cho:0:H:false", "그", [
    line("g", [
      [200, 150],
      [780, 150],
      [760, 420],
    ]),
  ]);
  const library = deriveMissingSlots(new Map([["cho:0:H:false", giyeok]]), [
    "jong:1:V",
  ]);
  const made = library.get("jong:1:V")!;
  expect(made.place).toBeDefined();
  const placed = placeInBox(made.strokes, made.place!, {
    x: 100,
    y: 100,
    width: 800,
    height: 800,
  });
  expect(frameOf(placed)!.y).toBeGreaterThan(560);
});

it("blends the same jamo written in different letters, but not differently built ones", () => {
  const a = [
    line("a", [
      [200, 200],
      [800, 200],
    ]),
  ];
  const b = [
    line("b", [
      [200, 240],
      [800, 240],
    ]),
  ];
  const blended = blendStrokes(a, [b], 0.5);
  expect(blended[0].points[0].y).toBeCloseTo(220, 0);
  expect(blended[0].id).toBe("a");
  const different = [
    line("c", [
      [500, 100],
      [500, 800],
    ]),
  ];
  expect(blendStrokes(a, [different])).toBe(a);
});
