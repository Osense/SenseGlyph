// 한 글자의 획을 초성·중성·종성으로 나누는 판정.
//
// 견본 글자의 자모 영역만 보면, 견본과 다르게 쓴 글씨에서 초성을 아예 못 찾거나
// 받침 획이 중성으로 가는 일이 생긴다. 사람이 한글을 쓰는 방식을 함께 쓴다.
//  1) 획순: 한글은 초성 → 중성 → 종성 차례로 쓴다. 그래서 획을 쓴 순서대로 놓고
//     앞 몇 획은 초성, 다음 몇 획은 중성, 나머지는 종성으로 '잘라' 나눈다.
//     (첫 획은 초성, 마지막 획은 받침이 있으면 종성·없으면 중성이 된다.)
//  2) 자모마다 정해진 획수: 강 = ㄱ(1) + ㅏ(2) + ㅇ(1) → 1획 초성, 2·3획 중성, 4획 종성.
//     흘려 쓰면 획이 줄 수 있어 범위로 보고, 벗어나면 조금씩 감점한다.
//  3) 자리: 견본 글자의 자모 영역(쓰기 칸에 보이던 자리 그대로 + 쓴 글씨 크기에 맞춘 자리)과
//     일반적인 한글 짜임(왼쪽 위 초성, 오른쪽·아래 중성, 맨 아래 종성)을 함께 본다.
// 획순을 아주 다르게 쓰는 사람도 있으므로, 자리만으로 본 결과가 훨씬 그럴듯하면 그쪽을 따른다.
import { decompose, vowelType } from "../hangul";
import {
  referenceVote,
  handwritingFrame,
  type ReferenceSettings,
} from "./reference";
import type { Stroke } from "../types";
import type { Box, Part } from "./types";

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

