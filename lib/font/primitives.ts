// 획 기본형(글씨 쓰기 교육의 기본 획)과 자모 문법.
//
// 한 획을 꺾이는 곳에서 나눈 뒤, 조각마다 방향으로 기본형을 붙입니다.
//   H 가로(→)  V 세로(↓)  L 왼삐침(↙)  R 오른삐침(↘)  D 점(짧은 획)  O 동그라미(닫힌 고리)
// 꺾임(ㄱ, ㄴ처럼 한 번에 이어 쓴 획)은 'HV', 'VH'처럼 두 기본형이 이어진 한 획이 됩니다.
//
// 자모마다 바른 획순의 기본형 줄(문법)이 있습니다. 강 = ㄱ(HV) + ㅏ(V H) + ㅇ(O).
// 쓴 획들의 기본형 줄과 자모 문법이 얼마나 다른지(편집 거리)를 재서 판정·보간·정돈에 씁니다.
// AI 모델 없이 정해진 규칙만 씁니다.
import { decompose } from "../hangul";
import type { Stroke } from "../types";
import { strokeVertices } from "./beautify";

export type Prim = "H" | "V" | "L" | "R" | "D" | "O";
export interface StrokeShape {
  /** 획을 이루는 기본형(쓴 순서) */
  prims: Prim[];
  /** 조각마다 길이(쓰기 칸 1000 기준) */
  lengths: number[];
  /** 획 전체 길이 */
  length: number;
}

type Pt = { x: number; y: number };

const DOT = 70; // 이보다 짧은 획은 점
const DEG = Math.PI / 180;

