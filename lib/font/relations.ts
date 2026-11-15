// 관계 기반 조합: 자모를 '원래 글자 안의 자리'가 아니라 '서로의 관계'로 쌓는다.
//
// 타자기처럼 자리만 맞춰 조합하면, '구'의 ㄱ(ㅜ 가로획 위, 글자 위쪽 절반)과
// '로'의 ㅗ(큰 ㄹ에 눌려 작고 아래쪽)를 합친 '고'는 ㄱ과 ㅗ 사이가 텅 빈다.
// 그래서 직접 쓴 글자에서 이 사람이
//   - 초성과 중성 사이를 얼마나 띄우는지(모음마다: ㅗ는 짧은 기둥 때문에 ㅜ보다 가깝다),
//   - 초성 가운데가 모음의 어디쯤 오는지,
//   - 받침을 위 글자에서 얼마나 띄우고 어디에 두는지,
//   - 같은 자모를 평소 어떤 크기로 쓰는지
// 를 배워 두었다가, 조합할 때 초성 → 중성 → 종성 순서로 그 관계대로 놓는다.
// 배울 글자가 없으면 짜임(세로·가로 모음)별 평균, 그것도 없으면 기본값을 쓴다.
import { decompose, vowelType } from "../hangul";
import type { Stroke } from "../types";
import { frameOf } from "./interpolate";
import type { Box, ComponentSample, Part } from "./types";

interface Stat {
  values: number[];
}
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface Relations {
  /** 초성 → 중성 간격(글자 높이·너비에 대한 비율). 키: 모음 번호 또는 'V'·'H' */
  choJungGap: Map<string, number>;
  /** 초성 → 중성 엇갈림: 가로 모음은 가운데 x 차이/너비, 세로 모음은 위 끝 y 차이/높이 */
  choJungShift: Map<string, number>;
  /** 위(초성+중성) → 받침 간격/높이, 받침 가운데 x 차이/너비. 키: 모음 짜임 */
  jongGap: Map<string, number>;
  jongShift: Map<string, number>;
  /** 자모 자리별 보통 크기(너비·높이) */
  size: Map<string, { width: number; height: number }>;
  /** 모음 크기 ÷ 초성 크기: 가로 모음은 너비, 세로 모음은 높이. 키: 'V'·'H' */
  jungToCho: Map<string, number>;
}

type Parts = Partial<Record<Part, ComponentSample>>;

