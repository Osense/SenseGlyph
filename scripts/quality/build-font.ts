// 시험용 손글씨(JSON) → 앱과 같은 계산으로 폰트(TTF) 만들기
// node scripts/quality/run.mjs <손글씨.json> <출력.ttf> [정돈 강도 0~100]
import { readFileSync, writeFileSync } from "node:fs";
import { HANGUL } from "../../data/charset";
import { newProject } from "../../lib/defaults";
import { generateFont } from "../../lib/font/generate";
import { defaultPreparation } from "../../lib/font/types";
import type { Stroke } from "../../lib/types";
import type { Part } from "../../lib/font/types";

const [input, output, strength = "0"] = process.argv.slice(2);
const data = JSON.parse(readFileSync(input, "utf8")) as {
  samples: Record<string, { part: Part; points: number[][] }[]>;
};
// QUALITY_AUTO=1: 자모 나누기를 앱의 자동 판정에 맡긴다(사용자가 고치지 않은 경우).
// 기본: 정답 나누기를 확인된 나누기로 넣는다(사용자가 3단계에서 고친 경우).
const auto = process.env.QUALITY_AUTO === "1";
const truth: Record<string, Record<string, Part>> = {};
const project = newProject();
project.name = "quality";
// 견본 글꼴(sans·squareout 등). 글줄 맞춤 방식이 이것에 따라 정해진다.
if (process.env.QUALITY_REF)
  project.settings.referenceFont = process.env.QUALITY_REF as typeof project.settings.referenceFont;
let t = 0;
for (const char of HANGUL) {
  const lines = data.samples[char];
  if (!lines?.length) continue;
  truth[char] = {};
  const strokes: Stroke[] = lines.map((line, order) => {
    truth[char][`${char}-${order}`] = line.part;
    return {
      id: `${char}-${order}`,
      order,
      createdAt: ++t,
      brush: "pen",
      params: { size: 50, usePressure: true },
      points: line.points.map(([x, y], i) => ({ x, y, p: 0.5, t: t * 1000 + i * 8 })),
    };
  });
  project.samples[char] = {
    char,
    category: "hangul-syllable",
    strokes,
    updatedAt: t,
    status: "done",
  };
}
const preparation = defaultPreparation("quality");
preparation.settings.correction = Number(strength);
if (process.env.QUALITY_DETAIL)
  preparation.settings.correctionDetail = {
    layout: 0, straighten: 0, smooth: 0, size: 0, weight: 0, balance: 0,
    ...JSON.parse(process.env.QUALITY_DETAIL),
  };
if (!auto)
  for (const [char, assignments] of Object.entries(truth))
    preparation.separations[char] = { assignments };
const started = Date.now();
const font = generateFont({ project, preparation, includePremium: true });
writeFileSync(output, Buffer.from(font.ttf));
console.log(
  `${output}: 쓴 글자 ${font.stats.direct}, 조합 ${font.stats.composed}, ${((Date.now() - started) / 1000).toFixed(1)}초`,
);

// 진단용: 자모 나누기 결과를 JSON으로 (QUALITY_PARTS=경로)
if (process.env.QUALITY_PARTS) {
  const { prepareHandwriting } = await import("../../lib/font/composition");
  const hw = prepareHandwriting(project, preparation, false);
  // 자동 판정이 정답과 다른 글자 수
  if (auto) {
    let wrong = 0;
    const wrongChars: string[] = [];
    for (const [char, parts] of hw.parts) {
      const bad = parts.some((part) =>
        part.strokes.some((s) => truth[char]?.[s.id] !== part.part),
      );
      if (bad) {
        wrong++;
        wrongChars.push(char);
      }
    }
    console.log(`자동 나누기 오답: ${wrong}/${hw.parts.size} ${wrongChars.join("")}`);
  }
  const out: Record<string, Record<string, number[][][]>> = {};
  for (const [char, parts] of hw.parts) {
    out[char] = {};
    for (const part of parts)
      out[char][part.key] = part.strokes.map((s) => s.points.map((p) => [p.x, p.y]));
  }
  writeFileSync(process.env.QUALITY_PARTS, JSON.stringify(out));
}

// 진단용: 조합 글자의 획이 어느 쓴 글자에서 왔는지 (QUALITY_COMPOSE=글자들, QUALITY_COMPOSE_OUT=경로)
if (process.env.QUALITY_COMPOSE) {
  const { prepareHandwriting, composeGlyph } = await import("../../lib/font/composition");
  const hw = prepareHandwriting(project, preparation, Number(strength) > 0);
  const out: Record<string, { id: string; part: string; points: number[][] }[]> = {};
  for (const char of process.env.QUALITY_COMPOSE) {
    const strokes = composeGlyph(char, hw.library, hw.pools, 0) ?? [];
    out[char] = strokes.map((s) => ({
      id: s.id,
      part: truth[s.id.split("-")[0]]?.[s.id] ?? "?",
      points: s.points.map((p) => [p.x, p.y]),
    }));
  }
  writeFileSync(process.env.QUALITY_COMPOSE_OUT ?? "/tmp/compose.json", JSON.stringify(out));
}

