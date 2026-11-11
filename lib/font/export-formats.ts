import fonteditor, { Font } from "fonteditor-core";
import { zipSync, zlibSync } from "fflate";
import { compress } from "woff2-encoder";
import { replaceSfntTables, sfntTable } from "./cmap";

import { nameOutputFont, type OutputNames } from "./output-names";

export type ExportFormat = "ttf" | "otf" | "woff" | "woff2" | "zip";
export type ConversionRequest = {
  buffer: ArrayBuffer;
  format: ExportFormat;
  names?: OutputNames;
  filename: string;
};
export type ConversionReply = { buffer: ArrayBuffer } | { error: string };

export async function convertFont({
  buffer,
  format,
  filename,
  names,
}: ConversionRequest) {
  if (names) buffer = nameOutputFont(buffer, names);
  if (format === "otf") return buffer;
  const converted = Font.create(buffer, { type: "otf" }).write({
    type: "ttf",
    toBuffer: false,
  }) as ArrayBuffer;
  const originalMetrics = sfntTable(buffer, "OS/2");
  const convertedMetrics = sfntTable(converted, "OS/2");
  // The converter overwrites Unicode coverage. Keep both language ranges
  // alongside the original cmap while preserving the converted glyph metrics.
  convertedMetrics.set(originalMetrics.subarray(42, 58), 42);
  convertedMetrics.set(originalMetrics.subarray(78, 86), 78);
  // Preserve the original Unicode mapping and both Korean and English names.
  const ttf = replaceSfntTables(converted, {
    cmap: sfntTable(buffer, "cmap"),
    name: sfntTable(buffer, "name"),
    "OS/2": convertedMetrics,
  });
  if (format === "ttf") return ttf;
  const makeWoff = () =>
    fonteditor.ttf2woff(ttf, {
      metadata: null,
      deflate: (data) => Array.from(zlibSync(Uint8Array.from(data))),
    });
  if (format === "woff") return makeWoff();
  const woff2 = await compress(buffer);
  if (
    woff2.length < 48 ||
    new DataView(woff2.buffer, woff2.byteOffset).getUint32(0) !== 0x774f4632
  )
    throw new Error("WOFF2 폰트를 만들지 못했습니다.");
  if (format === "woff2") return Uint8Array.from(woff2).buffer;
  const woff = makeWoff();
  return Uint8Array.from(
    zipSync(
      {
        [filename + ".ttf"]: [new Uint8Array(ttf), { level: 6 }],
        [filename + ".otf"]: [new Uint8Array(buffer), { level: 6 }],
        [filename + ".woff"]: new Uint8Array(woff),
        [filename + ".woff2"]: woff2,
      },
      { level: 0 },
    ),
  ).buffer;
}
