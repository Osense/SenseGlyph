import type { BrushParams, StrokePoint } from "../types";

type Point = number[];
function hull(points: Point[]): Point[] {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (
        out.length > 1 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
/** Sweep a finite rectangular nib. Each convex segment has the same winding,
 * so retracing cannot cancel ink in Canvas, SVG or the exported font. */
export function nibContours(
  points: StrokePoint[],
  params: BrushParams,
): Point[][] {
  if (!points.length) return [];
  const angle = ((params.nibAngle ?? 30) * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    thin = Math.max(2, params.size * 0.07);
  const corners = (p: StrokePoint) => {
    const w = (params.size * (params.usePressure ? 0.3 + 0.7 * p.p : 1)) / 2;
    return [
      [p.x + c * w - s * thin, p.y + s * w + c * thin],
      [p.x - c * w - s * thin, p.y - s * w + c * thin],
      [p.x - c * w + s * thin, p.y - s * w - c * thin],
      [p.x + c * w + s * thin, p.y + s * w - c * thin],
    ];
  };
  if (points.length === 1) return [hull(corners(points[0]))];
  const result: Point[][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    // Ignore repeated pointer samples except for an actual tap.
    if (i > 1 && a.x === b.x && a.y === b.y && a.p === b.p) continue;
    result.push(hull([...corners(a), ...corners(b)]));
  }
  return result;
}

/** Rasterise into font-em cells, then merge adjacent cells into row rectangles.
 * No random particles: previews, restored projects and font files stay identical. */
export function pixelContours(
  points: StrokePoint[],
  params: BrushParams,
): Point[][] {
  if (
    !points.length ||
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        Math.abs(p.x) > 10000 ||
        Math.abs(p.y) > 10000,
    )
  )
    return [];
  const cell = Math.max(4, Math.min(40, params.pixelSize ?? 12));
  const rows = new Map<number, Set<number>>();
  const stamp = (x: number, y: number, p: number) => {
    const radius = (params.size * (params.usePressure ? 0.3 + 0.7 * p : 1)) / 2;
    const cx = Math.floor(x / cell),
      cy = Math.floor(y / cell);
    for (
      let iy = Math.floor((y - radius) / cell);
      iy <= Math.floor((y + radius) / cell);
      iy++
    ) {
      for (
        let ix = Math.floor((x - radius) / cell);
        ix <= Math.floor((x + radius) / cell);
        ix++
      ) {
        if (
          (ix !== cx || iy !== cy) &&
          Math.hypot((ix + 0.5) * cell - x, (iy + 0.5) * cell - y) > radius
        )
          continue;
        if (!rows.has(iy)) rows.set(iy, new Set());
        rows.get(iy)!.add(ix);
      }
    }
  };
  stamp(points[0].x, points[0].y, points[0].p);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (cell / 2)),
    );
    for (let k = 1; k <= count; k++) {
      const t = k / count;
      stamp(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.p + (b.p - a.p) * t,
      );
    }
  }
  const contours: Point[][] = [];
  for (const [row, cells] of [...rows].sort((a, b) => a[0] - b[0])) {
    const columns = [...cells].sort((a, b) => a - b);
    for (let i = 0; i < columns.length; i++) {
      const start = columns[i];
      let end = start;
      while (i + 1 < columns.length && columns[i + 1] === end + 1)
        end = columns[++i];
      const x = start * cell,
        y = row * cell,
        right = (end + 1) * cell;
      contours.push([
        [x, y],
        [right, y],
        [right, y + cell],
        [x, y + cell],
      ]);
    }
  }
  return contours;
}
