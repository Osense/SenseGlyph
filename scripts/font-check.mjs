import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const font = await readFile("public/fonts/NotoSansKR.ttf");
let cmap = 0;
for (let i = 0; i < font.readUInt16BE(4); i++) {
  const o = 12 + i * 16;
  if (font.toString("ascii", o, o + 4) === "cmap")
    cmap = font.readUInt32BE(o + 8);
}
assert.ok(cmap, "cmap table");
let table = 0;
for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
  const o = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
  if (font.readUInt16BE(o) === 12) table = o;
}
assert.ok(table, "Unicode format 12 cmap");
const ranges = [];
for (let i = 0; i < font.readUInt32BE(table + 12); i++) {
  const o = table + 16 + i * 12;
  ranges.push([
    font.readUInt32BE(o),
    font.readUInt32BE(o + 4),
    font.readUInt32BE(o + 8),
  ]);
}
const missing = [];
for (let c = 0xac00; c <= 0xd7a3; c++)
  if (!ranges.some((r) => c >= r[0] && c <= r[1] && r[2] + c - r[0] > 0))
    missing.push(c);
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/font-coverage.json",
  JSON.stringify(
    {
      font: "NotoSansKR.ttf",
      modernHangul: 11172,
      covered: 11172 - missing.length,
      missing,
    },
    null,
    2,
  ),
);
assert.equal(missing.length, 0);
console.log("PASS local font covers all 11,172 modern Hangul syllables");
