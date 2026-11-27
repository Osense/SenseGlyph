// 이상 표본 감지: 같은 자모를 여러 글자에서 썼을 때, 다른 것들과 모양이 크게 다른 한 글자를 찾는다.
// 조합 엔진은 자모 자리마다 표본이 1~2개뿐이라, 한 글자를 삐끗하면 그 자모를 쓰는 글자 수십~수백 자가
// 함께 틀어진다. 그래서 '다시 써 보면 좋은 글자'로 미리 알려 준다.
//
// 비교 방법: 자모 조각의 획을 자기 상자에 맞춰 늘인 뒤(가로세로비 차이는 짜임마다 자연스러우므로 지운다)
// 점 32개로 고르게 뽑고, 두 표본 사이 평균 최근접 거리(챔퍼 거리)를 잰다.
// 같은 자모 묶음 안에서 '다른 표본들과의 거리 중앙값'이 묶음의 보통 값보다 훨씬 크면 이상 표본.
import { decompose } from "../hangul";
import type { GlyphSample, Stroke } from "../types";
import { separateSample } from "./composition";
import { cachedShape, shapeDistance, shapeGroup, type Shape } from "./jamo-shape";
import type { ReferenceSettings } from "./reference";
import type { Separation } from "./types";

/** 이상 표본으로 볼 최소 거리(자모 상자 1 기준)와 묶음 보통 거리에 대한 배수 */
const MIN_DISTANCE = 0.13;
const FACTOR = 2.4;

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

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
      const group = shapeGroup(component);
      const shape = cachedShape(component.strokes);
      if (!group || !shape) continue;
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

