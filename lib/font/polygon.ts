// Export-only simplification. Original centerlines remain untouched in the project.
// A sub-em tolerance removes redundant vertices without changing brush parameters.
function segmentDistanceSquared(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
}
function simplifyOpen(points: number[][], tolerance: number) {
  const keep = new Set([0, points.length - 1]),
    pending = [[0, points.length - 1]];
  while (pending.length) {
    const [first, last] = pending.pop()!;
    let distance = tolerance * tolerance,
      selected = -1;
    for (let i = first + 1; i < last; i++) {
      const value = segmentDistanceSquared(
        points[i],
        points[first],
        points[last],
      );
      if (value > distance) {
        distance = value;
        selected = i;
      }
    }
    if (selected >= 0) {
      keep.add(selected);
      pending.push([first, selected], [selected, last]);
    }
  }
  return points.filter((_, i) => keep.has(i));
}
export function simplifyContour(
  points: number[][],
  tolerance = 0.65,
): number[][] {
  if (points.length < 5) return points;
  let opposite = 1,
    distance = 0;
  for (let i = 1; i < points.length; i++) {
    const d =
      (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (d > distance) {
      opposite = i;
      distance = d;
    }
  }
  const result = [
    ...simplifyOpen(points.slice(0, opposite + 1), tolerance).slice(0, -1),
    ...simplifyOpen([...points.slice(opposite), points[0]], tolerance).slice(
      0,
      -1,
    ),
  ];
  return result.length >= 3 ? result : points;
}
