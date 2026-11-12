import { it, expect } from "vitest";
import opentype from "opentype.js";
import { generateFont } from "./generate";
import { defaultPreparation } from "./types";
import { completeFixture } from "./fixtures";
import { newProject } from "../defaults";
import { parseProject } from "../storage";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { checksum } from "./cmap";

it("creates a parseable OTF with all 11,172 nonempty Hangul glyphs, space and valid metrics", () => {
  const project = completeFixture(),
    preparation = defaultPreparation("나의 손글씨");
  const original = JSON.stringify(project),
    result = generateFont({ project, preparation });
  const font = opentype.parse(result.buffer);
  expect(checksum(new Uint8Array(result.buffer))).toBe(0xb1b0afba);
  expect(new TextDecoder().decode(result.buffer.slice(0, 4))).toBe("OTTO");
  expect(font.unitsPerEm).toBe(1000);
  expect(font.glyphs.length).toBe(11175);
  expect(result.stats.direct).toBe(138);
  expect(result.stats.composed).toBe(11034);
  for (let code = 0xac00; code <= 0xd7a3; code++) {
    const glyph = font.charToGlyph(String.fromCharCode(code));
    expect(glyph.index).toBeGreaterThan(0);
    expect(glyph.path.commands.length).toBeGreaterThan(3);
  }
  expect(font.charToGlyph(" ").advanceWidth).toBe(353);
  expect(font.charToGlyph("가").advanceWidth).toBeLessThan(1000);
  expect(font.charToGlyph("가").leftSideBearing).toBe(
    font.charToGlyph("가").getBoundingBox().x1,
  );
  expect(font.names.fontFamily.ko).toBe("나의 손글씨");
  expect(JSON.stringify(project)).toBe(original);
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/font-fixture.json", JSON.stringify(project));
  writeFileSync(
    "artifacts/validation-full-hangul.otf",
    new Uint8Array(result.buffer),
  );
}, 120000);

it("exports normalized glyphs with exact tracking increments and custom baseline", () => {
  const fixture = completeFixture(),
    project = newProject();
  project.samples["겨"] = fixture.samples["겨"];
  const preparation = defaultPreparation("My Hand");
  preparation.settings.includeComposed = false;
  preparation.settings.letterSpacing = 60;
  preparation.settings.baseline = 850;
  const result = generateFont({ project, preparation }),
    font = opentype.parse(result.buffer);
  expect(font.glyphs.length).toBe(4);
  expect(result.stats.composed).toBe(0);
  const basePrep = defaultPreparation("My Hand");
  basePrep.settings.baseline = 850;
  const baseFont = opentype.parse(
    generateFont({ project, preparation: basePrep }).buffer,
  );
  expect(
    font.charToGlyph("겨").advanceWidth! -
      baseFont.charToGlyph("겨").advanceWidth!,
  ).toBe(60);
  expect(font.charToGlyph("힣").index).toBe(0);
  expect(font.names.fontFamily.en).toBe("My Hand");
});
it("old backups get automatic body fitting and new output size settings round-trip safely", () => {
  const project = completeFixture();
  project.fontPreparation = defaultPreparation(project.name);
  project.fontPreparation.settings.bodySize = 900;
  expect(
    parseProject(JSON.stringify(project)).fontPreparation?.settings.bodySize,
  ).toBe(900);
  project.fontPreparation.settings.bodySize = 1200;
  project.fontPreparation.settings.letterSpacing = -250;
  expect(
    parseProject(JSON.stringify(project)).fontPreparation?.settings,
  ).toMatchObject({ bodySize: 1200, letterSpacing: -250 });
  project.fontPreparation.settings.bodySize = 1300;
  expect(() => parseProject(JSON.stringify(project))).toThrow("폰트 제작 설정");
  delete project.fontPreparation.settings.bodySize;
  expect(
    parseProject(JSON.stringify(project)).fontPreparation?.settings.bodySize,
  ).toBeUndefined();
});

it("preserves font preparation in JSON and accepts older backups while rejecting invalid boxes", () => {
  const project = completeFixture();
  project.fontPreparation = defaultPreparation(project.name);
  project.fontPreparation.separations["겨"] = {
    assignments: { "겨-cho": "jung" },
    boxes: { cho: { x: 80, y: 80, width: 400, height: 800 } },
  };
  expect(parseProject(JSON.stringify(project)).fontPreparation).toEqual(
    project.fontPreparation,
  );
  project.fontPreparation.separations["겨"].boxes!.cho!.width = 0;
  expect(() => parseProject(JSON.stringify(project))).toThrow("폰트 제작 설정");
  expect(
    parseProject(JSON.stringify(newProject())).fontPreparation,
  ).toBeUndefined();
});

