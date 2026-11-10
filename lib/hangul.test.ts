import { it, expect } from "vitest";
import { decompose, vowelType, slotKeys } from "./hangul";
it("decomposes both ends of modern Hangul and rare syllables", () => {
  expect(decompose("가")).toEqual({ cho: 0, jung: 0, jong: 0 });
  expect(decompose("힣")).toEqual({ cho: 18, jung: 20, jong: 27 });
  for (const ch of ["괶", "쥝", "휰"]) expect(decompose(ch)).not.toBeNull();
  for (const ch of ["", "AB", "ㄱ", "a"]) expect(decompose(ch)).toBeNull();
});
it("classifies all vowels and yields only populated slots", () => {
  expect(
    Array.from({ length: 21 }, (_, i) => vowelType(i)).filter((t) => t === "V"),
  ).toHaveLength(9);
  expect(vowelType(8)).toBe("H");
  expect(vowelType(9)).toBe("C");
  expect(slotKeys("가")).toHaveLength(2);
  expect(slotKeys("각")).toHaveLength(3);
  expect(slotKeys("A")).toEqual([]);
});
