// 이상 표본 감지: 같은 자모를 여러 글자에서 썼을 때, 다른 것들과 모양이 크게 다른 한 글자를 찾는다.
// 조합 엔진은 자모 자리마다 표본이 1~2개뿐이라, 한 글자를 삐끗하면 그 자모를 쓰는 글자 수십~수백 자가
// 함께 틀어진다. 그래서 '다시 써 보면 좋은 글자'로 미리 알려 준다.
//
// 비교 방법: 자모 조각의 획을 자기 상자에 맞춰 늘인 뒤(가로세로비 차이는 짜임마다 자연스러우므로 지운다)
// 점 32개로 고르게 뽑고, 두 표본 사이 평균 최근접 거리(챔퍼 거리)를 잰다.
// 같은 자모 묶음 안에서 '다른 표본들과의 거리 중앙값'이 묶음의 보통 값보다 훨씬 크면 이상 표본.
import { decompose, JAMO, vowelType } from "../hangul";
import type { GlyphSample, Stroke } from "../types";
import { separateSample } from "./composition";
import type { ReferenceSettings } from "./reference";
import type { Part, Separation } from "./types";

const POINTS = 32;
/** 이상 표본으로 볼 최소 거리(자모 상자 1 기준)와 묶음 보통 거리에 대한 배수 */
const MIN_DISTANCE = 0.13;
const FACTOR = 2.4;

type Shape = { x: number; y: number }[];

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

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 자모 글자(ㄱ·ㅏ·ㄺ …). 초성 ㄱ과 받침 ㄱ은 같은 묶음 */
function letterOf(part: Part, index: number) {
  return JAMO[part][index];
}

const shapeCache = new WeakMap<Stroke[], Shape | null>();
const cachedShape = (strokes: Stroke[]) => {
  if (!shapeCache.has(strokes)) shapeCache.set(strokes, jamoShape(strokes));
  return shapeCache.get(strokes)!;
};

/**
 * 같은 자모의 다른 표본과 모양이 크게 다른 글자: 글자 → 그 자모들(예: { 뀓: ["ㄲ"] }).
 * 같은 자모를 세 글자 이상 썼을 때만 판단한다.
 */
export function jamoOutliers(
  samples: Record<string, GlyphSample>,
  separations: Record<string, Separation> = {},
  reference?: ReferenceSettings,
): Record<string, string[]> {
  const groups = new Map<string, { char: string; shape: Shape }[]>();
  for (const sample of Object.values(samples)) {
    if (!sample.strokes.length || !decompose(sample.char)) continue;
    let parts;
    try {
      parts = separateSample(sample, separations[sample.char], reference);
    } catch {
      continue;
    }
    for (const component of parts) {
      const [part, index] = component.key.split(":");
      const letter = letterOf(part as Part, +index);
      // 초성은 세로 모음 옆(가·거)과 가로·섞인 모음 위(고·과)에서 모양이 원래 다르므로 따로 묶는다
      const kind =
        part === "cho"
          ? vowelType(decompose(sample.char)!.jung) === "V"
            ? "V"
            : "HC"
          : part;
      const shape = cachedShape(component.strokes);
      if (!letter || letter === " " || !shape) continue;
      const group = letter + ":" + kind;
      groups.set(group, [...(groups.get(group) ?? []), { char: sample.char, shape }]);
    }
  }
  const out: Record<string, string[]> = {};
  for (const [group, members] of groups) {
    const letter = group.split(":")[0];
    if (members.length < 3) continue;
    const typical = members.map((m, i) =>
      median(
        members.filter((_, j) => j !== i).map((o) => shapeDistance(m.shape, o.shape)),
      ),
    );
    const usual = median(typical);
    members.forEach((m, i) => {
      if (typical[i] > Math.max(MIN_DISTANCE, usual * FACTOR))
        out[m.char] = [...(out[m.char] ?? []), letter];
    });
  }
  return out;
}

