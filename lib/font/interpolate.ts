// 조합 보간: 쓰지 않은 짜임의 자모를 내 글씨로 만들고, 같은 자모의 여러 표본을 섞는다.
//
// 1) 빠진 짜임 채우기 — 예: '각'(받침 있는 ㅏ)을 쓰지 않았어도 '가'의 ㅏ로 만든다.
//    받침이 붙으면 세로 모음은 기둥만 짧아지고 곁줄기 길이는 그대로여야 하므로,
//    획을 '세로로만' 줄인다(중심선을 옮긴 뒤 브러시로 다시 그리므로 굵기는 그대로).
//    초성은 모음 짜임(세로·가로·섞임)에 맞춰 너비·높이 비율을 바꾸고,
//    받침이 없으면 같은 자음의 초성 모양을 받침 자리로 옮겨 쓴다.
// 2) 내 글씨끼리 섞기 — 같은 자모를 여러 글자에서 썼다면(가·거·고의 ㄱ),
//    획 기본형이 같은 표본끼리 점을 대응시켜 평균을 낸다. 하나만 쓸 때보다
//    덜 튀고, 여전히 내 글씨다.
import { decompose, vowelType } from "../hangul";
import type { Stroke, StrokePoint } from "../types";
import { strokeShape } from "./primitives";
import type { Box, ComponentSample } from "./types";

type Frame = Box;

export function frameOf(strokes: Stroke[]): Frame | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const stroke of strokes)
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  return minX === Infinity
    ? null
    : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function scaleStrokes(
  strokes: Stroke[],
  sx: number,
  sy: number,
  anchor: "top" | "center",
): Stroke[] {
  const box = frameOf(strokes);
  if (!box) return strokes;
  const ox = box.x + box.width / 2,
    oy = anchor === "top" ? box.y : box.y + box.height / 2;
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: ox + (p.x - ox) * sx,
      y: oy + (p.y - oy) * sy,
    })),
  }));
}

/* ---------- 1) 빠진 짜임 채우기 ---------- */
interface SlotKey {
  part: "cho" | "jung" | "jong";
  jamo: number;
  type?: string; // 모음 짜임 V/H/C
  jong?: boolean; // 받침 있음
}
function parseKey(key: string): SlotKey {
  const [part, jamo, a, b] = key.split(":");
  if (part === "cho") return { part, jamo: +jamo, type: a, jong: b === "true" };
  if (part === "jung") return { part, jamo: +jamo, jong: a === "true" };
  return { part: "jong", jamo: +jamo, type: a };
}

// 초성 상자 크기(쓰기 칸 기준 대략): 세로 모음 옆, 가로 모음 위, 섞임 모음 왼쪽 위
const CHO_SIZE: Record<string, [number, number]> = {
  V: [0.5, 0.75],
  H: [0.75, 0.45],
  C: [0.5, 0.45],
};
const clampScale = (v: number) => Math.max(0.72, Math.min(1.38, v));

// 초성 자음 번호 → 받침 번호(같은 자음)
const CHO_LIST = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JONG_LIST = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
const choToJong = (i: number) => JONG_LIST.indexOf(CHO_LIST[i]);
const jongToCho = (i: number) => CHO_LIST.indexOf(JONG_LIST[i]);

/** 받침 자리(글자 범위에 대한 비율) */
const JONG_PLACE: Box = { x: 0.16, y: 0.66, width: 0.68, height: 0.32 };
const CHO_PLACE: Record<string, Box> = {
  V: { x: 0.02, y: 0.08, width: 0.5, height: 0.55 },
  H: { x: 0.12, y: 0.0, width: 0.76, height: 0.38 },
  C: { x: 0.02, y: 0.0, width: 0.5, height: 0.36 },
};

function derived(
  source: ComponentSample,
  key: string,
  strokes: Stroke[],
  place?: Box,
): ComponentSample {
  const s = parseKey(key);
  return {
    ...source,
    key,
    part: s.part,
    strokes,
    derived: true,
    ...(place ? { place } : {}),
  };
}

