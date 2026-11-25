// 손글씨 정돈(보정). AI 없이 정해진 규칙만 사용하며, 같은 입력은 항상 같은 결과를 냅니다.
//
// 원칙
// - 강도 0이면 획을 전혀 바꾸지 않습니다(같은 객체를 돌려줌).
// - 획 수·획 순서·획 id·브러시·필압 곡선의 모양은 유지합니다. 점의 위치만 조금 옮깁니다.
// - 최대 강도에서도 이동량·회전·크기 변화에 상한을 둬서, 견본 글꼴로 바뀌지 않고
//   "내 글씨를 단정하게 쓴 모습"에 머물게 합니다.
// - 결과가 안전영역을 벗어나면 강도를 절반으로 낮춰 다시 시도하고, 그래도 안 되면 원본을 씁니다.
import { hitsStroke } from "../geometry";
import { strokesAreSafe } from "../safety";
import type { CharCategory, Stroke, StrokePoint } from "../types";
import type { Box, CorrectionDetail, FontBuildSettings, Part } from "./types";
import { CORRECTION_KEYS } from "./types";
import { vowelRoles } from "./primitives";

export type CorrectionAmounts = Record<
  (typeof CORRECTION_KEYS)[number],
  number
>;
export const NO_CORRECTION: CorrectionAmounts = {
  layout: 0,
  straighten: 0,
  smooth: 0,
  size: 0,
  weight: 0,
  balance: 0,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v / 100));

/** 하나의 강도 값을 항목별 비율로 나눕니다. 자모 배치와 기울기가 가장 큰 효과를 냅니다. */
export function detailFromStrength(strength: number): CorrectionDetail {
  const s = Math.max(0, Math.min(100, strength));
  return {
    layout: s,
    straighten: s,
    smooth: Math.round(s * 0.8),
    size: Math.round(s * 0.7),
    weight: Math.round(s * 0.5),
    balance: s,
  };
}

/** 저장된 설정 → 실제 적용 강도(0~1). 이전 버전의 켜기/끄기 보정은 30%로 읽습니다. */
export function correctionDetail(
  settings: FontBuildSettings,
): CorrectionDetail {
  if (settings.correctionDetail) return settings.correctionDetail;
  const legacy =
    settings.correction === undefined &&
    (settings.alignToReference || settings.averageStrokes)
      ? 30
      : 0;
  return detailFromStrength(settings.correction ?? legacy);
}
export function correctionAmounts(
  settings: FontBuildSettings,
): CorrectionAmounts {
  const detail = correctionDetail(settings);
  return Object.fromEntries(
    CORRECTION_KEYS.map((key) => [key, clamp01(detail[key] ?? 0)]),
  ) as CorrectionAmounts;
}
export const hasCorrection = (a: CorrectionAmounts) =>
  CORRECTION_KEYS.some((key) => a[key] > 0);

type Pt = { x: number; y: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function cumulative(points: Pt[]) {
  const out = [0];
  for (let i = 1; i < points.length; i++)
    out.push(
      out[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  return out;
}

/** 획 중심선의 꺾이는 점(모서리)을 찾습니다. 양 끝은 항상 포함합니다. */
export function strokeVertices(points: Pt[], tolerance: number): number[] {
  if (points.length < 3) return points.map((_, i) => i);
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = points[a],
      B = points[b];
    const dx = B.x - A.x,
      dy = B.y - A.y,
      len = Math.hypot(dx, dy) || 1;
    let worst = -1,
      far = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d =
        Math.abs((points[i].x - A.x) * dy - (points[i].y - A.y) * dx) / len;
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep.add(worst);
      stack.push([a, worst], [worst, b]);
    }
  }
  return [...keep].sort((a, b) => a - b);
}

/** 잔떨림 완화: 호 길이 기준 가우시안 평균. 끝점과 모서리 근처는 움직이지 않습니다. */
function smoothPoints(points: StrokePoint[], amount: number, size: number) {
  if (amount <= 0 || points.length < 4) return points;
  const sigma = 2 + amount * Math.min(14, size * 0.25);
  const lengths = cumulative(points);
  const corners = strokeVertices(points, Math.max(6, size * 0.2))
    .filter((i, k, list) => {
      if (k === 0 || k === list.length - 1) return true;
      const a = points[list[k - 1]],
        b = points[i],
        c = points[list[k + 1]];
      const turn = Math.abs(
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x),
      );
      const angle = Math.min(turn, Math.PI * 2 - turn);
      return angle > (35 * Math.PI) / 180;
    })
    .map((i) => lengths[i]);
  return points.map((p, i) => {
    const near = Math.min(...corners.map((c) => Math.abs(c - lengths[i])));
    const blend = amount * Math.min(1, near / (sigma * 2));
    if (blend <= 0) return p;
    let sx = 0,
      sy = 0,
      sw = 0;
    // 호 길이는 단조 증가하므로 3σ 창 안쪽만 양방향으로 훑습니다.
    for (const step of [-1, 1]) {
      for (
        let j = step < 0 ? i : i + 1;
        j >= 0 && j < points.length;
        j += step
      ) {
        const d = lengths[j] - lengths[i];
        if (Math.abs(d) > sigma * 3) break;
        const w = Math.exp(-(d * d) / (2 * sigma * sigma));
        sx += points[j].x * w;
        sy += points[j].y * w;
        sw += w;
      }
    }
    return { ...p, x: mix(p.x, sx / sw, blend), y: mix(p.y, sy / sw, blend) };
  });
}

