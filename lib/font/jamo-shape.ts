// 자모 조각의 모양 비교: 같은 자모를 쓴 표본끼리 얼마나 닮았는지 잰다.
// 획을 자기 상자에 맞춰 늘인 뒤(가로세로비 차이는 짜임마다 자연스러우므로 지운다) 점 32개로 고르게 뽑고,
// 두 표본 사이 평균 최근접 거리(챔퍼 거리)를 잰다.
import { decompose, JAMO, vowelType } from "../hangul";
import type { Stroke } from "../types";
import type { ComponentSample, Part } from "./types";

const POINTS = 32;

export type Shape = { x: number; y: number }[];

/** 자모 조각을 자기 상자(0~1)에 넣고 획 길이를 따라 점 POINTS 개로 */
export function jamoShape(strokes: Stroke[]): Shape | null {
  const all = strokes.flatMap((s) => s.points);
  if (all.length < 2) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of all) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const size = Math.max(x1 - x0, y1 - y0);
  if (size < 10) return null;
  // ㅡ·ㅣ처럼 얇은 자모는 얇은 쪽을 늘이지 않는다(늘이면 떨림이 모양처럼 커진다)
  const w = Math.max(x1 - x0, size * 0.3),
    h = Math.max(y1 - y0, size * 0.3);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  const segs: { a: { x: number; y: number }; b: { x: number; y: number }; len: number }[] = [];
  let total = 0;
  for (const stroke of strokes)
    for (let i = 1; i < stroke.points.length; i++) {
      const a = {
          x: (stroke.points[i - 1].x - cx) / w + 0.5,
          y: (stroke.points[i - 1].y - cy) / h + 0.5,
        },
        b = {
          x: (stroke.points[i].x - cx) / w + 0.5,
          y: (stroke.points[i].y - cy) / h + 0.5,
        };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 0) {
        segs.push({ a, b, len });
        total += len;
      }
    }
  if (!segs.length) return null;
  const out: Shape = [];
  let k = 0,
    walked = 0;
  for (let i = 0; i < POINTS; i++) {
    const at = ((i + 0.5) / POINTS) * total;
    while (k < segs.length - 1 && walked + segs[k].len < at) walked += segs[k++].len;
    const t = Math.min(1, Math.max(0, (at - walked) / segs[k].len));
    out.push({
      x: segs[k].a.x + (segs[k].b.x - segs[k].a.x) * t,
      y: segs[k].a.y + (segs[k].b.y - segs[k].a.y) * t,
    });
  }
  return out;
}

/** 두 모양 사이 평균 최근접 거리(양쪽 평균) */
export function shapeDistance(a: Shape, b: Shape) {
  const one = (p: Shape, q: Shape) => {
    let sum = 0;
    for (const u of p) {
      let best = Infinity;
      for (const v of q) best = Math.min(best, (u.x - v.x) ** 2 + (u.y - v.y) ** 2);
      sum += Math.sqrt(best);
    }
    return sum / p.length;
  };
  return (one(a, b) + one(b, a)) / 2;
}

const shapeCache = new WeakMap<Stroke[], Shape | null>();
export const cachedShape = (strokes: Stroke[]) => {
  if (!shapeCache.has(strokes)) shapeCache.set(strokes, jamoShape(strokes));
  return shapeCache.get(strokes)!;
};

/**
 * 모양을 견줄 묶음: 같은 자모끼리. 초성은 세로 모음 옆(가·거)과 가로·섞인 모음 위(고·과)에서
 * 모양이 원래 다르므로 따로 묶는다. 초성 ㄱ과 받침 ㄱ도 따로.
 */
export function shapeGroup(component: ComponentSample): string | null {
  const [part, index] = component.key.split(":");
  const letter = JAMO[part as Part]?.[+index];
  const d = decompose(component.char);
  if (!letter || letter === " " || !d) return null;
  const kind =
    part === "cho" ? (vowelType(d.jung) === "V" ? "V" : "HC") : part;
  return letter + ":" + kind;
}
