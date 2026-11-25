import { expect, it } from "vitest";
import { composeGlyph } from "./composition";
import { frameOf } from "./interpolate";
import type { ComponentSample } from "./types";
import type { Stroke } from "../types";

let n = 0;
const s = (pts: [number, number][]): Stroke => ({
  id: "b" + n++,
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
  part: "cho" | "jung" | "jong",
  strokes: Stroke[],
): ComponentSample => ({
  key,
  char,
  part,
  strokes,
  box: { x: 0, y: 0, width: 1000, height: 1000 },
});

// 쾌: 초성 ㅋ(15)이 ㅙ 위 왼쪽 구석에 작게, 귀·퓌: ㅟ(16)의 ㅜ 짧은 기둥은 x≈400
const kwae = [
  c("cho:15:C:false", "쾌", "cho", [
    s([
      [140, 150],
      [330, 150],
      [300, 380],
    ]),
    s([
      [150, 260],
      [310, 260],
    ]),
  ]),
  c("jung:10:false", "쾌", "jung", [
    s([
      [230, 420],
      [240, 520],
    ]),
    s([
      [110, 540],
      [560, 540],
    ]),
    s([
      [650, 120],
      [650, 880],
    ]),
    s([
      [800, 120],
      [800, 880],
    ]),
  ]),
];
const wi = (char: string, cho: string, dx: number) => [
  c(cho, char, "cho", [
    s([
      [250 + dx, 170],
      [520 + dx, 170],
      [500 + dx, 400],
    ]),
  ]),
  c("jung:16:false", char, "jung", [
    s([
      [130 + dx, 470],
      [650 + dx, 470],
    ]),
    s([
      [390 + dx, 480],
      [390 + dx, 760],
    ]),
    s([
      [780, 120],
      [780, 880],
    ]),
  ]),
];
const parts = [
  ...kwae,
  ...wi("귀", "cho:0:C:false", 0),
  ...wi("퓌", "cho:17:C:false", 20),
];
const pools = new Map<string, ComponentSample[]>();
for (const part of parts)
  pools.set(part.key, [...(pools.get(part.key) ?? []), part]);
const library = new Map([...pools].map(([key, pool]) => [key, pool[0]]));

/** 퀴를 만들어 ㅋ 가운데와 ㅜ 짧은 기둥(x≈390~410) 사이 거리 */
function offset(balance: number) {
  const strokes = composeGlyph("퀴", library, pools, balance)!;
  // 앞쪽 획 2개가 ㅋ(초성), 그 뒤 3개가 ㅟ
  const cho = frameOf(strokes.slice(0, 2))!;
  const stem = frameOf([strokes[3]])!;
  return {
    dx: Math.abs(cho.x + cho.width / 2 - (stem.x + stem.width / 2)),
    gap: stem.y - (cho.y + cho.height),
    pillarGap: frameOf([strokes[4]])!.x - (cho.x + cho.width),
  };
}

it("leaves composition untouched at strength 0", () => {
  const plain = composeGlyph("퀴", library, pools)!;
  const zero = composeGlyph("퀴", library, pools, 0)!;
  expect(zero).toEqual(plain);
});

it("pulls a far-off borrowed initial toward the ㅜ stem of ㅟ", () => {
  const before = offset(0),
    after = offset(1);
  // 평소 자리(귀·퓌: 기둥 위)에서 크게 벗어난 만큼만 옮긴다. 글자 폭 10% 안의 차이는 손글씨 맛으로 둔다.
  expect(after.dx).toBeLessThan(before.dx - 50);
  expect(after.dx).toBeLessThan(80);
  // 초성이 보(ㅡ) 위에 앉고 오른쪽 기둥과 떨어져 있다
  expect(after.gap).toBeGreaterThan(0);
  expect(after.pillarGap).toBeGreaterThan(0);
  // 중간 강도는 그 사이
  expect(offset(0.5).dx).toBeLessThan(before.dx);
});
