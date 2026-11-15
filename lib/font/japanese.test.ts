import opentype from "opentype.js";
import { expect, it } from "vitest";
import { charsetFor, basicCharsetFor, KANJI_BASIC } from "../../data/charset";
import { newProject } from "../defaults";
import { categoryForChar } from "../safety";
import type { FontProject, Stroke } from "../types";
import { generateFont } from "./generate";
import { nameOutputFont } from "./output-names";
import { defaultPreparation } from "./types";

/** 칸 안 (x0,y0)-(x1,y1) 상자를 긋는 시험용 획 */
const box = (x0: number, y0: number, x1: number, y1: number): Stroke => ({
  id: `${x0}-${y0}`,
  order: 0,
  createdAt: 1,
  brush: "pen",
  params: { size: 30, usePressure: false },
  points: [
    { x: x0, y: y0, p: 0.5, t: 0 },
    { x: x1, y: y0, p: 0.5, t: 1 },
    { x: x1, y: y1, p: 0.5, t: 2 },
    { x: x0, y: y1, p: 0.5, t: 3 },
  ],
});

function japaneseProject(): FontProject {
  const project = newProject();
  project.settings.script = "ja";
  const write = (char: string, strokes: Stroke[]) => {
    project.samples[char] = {
      char,
      category: charsetFor("ja").find((e) => e.char === char)!.category,
      strokes,
      status: "done",
      updatedAt: 1,
    };
  };
  // 한자: 칸 거의 전체, 가나: 조금 작게, 작은 가나: 왼쪽 아래, 、: 왼쪽 아래 점
  for (const char of ["一", "二", "三", "山"])
    write(char, [box(120, 120, 880, 880)]);
  write("あ", [box(160, 160, 840, 840)]);
  write("ゃ", [box(200, 450, 560, 820)]);
  write("、", [box(160, 760, 260, 860)]);
  write("!", [box(470, 230, 530, 800)]);
  return project;
}

it("has Japanese lists in the requested order", () => {
  const order = [...new Set(charsetFor("ja").map((e) => e.category))];
  expect(order.slice(0, 7)).toEqual([
    "hiragana",
    "katakana",
    "kanji",
    "digit",
    "latin-upper",
    "latin-lower",
    "ascii-symbol",
  ]);
  expect(KANJI_BASIC).toHaveLength(80);
  expect(charsetFor("ja").filter((e) => e.category === "kanji")).toHaveLength(
    1026,
  );
  expect(basicCharsetFor("ja").some((e) => e.char === "学")).toBe(true);
  expect(basicCharsetFor("ja").some((e) => e.char === "曜")).toBe(false);
  expect(categoryForChar("ゃ")).toBe("hiragana");
  expect(categoryForChar("国")).toBe("kanji");
});

it("builds a full-width Japanese font that keeps small kana and 、 in place", () => {
  const result = generateFont({
    project: japaneseProject(),
    preparation: defaultPreparation("わたしの字"),
  });
  const font = opentype.parse(result.ttf);
  const glyph = (c: string) => font.charToGlyph(c);
  const square = glyph("一").advanceWidth!;
  for (const c of ["あ", "ゃ", "、", "山"])
    expect(glyph(c).advanceWidth).toBe(square);
  const big = glyph("山").getBoundingBox(),
    small = glyph("ゃ").getBoundingBox(),
    comma = glyph("、").getBoundingBox();
  // 작은 가나는 작고, 아래쪽(기준선 쪽)에 있다
  expect(small.y2 - small.y1).toBeLessThan((big.y2 - big.y1) * 0.6);
  expect((small.y1 + small.y2) / 2).toBeLessThan((big.y1 + big.y2) / 2);
  // 、는 왼쪽 아래
  expect(comma.x2).toBeLessThan(square / 2);
  expect(comma.y2).toBeLessThan((big.y1 + big.y2) / 2);
  // 전각 ！는 반각 ! 손글씨로, 네모 칸 가운데에
  const wide = glyph("！");
  expect(wide.advanceWidth).toBe(square);
  const w = wide.getBoundingBox();
  expect(Math.abs((w.x1 + w.x2) / 2 - square / 2)).toBeLessThan(40);
  // 한글은 만들지 않는다
  expect(font.charToGlyphIndex("가")).toBe(0);
  expect(result.stats.characters).not.toContain("가");
}, 60_000);

it("names a Japanese font in Japanese", () => {
  const result = generateFont({
    project: japaneseProject(),
    preparation: defaultPreparation("わたしの字"),
  });
  const named = nameOutputFont(result.ttf, {
    korean: "わたしの字",
    english: "MyHand",
    script: "ja",
  });
  const font = opentype.parse(named);
  expect(font.names.fontFamily.ja).toBe("OSNS わたしの字");
  expect(font.names.fontFamily.en).toBe("OSNS MyHand");
  expect(() =>
    nameOutputFont(result.ttf, {
      korean: "나의손글씨",
      english: "MyHand",
      script: "ja",
    }),
  ).toThrow();
}, 60_000);
