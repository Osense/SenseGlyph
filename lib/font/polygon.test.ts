import { it, expect } from "vitest";
import { simplifyContour } from "./polygon";
import { segmentDistance } from "../geometry";

it("reduces redundant closed outline vertices within sub-em error without mutating the source", () => {
  const circle = Array.from({ length: 500 }, (_, i) => [
    500 + Math.cos((i / 500) * Math.PI * 2) * 200,
    500 + Math.sin((i / 500) * Math.PI * 2) * 200,
  ]);
  const original = JSON.stringify(circle),
    result = simplifyContour(circle);
  expect(result.length).toBeLessThan(100);
  for (const p of circle) {
    const distance = Math.min(
      ...result.map((a, i) => {
        const b = result[(i + 1) % result.length];
        return segmentDistance(
          { x: p[0], y: p[1] },
          { x: a[0], y: a[1] },
          { x: b[0], y: b[1] },
        );
      }),
    );
    expect(distance).toBeLessThanOrEqual(0.65);
  }
  expect(JSON.stringify(circle)).toBe(original);
});
