import { it, expect } from "vitest";
import { HANGUL, CHARSET, CATEGORIES } from "./charset";
import { slotKeys } from "../lib/hangul";
it("preserves all 138 unique specified syllables", () => {
  expect(HANGUL).toHaveLength(138);
  expect(new Set(HANGUL).size).toBe(138);
  expect(HANGUL.slice(0, 10).join(" ")).toBe("겨 구 귀 갛 겪 곧 곬 괆 괬 괶");
  expect(HANGUL.slice(-7).join(" ")).toBe("해 호 홰 혨 홅 흖 휰");
});
it("covers all 237 positional slots", () => {
  const slots = new Set(HANGUL.flatMap(slotKeys));
  expect([...slots].filter((k) => k.startsWith("cho:"))).toHaveLength(114);
  expect([...slots].filter((k) => k.startsWith("jung:"))).toHaveLength(42);
  expect([...slots].filter((k) => k.startsWith("jong:"))).toHaveLength(81);
  expect(slots.size).toBe(237);
});
it("has 180 required and 465 unique characters including optional symbols", () => {
  expect(
    CATEGORIES.filter((c) => c.required).flatMap((c) => c.chars),
  ).toHaveLength(180);
  expect(CHARSET).toHaveLength(465);
  expect(new Set(CHARSET.map((c) => c.char)).size).toBe(465);
  expect(CATEGORIES[2].chars).toHaveLength(32);
});
