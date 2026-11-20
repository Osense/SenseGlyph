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
  expect(KANJI_BASIC).toHaveLength(24);
  expect(KANJI_BASIC[0]).toBe("永");
  expect(charsetFor("ja").filter((e) => e.category === "kanji")).toHaveLength(
    1026,
  );
  expect(basicCharsetFor("ja").some((e) => e.char === "永")).toBe(true);
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
  expect(font.names.fontFamily.ja).toBe("WSNS わたしの字");
  expect(font.names.fontFamily.en).toBe("WSNS MyHand");
  expect(() =>
    nameOutputFont(result.ttf, {
      korean: "나의손글씨",
      english: "MyHand",
      script: "ja",
    }),
  ).toThrow();
}, 60_000);

it("puts the inferred handwriting rules on unwritten kanji", async () => {
  const { decompress } = await import("woff2-encoder");
  const { readFileSync } = await import("node:fs");
  const raw = await decompress(
    readFileSync("public/fonts/KleeOne-Regular.woff2"),
  );
  const bytes = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  ) as ArrayBuffer;
  const source = { name: "Klee One", load: () => opentype.parse(bytes) };
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    size: number,
  ): Stroke => ({
    id: `${x0}-${y0}-${x1}`,
    order: 0,
    createdAt: 1,
    brush: "pen",
    params: { size, usePressure: false },
    points: [
      { x: x0, y: y0, p: 0.5, t: 0 },
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2, p: 0.5, t: 1 },
      { x: x1, y: y1, p: 0.5, t: 2 },
    ],
  });
  const glyphs: Record<string, [number, number, number, number][]> = {
    一: [[150, 500, 850, 500]],
    二: [
      [250, 330, 750, 330],
      [150, 680, 850, 680],
    ],
    三: [
      [250, 250, 750, 250],
      [300, 500, 700, 500],
      [150, 760, 850, 760],
    ],
    十: [
      [150, 430, 850, 430],
      [500, 130, 500, 870],
    ],
    口: [
      [250, 250, 250, 780],
      [250, 250, 750, 250],
      [750, 250, 750, 780],
      [250, 760, 750, 760],
    ],
  };
  const project = newProject();
  project.settings.script = "ja";
  for (const [char, lines] of Object.entries(glyphs))
    project.samples[char] = {
      char,
      category: "kanji",
      strokes: lines.map(([a, b, c, d]) => line(a, b, c, d, 110)),
      status: "done",
      updatedAt: 1,
    };
  const build = (fallbacks: (typeof source)[]) =>
    generateFont(
      { project, preparation: defaultPreparation("わたしの字") },
      () => {},
      fallbacks,
    );
  const result = build([source]);
  expect(result.stats.style?.samples).toBeGreaterThanOrEqual(3);
  expect(result.stats.style!.weight).toBeGreaterThan(1.05);
  const styled = opentype.parse(result.ttf).charToGlyph("曜");
  expect(styled.path.commands.length).toBeGreaterThan(10);
  expect(result.stats.characters).toContain("曜");
}, 120_000);
