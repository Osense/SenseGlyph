import { getStrokeOutlinePoints, getStrokePoints } from "perfect-freehand";
import { nibContours, pixelContours } from "./solid";
import type { Stroke, StrokePoint, BrushId, BrushParams } from "../types";

/** Drops input points bunched at the same spot (a pen slowing down before it
 * lifts, or a pointer-up repeating the last move). The real end position is
 * kept, so the stroke still finishes exactly where the pen left the surface. */
export function spacedPoints(points: StrokePoint[], gap: number) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const q = out[out.length - 1];
    if (Math.hypot(points[i].x - q.x, points[i].y - q.y) >= gap)
      out.push(points[i]);
  }
  const end = points[points.length - 1],
    q = out[out.length - 1];
  if (out.length > 1 && Math.hypot(end.x - q.x, end.y - q.y) < gap)
    out[out.length - 1] = { ...end, p: q.p };
  else out.push(end);
  return out;
}

/** perfect-freehand 1.2.3 rounds the end of a stroke by sweeping 3π instead of
 * π, which leaves a whole extra circle (sized by the last pressure) hanging off
 * every stroke end. We ask it for a flat end and draw the half circle here. */
function roundEnd(poly: number[][], end: number[], ahead: number[]) {
  for (let i = 0; i + 3 < poly.length; i++) {
    const [a, b, c, d] = [poly[i], poly[i + 1], poly[i + 2], poly[i + 3]];
    const vx = a[0] - end[0],
      vy = a[1] - end[1],
      r = Math.hypot(vx, vy);
    if (r < 1e-6) continue;
    const close = (p: number[], k: number) =>
      Math.abs(p[0] - (end[0] + vx * k)) < 1e-6 &&
      Math.abs(p[1] - (end[1] + vy * k)) < 1e-6;
    if (!close(b, 0.99) || !close(c, -0.99) || !close(d, -1)) continue;
    // Sweep from a to d through the side the stroke was heading towards.
    const start = Math.atan2(vy, vx),
      turn = vx * ahead[1] - vy * ahead[0] > 0 ? 1 : -1,
      arc: number[][] = [];
    for (let k = 0; k <= 16; k++) {
      const angle = start + (turn * Math.PI * k) / 16;
      arc.push([end[0] + Math.cos(angle) * r, end[1] + Math.sin(angle) * r]);
    }
    return [...poly.slice(0, i), ...arc, ...poly.slice(i + 4)];
  }
  return poly;
}

function smoothOutline(
  points: StrokePoint[],
  brush: BrushId,
  params: BrushParams,
): number[][] {
  if (!points.length) return [];
  const stationary = points.every(
    (point) => Math.hypot(point.x - points[0].x, point.y - points[0].y) < 0.5,
  );
  const size = params.size * (brush === "pencil" ? 0.5 : 1),
    tapered = brush === "brush" && !stationary;
  const options = {
    size,
    thinning:
      brush === "marker"
        ? 0
        : brush === "brush"
          ? 0.75
          : brush === "pencil"
            ? 0.2
            : 0.5,
    smoothing: brush === "marker" ? 0.6 : brush === "pencil" ? 0.3 : 0.5,
    streamline: 0.5,
    simulatePressure: !params.usePressure,
    start: { taper: tapered ? params.size : 0 },
    end: { taper: tapered ? params.size : 0, cap: tapered },
  };
  const input = stationary ? points : spacedPoints(points, size * 0.08);
  // The smoothed path trails the pen slightly. Repeating the end lets it glide
  // onto the real lift-off point instead of jumping there (which leaves a knob).
  const end = input[input.length - 1],
    settle = stationary ? [] : [end, end, end, end];
  const strokePoints = getStrokePoints(
    [...input, ...settle].map((p) => [p.x, p.y, p.p]),
    options,
  );
  const poly = getStrokeOutlinePoints(strokePoints, options);
  if (tapered || strokePoints.length < 2) return poly;
  const last = strokePoints[strokePoints.length - 1];
  return roundEnd(poly, last.point, [-last.vector[0], -last.vector[1]]);
}
export function outlines(
  points: StrokePoint[],
  brush: BrushId,
  params: BrushParams,
): number[][][] {
  if (brush === "nib") return nibContours(points, params);
  if (brush === "pixel") return pixelContours(points, params);
  const polygon = smoothOutline(points, brush, params);
  return polygon.length ? [polygon] : [];
}
// For coordinate bounds only. Rendering must retain separate contours.
export function outline(
  points: StrokePoint[],
  brush: BrushId,
  params: BrushParams,
): number[][] {
  return outlines(points, brush, params).flat();
}
export function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.beginPath();
  for (const poly of outlines(s.points, s.brush, s.params)) {
    if (!poly.length) continue;
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (const p of poly.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
  }
  ctx.fill("nonzero");
}
