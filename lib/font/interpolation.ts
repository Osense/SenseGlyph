import type { Stroke } from "../types";
import type { ComponentSample, FontBuildSettings } from "./types";

export const correction = (s: FontBuildSettings) => s.positionCorrection ?? 35;
export const interpolation = (s: FontBuildSettings) =>
  s.shapeInterpolation ?? 25;
type Point = { x: number; y: number };
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b),
    i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function geometry(c: ComponentSample) {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const stroke of c.strokes)
    for (const p of stroke.points) {
      const x = (p.x - c.box.x) / c.box.width;
      const y = (p.y - c.box.y) / c.box.height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    w: Math.max(right - left, 0.02),
    h: Math.max(bottom - top, 0.02),
  };
}
function arc(points: Point[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  const total = lengths[lengths.length - 1];
  return lengths.map((n) => (total > 0 ? n / total : 0));
}
function at(points: Point[], lengths: number[], t: number): Point {
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < t) i++;
  if (points.length === 1) return points[0];
  const a = points[i - 1],
    b = points[i];
  const f = Math.max(
    0,
    Math.min(1, (t - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)),
  );
  return { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f) };
}
function describe(c: ComponentSample) {
  const g = geometry(c);
  const curves = c.strokes.map((s) => {
    const points = s.points.map((p) => ({
      x: ((p.x - c.box.x) / c.box.width - g.x) / g.w,
      y: ((p.y - c.box.y) / c.box.height - g.y) / g.h,
    }));
    const lengths = arc(points);
    return Array.from({ length: 33 }, (_, i) => at(points, lengths, i / 32));
  });
  return { component: c, g, curves };
}
type Description = ReturnType<typeof describe>;
function compatible(a: Description, b: Description) {
  // Correspondence is deliberately conservative: never average different stroke
  // counts, orders, brushes, pen directions or closed-loop starting points.
  return (
    a.component.strokes.length === b.component.strokes.length &&
    a.component.strokes.every((s, i) => {
      const other = b.component.strokes[i];
      return (
        s.brush === other.brush &&
        s.params.usePressure === other.params.usePressure &&
        s.params.nibAngle === other.params.nibAngle
      );
    })
  );
}
function distance(a: Description, b: Description) {
  if (!compatible(a, b)) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.curves.length; i++)
    for (let j = 0; j < 33; j++)
      sum += Math.hypot(
        a.curves[i][j].x - b.curves[i][j].x,
        a.curves[i][j].y - b.curves[i][j].y,
      );
  return sum / (a.curves.length * 33);
}

/** One pool per exact contextual slot. No cross-role or cross-layout borrowing. */
export function refinePool(
  pool: ComponentSample[],
  settings: FontBuildSettings,
) {
  const entries = pool.map(describe);
  // Largest compatible shape cluster, then its medoid. An early outlier must
  // not become the prototype just because it appeared first in the worksheet.
  const ranked = entries
    .map((entry) => {
      const neighbours = entries.filter((e) => distance(entry, e) <= 0.12);
      return {
        entry,
        neighbours,
        cost:
          neighbours.reduce((s, e) => s + distance(entry, e), 0) /
          neighbours.length,
      };
    })
    .sort(
      (a, b) =>
        b.neighbours.length - a.neighbours.length ||
        a.cost - b.cost ||
        a.entry.component.char.localeCompare(b.entry.component.char),
    );
  const prototype = ranked[0].entry;
  const position = correction(settings) / 100,
    shape = interpolation(settings) / 100;
  const target = {
    x: median(entries.map((e) => e.g.x)),
    y: median(entries.map((e) => e.g.y)),
    w: median(entries.map((e) => e.g.w)),
    h: median(entries.map((e) => e.g.h)),
  };
  const refine = (source: ComponentSample): ComponentSample => {
    if (!position && !shape) return source;
    const d = describe(source);
    const peers = entries.filter(
      (e) => e.component !== source && distance(d, e) <= 0.12,
    );
    if (!position && (!shape || !peers.length)) return source;
    const g = {
      x: mix(
        d.g.x,
        Math.max(d.g.x - 0.12, Math.min(d.g.x + 0.12, target.x)),
        position,
      ),
      y: mix(
        d.g.y,
        Math.max(d.g.y - 0.12, Math.min(d.g.y + 0.12, target.y)),
        position,
      ),
      // Limit size correction to 15% so an unusual genuine style survives.
      w: mix(
        d.g.w,
        Math.max(d.g.w * 0.85, Math.min(d.g.w * 1.15, target.w)),
        position,
      ),
      h: mix(
        d.g.h,
        Math.max(d.g.h * 0.85, Math.min(d.g.h * 1.15, target.h)),
        position,
      ),
    };
    const strokes: Stroke[] = source.strokes.map((stroke, i) => {
      const lengths = arc(
        stroke.points.map((p) => ({
          x: (p.x - source.box.x) / source.box.width / d.g.w,
          y: (p.y - source.box.y) / source.box.height / d.g.h,
        })),
      );
      return {
        ...stroke,
        points: stroke.points.map((p, j) => {
          let x = ((p.x - source.box.x) / source.box.width - d.g.x) / d.g.w;
          let y = ((p.y - source.box.y) / source.box.height - d.g.y) / d.g.h;
          if (peers.length && shape) {
            const samples = peers.map((e) =>
              at(
                e.curves[i],
                Array.from({ length: 33 }, (_, k) => k / 32),
                lengths[j],
              ),
            );
            x = mix(x, median(samples.map((s) => s.x)), shape);
            y = mix(y, median(samples.map((s) => s.y)), shape);
          }
          return {
            ...p,
            x: source.box.x + (g.x + x * g.w) * source.box.width,
            y: source.box.y + (g.y + y * g.h) * source.box.height,
          };
        }),
      };
    });
    return { ...source, strokes };
  };
  return { representative: refine(prototype.component), refine };
}
