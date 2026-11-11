import { it, expect } from "vitest";
import { HANGUL } from "../../data/charset";
import { defaultSettings } from "../defaults";
import { REFERENCE_FONTS } from "../reference-fonts";
import {
  referenceGuide,
  referencePart,
  referenceUsesFallback,
} from "./reference";
import { decompose } from "../hangul";
import type { Stroke } from "../types";
it("provides glyph- and font-specific ink-derived guides for all writing samples", () => {
  for (const font of REFERENCE_FONTS)
    for (const char of HANGUL) {
      const guide = referenceGuide(char, {
        ...defaultSettings(),
        referenceFont: font.id,
      })!;
      expect(guide).not.toBeNull();
      expect(Object.keys(guide.boxes)).toHaveLength(
        decompose(char)!.jong ? 3 : 2,
      );
      expect(guide.pixels.length).toBe(guide.resolution ** 2);
      expect(
        [...guide.pixels].every(
          (label) => label >= 1 && label <= (decompose(char)!.jong ? 3 : 2),
        ),
      ).toBe(true);
      for (const b of Object.values(guide.boxes)) {
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
      }
    }
  expect(referenceGuide("겨", defaultSettings())?.boxes).not.toEqual(
    referenceGuide("너", defaultSettings())?.boxes,
  );
  expect(referenceGuide("겨", defaultSettings())?.boxes).not.toEqual(
    referenceGuide("겨", { ...defaultSettings(), referenceFont: "hand" })
      ?.boxes,
  );
});
it("uses the same input-frame fit and lets actual ink regions assign a stroke", () => {
  const settings = defaultSettings(),
    guide = referenceGuide("갛", settings)!;
  const index = guide.pixels.findIndex((label) => label === 3),
    x =
      guide.x +
      (((index % guide.resolution) - 1) / (guide.resolution - 3)) * guide.width,
    y =
      guide.y +
      ((Math.floor(index / guide.resolution) - 1) / (guide.resolution - 3)) *
        guide.height;
  const stroke: Stroke = {
    id: "test",
    points: [{ x, y, p: 0.5, t: 0 }],
    brush: "pen",
    params: { size: 30, usePressure: false },
    createdAt: 0,
    order: 0,
  };
  expect(referencePart("갛", stroke, settings)).toBe("jong");
  const square = referenceGuide("갛", {
    ...settings,
    grid: { ...settings.grid, diamond: false },
  })!;
  expect(square.width).toBeGreaterThan(guide.width);
  expect(square.width / square.height).toBeCloseTo(guide.width / guide.height);
});

it("keeps the fallback outline, dimensions and 판정 범위 in sync when a font lacks a glyph", () => {
  const settings = { ...defaultSettings(), referenceFont: "poster" as const };
  const char = [...HANGUL].find((value) =>
    referenceUsesFallback(value, "poster"),
  )!;
  expect(char).toBeTruthy();
  expect(referenceUsesFallback(char, "sans")).toBe(false);
  expect(referenceGuide(char, settings)?.ink.some(Boolean)).toBe(true);
  expect(referenceGuide(char, settings)?.boxes).not.toEqual(
    referenceGuide(char, defaultSettings())?.boxes,
  );
});