/** [가장 적게, 바른 획수, 가장 많게] — 흘려 쓰기(줄어듦)와 나눠 쓰기를 고려한 범위 */
type Range = [number, number, number];
const CONSONANT: Record<string, Range> = {
  ㄱ: [1, 1, 1],
  ㄲ: [2, 2, 2],
  ㄴ: [1, 1, 1],
  ㄷ: [1, 2, 2],
  ㄸ: [2, 4, 4],
  ㄹ: [1, 3, 3],
  ㅁ: [2, 3, 4],
  ㅂ: [2, 4, 4],
  ㅃ: [4, 8, 8],
  ㅅ: [1, 2, 2],
  ㅆ: [2, 4, 4],
  ㅇ: [1, 1, 2],
  ㅈ: [1, 2, 3],
  ㅉ: [2, 4, 6],
  ㅊ: [2, 3, 4],
  ㅋ: [1, 2, 2],
  ㅌ: [2, 3, 3],
  ㅍ: [2, 4, 4],
  ㅎ: [2, 3, 3],
};
const VOWEL: Record<string, Range> = {
  ㅏ: [1, 2, 2],
  ㅐ: [2, 3, 3],
  ㅑ: [2, 3, 3],
  ㅒ: [3, 4, 4],
  ㅓ: [1, 2, 2],
  ㅔ: [2, 3, 3],
  ㅕ: [2, 3, 3],
  ㅖ: [3, 4, 4],
  ㅗ: [1, 2, 2],
  ㅘ: [2, 4, 4],
  ㅙ: [3, 5, 5],
  ㅚ: [2, 3, 3],
  ㅛ: [2, 3, 3],
  ㅜ: [1, 2, 2],
  ㅝ: [2, 4, 4],
  ㅞ: [3, 5, 5],
  ㅟ: [2, 3, 3],
  ㅠ: [2, 3, 3],
  ㅡ: [1, 1, 1],
  ㅢ: [2, 2, 2],
  ㅣ: [1, 1, 1],
};
const COMPOUND: Record<string, string> = {
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
function consonantRange(jamo: string): Range {
  if (CONSONANT[jamo]) return CONSONANT[jamo];
  const [a, b] = [...COMPOUND[jamo]].map((j) => CONSONANT[j]);
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** 이 글자의 자모별 획수 범위(초·중·종 차례) */
export function strokeRanges(
  char: string,
): { part: Part; range: Range }[] | null {
  const d = decompose(char);
  if (!d) return null;
  return [
    { part: "cho", range: consonantRange(CHO[d.cho]) },
    { part: "jung", range: VOWEL[JUNG[d.jung]] },
    ...(d.jong
      ? [{ part: "jong" as Part, range: consonantRange(JONG[d.jong]) }]
      : []),
  ];
}

const PARTS: Part[] = ["cho", "jung", "jong"];
const LOG_FLOOR = 0.04;

/** 일반적인 한글 짜임에서 자모가 놓이는 자리(글씨 범위를 0~1로 본 좌표) */
function typicalBoxes(char: string): Partial<Record<Part, Box>> {
  const d = decompose(char)!;
  const jong = d.jong > 0;
  const bottom = jong ? 0.62 : 1;
  const type = vowelType(d.jung);
  const boxes: Partial<Record<Part, Box>> = {
    cho:
      type === "V"
        ? { x: 0, y: 0, width: 0.55, height: bottom }
        : type === "H"
          ? { x: 0, y: 0, width: 1, height: bottom * 0.55 }
          : { x: 0, y: 0, width: 0.6, height: bottom * 0.55 },
    jung:
      type === "V"
        ? { x: 0.55, y: 0, width: 0.45, height: bottom }
        : type === "H"
          ? { x: 0, y: bottom * 0.55, width: 1, height: bottom * 0.45 }
          : { x: 0, y: bottom * 0.5, width: 1, height: bottom * 0.5 },
  };
  if (type === "C") boxes.jung = { x: 0, y: 0, width: 1, height: bottom };
  if (jong) boxes.jong = { x: 0, y: 0.66, width: 1, height: 0.34 };
  return boxes;
}

function center(stroke: Stroke) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** 획마다 각 자모일 그럴듯함(로그 점수). 손으로 정한 배정은 그 자모만 가능하게 한다. */
export function strokeScores(
  char: string,
  strokes: Stroke[],
  reference: ReferenceSettings | undefined,
  manual: Record<string, Part> = {},
): number[][] {
  const present = PARTS.filter((part, i) => i < 2 || decompose(char)!.jong > 0);
  const frame = handwritingFrame(strokes);
  const typical = typicalBoxes(char);
  return strokes.map((stroke) => {
    if (manual[stroke.id])
      return PARTS.map((part) => (part === manual[stroke.id] ? 0 : -Infinity));
    const fixed = referenceVote(char, stroke, reference)?.shares;
    const fitted = referenceVote(char, stroke, reference, strokes)?.shares;
    const c = center(stroke);
    const u = frame && frame.width > 1 ? (c.x - frame.x) / frame.width : 0.5,
      v = frame && frame.height > 1 ? (c.y - frame.y) / frame.height : 0.5;
    return PARTS.map((part, i) => {
      if (!present.includes(part)) return -Infinity;
      let score = 0;
      if (fixed) score += 0.8 * Math.log(LOG_FLOOR + fixed[i]);
      if (fitted) score += 1.0 * Math.log(LOG_FLOOR + fitted[i]);
      const box = typical[part]!;
      const dx = Math.max(box.x - u, 0, u - box.x - box.width),
        dy = Math.max(box.y - v, 0, v - box.y - box.height);
      score -= 2.5 * Math.hypot(dx, dy);
      // 왼쪽 위는 초성, 오른쪽 아래(받침 자리)는 종성 쪽으로 조금 더 기운다.
      if (part === "cho") score -= 0.6 * Math.max(0, u + v - 1);
      if (part === "jong") score -= 0.6 * Math.max(0, 1.2 - v * 1.6);
      return score;
    });
  });
}

function countPenalty(n: number, [lo, ideal, hi]: Range) {
  if (n < lo) return 1.5 * (lo - n);
  if (n > hi) return 1.2 * (n - hi);
  return 0.15 * Math.abs(n - ideal);
}

export interface Judgement {
  parts: Map<string, Part>;
  /** 획순대로 나눈 결과를 따랐는지(false 면 자리만으로 판정) */
  ordered: boolean;
}

/** 획을 쓴 순서와 자리, 자모 획수를 함께 보고 한 글자의 획을 나눈다. */
export function judgeStrokes(
  char: string,
  strokes: Stroke[],
  reference?: ReferenceSettings,
  manual: Record<string, Part> = {},
): Judgement | null {
  const ranges = strokeRanges(char);
  if (!ranges || !strokes.length) return null;
  const ordered = strokes
    .map((stroke, index) => ({ stroke, index }))
    .sort(
      (a, b) =>
        a.stroke.order - b.stroke.order ||
        a.stroke.createdAt - b.stroke.createdAt ||
        a.index - b.index,
    )
    .map((item) => item.stroke);
  const scores = strokeScores(char, ordered, reference, manual);
  const k = ranges.length,
    n = ordered.length;
  const partIndex = ranges.map((r) => PARTS.indexOf(r.part));

  // 자리만 본 판정(획순 무시)
  const free = scores.map((row) => {
    let best = 0;
    for (let i = 1; i < 3; i++) if (row[i] > row[best]) best = i;
    return best;
  });
  const freeScore = scores.reduce((sum, row, i) => sum + row[free[i]], 0);

  // 획순대로 자르기: 각 자모가 이어진 한 묶음(최소 1획)이 되게 나누는 가장 좋은 방법
  let ordered_: number[] | null = null;
  let orderedScore = -Infinity,
    orderedPlace = -Infinity;
  if (n >= k) {
    const prefix = partIndex.map((p) => {
      const sums = [0];
      for (let i = 0; i < n; i++) sums.push(sums[i] + scores[i][p]);
      return sums;
    });
    const segment = (part: number, from: number, to: number) =>
      prefix[part][to] -
      prefix[part][from] -
      countPenalty(to - from, ranges[part].range);
    // best[j][i]: 앞 i 획을 앞 j+1 자모로 나눈 최고 점수
    const best: number[][] = Array.from({ length: k }, () =>
      new Array(n + 1).fill(-Infinity),
    );
    const from: number[][] = Array.from({ length: k }, () =>
      new Array(n + 1).fill(-1),
    );
    for (let i = 1; i <= n - (k - 1); i++) best[0][i] = segment(0, 0, i);
    for (let j = 1; j < k; j++)
      for (let i = j + 1; i <= n - (k - 1 - j); i++)
        for (let s = j; s < i; s++) {
          const value = best[j - 1][s] + segment(j, s, i);
          if (value > best[j][i]) {
            best[j][i] = value;
            from[j][i] = s;
          }
        }
    if (best[k - 1][n] > -Infinity) {
      orderedScore = best[k - 1][n];
      const cuts: number[] = [n];
      for (let j = k - 1; j > 0; j--) cuts.unshift(from[j][cuts[0]]);
      cuts.unshift(0);
      ordered_ = new Array(n);
      for (let j = 0; j < k; j++)
        for (let i = cuts[j]; i < cuts[j + 1]; i++) ordered_[i] = partIndex[j];
      orderedPlace = ordered_.reduce((sum, p, i) => sum + scores[i][p], 0);
    }
  }
  // 획순을 따르는 쪽을 기본으로 하고, 자리만으로 본 결과가 훨씬 그럴듯할 때만(획순을 다르게 쓴 경우) 그쪽을 쓴다.
  const useOrdered =
    ordered_ !== null &&
    Number.isFinite(orderedScore) &&
    freeScore - orderedPlace < 2.5;
  const chosen = useOrdered ? ordered_! : free;
  if (!useOrdered && n >= k) {
    // 자리만으로 나눠도 빠진 자모가 없게: 그 자모일 가능성이 가장 큰 획을 넘겨준다.
    for (const p of partIndex) {
      if (chosen.includes(p)) continue;
      let pick = -1,
        loss = Infinity;
      for (let i = 0; i < n; i++) {
        const owner = chosen[i];
        if (chosen.filter((c) => c === owner).length < 2) continue;
        const cost = scores[i][owner] - scores[i][p];
        if (cost < loss) {
          loss = cost;
          pick = i;
        }
      }
      if (pick >= 0 && Number.isFinite(loss)) chosen[pick] = p;
    }
  }
  return {
    parts: new Map(ordered.map((stroke, i) => [stroke.id, PARTS[chosen[i]]])),
    ordered: useOrdered,
  };
}

const cache = new WeakMap<Stroke[], Map<string, Judgement | null>>();
/** 같은 획 묶음·배정·견본이면 한 번만 계산한다. */
export function cachedJudgement(
  char: string,
  strokes: Stroke[],
  reference?: ReferenceSettings,
  manual: Record<string, Part> = {},
) {
  let byKey = cache.get(strokes);
  if (!byKey) cache.set(strokes, (byKey = new Map()));
  const key =
    char +
    "|" +
    (reference?.referenceFont ?? "sans") +
    "|" +
    JSON.stringify(manual);
  if (!byKey.has(key))
    byKey.set(key, judgeStrokes(char, strokes, reference, manual));
  return byKey.get(key)!;
}
