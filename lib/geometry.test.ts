import { describe, it, expect } from "vitest";
import {
  pixelToEm,
  emToPixel,
  segmentDistance,
  hitsStroke,
  splitPoints,
} from "./geometry";
const q = (x: number, y = 0) => ({ x, y, p: 0.5, t: x });
describe("em geometry", () => {
  it("round trips offset CSS pixels without clamping", () => {
    const r = { left: 20, top: 30, width: 500, height: 500 };
    expect(pixelToEm(270, 280, r)).toEqual({ x: 500, y: 500 });
    expect(emToPixel(500, 500, 500)).toEqual({ x: 250, y: 250 });
    expect(pixelToEm(10, 540, r)).toEqual({ x: -20, y: 1020 });
  });
  it("handles endpoints and zero length segments", () => {
    expect(segmentDistance(q(5, 3), q(0), q(10))).toBe(3);
    expect(segmentDistance(q(15), q(0), q(10))).toBe(5);
    expect(segmentDistance(q(3, 4), q(0), q(0))).toBe(5);
  });
  it("hits between sparse samples with width and strict boundary", () => {
    expect(hitsStroke(q(50, 7), [q(0), q(100)], 5, 6)).toBe(true);
    expect(hitsStroke(q(50, 8), [q(0), q(100)], 5, 6)).toBe(false);
  });
  it("splits into valid pieces and preserves original data", () => {
    const points = [0, 10, 20, 30, 40, 50, 60].map((x) => q(x));
    expect(splitPoints(points, q(30), 11)).toEqual([
      [q(0), q(10)],
      [q(50), q(60)],
    ]);
    expect(points).toHaveLength(7);
    expect(splitPoints([q(0), q(10), q(20)], q(10), 1)).toEqual([]);
  });
});