function learn(pools: Map<string, ComponentSample[]>): Relations {
  const byChar = new Map<string, Parts>();
  for (const pool of pools.values())
    for (const c of pool) {
      const parts = byChar.get(c.char) ?? {};
      parts[c.part] = c;
      byChar.set(c.char, parts);
    }
  const add = (map: Map<string, Stat>, key: string, value: number) => {
    if (!Number.isFinite(value)) return;
    const stat = map.get(key) ?? { values: [] };
    stat.values.push(value);
    map.set(key, stat);
  };
  const gap = new Map<string, Stat>(),
    shift = new Map<string, Stat>(),
    jGap = new Map<string, Stat>(),
    jShift = new Map<string, Stat>(),
    proportion = new Map<string, Stat>(),
    sizes = new Map<string, { w: number[]; h: number[] }>();

  for (const [char, parts] of byChar) {
    const d = decompose(char);
    if (!d || !parts.cho || !parts.jung) continue;
    const type = vowelType(d.jung);
    const cho = frameOf(parts.cho.strokes),
      jung = frameOf(parts.jung.strokes);
    const all = frameOf(Object.values(parts).flatMap((p) => p!.strokes));
    if (!cho || !jung || !all || all.width < 60 || all.height < 60) continue;
    if (type === "H") {
      const g = (jung.y - (cho.y + cho.height)) / all.height;
      const s = (jung.x + jung.width / 2 - (cho.x + cho.width / 2)) / all.width;
      add(gap, String(d.jung), g);
      add(gap, "H", g);
      add(shift, String(d.jung), s);
      add(shift, "H", s);
      add(proportion, "H", jung.width / Math.max(1, cho.width));
    } else if (type === "V") {
      const g = (jung.x - (cho.x + cho.width)) / all.width;
      const s = (jung.y - cho.y) / all.height;
      add(gap, String(d.jung), g);
      add(gap, "V", g);
      add(shift, String(d.jung), s);
      add(shift, "V", s);
      add(proportion, "V", jung.height / Math.max(1, cho.height));
    }
    if (parts.jong) {
      const upper = frameOf([...parts.cho.strokes, ...parts.jung.strokes])!,
        jong = frameOf(parts.jong.strokes)!;
      add(jGap, type, (jong.y - (upper.y + upper.height)) / all.height);
      add(
        jShift,
        type,
        (jong.x + jong.width / 2 - (upper.x + upper.width / 2)) / all.width,
      );
    }
    for (const part of Object.values(parts)) {
      const box = frameOf(part!.strokes);
      if (!box) continue;
      const entry = sizes.get(part!.key) ?? { w: [], h: [] };
      entry.w.push(box.width);
      entry.h.push(box.height);
      sizes.set(part!.key, entry);
    }
  }
  // 모음별 값은 표본이 적으면 짜임(가로·세로 모음) 전체 값 쪽으로 당겨 둔다(표본 1개 = 1/3만 반영).
  const collapse = (map: Map<string, Stat>) => {
    const out = new Map([...map].map(([k, s]) => [k, median(s.values)]));
    for (const [k, s] of map) {
      if (k === "H" || k === "V" || k === "C") continue;
      const jung = Number(k);
      const group = Number.isFinite(jung)
        ? out.get(vowelType(jung))
        : undefined;
      if (group === undefined) continue;
      const n = s.values.length;
      out.set(k, (out.get(k)! * n + group * 2) / (n + 2));
    }
    return out;
  };
  return {
    choJungGap: collapse(gap),
    choJungShift: collapse(shift),
    jongGap: collapse(jGap),
    jongShift: collapse(jShift),
    jungToCho: collapse(proportion),
    size: new Map(
      [...sizes]
        .filter(([, s]) => s.w.length >= 2)
        .map(([k, s]) => [k, { width: median(s.w), height: median(s.h) }]),
    ),
  };
}

const cache = new WeakMap<Map<string, ComponentSample[]>, Relations>();
export function relationsOf(pools: Map<string, ComponentSample[]>) {
  let relations = cache.get(pools);
  if (!relations) cache.set(pools, (relations = learn(pools)));
  return relations;
}

/* ---------- 쌓기 ---------- */
export interface Piece {
  key: string;
  part: Part;
  strokes: Stroke[];
  /** 짝이 맞는 글자(anchor)에서 그대로 가져온 자모: 움직이지 않는다 */
  fixed: boolean;
}

function moveBy(strokes: Stroke[], dx: number, dy: number): Stroke[] {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return strokes;
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
  }));
}
function scaleAbout(strokes: Stroke[], factor: number): Stroke[] {
  if (Math.abs(factor - 1) < 0.01) return strokes;
  const box = frameOf(strokes)!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => ({
      ...p,
      x: cx + (p.x - cx) * factor,
      y: cy + (p.y - cy) * factor,
    })),
  }));
}

// 배운 값이 없을 때의 기본값(쓰기 칸 비율)
const DEFAULT_GAP: Record<string, number> = { H: 0.04, V: 0.035 };
const DEFAULT_SHIFT: Record<string, number> = { H: 0, V: 0.02 };
const DEFAULT_JONG_GAP = 0.05;

/**
 * 조합할 자모 조각을 관계대로 놓는다.
 * 1) 빌려 온 자모는 같은 자리 표본들의 보통 크기로(0.8~1.25배, 모양 비율 그대로)
 * 2) 초성 ↔ 중성: 가로 모음은 위아래 간격과 가운데 맞춤, 세로 모음은 좌우 간격과 위 끝 맞춤
 *    (한쪽이 anchor 에서 온 고정 조각이면 다른 쪽을 그쪽에 맞춘다)
 * 3) 받침: 위 글자(초성+중성) 아래로 배운 간격만큼, 배운 가로 위치에
 * 섞임 모음(ㅘ·ㅝ 등)의 초성–중성은 겹쳐 쓰는 모양이라 자리 방식을 그대로 둔다.
 */