function pathLength(points: Pt[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  return length;
}

/** 방향(y 아래가 +)으로 기본형을 정한다. */
export function directionPrim(dx: number, dy: number): Prim {
  // 위로 긋는 획은 반대로 그은 것으로 보고 같은 기본형으로 친다.
  if (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.6) {
    dx = -dx;
    dy = -dy;
  }
  const angle = Math.atan2(dy, dx) / DEG; // 0: →, 90: ↓, 180: ←
  const a = angle < -90 ? angle + 180 : angle;
  if (Math.abs(a) <= 28 || Math.abs(a) >= 162) return "H";
  if (a >= 62 && a <= 112) return "V";
  if (a > 112) return "L";
  return "R";
}

/** 닫힌 고리(ㅇ, ㅎ의 동그라미)인지: 시작과 끝이 가깝고 한 바퀴 가까이 돈다. */
function isLoop(points: Pt[], length: number) {
  if (points.length < 6 || length < 60) return false;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX,
    h = maxY - minY;
  if (Math.min(w, h) < Math.max(w, h) * 0.3) return false;
  const a = points[0],
    b = points[points.length - 1];
  const gap = Math.hypot(a.x - b.x, a.y - b.y);
  if (gap > Math.max(w, h) * 0.45) return false;
  let turn = 0;
  for (let i = 2; i < points.length; i++) {
    const t1 = Math.atan2(
        points[i - 1].y - points[i - 2].y,
        points[i - 1].x - points[i - 2].x,
      ),
      t2 = Math.atan2(
        points[i].y - points[i - 1].y,
        points[i].x - points[i - 1].x,
      );
    let d = t2 - t1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn += d;
  }
  return Math.abs(turn) > 4.4; // 약 250도 이상
}

const shapeCache = new WeakMap<Stroke["points"], StrokeShape>();

/** 한 획의 기본형 줄. */
export function strokeShape(stroke: Pick<Stroke, "points">): StrokeShape {
  const cached = shapeCache.get(stroke.points);
  if (cached) return cached;
  const points = stroke.points;
  const length = pathLength(points);
  let shape: StrokeShape;
  if (length < DOT) shape = { prims: ["D"], lengths: [length], length };
  else if (isLoop(points, length))
    shape = { prims: ["O"], lengths: [length], length };
  else {
    const vertices = strokeVertices(points, Math.max(10, length * 0.06));
    // 조각: [방향, 길이]
    let pieces = vertices.slice(1).map((v, k) => {
      const a = points[vertices[k]],
        b = points[v];
      return {
        dx: b.x - a.x,
        dy: b.y - a.y,
        len: pathLength(points.slice(vertices[k], v + 1)),
      };
    });
    // 아주 짧은 갈고리(끝의 삐침, 펜 떨림)는 앞뒤 조각에 붙인다.
    const minPiece = Math.max(28, length * 0.14);
    pieces = pieces.filter((p) => p.len >= minPiece);
    if (!pieces.length)
      pieces = [
        {
          dx: points.at(-1)!.x - points[0].x,
          dy: points.at(-1)!.y - points[0].y,
          len: length,
        },
      ];
    const prims: Prim[] = [];
    const lengths: number[] = [];
    for (const piece of pieces) {
      const prim = directionPrim(piece.dx, piece.dy);
      // 같은 기본형이 이어지면(완만한 곡선) 하나로 합친다.
      if (prims.at(-1) === prim) lengths[lengths.length - 1] += piece.len;
      else {
        prims.push(prim);
        lengths.push(piece.len);
      }
    }
    shape = { prims, lengths, length };
  }
  shapeCache.set(stroke.points, shape);
  return shape;
}

/* ---------- 자모 문법 ---------- */
const CONSONANT: Record<string, string> = {
  ㄱ: "HV",
  ㄴ: "VH",
  ㄷ: "HVH",
  ㄹ: "HVHVH",
  ㅁ: "VHVH",
  ㅂ: "VVHH",
  ㅅ: "LR",
  ㅇ: "O",
  ㅈ: "HLR",
  ㅊ: "DHLR",
  ㅋ: "HVH",
  ㅌ: "HHVH",
  ㅍ: "HVVH",
  ㅎ: "DHO",
};
const DOUBLE: Record<string, string> = {
  ㄲ: "ㄱㄱ",
  ㄸ: "ㄷㄷ",
  ㅃ: "ㅂㅂ",
  ㅆ: "ㅅㅅ",
  ㅉ: "ㅈㅈ",
  ㄳ: "ㄱㅅ",
  ㄵ: "ㄴㅈ",
  ㄶ: "ㄴㅎ",
  ㄺ: "ㄹㄱ",
  ㄻ: "ㄹㅁ",
  ㄼ: "ㄹㅂ",
  ㄽ: "ㄹㅅ",
  ㄾ: "ㄹㅌ",
  ㄿ: "ㄹㅍ",
  ㅀ: "ㄹㅎ",
  ㅄ: "ㅂㅅ",
};
const VOWEL: Record<string, string> = {
  ㅏ: "VH",
  ㅐ: "VHV",
  ㅑ: "VHH",
  ㅒ: "VHHV",
  ㅓ: "HV",
  ㅔ: "HVV",
  ㅕ: "HHV",
  ㅖ: "HHVV",
  ㅗ: "VH",
  ㅘ: "VHVH",
  ㅙ: "VHVHV",
  ㅚ: "VHV",
  ㅛ: "VVH",
  ㅜ: "HV",
  ㅝ: "HVHV",
  ㅞ: "HVHVV",
  ㅟ: "HVV",
  ㅠ: "HVV",
  ㅡ: "H",
  ㅢ: "HV",
  ㅣ: "V",
};
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

export function jamoGrammar(jamo: string): string {
  if (VOWEL[jamo]) return VOWEL[jamo];
  if (CONSONANT[jamo]) return CONSONANT[jamo];
  if (DOUBLE[jamo]) return [...DOUBLE[jamo]].map((j) => CONSONANT[j]).join("");
  return "";
}

/** 글자의 초·중·종성 문법(획순 차례) */
export function syllableGrammar(char: string): string[] | null {
  const d = decompose(char);
  if (!d) return null;
  return [
    jamoGrammar(CHO[d.cho]),
    jamoGrammar(JUNG[d.jung]),
    ...(d.jong ? [jamoGrammar(JONG[d.jong])] : []),
  ];
}

/* ---------- 비교 ---------- */
const SIMILAR: Record<string, number> = {
  VL: 0.3,
  LV: 0.3, // ㄱ의 내리긋기는 세로·왼삐침 사이
  HR: 0.55,
  RH: 0.55,
  VR: 0.5,
  RV: 0.5,
  LR: 0.7,
  RL: 0.7,
  HL: 0.8,
  LH: 0.8,
  DH: 0.3,
  HD: 0.3,
  DV: 0.3,
  VD: 0.3,
  DL: 0.35,
  LD: 0.35,
  DR: 0.35,
  RD: 0.35,
  OD: 0.8,
  DO: 0.8,
};
const substitute = (a: Prim, b: Prim) => (a === b ? 0 : (SIMILAR[a + b] ?? 1));
const gapCost = (p: Prim) => (p === "D" ? 0.45 : 0.75);

/** 쓴 기본형 줄과 자모 문법의 차이(가중 편집 거리). 0이면 똑같다. */
export function grammarCost(written: Prim[], expected: string): number {
  const e = [...expected] as Prim[];
  const n = written.length,
    m = e.length;
  let prev = Array.from({ length: m + 1 }, (_, j) =>
    e.slice(0, j).reduce((s, p) => s + gapCost(p), 0),
  );
  for (let i = 1; i <= n; i++) {
    const row = [prev[0] + gapCost(written[i - 1])];
    for (let j = 1; j <= m; j++)
      row.push(
        Math.min(
          prev[j - 1] + substitute(written[i - 1], e[j - 1]),
          prev[j] + gapCost(written[i - 1]),
          row[j - 1] + gapCost(e[j - 1]),
        ),
      );
    prev = row;
  }
  return prev[m];
}

/** 여러 획을 이어 붙인 기본형 줄 */
export function primsOf(strokes: Pick<Stroke, "points">[]): Prim[] {
  return strokes.flatMap((stroke) => strokeShape(stroke).prims);
}

/* ---------- 모음의 역할 ---------- */
export type Role = "pillar" | "beam" | "branch" | "other";

/**
 * 중성(모음) 획의 역할: 세로 모음의 긴 세로획은 기둥(pillar),
 * 가로 모음의 긴 가로획은 보(beam), 거기 붙은 짧은 획은 곁줄기(branch).
 */
export function vowelRoles(strokes: Stroke[]): Map<string, Role> {
  const roles = new Map<string, Role>();
  if (!strokes.length) return roles;
  const info = strokes.map((stroke) => {
    const shape = strokeShape(stroke);
    let v = 0,
      h = 0;
    shape.prims.forEach((p, i) => {
      if (p === "V" || p === "L") v += shape.lengths[i];
      if (p === "H" || p === "R") h += shape.lengths[i];
    });
    return { stroke, v, h };
  });
  const longestV = Math.max(...info.map((i) => i.v)),
    longestH = Math.max(...info.map((i) => i.h));
  for (const { stroke, v, h } of info) {
    if (v >= h && v >= longestV * 0.7 && longestV >= longestH * 0.5)
      roles.set(stroke.id, "pillar");
    else if (h > v && h >= longestH * 0.7 && longestH >= longestV * 0.5)
      roles.set(stroke.id, "beam");
    else if (v > 0 || h > 0) roles.set(stroke.id, "branch");
    else roles.set(stroke.id, "other");
  }
  return roles;
}
