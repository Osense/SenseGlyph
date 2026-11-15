// 필체 규칙 추론: 직접 쓴 몇 글자와 견본 글꼴의 같은 글자를 비교해
// "이 사람은 획이 얼마나 굵고, 가로획이 얼마나 오르고, 글자를 얼마나 납작/홀쭉하게 쓰는지"를 찾는다.
// 쓰지 않은 가나·한자는 견본 모양에 이 규칙을 입혀 채운다. AI 없이 측정값만 쓴다.
import type { Stroke } from "../types";
import { writerSlant } from "./beautify";

/** 고리(외곽선) 목록. 좌표는 폰트 단위, y 위로 + */
export type Rings = number[][][];

export interface InferredStyle {
  /** 획 굵기 배율(견본 대비) */
  weight: number;
  /** 가로 폭 배율 */
  width: number;
  /** 세로 높이 배율 */
  height: number;
  /** 글자 중심의 세로 이동(폰트 단위, 위로 +) */
  shiftY: number;
  /** 가로획이 오른쪽으로 오르는 각(도) */
  rise: number;
  /** 세로획이 기우는 각(도, 아래쪽이 오른쪽이면 +) */
  lean: number;
  /** 비교에 쓴 글자 수 */
  samples: number;
}

export const NEUTRAL_STYLE: InferredStyle = {
  weight: 1,
  width: 1,
  height: 1,
  shiftY: 0,
  rise: 0,
  lean: 0,
  samples: 0,
};

function area(ring: number[][]) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i],
      [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
function perimeter(ring: number[][]) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i],
      [x2, y2] = ring[(i + 1) % ring.length];
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}
function bounds(rings: Rings) {
  let l = Infinity,
    b = Infinity,
    r = -Infinity,
    t = -Infinity;
  for (const ring of rings)
    for (const [x, y] of ring) {
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < b) b = y;
      if (y > t) t = y;
    }
  return Number.isFinite(l)
    ? { l, b, r, t, w: r - l, h: t - b, cx: (l + r) / 2, cy: (b + t) / 2 }
    : null;
}
/** 평균 획 굵기 ≈ 2 × 잉크 넓이 ÷ 테두리 길이 (가늘고 긴 띠의 너비) */
export function strokeWidthOf(rings: Rings) {
  const ink = Math.abs(rings.reduce((s, ring) => s + area(ring), 0));
  const edge = rings.reduce((s, ring) => s + perimeter(ring), 0);
  return edge > 0 ? (2 * ink) / edge : 0;
}
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b),
    m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * 쓴 글자(mine)와 견본의 같은 글자(reference)를 짝지어 규칙을 찾는다.
 * 짝이 3개보다 적으면 확실하지 않으므로 견본 그대로(중립)를 돌려준다.
 */
export function inferStyle(
  pairs: { mine: Rings; reference: Rings }[],
  strokes: Stroke[] = [],
): InferredStyle {
  const weights: number[] = [],
    widths: number[] = [],
    heights: number[] = [],
    shifts: number[] = [];
  for (const { mine, reference } of pairs) {
    const a = bounds(mine),
      b = bounds(reference);
    if (!a || !b || b.w < 40 || b.h < 40) continue;
    const wm = strokeWidthOf(mine),
      wr = strokeWidthOf(reference);
    if (wm > 0 && wr > 0) weights.push(wm / wr);
    // 아주 가는 글자(一, ー)는 폭·높이 비교에서 뺀다.
    if (b.w > 200 && a.w > 0) widths.push(a.w / b.w);
    if (b.h > 200 && a.h > 0) heights.push(a.h / b.h);
    shifts.push(a.cy - b.cy);
  }
  if (weights.length < 3) return { ...NEUTRAL_STYLE, samples: weights.length };
  const slant = writerSlant(strokes);
  return {
    weight: clamp(median(weights), 0.5, 2.2),
    width: widths.length >= 3 ? clamp(median(widths), 0.8, 1.2) : 1,
    height: heights.length >= 3 ? clamp(median(heights), 0.8, 1.2) : 1,
    shiftY: clamp(median(shifts), -60, 60),
    rise: (-slant.horizontal * 180) / Math.PI,
    lean: (slant.vertical * 180) / Math.PI,
    samples: weights.length,
  };
}

/** 규칙이 견본과 눈에 띄게 다른가(아니면 견본 곡선을 그대로 둔다) */
export function isNoticeable(style: InferredStyle) {
  return (
    style.samples >= 3 &&
    (Math.abs(style.weight - 1) > 0.06 ||
      Math.abs(style.width - 1) > 0.03 ||
      Math.abs(style.height - 1) > 0.03 ||
      Math.abs(style.shiftY) > 8 ||
      Math.abs(style.rise) > 0.8 ||
      Math.abs(style.lean) > 0.8)
  );
}