const STRAIGHTEN_LIMIT = (14 * Math.PI) / 180;

/** 이 사람이 긋는 가로획·세로획의 평소 기울기(라디안, y 아래가 +). */
export interface Slant {
  horizontal: number;
  vertical: number;
}
const DEG = Math.PI / 180;
/**
 * 손글씨 전체에서 거의 가로·세로인 곧은 조각의 기울기 중앙값을 구한다.
 * 한글 손글씨의 가로획은 보통 오른쪽이 살짝 올라가므로 0~7도 오름, 세로획은 ±4도로 묶는다.
 */
export function writerSlant(strokes: Stroke[]): Slant {
  const hs: number[] = [],
    vs: number[] = [];
  for (const stroke of strokes) {
    const points = stroke.points;
    if (points.length < 2) continue;
    const vertices = strokeVertices(
      points,
      Math.max(8, stroke.params.size * 0.3),
    );
    for (let k = 0; k < vertices.length - 1; k++) {
      const a = points[vertices[k]],
        b = points[vertices[k + 1]];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      if (Math.hypot(dx, dy) < 80) continue;
      const angle = Math.atan2(dy, dx);
      if (Math.abs(Math.sin(angle)) < Math.sin(STRAIGHTEN_LIMIT))
        hs.push(Math.atan2(dy, Math.abs(dx)) * Math.sign(dx || 1));
      else if (Math.abs(Math.cos(angle)) < Math.sin(STRAIGHTEN_LIMIT))
        vs.push(Math.atan2(dx, Math.abs(dy)) * Math.sign(dy || 1));
    }
  }
  const mid = (v: number[]) => (v.length >= 5 ? median(v) : 0);
  return {
    horizontal: Math.max(-7 * DEG, Math.min(0, mid(hs))),
    vertical: Math.max(-4 * DEG, Math.min(4 * DEG, mid(vs))),
  };
}

/** 기울기 정돈: 거의 가로·세로인 곧은 구간만 수평·수직 쪽으로 세웁니다.
 * 꺾이는 점(모서리)을 옮기고 그 사이 점은 호 길이에 따라 함께 따라오게 하므로
 * 획이 끊기거나 꺾임이 사라지지 않습니다. 다른 획에 닿아 있는 끝점은 거의 고정합니다. */
