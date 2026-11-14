import opentype from "opentype.js";
import { expect, it } from "vitest";
import { checksum } from "./cmap";
import { completeFixture } from "./fixtures";
import { generateFont } from "./generate";
import { writeFonts, writeWoff } from "./sfnt-writer";
import { defaultPreparation } from "./types";

it("writes matching TrueType and CFF fonts with valid checksums", () => {
  const result = generateFont({
    project: completeFixture(),
    preparation: defaultPreparation("나의 손글씨"),
  });
  for (const [buffer, tag] of [
    [result.ttf, 0x00010000],
    [result.otf, 0x4f54544f],
  ] as const) {
    expect(new DataView(buffer).getUint32(0)).toBe(tag);
    expect(checksum(new Uint8Array(buffer))).toBe(0xb1b0afba);
    const font = opentype.parse(buffer);
    expect(font.glyphs.length).toBe(result.stats.glyphs);
    const glyph = font.charToGlyph("한");
    expect(glyph.path.commands.length).toBeGreaterThan(3);
    expect(font.names.fontFamily.ko).toBe("나의 손글씨");
  }
  const a = opentype.parse(result.ttf).charToGlyph("겨").getBoundingBox(),
    b = opentype.parse(result.otf).charToGlyph("겨").getBoundingBox();
  expect([a.x1, a.y1, a.x2, a.y2]).toEqual([b.x1, b.y1, b.x2, b.y2]);
  const woff = writeWoff(result.ttf);
  expect(new DataView(woff).getUint32(0)).toBe(0x774f4646);
  expect(woff.byteLength).toBeLessThan(result.ttf.byteLength);
}, 60_000);

it("turns cubic curves into close quadratic ones for TrueType", () => {
  const { ttf, otf } = writeFonts(
    {
      familyEnglish: "Curve",
      familyKorean: "곡선",
      postScriptName: "Curve-Regular",
      uniqueID: "curve",
      version: "Version 1.500",
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    },
    [
      { name: ".notdef", advanceWidth: 500, contours: [] },
      {
        name: "uni004F",
        unicode: 0x4f,
        advanceWidth: 600,
        contours: [
          {
            x: 300,
            y: 0,
            segments: [
              [2, 466, 0, 600, 134, 600, 300],
              [2, 600, 466, 466, 600, 300, 600],
              [2, 134, 600, 0, 466, 0, 300],
              [2, 0, 134, 134, 0, 300, 0],
            ],
          },
        ],
      },
    ],
  );
  const area = (buffer: ArrayBuffer) => {
    const box = opentype.parse(buffer).charToGlyph("O").getBoundingBox();
    return [box.x1, box.y1, box.x2, box.y2].map(Math.round);
  };
  expect(area(ttf)).toEqual(area(otf));
});
