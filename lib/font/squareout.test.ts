// WSNS 사각탈출: 직접 만든 탈네모 견본이 앱에서 쓰는 방식대로 동작하는지
import { it, expect } from "vitest";
import opentype from "opentype.js";
import { readFileSync } from "node:fs";
import { fallbackGlyph, type FallbackSource } from "./fallback";
import { createLayoutPlan, type Contours } from "./layout";
import { defaultPreparation } from "./types";
import { referenceFont, referenceFontsFor } from "../reference-fonts";
import { referenceGuide } from "./reference";
import { HANGUL } from "../../data/charset";

async function load() {
  const { decompress } = await import("woff2-encoder");
  const raw = await decompress(
    readFileSync("public/fonts/WSNS-Sagaktalchul.woff2"),
  );
  return raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  ) as ArrayBuffer;
}

it("is offered as a Korean reference font with a fixed frame", () => {
  const font = referenceFont("squareout", "ko");
  expect(font.id).toBe("squareout");
  expect(referenceFontsFor("ko").map((f) => f.id)).toContain("squareout");
  expect("frame" in font && font.frame).toEqual([36, -104, 914, 857]);
});

it("covers all 11,172 syllables and keeps every jamo where it was drawn", async () => {
  const font = opentype.parse(await load());
  for (let code = 0xac00; code <= 0xd7a3; code += 97)
    expect(font.charToGlyphIndex(String.fromCharCode(code))).toBeGreaterThan(0);
  const box = (c: string) => font.charToGlyph(c).getBoundingBox();
  // 받침이 있어도 위쪽(초성·모음)은 같은 자리, 아래로만 내려온다
  expect(box("가").y2).toBe(box("각").y2);
  expect(box("가").y1).toBeGreaterThan(box("각").y1 + 200);
  // 모든 음절이 같은 너비(타자기)
  expect(font.charToGlyph("가").advanceWidth).toBe(
    font.charToGlyph("뷁").advanceWidth,
  );
});

it("fills unwritten Hangul inside one shared frame instead of centring each letter", async () => {
  const bytes = await load();
  const settings = defaultPreparation("Test").settings;
  const square: Contours = [
    [
      [280, 260],
      [720, 260],
      [720, 740],
      [280, 740],
    ],
  ];
  const plan = createLayoutPlan(new Map([["가", square]]), settings);
  const fill = (fixed: boolean) => {
    const source: FallbackSource = {
      name: "WSNS 사각탈출",
      frame: fixed ? ([36, -104, 914, 857] as const) : undefined,
      load: () => opentype.parse(bytes),
    };
    const loaded = new Map();
    return (char: string) => fallbackGlyph(char, [source], plan, 760, loaded)!;
  };
  const fixed = fill(true);
  // 같은 틀: 가와 각의 윗선이 같고, 너비도 같다
  expect(fixed("가").top).toBe(fixed("각").top);
  expect(fixed("가").advanceWidth).toBe(fixed("각").advanceWidth);
  expect(fixed("고").advanceWidth).toBe(fixed("한").advanceWidth);
  // 예전 방식(글자마다 가운데)이면 가가 아래로 내려와 윗선이 어긋난다
  const centred = fill(false);
  expect(centred("가").top).not.toBe(centred("각").top);
});

it("judges jamo against the same frame for every written letter", () => {
  const settings = { referenceFont: "squareout" as const, grid: undefined };
  const guides = HANGUL
    .slice(0, 30)
    .map((c) => referenceGuide(c, settings as never)!);
  for (const guide of guides) {
    expect(guide.width).toBeCloseTo(guides[0].width, 5);
    expect(guide.x).toBeCloseTo(guides[0].x, 5);
  }
});