function straightenPoints(
  points: StrokePoint[],
  amount: number,
  size: number,
  anchored: (p: Pt) => boolean,
  slant: Slant = { horizontal: 0, vertical: 0 },
) {
  if (amount <= 0 || points.length < 2) return points;
  const vertices = strokeVertices(points, Math.max(8, size * 0.3));
  const shift = vertices.map(() => ({ x: 0, y: 0, nx: 0, ny: 0 }));
  const weightOf = (k: number) => {
    const end = k === 0 || k === vertices.length - 1;
    return end && anchored(points[vertices[k]]) ? 4 : 1;
  };
  for (let k = 0; k < vertices.length - 1; k++) {
    const a = points[vertices[k]],
      b = points[vertices[k + 1]];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy);
    if (len < Math.max(40, size * 0.8)) continue;
    // 곡선(ㅇ, ㅅ의 삐침 등)은 건드리지 않습니다.
    let bend = 0;
    for (let i = vertices[k] + 1; i < vertices[k + 1]; i++)
      bend = Math.max(
        bend,
        Math.abs((points[i].x - a.x) * dy - (points[i].y - a.y) * dx) / len,
      );
    if (bend > len * 0.12) continue;
    const angle = Math.atan2(dy, dx);
    const fromHorizontal = Math.abs(Math.sin(angle)),
      fromVertical = Math.abs(Math.cos(angle));
    const wa = weightOf(k),
      wb = weightOf(k + 1);
    if (Math.asin(fromHorizontal) <= STRAIGHTEN_LIMIT) {
      // 가로획은 완전한 수평이 아니라 '이 사람이 평소 긋는 기울기'(살짝 오른쪽 위)로 맞춘다.
      const mid = (a.y * wa + b.y * wb) / (wa + wb);
      const rise = Math.tan(slant.horizontal) * (b.x - a.x);
      const share = wa / (wa + wb);
      shift[k].y += (mid - rise * (1 - share) - a.y) * amount;
      shift[k + 1].y += (mid + rise * share - b.y) * amount;
      shift[k].ny++;
      shift[k + 1].ny++;
    } else if (Math.asin(fromVertical) <= STRAIGHTEN_LIMIT) {
      const mid = (a.x * wa + b.x * wb) / (wa + wb);
      const lean = Math.tan(slant.vertical) * (b.y - a.y);
      const share = wa / (wa + wb);
      shift[k].x += (mid - lean * (1 - share) - a.x) * amount;
      shift[k + 1].x += (mid + lean * share - b.x) * amount;
      shift[k].nx++;
      shift[k + 1].nx++;
    }
  }
  const limit = Math.max(12, size * 0.6);
  const moves = shift.map((s) => ({
    x: Math.max(-limit, Math.min(limit, s.nx ? s.x / s.nx : 0)),
    y: Math.max(-limit, Math.min(limit, s.ny ? s.y / s.ny : 0)),
  }));
  if (moves.every((m) => !m.x && !m.y)) return points;
  const lengths = cumulative(points);
  return points.map((p, i) => {
    let k = 0;
    while (k < vertices.length - 2 && vertices[k + 1] < i) k++;
    const i0 = vertices[k],
      i1 = vertices[Math.min(k + 1, vertices.length - 1)];
    const span = lengths[i1] - lengths[i0];
    const t = span > 0 ? (lengths[i] - lengths[i0]) / span : 0;
    const m0 = moves[k],
      m1 = moves[Math.min(k + 1, moves.length - 1)];
    return { ...p, x: p.x + mix(m0.x, m1.x, t), y: p.y + mix(m0.y, m1.y, t) };
  });
}