/**
 * 견본 글자 외곽선에 규칙을 입힌다.
 * 1) 글자 중심 기준 폭·높이 배율, 2) 가로획 오름·세로획 기울기(전단), 3) 세로 이동,
 * 4) 획 굵기: 잉크 바깥쪽으로 테두리를 밀거나 당긴다.
 */
export function applyStyle(
  rings: Rings,
  style: InferredStyle,
  center: { x: number; y: number },
): Rings {
  if (!rings.length) return rings;
  const rise = Math.tan((style.rise * Math.PI) / 180),
    lean = Math.tan((style.lean * Math.PI) / 180);
  let out = rings.map((ring) =>
    ring.map(([x, y]) => {
      const dx = (x - center.x) * style.width,
        dy = (y - center.y) * style.height;
      return [
        center.x + dx - dy * lean,
        center.y + dy + dx * rise + style.shiftY,
      ];
    }),
  );
  if (Math.abs(style.weight - 1) > 0.04) {
    const base = strokeWidthOf(out);
    const delta = clamp(((style.weight - 1) * base) / 2, -base * 0.4, 60);
    out = offsetRings(out, delta);
  }
  return out;
}

/** 테두리를 잉크 바깥쪽으로 delta 만큼 민다(음수면 안쪽으로). 점마다 양옆 변의 법선을 평균한다. */
export function offsetRings(rings: Rings, delta: number): Rings {
  if (!delta || !rings.length) return rings;
  // 가장 큰 고리가 바깥 윤곽: 그 방향으로 잉크가 어느 쪽에 있는지 정한다.
  let biggest = rings[0];
  for (const ring of rings)
    if (Math.abs(area(ring)) > Math.abs(area(biggest))) biggest = ring;
  const inkLeft = area(biggest) > 0;
  return rings.map((ring) => {
    const n = ring.length;
    if (n < 3) return ring;
    const normals = ring.map((p, i) => {
      const q = ring[(i + 1) % n];
      const dx = q[0] - p[0],
        dy = q[1] - p[1],
        len = Math.hypot(dx, dy) || 1;
      // 잉크 반대쪽(바깥) 법선
      return inkLeft ? [dy / len, -dx / len] : [-dy / len, dx / len];
    });
    return ring.map(([x, y], i) => {
      const a = normals[(i - 1 + n) % n],
        b = normals[i];
      let nx = a[0] + b[0],
        ny = a[1] + b[1];
      const len = Math.hypot(nx, ny);
      if (len < 1e-6) return [x, y];
      nx /= len;
      ny /= len;
      // 모서리에서 너무 멀리 튀지 않게(최대 2배)
      const cos = Math.max(0.5, nx * b[0] + ny * b[1]);
      const d = delta / cos;
      return [x + nx * d, y + ny * d];
    });
  });
}

/** 곡선을 짧은 직선으로 펴서 고리 목록으로(opentype 경로 명령) */
export function flattenPath(
  commands: {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }[],
  steps = 6,
): Rings {
  const rings: Rings = [];
  let ring: number[][] = [];
  let px = 0,
    py = 0;
  const close = () => {
    if (ring.length >= 3) rings.push(ring);
    ring = [];
  };
  for (const c of commands) {
    if (c.type === "M") {
      close();
      px = c.x!;
      py = c.y!;
      ring.push([px, py]);
    } else if (c.type === "L") {
      px = c.x!;
      py = c.y!;
      ring.push([px, py]);
    } else if (c.type === "Q") {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        ring.push([
          u * u * px + 2 * u * t * c.x1! + t * t * c.x!,
          u * u * py + 2 * u * t * c.y1! + t * t * c.y!,
        ]);
      }
      px = c.x!;
      py = c.y!;
    } else if (c.type === "C") {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        ring.push([
          u * u * u * px +
            3 * u * u * t * c.x1! +
            3 * u * t * t * c.x2! +
            t * t * t * c.x!,
          u * u * u * py +
            3 * u * u * t * c.y1! +
            3 * u * t * t * c.y2! +
            t * t * t * c.y!,
        ]);
      }
      px = c.x!;
      py = c.y!;
    } else if (c.type === "Z") close();
  }
  close();
  // 마지막 점이 첫 점과 같으면 뺀다
  return rings.map((r) => {
    const [a, b] = [r[0], r[r.length - 1]];
    return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01
      ? r.slice(0, -1)
      : r;
  });
}
