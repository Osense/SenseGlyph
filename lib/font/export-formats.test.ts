import opentype from "opentype.js";
import { unzipSync } from "fflate";
import { decompress } from "woff2-encoder";
import { expect, it } from "vitest";
import { convertFont } from "./export-formats";
import { completeFixture } from "./fixtures";
import { generateFont } from "./generate";
import { defaultPreparation } from "./types";

it("exports four valid fonts with the original names and Hangul coverage", async () => {
  const project = completeFixture();
  const preparation = defaultPreparation("나의 글씨");
  preparation.settings.englishFamilyName = "My Handwriting";
  const original = generateFont({ project, preparation });
  const zip = await convertFont({
    buffer: original.buffer,
    format: "zip",
    filename: "나의 글씨",
  });
  const files = unzipSync(new Uint8Array(zip));
  expect(Object.keys(files)).toEqual(
    ["ttf", "otf", "woff", "woff2"].map((ext) => "나의 글씨." + ext),
  );
  expect(files["나의 글씨.otf"]).toEqual(new Uint8Array(original.buffer));
  for (const [ext, signature] of [
    ["ttf", 0x00010000],
    ["otf", 0x4f54544f],
    ["woff", 0x774f4646],
    ["woff2", 0x774f4632],
  ] as const) {
    const bytes = files["나의 글씨." + ext];
    expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(0)).toBe(
      signature,
    );
    const sfnt = ext === "woff2" ? await decompress(bytes) : bytes;
    const font = opentype.parse(Uint8Array.from(sfnt).buffer);
    expect(font.names.fontFamily).toMatchObject({
      en: "My Handwriting",
      ko: "나의 글씨",
    });
    expect(font.glyphs.length).toBe(original.stats.glyphs);
    expect(font.charToGlyphIndex("가")).toBeGreaterThan(0);
    expect(font.charToGlyphIndex("힣")).toBeGreaterThan(0);
    expect(font.charToGlyph("한").path.commands.length).toBeGreaterThan(0);
  }
}, 60_000);
