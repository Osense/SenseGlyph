import { expect, it } from "vitest";
import { characterGuide } from "./character-guide";
import { CATEGORIES, SPECIAL_SYMBOLS } from "../data/charset";

it("names every special symbol and jamo with how it is used", () => {
  for (const char of SPECIAL_SYMBOLS) {
    const guide = characterGuide(char, "special-symbol");
    expect(guide, char).not.toMatch(/^특수 기호예요/);
    expect(guide.length, char).toBeGreaterThan(15);
  }
  const jamo = CATEGORIES.find((c) => c.id === "hangul-jamo")!.chars;
  for (const char of jamo)
    expect(characterGuide(char, "hangul-jamo"), char).toMatch(/\(.+\)/);
  expect(characterGuide("ㄱ", "hangul-jamo")).toContain("기역");
  expect(characterGuide("ㅢ", "hangul-jamo")).toContain("(의)");
  expect(characterGuide("Ⅳ", "special-symbol")).toContain("로마 숫자 4");
});
