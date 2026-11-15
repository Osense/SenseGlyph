import { expect, it } from "vitest";
import { composeGlyph } from "./composition";
import type { ComponentSample } from "./types";
import type { Stroke } from "../types";
let n = 0;
const s = (pts: [number, number][]): Stroke => ({
  id: "s" + n++,
  order: n,
  createdAt: n,
  brush: "pen",
  params: { size: 34, usePressure: false },
  points: pts.flatMap(([x, y], k) =>
    k === 0
      ? [{ x, y, p: 1, t: 0 }]
      : Array.from({ length: 10 }, (_, i) => ({
          x: pts[k - 1][0] + ((x - pts[k - 1][0]) * (i + 1)) / 10,
          y: pts[k - 1][1] + ((y - pts[k - 1][1]) * (i + 1)) / 10,
          p: 1,
          t: k * 10 + i,
        })),
  ),
});
const c = (
  key: string,
  char: string,
  part: any,
  strokes: Stroke[],
): ComponentSample => ({
  key,
  char,
  part,
  strokes,
  box: { x: 0, y: 0, width: 1000, height: 1000 },
});
// 초성 ㄱ=0, ㄹ=5, ㅂ=7, ㅅ=9 / 중성 ㅗ=8, ㅜ=13
const gu = {
  cho: c("cho:0:H:false", "구", "cho", [
    s([
      [300, 230],
      [690, 230],
      [670, 430],
    ]),
  ]),
  jung: c("jung:13:false", "구", "jung", [
    s([
      [150, 520],
      [850, 515],
    ]),
    s([
      [500, 525],
      [505, 800],
    ]),
  ]),
};
const ro = {
  cho: c("cho:5:H:false", "로", "cho", [
    s([
      [290, 130],
      [710, 130],
      [700, 300],
    ]),
    s([
      [700, 300],
      [300, 310],
      [300, 470],
    ]),
    s([
      [300, 470],
      [720, 470],
    ]),
  ]),
  jung: c("jung:8:false", "로", "jung", [
    s([
      [500, 600],
      [500, 690],
    ]),
    s([
      [320, 700],
      [680, 698],
    ]),
  ]),
};
const bo = {
  cho: c("cho:7:H:false", "보", "cho", [
    s([
      [340, 180],
      [340, 450],
    ]),
    s([
      [660, 180],
      [660, 450],
    ]),
    s([
      [340, 310],
      [660, 310],
    ]),
    s([
      [340, 450],
      [660, 450],
    ]),
  ]),
  jung: c("jung:8:false", "보", "jung", [
    s([
      [500, 480],
      [500, 570],
    ]),
    s([
      [180, 585],
      [820, 580],
    ]),
  ]),
};
const so = {
  cho: c("cho:9:H:false", "소", "cho", [
    s([
      [500, 190],
      [300, 450],
    ]),
    s([
      [480, 260],
      [700, 450],
    ]),
  ]),
  jung: c("jung:8:false", "소", "jung", [
    s([
      [500, 475],
      [500, 565],
    ]),
    s([
      [190, 580],
      [810, 575],
    ]),
  ]),
};
const pools = new Map<string, ComponentSample[]>();
for (const ch of [gu, ro, bo, so])
  for (const p of Object.values(ch))
    pools.set(p.key, [...(pools.get(p.key) ?? []), p]);
const library = new Map<string, ComponentSample>(
  [...pools].map(([k, v]) => [k, v[0]]),
);
library.set("jung:8:false", ro.jung);
pools.set("jung:8:false", [ro.jung]); // 사용자 사례: ㅗ는 '로'에서만
const box = (strokes: Stroke[]) => {
  const xs = strokes.flatMap((t) => t.points.map((p) => p.x)),
    ys = strokes.flatMap((t) => t.points.map((p) => p.y));
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
};
it("stacks 고 from 구's ㄱ and 로's small, low ㅗ by learned spacing, not by their old spots", () => {
  const strokes = composeGlyph("고", library, pools)!;
  const cho = box(strokes.slice(0, 1)),
    jung = box(strokes.slice(1));
  // 고치기 전: ㄱ 아래(430)와 ㅗ 위(600) 사이가 170 넘게 비었다.
  expect(jung.top - cho.bottom).toBeLessThan(170 * 0.75);
  // 큰 ㄹ에 눌려 작았던 ㅗ가 초성보다 넓게(이 사람의 가로 모음 비율 쪽으로) 커진다.
  expect(jung.right - jung.left).toBeGreaterThan((cho.right - cho.left) * 0.95);
});

it("learns the usual size of ㅗ from 보·소 when available", () => {
  const more = new Map(pools);
  more.set("jung:8:false", [ro.jung, bo.jung, so.jung]);
  const strokes = composeGlyph("고", library, more)!;
  const jung = box(strokes.slice(1));
  expect(jung.right - jung.left).toBeGreaterThan(360 * 1.15);
});
