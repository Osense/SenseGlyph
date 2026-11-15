import { expect, it } from "vitest";
import {
  applyStyle,
  flattenPath,
  inferStyle,
  isNoticeable,
  offsetRings,
  strokeWidthOf,
  type Rings,
} from "./style-transfer";

/** 가로 막대(두께 thick) 하나와 세로 막대 하나: 十 모양 */
const cross = (thick: number, w = 600, h = 600, cx = 470, cy = 300): Rings => [
  [
    [cx - w / 2, cy - thick / 2],
    [cx + w / 2, cy - thick / 2],
    [cx + w / 2, cy + thick / 2],
    [cx - w / 2, cy + thick / 2],
  ],
  [
    [cx - thick / 2, cy - h / 2],
    [cx + thick / 2, cy - h / 2],
    [cx + thick / 2, cy + h / 2],
    [cx - thick / 2, cy + h / 2],
  ],
];

it("measures stroke width from ink area and outline length", () => {
  expect(strokeWidthOf(cross(60))).toBeGreaterThan(50);
  expect(strokeWidthOf(cross(60))).toBeLessThan(70);
});

it("infers thicker, narrower handwriting from a few pairs", () => {
  const pairs = [0, 1, 2, 3].map(() => ({
    mine: cross(90, 540, 600),
    reference: cross(60, 600, 600),
  }));
  const style = inferStyle(pairs);
  expect(style.samples).toBe(4);
  expect(style.weight).toBeGreaterThan(1.3);
  expect(style.width).toBeCloseTo(0.9, 1);
  expect(style.height).toBeCloseTo(1, 1);
  expect(isNoticeable(style)).toBe(true);
});

it("stays neutral with too few samples", () => {
  const style = inferStyle([{ mine: cross(90), reference: cross(60) }]);
  expect(isNoticeable(style)).toBe(false);
});

it("applies weight, width and rise to sample glyphs", () => {
  const center = { x: 470, y: 300 };
  const base = cross(60);
  const styled = applyStyle(
    base,
    {
      weight: 1.5,
      width: 0.9,
      height: 1,
      shiftY: 0,
      rise: 4,
      lean: 0,
      samples: 5,
    },
    center,
  );
  expect(strokeWidthOf(styled)).toBeGreaterThan(strokeWidthOf(base) * 1.3);
  const xs = styled.flat().map((p) => p[0]);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(600);
  // 오른쪽 끝이 왼쪽 끝보다 높다(가로획이 오름)
  const bar = styled[0];
  expect(bar[1][1]).toBeGreaterThan(bar[0][1]);
});

it("shrinks holes the right way when thinning", () => {
  const thinner = offsetRings(cross(80), -10);
  expect(strokeWidthOf(thinner)).toBeLessThan(strokeWidthOf(cross(80)));
});

it("flattens curves into rings", () => {
  const rings = flattenPath([
    { type: "M", x: 0, y: 0 },
    { type: "Q", x1: 50, y1: 100, x: 100, y: 0 },
    { type: "L", x: 50, y: -50 },
    { type: "Z" },
  ]);
  expect(rings).toHaveLength(1);
  expect(rings[0].length).toBeGreaterThan(6);
});