/**
 * 쓴 표본이 없는 짜임(자모 자리)을 가까운 짜임의 내 글씨로 만든다.
 * 실제로 쓴 표본이 있는 자리는 건드리지 않는다.
 */
export function deriveMissingSlots(
  library: Map<string, ComponentSample>,
  wanted: string[],
): Map<string, ComponentSample> {
  const out = new Map(library);
  const has = (key: string) => library.get(key);
  for (const key of wanted) {
    if (out.has(key)) continue;
    const s = parseKey(key);
    let made: ComponentSample | undefined;
    if (s.part === "jung") {
      // 받침 유무만 다른 같은 모음: 세로로만 줄이거나 늘린다(곁줄기 길이 유지).
      const other = has(`jung:${s.jamo}:${!s.jong}`);
      if (other) {
        const type = vowelType(s.jamo);
        const f = type === "H" ? 0.86 : 0.76;
        made = derived(
          other,
          key,
          scaleStrokes(other.strokes, 1, s.jong ? f : 1 / f, "top"),
        );
      }
    } else if (s.part === "cho") {
      const sameType = has(`cho:${s.jamo}:${s.type}:${!s.jong}`);
      if (sameType)
        made = derived(
          sameType,
          key,
          scaleStrokes(sameType.strokes, 1, s.jong ? 0.86 : 1 / 0.86, "top"),
        );
      else
        for (const type of ["V", "H", "C"].filter((t) => t !== s.type))
          for (const jong of [s.jong, !s.jong]) {
            const other = has(`cho:${s.jamo}:${type}:${jong}`);
            if (!other || made) continue;
            const [fw, fh] = CHO_SIZE[type],
              [tw, th] = CHO_SIZE[s.type!];
            made = derived(
              other,
              key,
              scaleStrokes(
                other.strokes,
                clampScale(tw / fw),
                clampScale(th / fh) *
                  (jong === s.jong ? 1 : s.jong ? 0.86 : 1 / 0.86),
                "top",
              ),
            );
          }
      if (!made) {
        // 받침으로 쓴 같은 자음을 초성 자리로
        const j = choToJong(s.jamo);
        for (const type of [s.type, "V", "H", "C"]) {
          const other = j > 0 ? has(`jong:${j}:${type}`) : undefined;
          if (other && !made)
            made = derived(other, key, other.strokes, CHO_PLACE[s.type!]);
        }
      }
    } else {
      for (const type of [s.type, "V", "H", "C"]) {
        const other = has(`jong:${s.jamo}:${type}`);
        if (other && !made) made = derived(other, key, other.strokes);
      }
      if (!made) {
        // 초성으로 쓴 같은 자음을 받침 자리로(가로 모음 위 초성이 받침과 가장 닮았다)
        const c = jongToCho(s.jamo);
        if (c >= 0)
          for (const type of ["H", "C", "V"])
            for (const jong of [true, false]) {
              const other = has(`cho:${c}:${type}:${jong}`);
              if (other && !made)
                made = derived(other, key, other.strokes, JONG_PLACE);
            }
      }
    }
    if (made) out.set(key, made);
  }
  return out;
}

/** 정해 둔 자리(글자 범위에 대한 비율)에 자모를 비율 그대로 놓는다. */
export function placeInBox(
  strokes: Stroke[],
  place: Box,
  target: Frame,
): Stroke[] {
  const own = frameOf(strokes);
  if (!own) return strokes;
  const box = {
    x: target.x + place.x * target.width,
    y: target.y + place.y * target.height,
    width: place.width * target.width,
    height: place.height * target.height,
  };
  const scale = Math.max(
    0.6,
    Math.min(
      1.3,
      Math.min(
        box.width / Math.max(1, own.width),
        box.height / Math.max(1, own.height),
      ),
    ),
  );
  const cx = own.x + own.width / 2,
    cy = own.y + own.height / 2;
  const nx = box.x + box.width / 2,
    ny = box.y + box.height / 2;
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => ({
      ...p,
      x: nx + (p.x - cx) * scale,
      y: ny + (p.y - cy) * scale,
    })),
  }));
}

