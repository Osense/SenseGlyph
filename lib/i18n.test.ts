import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { EN, JA } from "./i18n-messages";
import { translate } from "./i18n";

const sources = ["app", "app/privacy", "components", "lib"].flatMap((dir) =>
  readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
    .map((f) => readFileSync(join(dir, f), "utf8")),
);

it("translates every literal UI string into Japanese and English", () => {
  const keys = new Set<string>();
  for (const source of sources)
    for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      const key = JSON.parse('"' + match[1] + '"') as string;
      if (/[가-힣]/.test(key) && !/^[가-힣]$/.test(key)) keys.add(key);
    }
  expect(keys.size).toBeGreaterThan(250);
  const missing = [...keys].filter((key) => !JA[key] || !EN[key]);
  expect(missing).toEqual([]);
});

it("fills placeholders", () => {
  expect(translate("ja", "{n}획", { n: 3 })).toBe("3画");
  expect(translate("en", "{n}획", { n: 3 })).toBe("3 strokes");
  expect(translate("ko", "{n}획", { n: 3 })).toBe("3획");
  expect(translate("en", "없는 문구")).toBe("없는 문구");
});
