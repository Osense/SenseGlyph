import { replaceSfntTables, sfntTable } from "./cmap";
import { isEnglishFontName } from "./names";

export interface OutputNames {
  /** 현지 이름(한글 폰트면 한국어, 일본어 폰트면 일본어) */
  korean: string;
  english: string;
  script?: "ko" | "ja";
}
const JAPANESE = /[\u3040-\u30ff\u4e00-\u9fff]/;
export const isLocalOutputName = (name: string, script: "ko" | "ja" = "ko") =>
  script === "ja"
    ? JAPANESE.test(name) &&
      !/\s/.test(name) &&
      !/[<>:"/\\|?*\x00-\x1f]/.test(name) &&
      !name.endsWith(".")
    : isKoreanOutputName(name);

/** 쎈스 글리프로 만든 폰트 표시. 파일 이름과 폰트 이름 앞에 붙는다. */
export const OUTPUT_PREFIX = "WSNS ";
export const isKoreanOutputName = (name: string) =>
  /[가-힣]/.test(name) &&
  !/\s/.test(name) &&
  !/[<>:"/\\|?*\x00-\x1f]/.test(name) &&
  !name.endsWith(".");

export const isEnglishOutputName = (name: string) =>
  isEnglishFontName(name) && !/\s/.test(name);

/** 굵기 3종(가는·보통·굵은) 묶음에서 쓰는 굵기 이름 */
export type FontStyleName = "Light" | "Regular" | "Bold";
const STYLE = {
  Light: { weight: 300, bold: false },
  Regular: { weight: 400, bold: false },
  Bold: { weight: 700, bold: true },
} as const;

export function nameOutputFont(
  buffer: ArrayBuffer,
  names: OutputNames,
  style: FontStyleName = "Regular",
) {
  const korean = names.korean.trim().normalize("NFC");
  const english = names.english.trim();
  if (
    korean.length > 60 ||
    english.length > 60 ||
    !isLocalOutputName(korean, names.script) ||
    !isEnglishOutputName(english)
  )
    throw new Error("폰트 이름(현지어·영문)을 확인해 주세요.");

  const family = {
    korean: OUTPUT_PREFIX + korean,
    english: OUTPUT_PREFIX + english,
  };
  const postScript =
    family.english.replace(/[^a-zA-Z0-9]/g, "").slice(0, 55) + "-" + style;
  // 같은 가족 안에서 굵기만 다르게: Bold 는 기본 굵게(스타일 이름 Bold),
  // Light 는 따로 고르는 굵기라 패밀리 이름에 Light 를 붙이고 큰 가족(16·17번 이름)으로 묶는다.
  const legacyFamily = (name: string) =>
    style === "Light" ? name + " Light" : name;
  const subfamily = style === "Bold" ? "Bold" : "Regular";
  const fullName = (name: string) =>
    style === "Regular" ? name : name + " " + style;
  const original = sfntTable(buffer, "name");
  const table = new DataView(
    original.buffer,
    original.byteOffset,
    original.byteLength,
  );
  const count = table.getUint16(2);
  const storage = table.getUint16(4);
  const renamed = new Set([1, 2, 3, 4, 6, 16, 17, 18, 21]);
  const records: {
    platform: number;
    encoding: number;
    language: number;
    id: number;
    bytes: Uint8Array;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 12;
    const id = table.getUint16(offset + 6);
    const language = table.getUint16(offset + 4);
    if (renamed.has(id) || language >= 0x8000) continue;
    const start = storage + table.getUint16(offset + 10);
    records.push({
      platform: table.getUint16(offset),
      encoding: table.getUint16(offset + 2),
      language,
      id,
      bytes: original.subarray(start, start + table.getUint16(offset + 8)),
    });
  }
  for (const [language, name] of [
    [0x0409, family.english],
    [names.script === "ja" ? 0x0411 : 0x0412, family.korean],
  ] as const) {
    for (const [id, value] of [
      [1, legacyFamily(name)],
      [2, subfamily],
      [3, postScript],
      [4, fullName(name)],
      [6, postScript],
      ...(style === "Regular"
        ? []
        : ([
            [16, name],
            [17, style],
          ] as const)),
    ] as const) {
      const bytes = new Uint8Array(value.length * 2);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < value.length; i++)
        view.setUint16(i * 2, value.charCodeAt(i));
      records.push({ platform: 3, encoding: 1, language, id, bytes });
    }
  }
  records.sort(
    (a, b) =>
      a.platform - b.platform ||
      a.encoding - b.encoding ||
      a.language - b.language ||
      a.id - b.id,
  );
  const header = 6 + records.length * 12;
  const bytes = new Uint8Array(
    header + records.reduce((size, record) => size + record.bytes.length, 0),
  );
  const view = new DataView(bytes.buffer);
  view.setUint16(2, records.length);
  view.setUint16(4, header);
  let offset = 0;
  for (const [index, record] of records.entries()) {
    const fields = [
      record.platform,
      record.encoding,
      record.language,
      record.id,
      record.bytes.length,
      offset,
    ];
    fields.forEach((value, field) =>
      view.setUint16(6 + index * 12 + field * 2, value),
    );
    bytes.set(record.bytes, header + offset);
    offset += record.bytes.length;
  }
  const tables: Record<string, Uint8Array> = { name: bytes };
  if (style !== "Regular") {
    // OS/2 굵기 값과 굵게 표시, head 의 굵게 표시를 굵기에 맞춘다.
    const os2 = sfntTable(buffer, "OS/2").slice();
    const ov = new DataView(os2.buffer);
    ov.setUint16(4, STYLE[style].weight);
    let selection = ov.getUint16(62) & ~(0x01 | 0x20 | 0x40);
    selection |= STYLE[style].bold ? 0x20 : 0x40;
    ov.setUint16(62, selection);
    tables["OS/2"] = os2;
    const head = sfntTable(buffer, "head").slice();
    const hv = new DataView(head.buffer);
    hv.setUint16(44, (hv.getUint16(44) & ~1) | (STYLE[style].bold ? 1 : 0));
    tables.head = head;
  }
  return replaceSfntTables(buffer, tables);
}