export function arrangePieces(
  char: string,
  pieces: Piece[],
  relations: Relations,
  frame: Box | null,
): Piece[] {
  const d = decompose(char);
  if (!d || pieces.every((p) => p.fixed)) return pieces;
  const type = vowelType(d.jung);
  const out = pieces.map((piece) => {
    if (piece.fixed) return piece;
    const norm = relations.size.get(piece.key);
    const box = frameOf(piece.strokes);
    if (!norm || !box || box.width < 10 || box.height < 10) return piece;
    // 가늘고 긴 자모(ㅡ, ㅣ)는 긴 쪽만 본다.
    const ratio =
      box.width > box.height * 2.5
        ? norm.width / box.width
        : box.height > box.width * 2.5
          ? norm.height / box.height
          : Math.sqrt((norm.width / box.width) * (norm.height / box.height));
    return {
      ...piece,
      strokes: scaleAbout(piece.strokes, Math.max(0.8, Math.min(1.25, ratio))),
    };
  });
  const find = (part: Part) => out.find((p) => p.part === part);
  // 모음 표본이 하나뿐이라 보통 크기를 모를 때: 초성에 대한 이 사람의 모음 비율로 맞춘다
  // ('로'의 ㅗ처럼 큰 초성에 눌려 작게 쓴 모음을 되살린다).
  {
    const choPiece = find("cho"),
      jungPiece = find("jung");
    const proportion = relations.jungToCho.get(type);
    if (
      choPiece &&
      jungPiece &&
      !jungPiece.fixed &&
      proportion &&
      type !== "C" &&
      !relations.size.get(jungPiece.key)
    ) {
      const a = frameOf(choPiece.strokes)!,
        b = frameOf(jungPiece.strokes)!;
      const now =
        type === "H"
          ? b.width / Math.max(1, a.width)
          : b.height / Math.max(1, a.height);
      const factor = Math.max(0.8, Math.min(1.25, proportion / now));
      jungPiece.strokes = scaleAbout(jungPiece.strokes, factor);
    }
  }
  const cho = find("cho"),
    jung = find("jung"),
    jong = find("jong");
  const height = frame?.height ?? 760,
    width = frame?.width ?? 760;
  const pick = (map: Map<string, number>, fallback: number) =>
    map.get(String(d.jung)) ?? map.get(type) ?? fallback;

  if (cho && jung && type !== "C" && !(cho.fixed && jung.fixed)) {
    const gap = pick(relations.choJungGap, DEFAULT_GAP[type]);
    const shift = pick(relations.choJungShift, DEFAULT_SHIFT[type]);
    const a = frameOf(cho.strokes)!,
      b = frameOf(jung.strokes)!;
    // 중성을 초성에 맞춘다(중성이 고정이면 초성을 반대로 맞춘다).
    let dx: number, dy: number;
    if (type === "H") {
      dx = a.x + a.width / 2 + shift * width - (b.x + b.width / 2);
      dy = a.y + a.height + gap * height - b.y;
    } else {
      dx = a.x + a.width + gap * width - b.x;
      dy = a.y + shift * height - b.y;
    }
    if (jung.fixed) cho.strokes = moveBy(cho.strokes, -dx, -dy);
    else jung.strokes = moveBy(jung.strokes, dx, dy);
  }
  if (jong && !jong.fixed && cho && jung) {
    const upper = frameOf([...cho.strokes, ...jung.strokes])!,
      j = frameOf(jong.strokes)!;
    const gap = relations.jongGap.get(type) ?? DEFAULT_JONG_GAP;
    const shift = relations.jongShift.get(type) ?? 0;
    jong.strokes = moveBy(
      jong.strokes,
      upper.x + upper.width / 2 + shift * width - (j.x + j.width / 2),
      upper.y + upper.height + gap * height - j.y,
    );
  }
  return out;
}
