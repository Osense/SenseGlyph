import { it, expect } from "vitest";
import { makeCmap, checksum } from "./cmap";

it("compacts all modern Hangul into one bounded format-4 segment and a full format-12 group", () => {
  const mappings = Array.from({ length: 11172 }, (_, i) => ({
    code: 0xac00 + i,
    index: i + 3,
  }));
  const bytes = makeCmap(mappings),
    data = new DataView(bytes.buffer);
  expect(bytes.length).toBeLessThan(200);
  expect(data.getUint16(2)).toBe(4);
  const format4 = data.getUint32(8),
    format12 = data.getUint32(16);
  expect(data.getUint16(format4)).toBe(4);
  expect(data.getUint16(format4 + 2)).toBe(32);
  expect(data.getUint16(format4 + 6)).toBe(4);
  expect(data.getUint16(format12)).toBe(12);
  expect(data.getUint32(format12 + 12)).toBe(1);
  expect(data.getUint32(format12 + 16)).toBe(0xac00);
  expect(data.getUint32(format12 + 20)).toBe(0xd7a3);
});

it("starts separate groups for code/glyph gaps and includes non-BMP mappings only in format 12", () => {
  const bytes = makeCmap([
    { code: 32, index: 1 },
    { code: 0xac00, index: 2 },
    { code: 0xac01, index: 7 },
    { code: 0x1f600, index: 8 },
  ]);
  const data = new DataView(bytes.buffer),
    format12 = data.getUint32(16);
  expect(data.getUint32(format12 + 12)).toBe(4);
  expect(checksum(new Uint8Array([1, 2, 3]))).toBe(0x01020300);
});