function median(values: number[]) {
  if (!values.length) return NaN;
  const v = [...values].sort((a, b) => a - b),
    m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export function medianPressure(strokes: Stroke[]) {
  return median(
    strokes
      .filter((s) => s.params.usePressure)
      .flatMap((s) => s.points.map((p) => p.p)),
  );
}

/** 굵기 고르게: 획마다 필압의 중앙값을 전체 중앙값 쪽으로 옮깁니다. 획 안의 강약은 유지합니다. */
function evenPressure(stroke: Stroke, amount: number, target: number) {
  if (amount <= 0 || !stroke.params.usePressure || !Number.isFinite(target))
    return stroke.points;
  const own = median(stroke.points.map((p) => p.p));
  const delta = (target - own) * amount * 0.8;
  if (!delta) return stroke.points;
  return stroke.points.map((p) => ({
    ...p,
    p: Math.max(0.05, Math.min(1, p.p + delta)),
  }));
}

function centerBounds(strokes: Stroke[]) {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity,
    size = 0;
  for (const s of strokes) {
    size = Math.max(size, s.params.size);
    for (const p of s.points) {
      left = Math.min(left, p.x);
      top = Math.min(top, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    }
  }
  // 견본 상자는 잉크 범위이므로 펜 굵기의 절반만큼 넓혀 비교합니다.
  const pad = size / 2;
  return Number.isFinite(left)
    ? {
        x: left - pad,
        y: top - pad,
        width: right - left + size,
        height: bottom - top + size,
      }
    : null;
}
const union = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((b) => b.x)),
    top = Math.min(...boxes.map((b) => b.y)),
    right = Math.max(...boxes.map((b) => b.x + b.width)),
    bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * 내 글씨의 평소 자모 배치: 같은 짜임(세로·가로·섞임 모음 × 받침 유무)으로 쓴 글자들에서
 * 자모마다 글자 범위에 대한 위치·크기(0~1)의 중앙값. 글자마다 들쭉날쭉한 배치를
 * 견본 글꼴이 아니라 '내가 평소 쓰는 배치'로 당기기 위해 쓴다.
 */
export type OwnLayouts = Map<string, Partial<Record<Part, Box>>>;
export function ownLayouts(
  written: { layout: string; parts: { part: Part; strokes: Stroke[] }[] }[],
): OwnLayouts {
  const groups = new Map<string, Map<Part, Box[]>>();
  for (const { layout, parts } of written) {
    const boxes = parts
      .map((p) => ({ part: p.part, box: centerBounds(p.strokes) }))
      .filter((p): p is { part: Part; box: Box } => !!p.box);
    const frame = union(boxes.map((p) => p.box));
    if (!frame || frame.width < 40 || frame.height < 40 || boxes.length < 2)
      continue;
    const group = groups.get(layout) ?? new Map<Part, Box[]>();
    for (const { part, box } of boxes)
      group.set(part, [
        ...(group.get(part) ?? []),
        {
          x: (box.x - frame.x) / frame.width,
          y: (box.y - frame.y) / frame.height,
          width: box.width / frame.width,
          height: box.height / frame.height,
        },
      ]);
    groups.set(layout, group);
  }
  const out: OwnLayouts = new Map();
  for (const [layout, group] of groups) {
    const boxes: Partial<Record<Part, Box>> = {};
    for (const [part, list] of group) {
      // 세 글자 이상 써야 '평소 배치'로 본다
      if (list.length < 3) continue;
      boxes[part] = {
        x: median(list.map((b) => b.x)),
        y: median(list.map((b) => b.y)),
        width: median(list.map((b) => b.width)),
        height: median(list.map((b) => b.height)),
      };
    }
    if (Object.keys(boxes).length >= 2) out.set(layout, boxes);
  }
  return out;
}

/** 자모 배치: 목표 자모 상자(내 평소 배치, 없으면 견본 글꼴)를 내 글자 크기에 맞춘 뒤, 각 자모의 위치·비율을 그쪽으로 당깁니다. */
function arrangeParts(
  strokes: Stroke[],
  amount: number,
  partOf: Map<string, Part>,
  boxes: Partial<Record<Part, Box>>,
) {
  if (amount <= 0) return strokes;
  const groups = new Map<Part, Stroke[]>();
  for (const s of strokes) {
    const part = partOf.get(s.id);
    if (part && boxes[part]) groups.set(part, [...(groups.get(part) ?? []), s]);
  }
  if (groups.size < 2) return strokes;
  const mine = union(
    [...groups.values()].map((g) => centerBounds(g)!).filter(Boolean),
  );
  const theirs = union([...groups.keys()].map((part) => boxes[part]!));
  if (!mine || !theirs) return strokes;
  // 견본을 내 글자 전체 크기에 맞춥니다: 전체 크기는 바꾸지 않고 자모 사이의 비례만 닮게 합니다.
  const sx = mine.width / theirs.width,
    sy = mine.height / theirs.height;
  const fit = (b: Box): Box => ({
    x: mine.x + (b.x - theirs.x) * sx,
    y: mine.y + (b.y - theirs.y) * sy,
    width: b.width * sx,
    height: b.height * sy,
  });
  const transform = new Map<string, (p: StrokePoint) => StrokePoint>();
  for (const [part, group] of groups) {
    const from = centerBounds(group)!,
      to = fit(boxes[part]!);
    const fx = from.x + from.width / 2,
      fy = from.y + from.height / 2;
    const reach = amount * 0.7;
    const maxMove = 60 * amount;
    const dx = Math.max(
      -maxMove,
      Math.min(maxMove, (to.x + to.width / 2 - fx) * reach),
    );
    const dy = Math.max(
      -maxMove,
      Math.min(maxMove, (to.y + to.height / 2 - fy) * reach),
    );
    const ratio = (target: number, own: number) =>
      mix(
        1,
        Math.max(0.8, Math.min(1.25, target / Math.max(1, own))),
        amount * 0.6,
      );
    // 가늘고 긴 자모(ㅡ, ㅣ)는 짧은 쪽 비율을 바꾸지 않습니다.
    const kx =
      from.width < from.height * 0.35 ? 1 : ratio(to.width, from.width);
    const ky =
      from.height < from.width * 0.35 ? 1 : ratio(to.height, from.height);
    const move = (p: StrokePoint) => ({
      ...p,
      x: fx + dx + (p.x - fx) * kx,
      y: fy + dy + (p.y - fy) * ky,
    });
    for (const s of group) transform.set(s.id, move);
  }
  return strokes.map((s) => {
    const move = transform.get(s.id);
    return move ? { ...s, points: s.points.map(move) } : s;
  });
}

export interface BeautifyOptions {
  amounts: CorrectionAmounts;
  category: CharCategory;
  /** 한글 음절: 획 id → 초·중·종성 */
  partOf?: Map<string, Part>;
  /** 한글 음절: 견본 글꼴의 자모 상자 */
  boxes?: Partial<Record<Part, Box>>;
  /** 전체 손글씨의 필압 중앙값 */
  pressureTarget?: number;
  /** 이 사람이 긋는 가로·세로획의 평소 기울기 */
  slant?: Slant;
  /** 한글 음절: 이 글자의 모음 짜임과 받침 유무(모음 획 맞추기) */
  vowel?: { type: "V" | "H" | "C"; jong: boolean };
  /** 모음 기둥 길이·보 너비의 평소 값(같은 짜임끼리) */
  norms?: VowelNorms;
}

function apply(strokes: Stroke[], options: BeautifyOptions, scale: number) {
  const a = options.amounts;
  const k = (v: number) => v * scale;
  let result = strokes.map((stroke, index) => {
    const others = strokes.filter((_, i) => i !== index);
    const anchored = (p: Pt) =>
      others.some((o) =>
        hitsStroke(p, o.points, stroke.params.size * 0.6, o.params.size),
      );
    let points = smoothPoints(stroke.points, k(a.smooth), stroke.params.size);
    points = straightenPoints(
      points,
      k(a.straighten),
      stroke.params.size,
      anchored,
      options.slant,
    );
    const moved = { ...stroke, points };
    return {
      ...moved,
      points: evenPressure(moved, k(a.weight), options.pressureTarget ?? NaN),
    };
  });
  if (options.partOf && options.vowel && options.category === "hangul-syllable")
    result = harmonizeVowel(
      result,
      k(a.layout),
      options.partOf,
      options.vowel,
      options.norms,
    );
  if (options.partOf && options.boxes && options.category === "hangul-syllable")
    result = arrangeParts(result, k(a.layout), options.partOf, options.boxes);
  return result;
}

/** 한 글자의 획을 정돈합니다. 강도가 모두 0이면 입력 배열을 그대로 돌려줍니다. */
export function beautifyStrokes(
  strokes: Stroke[],
  options: BeautifyOptions,
): Stroke[] {
  if (!strokes.length || !hasCorrection(options.amounts)) return strokes;
  for (const scale of [1, 0.5]) {
    const result = apply(strokes, options, scale);
    if (strokesAreSafe(result, options.category)) return result;
  }
  return strokes;
}

/* ---------- 모음 획 맞추기 ---------- */
/** 같은 짜임 모음의 기둥 높이·보 너비의 평소 값. 키: "V:true" (짜임:받침) */
export type VowelNorms = Map<string, { pillar?: number; beam?: number }>;

function extent(stroke: Stroke) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of stroke.points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** 모든 글자의 모음에서 기둥 높이·보 너비의 중앙값을 짜임별로 구한다. */
export function vowelNorms(
  samples: { vowel: { type: string; jong: boolean }; jung: Stroke[] }[],
): VowelNorms {
  const pillars = new Map<string, number[]>(),
    beams = new Map<string, number[]>();
  for (const { vowel, jung } of samples) {
    const key = vowel.type + ":" + vowel.jong;
    const roles = vowelRoles(jung);
    for (const stroke of jung) {
      const role = roles.get(stroke.id);
      if (role === "pillar")
        pillars.set(key, [...(pillars.get(key) ?? []), extent(stroke).h]);
      if (role === "beam")
        beams.set(key, [...(beams.get(key) ?? []), extent(stroke).w]);
    }
  }
  const norms: VowelNorms = new Map();
  for (const key of new Set([...pillars.keys(), ...beams.keys()])) {
    const p = pillars.get(key) ?? [],
      b = beams.get(key) ?? [];
    norms.set(key, {
      ...(p.length >= 3 ? { pillar: median(p) } : {}),
      ...(b.length >= 3 ? { beam: median(b) } : {}),
    });
  }
  return norms;
}

/** 획 하나를 한쪽 끝을 고정하고 한 방향으로 늘이거나 줄인다. */
function stretch(
  stroke: Stroke,
  axis: "x" | "y",
  fixed: number,
  factor: number,
): Stroke {
  if (Math.abs(factor - 1) < 0.005) return stroke;
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      [axis]: fixed + (p[axis] - fixed) * factor,
    })),
  };
}

