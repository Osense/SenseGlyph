import { zipSync } from "fflate";
import { compress } from "woff2-encoder";
import { writeWoff } from "./sfnt-writer";
import { nameOutputFont, type OutputNames } from "./output-names";

export type ExportFormat = "ttf" | "otf" | "woff" | "woff2" | "zip";
export type ConversionRequest = {
  /** 폰트 만들기에서 함께 나온 TrueType·OpenType 원본 */
  ttf: ArrayBuffer;
  otf: ArrayBuffer;
  format: ExportFormat;
  names?: OutputNames;
  filename: string;
};
export type ConversionReply = { buffer: ArrayBuffer } | { error: string };

/** TTF·OTF 는 이미 만들어져 있어 이름만 바꾸고, 웹 폰트는 TTF 를 감싸 만든다. */
export async function convertFont({
  ttf,
  otf,
  format,
  filename,
  names,
}: ConversionRequest) {
  if (names) {
    ttf = nameOutputFont(ttf, names);
    otf = nameOutputFont(otf, names);
  }
  if (format === "ttf") return ttf;
  if (format === "otf") return otf;
  if (format === "woff") return writeWoff(ttf);
  let woff2 = await compress(new Uint8Array(ttf));
  // WOFF2 해독기는 압축률이 100배를 넘으면 받지 않는다(같은 모양이 아주 많은 폰트).
  // 그럴 때는 압축이 덜 되는 OTF 로 다시 만든다.
  if (ttf.byteLength / woff2.length > 90)
    woff2 = await compress(new Uint8Array(otf));
  if (
    woff2.length < 48 ||
    new DataView(woff2.buffer, woff2.byteOffset).getUint32(0) !== 0x774f4632
  )
    throw new Error("WOFF2 폰트를 만들지 못했습니다.");
  if (format === "woff2") return Uint8Array.from(woff2).buffer;
  return Uint8Array.from(
    zipSync(
      {
        [filename + ".ttf"]: [new Uint8Array(ttf), { level: 6 }],
        [filename + ".otf"]: [new Uint8Array(otf), { level: 6 }],
        [filename + ".woff"]: new Uint8Array(writeWoff(ttf)),
        [filename + ".woff2"]: woff2,
      },
      { level: 0 },
    ),
  ).buffer;
}
