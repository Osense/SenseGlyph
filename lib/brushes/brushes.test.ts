import { it, expect } from "vitest";
import { outline } from "./index";
import type { BrushId } from "../types";
it('all brushes produce visible ink for a tap with repeated identical points',()=>{
  for(const brush of ['pen','marker','brush','pencil','nib'] as BrushId[]){
    const polygon=outline([{x:400,y:400,p:.5,t:0},{x:400,y:400,p:.5,t:10}],brush,{size:50,usePressure:true,nibAngle:30});
    const area=polygon.reduce((sum,p,i)=>{const n=polygon[(i+1)%polygon.length];return sum+p[0]*n[1]-n[0]*p[1];},0);
    expect(polygon.length).toBeGreaterThan(3);expect(Math.abs(area)).toBeGreaterThan(1);
  }
});
const points = Array.from({ length: 20 }, (_, i) => ({
  x: i * 30,
  y: 200 + Math.sin(i) * 30,
  p: 0.1 + i / 25,
  t: i * 5,
}));
it("all five brushes deterministically regenerate finite distinct polygons", () => {
  const results = (
    ["pen", "marker", "brush", "pencil", "nib"] as BrushId[]
  ).map((b) => {
    const params = { size: 50, usePressure: true, nibAngle: 30 };
    const first = outline(points, b, params);
    expect(first).toEqual(outline(points, b, params));
    expect(first.length).toBeGreaterThan(3);
    expect(first.flat().every(Number.isFinite)).toBe(true);
    return JSON.stringify(first);
  });
  expect(new Set(results).size).toBe(5);
});
it("nib offsets follow configured angle and empty strokes are safe", () => {
  expect(outline([], "pen", { size: 50, usePressure: true })).toEqual([]);
  const n = outline(
    [
      { x: 100, y: 100, p: 0.5, t: 0 },
      { x: 200, y: 100, p: 0.5, t: 1 },
    ],
    "nib",
    { size: 40, usePressure: false, nibAngle: 90 },
  );
  expect(n[0][0]).toBeCloseTo(100);
  expect(n[0][1]).toBeCloseTo(120);
  expect(n[3][1]).toBeCloseTo(80);
});
it("stroke ends are a single half circle, not an extra loop hanging off the end", () => {
  // A pen slowing to a stop before lifting, plus the repeated pointer-up point.
  let x = 100;
  const points = Array.from({ length: 40 }, (_, i) => {
    x += i < 30 ? 14 : 14 * 0.6 ** (i - 29);
    return { x, y: 300, p: 0.5, t: i * 8 };
  });
  points.push({ ...points[points.length - 1] });
  const end = points[points.length - 1].x;
  for (const brush of ["pen", "marker", "pencil"] as BrushId[]) {
    const size = 50 * (brush === "pencil" ? 0.5 : 1);
    const polygon = outline(points, brush, { size: 50, usePressure: false });
    // Nothing may reach further past the end than a round cap of the line width.
    expect(Math.max(...polygon.map((p) => p[0]))).toBeLessThan(end + size * 0.8);
    // The old 3π end cap looped around the end and crossed its own outline.
    expect(selfCrossingsNear(polygon, [end, 300], size * 1.5)).toBe(0);
  }
});

function selfCrossingsNear(poly: number[][], at: number[], radius: number) {
  const edges = poly
    .map((p, i) => [p, poly[(i + 1) % poly.length], i] as const)
    .filter(([a, b]) =>
      [a, b].every((p) => Math.hypot(p[0] - at[0], p[1] - at[1]) < radius),
    );
  const side = (a: number[], b: number[], c: number[]) =>
    Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  let crossings = 0;
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b, m] = edges[i],
        [c, d, n] = edges[j];
      if (Math.abs(m - n) <= 1 || Math.abs(m - n) === poly.length - 1) continue;
      if (
        side(a, b, c) * side(a, b, d) < 0 &&
        side(c, d, a) * side(c, d, b) < 0
      )
        crossings++;
    }
  return crossings;
}