/**
 * 모음 정돈(획의 역할을 알고 하는 보정)
 * - 짝 맞추기: ㅑ·ㅕ의 두 곁줄기 길이, ㅛ·ㅠ의 두 짧은 기둥 길이, ㅐ·ㅔ의 두 기둥 높이를 서로 맞춘다.
 * - 글자 사이 일관성: 같은 짜임 모음의 기둥 높이·보 너비를 내 글씨의 평소 값 쪽으로 당긴다.
 * 곁줄기는 기둥(또는 보)에 붙은 끝을 고정하고 늘이므로 모음이 떨어지지 않는다.
 */
function harmonizeVowel(
  strokes: Stroke[],
  amount: number,
  partOf: Map<string, Part>,
  vowel: { type: "V" | "H" | "C"; jong: boolean },
  norms?: VowelNorms,
): Stroke[] {
  if (amount <= 0) return strokes;
  const jung = strokes.filter((s) => partOf.get(s.id) === "jung");
  if (jung.length < 2) return strokes;
  const roles = vowelRoles(jung);
  const pillars = jung.filter((s) => roles.get(s.id) === "pillar");
  const beams = jung.filter((s) => roles.get(s.id) === "beam");
  const branches = jung.filter((s) => roles.get(s.id) === "branch");
  const changed = new Map<string, Stroke>();
  const current = (s: Stroke) => changed.get(s.id) ?? s;
  const reach = amount * 0.6;
  const limit = (f: number) => Math.max(0.85, Math.min(1.18, f));

  // 1) 기둥 높이: 평소 값 쪽으로(위 끝 고정), 기둥이 둘이면 서로도 맞춘다.
  const norm = norms?.get(vowel.type + ":" + vowel.jong);
  if (pillars.length) {
    const heights = pillars.map((s) => extent(s).h);
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    const target = norm?.pillar ? mean + (norm.pillar - mean) * 0.5 : mean;
    pillars.forEach((s, i) => {
      if (heights[i] < 40) return;
      const f = limit(1 + (target / heights[i] - 1) * reach);
      changed.set(s.id, stretch(s, "y", extent(s).minY, f));
    });
  }
  if (beams.length && norm?.beam) {
    beams.forEach((s) => {
      const e = extent(s);
      if (e.w < 60) return;
      const f = limit(1 + ((norm.beam! * 0.5 + e.w * 0.5) / e.w - 1) * reach);
      changed.set(s.id, stretch(s, "x", (e.minX + e.maxX) / 2, f));
    });
  }

  // 2) 곁줄기 짝 맞추기: 같은 방향 곁줄기가 둘 이상이면 길이를 평균으로(붙은 끝 고정).
  const main = [...pillars, ...beams].map(current);
  const anchorOf = (s: Stroke, axis: "x" | "y") => {
    const e = extent(s);
    if (!main.length) return axis === "x" ? e.minX : e.minY;
    const near = (v: number) =>
      Math.min(
        ...main.map((m) => {
          const me = extent(m);
          return axis === "x"
            ? Math.min(
                Math.abs(v - me.minX),
                Math.abs(v - me.maxX),
                Math.abs(v - (me.minX + me.maxX) / 2),
              )
            : Math.min(
                Math.abs(v - me.minY),
                Math.abs(v - me.maxY),
                Math.abs(v - (me.minY + me.maxY) / 2),
              );
        }),
      );
    const lo = axis === "x" ? e.minX : e.minY,
      hi = axis === "x" ? e.maxX : e.maxY;
    return near(lo) <= near(hi) ? lo : hi;
  };
  const horizontal = branches.filter((s) => extent(s).w > extent(s).h * 1.5);
  const vertical = branches.filter((s) => extent(s).h > extent(s).w * 1.5);
  for (const [group, axis] of [
    [horizontal, "x"],
    [vertical, "y"],
  ] as const) {
    if (group.length < 2) continue;
    const sizes = group.map((s) => (axis === "x" ? extent(s).w : extent(s).h));
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    group.forEach((s, i) => {
      if (sizes[i] < 20) return;
      const f = limit(1 + (mean / sizes[i] - 1) * reach);
      changed.set(s.id, stretch(current(s), axis, anchorOf(s, axis), f));
    });
  }
  if (!changed.size) return strokes;
  return strokes.map((s) => changed.get(s.id) ?? s);
}
