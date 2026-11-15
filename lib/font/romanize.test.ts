import { expect, it } from "vitest";
import { romanizeName } from "./romanize";

it("romanizes Korean names syllable by syllable", () => {
  expect(romanizeName("나의손글씨")).toBe("Nauisongeulssi");
  expect(romanizeName("쎈스")).toBe("Ssenseu");
  expect(romanizeName("오현체2")).toBe("Ohyeonche2");
});

it("romanizes kana and skips kanji", () => {
  expect(romanizeName("わたしの字", "ja")).toBe("Watashino");
  expect(romanizeName("きょうのノート", "ja")).toBe("Kyounonoto");
  expect(romanizeName("ちょっと", "ja")).toBe("Chotto");
  expect(romanizeName("漢字", "ja")).toBe("MyHandwriting");
});
