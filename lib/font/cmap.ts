// OpenType cmap formats 4/12 and sfnt checksums:
// https://learn.microsoft.com/en-us/typography/opentype/spec/cmap
// https://learn.microsoft.com/en-us/typography/opentype/spec/otff
export interface CharacterMapping {
  code: number;
  index: number;
}
interface Group {
  start: number;
  end: number;
  index: number;
}

function groupsFor(mapping: CharacterMapping[]): Group[] {
  const groups: Group[] = [];
  for (const entry of [...mapping].sort((a, b) => a.code - b.code)) {
    const previous = groups[groups.length - 1];
    if (
      previous &&
      entry.code === previous.end + 1 &&
      entry.index === previous.index + entry.code - previous.start
    )
      previous.end = entry.code;
    else
      groups.push({ start: entry.code, end: entry.code, index: entry.index });
  }
  return groups;
}

export function makeCmap(mapping: CharacterMapping[]): Uint8Array {
  const groups = groupsFor(mapping),
    bmp = groupsFor(mapping.filter((entry) => entry.code < 0xffff));
  const segments = bmp.length + 1,
    format4Length = 16 + segments * 8;
  if (format4Length > 65535) throw new Error("문자 매핑이 너무 복잡합니다.");
  const offset4 = 36,
    offset12 = offset4 + format4Length;
  const bytes = new Uint8Array(offset12 + 16 + groups.length * 12),
    data = new DataView(bytes.buffer);
  data.setUint16(2, 4);
  for (const [i, record] of [
    [0, [0, 3, offset4]],
    [1, [0, 4, offset12]],
    [2, [3, 1, offset4]],
    [3, [3, 10, offset12]],
  ] as [number, number[]][]) {
    const position = 4 + i * 8;
    data.setUint16(position, record[0]);
    data.setUint16(position + 2, record[1]);
    data.setUint32(position + 4, record[2]);
  }
  data.setUint16(offset4, 4);
  data.setUint16(offset4 + 2, format4Length);
  data.setUint16(offset4 + 6, segments * 2);
  const power = 2 ** Math.floor(Math.log2(segments));
  data.setUint16(offset4 + 8, power * 2);
  data.setUint16(offset4 + 10, Math.log2(power));
  data.setUint16(offset4 + 12, segments * 2 - power * 2);
  const all = [...bmp, { start: 0xffff, end: 0xffff, index: 0 }];
  for (let i = 0; i < segments; i++) {
    const group = all[i];
    data.setUint16(offset4 + 14 + i * 2, group.end);
    data.setUint16(offset4 + 16 + segments * 2 + i * 2, group.start);
    data.setUint16(
      offset4 + 16 + segments * 4 + i * 2,
      i === segments - 1 ? 1 : (group.index - group.start) & 0xffff,
    );
    // idRangeOffset is 0: every segment maps by a constant delta.
  }
  data.setUint16(offset12, 12);
  data.setUint32(offset12 + 4, 16 + groups.length * 12);
  data.setUint32(offset12 + 12, groups.length);
  groups.forEach((group, i) => {
    const offset = offset12 + 16 + i * 12;
    data.setUint32(offset, group.start);
    data.setUint32(offset + 4, group.end);
    data.setUint32(offset + 8, group.index);
  });
  return bytes;
}

export function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    const value =
      ((bytes[i] ?? 0) * 0x1000000 +
        (bytes[i + 1] ?? 0) * 0x10000 +
        (bytes[i + 2] ?? 0) * 0x100 +
        (bytes[i + 3] ?? 0)) >>>
      0;
    sum = (sum + value) >>> 0;
  }
  return sum;
}

export function replaceCmap(
  buffer: ArrayBuffer,
  mapping: CharacterMapping[],
): ArrayBuffer {
  const original = new DataView(buffer),
    count = original.getUint16(4);
  const tables = Array.from({ length: count }, (_, i) => {
    const position = 12 + i * 16,
      offset = original.getUint32(position + 8),
      length = original.getUint32(position + 12);
    const tag = String.fromCharCode(...new Uint8Array(buffer, position, 4));
    const bytes =
      tag === "cmap"
        ? makeCmap(mapping)
        : new Uint8Array(buffer.slice(offset, offset + length));
    if (tag === "head")
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
        8,
        0,
      );
    return { tag, bytes };
  });
  const align = (length: number) => (length + 3) & ~3;
  const size =
    12 +
    count * 16 +
    tables.reduce((sum, table) => sum + align(table.bytes.length), 0);
  const bytes = new Uint8Array(size),
    data = new DataView(bytes.buffer);
  bytes.set(new Uint8Array(buffer, 0, 12));
  let offset = 12 + count * 16,
    head = -1;
  tables.forEach((table, i) => {
    const position = 12 + i * 16;
    for (let c = 0; c < 4; c++) bytes[position + c] = table.tag.charCodeAt(c);
    data.setUint32(position + 4, checksum(table.bytes));
    data.setUint32(position + 8, offset);
    data.setUint32(position + 12, table.bytes.length);
    bytes.set(table.bytes, offset);
    if (table.tag === "head") head = offset;
    offset += align(table.bytes.length);
  });
  if (head < 0) throw new Error("폰트 헤더를 찾지 못했습니다.");
  data.setUint32(head + 8, (0xb1b0afba - checksum(bytes)) >>> 0);
  return bytes.buffer;
}
