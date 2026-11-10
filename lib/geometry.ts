import type { StrokePoint } from "./types";
export function pixelToEm(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  return {
    x: ((x - rect.left) * 1000) / rect.width,
    y: ((y - rect.top) * 1000) / rect.height,
  };
}
export function emToPixel(x: number, y: number, width: number, height = width) {
  return { x: (x * width) / 1000, y: (y * height) / 1000 };
}
export function segmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function hitsStroke(
  p: { x: number; y: number },
  points: StrokePoint[],
  radius: number,
  width: number,
) {
  return points.some(
    (a, i) =>
      segmentDistance(p, a, points[Math.max(0, i - 1)]) < radius + width / 2,
  );
}
export function splitPoints(
  points: StrokePoint[],
  p: { x: number; y: number },
  radius: number,
): StrokePoint[][] {
  const result: StrokePoint[][] = [];
  let part: StrokePoint[] = [];
  for (const q of points) {
    if (Math.hypot(q.x - p.x, q.y - p.y) < radius) {
      if (part.length >= 2) result.push(part);
      part = [];
    } else part.push(q);
  }
  if (part.length >= 2) result.push(part);
  return result;
}
