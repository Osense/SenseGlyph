import { expect, it } from "vitest";
import { jamoOutliers } from "./outliers";
import type { GlyphSample, Stroke } from "../types";

let n = 0;
const stroke = (pts: [number, number][]): Stroke => ({
  id: "s" + n++,
  order: n,
  createdAt: n,
  brush: "pen",
  params: { size: 50, usePressure: false },
  points: pts.map(([x, y], i) => ({ x, y, p: 0.5, t: i })),
});
const line = (a: [number, number], b: [number, number]) =>
  Array.from({ length: 12 }, (_, i): [number, number] => [
    a[0] + ((b[0] - a[0]) * i) / 11,
    a[1] + ((b[1] - a[1]) * i) / 11,
  ]);

// 세로 모음 글자: 초성 ㄱ(가로획+세로획) + 모음 ㅣ(기둥)
function sample(char: string, cho: Stroke[], jitter = 0): GlyphSample {
  const vowel = stroke(line([700 + jitter, 150], [700 + jitter, 850]));
  const strokes = [...cho, vowel];
  return {
    char,
    category: "hangul-syllable",
    status: "done",
    updatedAt: 1,
    strokes,
  } as GlyphSample;
}
const giyeok = (d: number) => [
  stroke([...line([150, 250 + d], [480, 250]), ...line([480, 250], [430, 650 + d])]),
];

it("flags the one letter whose jamo looks unlike the same jamo elsewhere", () => {
  const samples: Record<string, GlyphSample> = {
    가: sample("가", giyeok(0)),
    거: sample("거", giyeok(10), 10),
    기: sample("기", giyeok(-8), -6),
    // 겨의 ㄱ만 동그라미처럼 썼다
    겨: sample(
      "겨",
      [
        stroke(
          Array.from({ length: 24 }, (_, i): [number, number] => [
            320 + 160 * Math.cos((i / 23) * Math.PI * 2),
            450 + 160 * Math.sin((i / 23) * Math.PI * 2),
          ]),
        ),
      ],
      4,
    ),
  };
  const separations = Object.fromEntries(
    Object.values(samples).map((s) => [
      s.char,
      {
        assignments: Object.fromEntries(
          s.strokes.map((st, i) => [st.id, i === s.strokes.length - 1 ? "jung" : "cho"]),
        ),
      },
    ]),
  );
  const out = jamoOutliers(samples, separations as never);
  expect(Object.keys(out)).toEqual(["겨"]);
  expect(out["겨"]).toEqual(["ㄱ"]);
});
