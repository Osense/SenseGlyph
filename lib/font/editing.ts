import type { GlyphSample, Stroke } from "../types";
import type { Box, Separation } from "./types";
import { outline, outlines } from "../brushes";

export function activeSeparation(sample: GlyphSample, separation?: Separation) {
  if (
    !separation ||
    (separation.sourceUpdatedAt !== undefined &&
      separation.sourceUpdatedAt !== sample.updatedAt)
  )
    return undefined;
  if (separation.strokes) {
    const originals = new Map(
      sample.strokes.map((stroke) => [stroke.id, stroke]),
    );
    if (
      separation.strokes.length !== originals.size ||
      new Set(separation.strokes.map((stroke) => stroke.id)).size !==
        originals.size ||
      !separation.strokes.every((stroke) => {
        const original = originals.get(stroke.id);
        return (
          original?.createdAt === stroke.createdAt &&
          original.brush === stroke.brush
        );
      })
    )
      return undefined;
  }
  return separation;
}
export function effectiveStrokes(
  sample: GlyphSample,
  separation?: Separation,
): Stroke[] {
  return activeSeparation(sample, separation)?.strokes ?? sample.strokes;
}
export function effectiveSample(
  sample: GlyphSample,
  separation?: Separation,
): GlyphSample {
  return { ...sample, strokes: effectiveStrokes(sample, separation) };
}
export function moveStrokes(
  strokes: Stroke[],
  ids: string[],
  dx: number,
  dy: number,
) {
  const set = new Set(ids);
  return strokes.map((stroke) =>
    set.has(stroke.id)
      ? {
          ...stroke,
          points: stroke.points.map((p) => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy,
          })),
        }
      : stroke,
  );
}
export function deformStroke(
  strokes: Stroke[],
  id: string,
  index: number,
  dx: number,
  dy: number,
  radius: number,
) {
  return strokes.map((stroke) => {
    if (stroke.id !== id) return stroke;
    const anchor = stroke.points[index];
    return {
      ...stroke,
      points: stroke.points.map((p, i) => {
        const distance = Math.hypot(p.x - anchor.x, p.y - anchor.y);
        const weight =
          i === index
            ? 1
            : distance >= radius
              ? 0
              : (1 - distance / radius) ** 2;
        return { ...p, x: p.x + dx * weight, y: p.y + dy * weight };
      }),
    };
  });
}
export function strokeBounds(strokes: Stroke[], ids?: string[]): Box | null {
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const stroke of strokes)
    if (!ids || ids.includes(stroke.id))
      for (const [px, py] of outline(
        stroke.points,
        stroke.brush,
        stroke.params,
      )) {
        x = Math.min(x, px);
        y = Math.min(y, py);
        right = Math.max(right, px);
        bottom = Math.max(bottom, py);
      }
  return Number.isFinite(x)
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}
function segmentHitsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Box,
) {
  let lo = 0,
    hi = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy],
    q = [
      a.x - box.x,
      box.x + box.width - a.x,
      a.y - box.y,
      box.y + box.height - a.y,
    ];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
      if (lo > hi) return false;
    }
  }
  return true;
}
export function selectStrokes(strokes: Stroke[], box: Box): string[] {
  return strokes
    .filter((stroke) => {
      const radius = stroke.params.size / 2;
      const expanded = {
        x: box.x - radius,
        y: box.y - radius,
        width: box.width + radius * 2,
        height: box.height + radius * 2,
      };
      return stroke.points.some((p, i) =>
        segmentHitsBox(stroke.points[Math.max(0, i - 1)], p, expanded),
      );
    })
    .map((stroke) => stroke.id);
}
export function dragBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export type LassoPoint = { x: number; y: number };
function onSegment(p: LassoPoint, a: LassoPoint, b: LassoPoint) {
  return (
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < 0.001 &&
    p.x >= Math.min(a.x, b.x) - 0.001 &&
    p.x <= Math.max(a.x, b.x) + 0.001 &&
    p.y >= Math.min(a.y, b.y) - 0.001 &&
    p.y <= Math.max(a.y, b.y) + 0.001
  );
}
export function pointInLasso(p: LassoPoint, polygon: LassoPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (onSegment(p, a, b)) return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function segmentsIntersect(
  a: LassoPoint,
  b: LassoPoint,
  c: LassoPoint,
  d: LassoPoint,
) {
  const cross = (p: LassoPoint, q: LassoPoint, r: LassoPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d) ||
    onSegment(c, a, b) ||
    onSegment(d, a, b)
  );
}
export function selectStrokesLasso(strokes: Stroke[], polygon: LassoPoint[]) {
  if (polygon.length < 3) return [];
  const xs = polygon.map((p) => p.x),
    ys = polygon.map((p) => p.y),
    left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  return strokes
    .filter((stroke) =>
      outlines(stroke.points, stroke.brush, stroke.params).some((contour) => {
        const ink = contour.map(([x, y]) => ({ x, y }));
        if (
          !ink.length ||
          ink.every((p) => p.x < left) ||
          ink.every((p) => p.x > right) ||
          ink.every((p) => p.y < top) ||
          ink.every((p) => p.y > bottom)
        )
          return false;
        if (
          ink.some((p) => pointInLasso(p, polygon)) ||
          polygon.some((p) => pointInLasso(p, ink))
        )
          return true;
        return ink.some((a, i) =>
          polygon.some((c, j) =>
            segmentsIntersect(
              a,
              ink[(i + 1) % ink.length],
              c,
              polygon[(j + 1) % polygon.length],
            ),
          ),
        );
      }),
    )
    .map((stroke) => stroke.id);
}
