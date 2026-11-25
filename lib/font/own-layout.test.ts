import { expect, it } from "vitest";
import { ownLayouts } from "./beautify";
import { createLayoutPlan, layoutGlyph } from "./layout";
import type { Stroke } from "../types";

let n = 0;
const box = (x: number, y: number, w: number, h: number): Stroke => ({
  id: "o" + n++,
  order: n,
  createdAt: n,
  brush: "pen",
  params: { size: 0, usePressure: false },
  points: [
    { x, y, p: 1, t: 0 },
    { x: x + w, y: y + h, p: 1, t: 1 },
  ],
});

it("learns the writer's usual jamo layout per syllable shape", () => {
  // 세로 모음 글자 셋: 초성은 왼쪽 절반, 모음은 오른쪽(가운데 글자만 크기·위치가 다르게 쓰임)
  const written = [0, 1, 2].map((i) => {
    const k = i === 1 ? 1.2 : 1;
    const dx = i * 40;
    return {
      layout: "V:false",
      parts: [
        { part: "cho" as const, strokes: [box(dx, 0, 400 * k, 800 * k)] },
        {
          part: "jung" as const,
          strokes: [box(dx + 600 * k, 0, 200 * k, 800 * k)],
        },
      ],
    };
  });
  const own = ownLayouts(written).get("V:false")!;
  // 글자 범위에 대한 비율이므로 크기·위치가 달라도 같은 배치로 읽힌다
  expect(own.cho!.x).toBeCloseTo(0, 5);
  expect(own.cho!.width).toBeCloseTo(0.5, 5);
  expect(own.jung!.x).toBeCloseTo(0.75, 5);
  // 두 글자뿐이면 '평소 배치'로 보지 않는다
  expect(ownLayouts(written.slice(0, 2)).size).toBe(0);
});

it("evens glyph size only against syllables of the same shape", () => {
  const ring = (x: number, y: number, w: number, h: number) => [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  ];
  const settings = {
    familyName: "t",
    letterSpacing: 0,
    baseline: 800,
    includeComposed: true,
  };
  // 받침 없는 세로 모음(가·나·다)은 600, 받침 있는 섞임 모음(곽·괄·괌)은 800 크기로 썼다
  const direct = new Map([
    ["가", ring(0, 0, 600, 600)],
    ["나", ring(0, 0, 600, 600)],
    ["다", ring(0, 0, 600, 600)],
    ["곽", ring(0, 0, 800, 800)],
    ["괄", ring(0, 0, 800, 800)],
    ["괌", ring(0, 0, 800, 800)],
  ]);
  const plan = createLayoutPlan(direct, settings, 1);
  const height = (char: string, size: number) => {
    const g = layoutGlyph(char, ring(0, 0, size, size), plan);
    return g.bounds!.bottom - g.bounds!.top;
  };
  // 짜임이 다르면 원래 크기 차이를 남긴다(받침 있는 섞임 모음은 원래 더 크다)
  expect(height("라", 600)).toBeLessThan(height("괍", 800));
  // 같은 짜임에서 크게 쓴 글자는 줄고, 작게 쓴 글자는 커진다
  expect(height("마", 700)).toBeLessThan((700 / 600) * height("가", 600));
  expect(height("바", 520)).toBeGreaterThan((520 / 600) * height("가", 600));
});