it("rejects empty projects and invalid metrics without generating a misleading file", () => {
  const project = newProject(),
    preparation = defaultPreparation("Test");
  expect(() => generateFont({ project, preparation })).toThrow("한 글자");
  preparation.settings.baseline = Infinity;
  expect(() => generateFont({ project, preparation })).toThrow("메트릭");
});
it("exports English descenders below the Hangul safety boundary without clipping the font descent", () => {
  const project = newProject();
  project.samples.g = {
    char: "g",
    category: "latin-lower",
    status: "done",
    updatedAt: 1,
    strokes: [
      {
        id: "tail",
        brush: "marker",
        params: { size: 40, usePressure: false },
        order: 0,
        createdAt: 1,
        points: [
          { x: 400, y: 930, p: 0.5, t: 0 },
          { x: 430, y: 970, p: 0.5, t: 10 },
        ],
      },
    ],
  };
  const preparation = defaultPreparation("Descender Test"),
    result = generateFont({ project, preparation }),
    font = opentype.parse(result.buffer);
  expect(font.charToGlyph("g").getBoundingBox().y1).toBeLessThan(-160);
  expect(font.descender).toBeLessThanOrEqual(-200);
});

it("exports separate readable Korean and English names with a matching PostScript name", () => {
  const project = newProject();
  project.samples["겨"] = completeFixture().samples["겨"];
  const preparation = defaultPreparation("나의 손글씨");
  preparation.settings.englishFamilyName = "Osense Hand";
  project.fontPreparation = preparation;
  const restored = parseProject(JSON.stringify(project));
  const font = opentype.parse(
    generateFont({ project: restored, preparation: restored.fontPreparation! })
      .buffer,
  );
  expect(font.names.fontFamily).toMatchObject({
    en: "Osense Hand",
    ko: "나의 손글씨",
  });
  expect(font.names.fullName.en).toBe("Osense Hand");
  expect(font.names.postScriptName.en).toBe("OsenseHand-Regular");
});

it("maps written premium characters in the full font and excludes them from the basic font", () => {
  const project = newProject();
  const sample = completeFixture().samples["겨"];
  project.samples["겨"] = sample;
  project.samples["①"] = { ...sample, char: "①", category: "special-symbol" };
  project.samples["⑪"] = { ...sample, char: "⑪", category: "special-symbol" };
  const preparation = defaultPreparation("Special Symbols");
  const full = generateFont({ project, preparation });
  const basic = generateFont({ project, preparation, includePremium: false });
  expect(opentype.parse(full.buffer).charToGlyphIndex("①")).toBeGreaterThan(0);
  expect(opentype.parse(basic.buffer).charToGlyphIndex("①")).toBe(0);
  expect(full.stats.characters).not.toContain("⑪");
  expect(parseProject(JSON.stringify(project)).samples["⑪"]).toEqual(
    project.samples["⑪"],
  );
  expect(basic.stats.characters).toContain("겨");
  expect(parseProject(JSON.stringify(project)).samples["①"].category).toBe(
    "special-symbol",
  );
});

it("fills unwritten characters from the reference fonts without touching written ones", () => {
  const project = newProject();
  project.samples["겨"] = completeFixture().samples["겨"];
  const preparation = defaultPreparation("Fallback");
  const load = (file: string) => () =>
    opentype.parse(
      Uint8Array.from(readFileSync("public/fonts/" + file)).buffer,
    );
  const sources = [
    { name: "검은고딕", load: load("BlackHanSans-Regular.ttf") },
    { name: "특수기호 보조", load: load("SpecialSymbolsFallback.ttf") },
    { name: "Noto Sans KR", load: load("NotoSansKR.ttf") },
  ];
  const plain = generateFont({ project, preparation });
  const filled = generateFont({ project, preparation }, () => {}, sources);
  const a = opentype.parse(plain.buffer),
    b = opentype.parse(filled.buffer);
  expect(a.charToGlyphIndex("A")).toBe(0);
  for (const char of ["A", "가", "!", "①"])
    expect(b.charToGlyphIndex(char)).toBeGreaterThan(0);
  expect(filled.stats.fallback).toBeGreaterThan(2000);
  expect(filled.stats.direct).toBe(1);
  expect(b.charToGlyph("겨").path.toPathData(0)).toBe(
    a.charToGlyph("겨").path.toPathData(0),
  );
  // Filled Hangul sits on the same body as the handwriting.
  const written = a.charToGlyph("겨").getBoundingBox();
  const borrowed = b.charToGlyph("가").getBoundingBox();
  expect(
    Math.abs((borrowed.y1 + borrowed.y2) / 2 - (written.y1 + written.y2) / 2),
  ).toBeLessThan(60);
}, 120000);
