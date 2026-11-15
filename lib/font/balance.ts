// 자모 균형 보정: 서로 다른 글자에서 빌려 와 조합한 자모의 크기·위치·맞춤을 고르게 한다.
//
// 문제: '퀴'를 '쾌'의 ㅋ + '귀'의 ㅟ로 만들면, 쓸 때 따라 쓴 견본 글꼴이 글자마다
// 자모 모양·자리를 다르게 그려 두었기 때문에 ㅋ이 ㅟ의 ㅜ와 어긋나게 붙는다.
// 그래서 강도(0~1)만큼
//   1) 평균 자리: 같은 자모 자리(예: 받침 없는 ㅟ)를 여러 글자에서 썼다면 그 평균 위치·크기로
//   2) 구조 맞춤: 초성 가운데를 모음의 짧은 기둥(ㅗ·ㅜ의 세로획)에, 세로 모음은 곁가지 높이에,
//      초성이 모음 기둥을 침범하지 않게, 받침은 위 글자 가운데에
// 맞춘다. 강도 0이면 아무것도 바꾸지 않는다(쓴 그대로).
import { decompose, vowelType } from "../hangul";
import type { Stroke } from "../types";
import { frameOf } from "./interpolate";
import type { ComponentSample, Part } from "./types";
import type { Piece } from "./relations";

type Frame = { x: number; y: number; width: number; height: number };
/** 글자 범위에 대한 자모 상자 비율(0~1) */
type Norm = { cx: number; cy: number; w: number; h: number };

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function transform(
  strokes: Stroke[],
  map: (x: number, y: number) => [number, number],
): Stroke[] {
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => {
      const [x, y] = map(p.x, p.y);
      return { ...p, x, y };
    }),
  }));
}
const moveBy = (strokes: Stroke[], dx: number, dy: number) =>
  Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5
    ? strokes
    : transform(strokes, (x, y) => [x + dx, y + dy]);