/* ---------- 2) 내 글씨끼리 섞기 ---------- */
function resample(
  points: StrokePoint[],
  count: number,
): { x: number; y: number }[] {
  if (points.length === 1)
    return Array.from({ length: count }, () => ({
      x: points[0].x,
      y: points[0].y,
    }));
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  const total = lengths.at(-1)! || 1;
  const out: { x: number; y: number }[] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const at = (total * i) / Math.max(1, count - 1);
    while (k < points.length - 2 && lengths[k + 1] < at) k++;
    const span = lengths[k + 1] - lengths[k] || 1;
    const t = Math.min(1, Math.max(0, (at - lengths[k]) / span));
    out.push({
      x: points[k].x + (points[k + 1].x - points[k].x) * t,
      y: points[k].y + (points[k + 1].y - points[k].y) * t,
    });
  }
  return out;
}

export const sameShape = (a: Stroke[], b: Stroke[]) =>
  a.length === b.length &&
  a.every(
    (stroke, i) =>
      strokeShape(stroke).prims.join("") === strokeShape(b[i]).prims.join(""),
  );

/**
 * 같은 자모 표본 여러 개를 섞는다. main 의 획(아이디·필압·시간)을 바탕으로 점의 위치만 평균 낸다.
 * others 는 이미 main 과 같은 좌표계로 옮겨 둔 획들이어야 한다.
 * 획 수나 기본형이 다른 표본, 너무 다르게 생긴 표본은 섞지 않는다.
 */
export function blendStrokes(
  main: Stroke[],
  others: Stroke[][],
  mainWeight = 0.6,
  /** 이미 기본형이 같은지 확인한 표본들이면 true */
  checked = false,
): Stroke[] {
  const usable = checked
    ? others
    : others.filter((other) => sameShape(main, other));
  if (!usable.length) return main;
  const size = (() => {
    const box = frameOf(main);
    return box ? Math.max(box.width, box.height, 60) : 60;
  })();
  const blended = main.map((stroke, i) => {
    const count = stroke.points.length;
    const base = resample(stroke.points, count);
    const partners: { x: number; y: number }[][] = [];
    for (const other of usable) {
      let pts = resample(other[i].points, count);
      // 반대 방향으로 그은 획이면 뒤집어 맞춘다.
      const forward =
        Math.hypot(pts[0].x - base[0].x, pts[0].y - base[0].y) +
        Math.hypot(
          pts[count - 1].x - base[count - 1].x,
          pts[count - 1].y - base[count - 1].y,
        );
      const backward =
        Math.hypot(pts[count - 1].x - base[0].x, pts[count - 1].y - base[0].y) +
        Math.hypot(pts[0].x - base[count - 1].x, pts[0].y - base[count - 1].y);
      if (backward < forward) pts = [...pts].reverse();
      const gap =
        pts.reduce(
          (s, p, k) => s + Math.hypot(p.x - base[k].x, p.y - base[k].y),
          0,
        ) / count;
      if (gap <= size * 0.22) partners.push(pts);
    }
    return { stroke, base, partners };
  });
  if (blended.some((b) => !b.partners.length)) {
    // 한 획이라도 짝이 없으면 섞지 않는다(자모 안 획들의 관계가 어긋나지 않게).
    return main;
  }
  return blended.map(({ stroke, base, partners }) => {
    const w = (1 - mainWeight) / partners.length;
    return {
      ...stroke,
      points: stroke.points.map((p, k) => ({
        ...p,
        x:
          base[k].x * mainWeight + partners.reduce((s, q) => s + q[k].x * w, 0),
        y:
          base[k].y * mainWeight + partners.reduce((s, q) => s + q[k].y * w, 0),
      })),
    };
  });
}
