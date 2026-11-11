import { replaceSfntTables, sfntTable } from "./cmap";
import { isEnglishFontName } from "./names";

export interface OutputNames {
  korean: string;
  english: string;
}

export const OUTPUT_PREFIX = "OSNS ";
export const isKoreanOutputName = (name: string) =>
  /[가-힣]/.test(name) &&
  !/\s/.test(name) &&
  !/[<>:"/\\|?*\x00-\x1f]/.test(name) &&
  !name.endsWith(".");

export const isEnglishOutputName = (name: string) =>
  isEnglishFontName(name) && !/\s/.test(name);

export function nameOutputFont(buffer: ArrayBuffer, names: OutputNames) {
  const korean = names.korean.trim().normalize("NFC");
  const english = names.english.trim();
  if (
    korean.length > 60 ||
    english.length > 60 ||
    !isKoreanOutputName(korean) ||
    !isEnglishOutputName(english)
  )
    throw new Error("한글과 영문 폰트 이름을 확인해 주세요.");

  const family = {
    korean: OUTPUT_PREFIX + korean,
    english: OUTPUT_PREFIX + english,
  };
  const postScript =
    family.english.replace(/[^a-zA-Z0-9]/g, "").slice(0, 55) + "-Regular";
  const original = sfntTable(buffer, "name");
  const table = new DataView(
    original.buffer,
    original.byteOffset,
    original.byteLength,
  );
  const count = table.getUint16(2);
  const storage = table.getUint16(4);
  const renamed = new Set([1, 3, 4, 6, 16, 18, 21]);
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
    [0x0412, family.korean],
  ] as const) {
    for (const [id, value] of [
      [1, name],
      [3, postScript],
      [4, name],
      [6, postScript],
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
  return replaceSfntTables(buffer, { name: bytes });
}