function scaleAbout(strokes: Stroke[], sx: number, sy: number) {
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return strokes;
  const b = frameOf(strokes)!;
  const cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  return transform(strokes, (x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}

/* ---------- 1) 같은 자리 자모의 평균 상자 ---------- */
const slotCache = new WeakMap<
  Map<string, ComponentSample[]>,
  Map<string, Norm>
>();
/** 자모 자리마다, 그 자모가 원래 글자 범위 안에서 차지한 상자 비율의 중앙값 */
export function slotNorms(pools: Map<string, ComponentSample[]>) {
  let norms = slotCache.get(pools);
  if (norms) return norms;
  const charFrames = new Map<string, Frame | null>();
  const byChar = new Map<string, Stroke[]>();
  for (const pool of pools.values())
    for (const c of pool)
      byChar.set(c.char, [...(byChar.get(c.char) ?? []), ...c.strokes]);
  for (const [char, strokes] of byChar) charFrames.set(char, frameOf(strokes));
  norms = new Map();
  for (const [key, pool] of pools) {
    const list: Norm[] = [];
    for (const c of pool) {
      const f = charFrames.get(c.char),
        b = frameOf(c.strokes);
      if (!f || !b || f.width < 60 || f.height < 60) continue;
      list.push({
        cx: (b.x + b.width / 2 - f.x) / f.width,
        cy: (b.y + b.height / 2 - f.y) / f.height,
        w: b.width / f.width,
        h: b.height / f.height,
      });
    }
    if (list.length)
      norms.set(key, {
        cx: median(list.map((n) => n.cx)),
        cy: median(list.map((n) => n.cy)),
        w: median(list.map((n) => n.w)),
        h: median(list.map((n) => n.h)),
      });
  }
  slotCache.set(pools, norms);
  return norms;
}

/** 빌려 온 자모를 같은 자리 평균 상자 쪽으로 옮기고 크기를 맞춘다(강도만큼). */
export function averagePieces(
  pieces: Piece[],
  pools: Map<string, ComponentSample[]>,
  frame: Frame | null,
  amount: number,
): Piece[] {
  if (amount <= 0 || !frame) return pieces;
  const norms = slotNorms(pools);
  return pieces.map((piece) => {
    if (piece.fixed) return piece;
    const norm = norms.get(piece.key),
      box = frameOf(piece.strokes);
    if (!norm || !box || box.width < 8 || box.height < 8) return piece;
    const tw = norm.w * frame.width,
      th = norm.h * frame.height;
    // 가늘고 긴 자모(ㅡ, ㅣ)는 긴 쪽 길이만 맞추고 두께 쪽은 그대로
    const thinH = box.width > box.height * 2.5,
      thinV = box.height > box.width * 2.5;
    let sx = thinV ? 1 : tw / box.width,
      sy = thinH ? 1 : th / box.height;
    if (!thinH && !thinV) {
      // 모양 비율은 크게 바꾸지 않는다: 두 배율을 기하평균 쪽으로 반쯤 모은다
      const g = Math.sqrt(sx * sy);
      sx = Math.sqrt(sx * g);
      sy = Math.sqrt(sy * g);
    }
    sx = Math.pow(clamp(sx, 0.75, 1.33), amount);
    sy = Math.pow(clamp(sy, 0.75, 1.33), amount);
    const scaled = scaleAbout(piece.strokes, sx, sy);
    const now = frameOf(scaled)!;
    const tx = frame.x + norm.cx * frame.width,
      ty = frame.y + norm.cy * frame.height;
    return {
      ...piece,
      strokes: moveBy(
        scaled,
        (tx - (now.x + now.width / 2)) * amount,
        (ty - (now.y + now.height / 2)) * amount,
      ),
    };
  });
}

/* ---------- 2) 구조 맞춤 ---------- */
/** 모음 획에서 기둥(긴 세로)·보(긴 가로)·곁가지(짧은 획)의 상자를 찾는다.
 * 획마다의 상자 모양으로만 판단하므로, 획 하나로 이어 쓴 모음(ㅜ를 한 번에)이나
 * 외곽선 모양의 획에서도 엉뚱한 역할이 붙지 않는다. */
function vowelParts(strokes: Stroke[]) {
  const all = frameOf(strokes);
  const pillars: Frame[] = [],
    beams: Frame[] = [],
    branchesV: Frame[] = [],
    branchesH: Frame[] = [];
  if (!all) return { pillars, beams, branchesV, branchesH };
  for (const stroke of strokes) {
    const f = frameOf([stroke]);
    if (!f) continue;
    if (f.height >= all.height * 0.55 && f.height >= f.width * 2.2)
      pillars.push(f);
    else if (f.width >= all.width * 0.4 && f.width >= f.height * 1.8)
      beams.push(f);
    else (f.height >= f.width ? branchesV : branchesH).push(f);
  }
  return { pillars, beams, branchesV, branchesH };
}
const centerX = (f: Frame) => f.x + f.width / 2;
const centerY = (f: Frame) => f.y + f.height / 2;
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// 중성 번호: ㅗ 기반 섞임(ㅘㅙㅚ), ㅜ 기반 섞임(ㅝㅞㅟ), ㅢ
const O_MIXED = new Set([9, 10, 11]);
const U_MIXED = new Set([14, 15, 16]);
const EU_I = 19;

/**
 * 초성·중성·종성의 맞춤을 강도만큼 바로잡는다. 고정 조각(짝 글자에서 그대로 온 것)은
 * 움직이지 않고, 둘 다 고정이면 그대로 둔다.
 */
export function alignPieces(
  char: string,
  pieces: Piece[],
  frame: Frame | null,
  amount: number,
): Piece[] {
  const d = decompose(char);
  if (!d || amount <= 0) return pieces;
  const out = pieces.map((p) => ({ ...p }));
  const find = (part: Part) => out.find((p) => p.part === part);
  const cho = find("cho"),
    jung = find("jung"),
    jong = find("jong");
  if (!cho || !jung) return out;
  const width = frame?.width ?? 760,
    height = frame?.height ?? 760;
  const type = vowelType(d.jung);
  const parts = vowelParts(jung.strokes);
  const gapX = 0.035 * width,
    gapY = 0.035 * height;
  /** 초성을 (dx, dy) 옮긴다. 초성이 고정이면 중성을 반대로 옮긴다.
   * 모음 구조를 잘못 읽었을 때 크게 튀지 않도록 한 번에 글자 크기의 20%까지만 옮긴다. */
  const shiftCho = (dx: number, dy: number) => {
    if (cho.fixed && jung.fixed) return;
    dx = clamp(dx, -width * 0.2, width * 0.2);
    dy = clamp(dy, -height * 0.2, height * 0.2);
    if (!cho.fixed) cho.strokes = moveBy(cho.strokes, dx * amount, dy * amount);
    else jung.strokes = moveBy(jung.strokes, -dx * amount, -dy * amount);
  };

  if (!(cho.fixed && jung.fixed)) {
    const a = frameOf(cho.strokes)!;
    // 가로 모음·섞임 모음: 초성 가운데를 ㅗ·ㅜ의 짧은 기둥(곁가지 세로획) 위로
    if (type === "H" || type === "C") {
      const pillarX = parts.pillars.length
        ? Math.min(...parts.pillars.map((p) => p.x))
        : Infinity;
      const stems = parts.branchesV.filter((b) => centerX(b) < pillarX);
      const leftBeam = parts.beams.length
        ? parts.beams.reduce((m, b) => (b.width > m.width ? b : m))
        : null;
      // 기둥 왼쪽에 있는 모음 잉크(ㅗ·ㅜ·ㅡ 부분). 보·곁가지를 못 읽었을 때(한 획으로 이어 쓴 ㅜ 등) 대신 쓴다.
      const leftInk = frameOf(
        jung.strokes.filter((stroke) => {
          const f = frameOf([stroke]);
          return !!f && centerX(f) < pillarX;
        }),
      );
      const stemX = stems.length
        ? mean(stems.map(centerX))
        : leftBeam
          ? centerX(leftBeam)
          : leftInk
            ? centerX(leftInk)
            : null;
      let dx = stemX === null ? 0 : stemX - centerX(a);
      let dy = 0;
      if (type === "C") {
        // 섞임 모음: 초성이 오른쪽 기둥을 침범하지 않게
        if (Number.isFinite(pillarX)) {
          const over = a.x + a.width + dx - (pillarX - gapX);
          if (over > 0) dx -= over;
        }
        // 세로 자리: ㅜ 기반·ㅢ는 보 위에, ㅗ 기반은 짧은 기둥 위에 앉힌다
        const beamTop = leftBeam ? leftBeam.y : leftInk ? leftInk.y : null;
        const stemTop = stems.length
          ? Math.min(...stems.map((s) => s.y))
          : null;
        const seat = O_MIXED.has(d.jung)
          ? (stemTop ?? beamTop)
          : U_MIXED.has(d.jung) || d.jung === EU_I
            ? beamTop
            : null;
        if (seat !== null) dy = seat - gapY - (a.y + a.height);
      }
      shiftCho(dx, dy);
      // 섞임 모음에서 초성이 기둥과 겹칠 만큼 크면 가로로 살짝 줄인다
      if (type === "C" && !cho.fixed && Number.isFinite(pillarX)) {
        const b = frameOf(cho.strokes)!;
        const room = pillarX - gapX - b.x;
        if (room > 0 && b.width > room) {
          const sx = lerp(1, Math.max(0.8, room / b.width), amount);
          cho.strokes = scaleAbout(cho.strokes, sx, 1);
          const c = frameOf(cho.strokes)!;
          cho.strokes = moveBy(cho.strokes, b.x - c.x, 0);
        }
      }
    } else if (type === "V") {
      // 세로 모음: 초성 세로 가운데를 곁가지(ㅏ·ㅓ의 짧은 가로획) 높이에, 기둥 왼쪽에 띄워서
      const pillarX = parts.pillars.length
        ? Math.min(...parts.pillars.map((p) => p.x))
        : null;
      const dy = parts.branchesH.length
        ? mean(parts.branchesH.map(centerY)) - centerY(a)
        : 0;
      let dx = 0;
      if (pillarX !== null) {
        const over = a.x + a.width - (pillarX - gapX);
        if (over > 0) dx = -over;
      }
      // 받침이 있으면 위아래 맞춤은 반만(받침 자리를 위해 초성이 위로 붙는 경우가 많다)
      shiftCho(dx, d.jong ? dy * 0.5 : dy);
    }
  }

  // 받침: 위 글자(초성+중성) 가운데 아래에, 겹치지 않게
  if (jong && !jong.fixed) {
    const parts = vowelParts(jung.strokes);
    const upper = frameOf([...cho.strokes, ...jung.strokes])!,
      j = frameOf(jong.strokes)!;
    const targetX =
      type === "V" && parts.pillars.length
        ? (upper.x + Math.max(...parts.pillars.map((p) => p.x + p.width))) / 2
        : centerX(upper);
    let dy = 0;
    const overlap = upper.y + upper.height + gapY - j.y;
    if (overlap > 0) dy = overlap;
    jong.strokes = moveBy(
      jong.strokes,
      clamp(targetX - centerX(j), -width * 0.2, width * 0.2) * amount,
      clamp(dy, 0, height * 0.2) * amount,
    );
  }
  return out;
}
