// TrueType(glyf)·OpenType(CFF)·WOFF 파일을 직접 쓰는 가벼운 작성기.
// opentype.js 의 toArrayBuffer 는 1만 1천 자 폰트에서 전체 시간의 85%를 차지해
// (PC 9초, 태블릿 30초 이상) 필요한 표만 형식 문서대로 바로 씁니다.
// https://learn.microsoft.com/en-us/typography/opentype/spec/otff
// https://adobe-type-tools.github.io/font-tech-notes/pdfs/5176.CFF.pdf
// https://adobe-type-tools.github.io/font-tech-notes/pdfs/5177.Type2.pdf
// https://www.w3.org/TR/WOFF/
import { zlibSync } from "fflate";
import { checksum, makeCmap, type CharacterMapping } from "./cmap";

/** 윤곽 하나: 시작점과 이어지는 선분. y 는 위쪽이 + (폰트 단위). */
export type Segment =
  | [0, number, number] // 직선
  | [1, number, number, number, number] // 2차 곡선(조절점, 끝점)
  | [2, number, number, number, number, number, number]; // 3차 곡선
export interface Contour {
  x: number;
  y: number;
  segments: Segment[];
}
export interface OutlineGlyph {
  name: string;
  unicode?: number;
  advanceWidth: number;
  contours: Contour[];
}
export interface FontInfo {
  familyEnglish: string;
  familyKorean: string;
  postScriptName: string;
  uniqueID: string;
  version: string; // "Version 1.500"
  unitsPerEm: number;
  ascender: number;
  descender: number;
}

/* ---------- 바이트 쓰기 ---------- */
class Writer {
  bytes: Uint8Array;
  view: DataView;
  length = 0;
  constructor(size = 1024) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }
  private grow(extra: number) {
    if (this.length + extra <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number) {
    this.grow(1);
    this.bytes[this.length++] = v & 0xff;
  }
  u16(v: number) {
    this.grow(2);
    this.view.setUint16(this.length, v & 0xffff);
    this.length += 2;
  }
  i16(v: number) {
    this.grow(2);
    this.view.setInt16(this.length, v);
    this.length += 2;
  }
  u32(v: number) {
    this.grow(4);
    this.view.setUint32(this.length, v >>> 0);
    this.length += 4;
  }
  i32(v: number) {
    this.grow(4);
    this.view.setInt32(this.length, v);
    this.length += 4;
  }
  tag(t: string) {
    for (let i = 0; i < 4; i++) this.u8(t.charCodeAt(i));
  }
  raw(data: Uint8Array) {
    this.grow(data.length);
    this.bytes.set(data, this.length);
    this.length += data.length;
  }
  pad4() {
    while (this.length % 4) this.u8(0);
  }
  done() {
    return this.bytes.slice(0, this.length);
  }
}

/* ---------- 곡선 변환 ---------- */
/** 3차 곡선을 2차 곡선 여러 개로(TrueType 용). 오차가 1단위 안쪽이 되도록 나눈다. */
function cubicToQuads(
  x0: number,
  y0: number,
  s: [2, number, number, number, number, number, number],
): Segment[] {
  const [, x1, y1, x2, y2, x3, y3] = s;
  const size = Math.hypot(x3 - x0, y3 - y0) + Math.hypot(x1 - x0, y1 - y0);
  const parts = Math.min(8, Math.max(1, Math.ceil(size / 120)));
  const at = (t: number) => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ];
  };
  const d = (t: number) => {
    const u = 1 - t;
    return [
      3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2),
      3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2),
    ];
  };
  const out: Segment[] = [];
  for (let i = 0; i < parts; i++) {
    const t0 = i / parts,
      t1 = (i + 1) / parts;
    const [ax, ay] = at(t0),
      [bx, by] = at(t1);
    const [dax, day] = d(t0),
      [dbx, dby] = d(t1);
    // 두 끝점의 접선이 만나는 곳을 조절점으로. 평행하면 가운데 점.
    const det = dax * dby - day * dbx;
    let cx: number, cy: number;
    if (Math.abs(det) < 1e-6) {
      const [mx, my] = at((t0 + t1) / 2);
      cx = 2 * mx - (ax + bx) / 2;
      cy = 2 * my - (ay + by) / 2;
    } else {
      const k = ((bx - ax) * dby - (by - ay) * dbx) / det;
      cx = ax + dax * k;
      cy = ay + day * k;
      const [mx, my] = at((t0 + t1) / 2);
      const qx = 0.25 * ax + 0.5 * cx + 0.25 * bx,
        qy = 0.25 * ay + 0.5 * cy + 0.25 * by;
      if (Math.hypot(qx - mx, qy - my) > 4) {
        cx = 2 * mx - (ax + bx) / 2;
        cy = 2 * my - (ay + by) / 2;
      }
    }
    out.push([1, Math.round(cx), Math.round(cy), Math.round(bx), Math.round(by)]);
  }
  return out;
}

interface Box {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}
function glyphBox(glyph: OutlineGlyph): Box | null {
  let xMin = Infinity,
    yMin = Infinity,
    xMax = -Infinity,
    yMax = -Infinity;
  const add = (x: number, y: number) => {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  };
  for (const c of glyph.contours) {
    add(c.x, c.y);
    for (const s of c.segments)
      for (let i = 1; i < s.length; i += 2) add(s[i], s[i + 1]);
  }
  return xMin === Infinity ? null : { xMin, yMin, xMax, yMax };
}

/* ---------- glyf ---------- */
interface TrueTypeGlyph {
  bytes: Uint8Array;
  box: Box | null;
  points: number;
  contours: number;
}
function encodeGlyf(glyph: OutlineGlyph): TrueTypeGlyph {
  const xs: number[] = [],
    ys: number[] = [],
    on: boolean[] = [],
    ends: number[] = [];
  for (const contour of glyph.contours) {
    const start = xs.length;
    let px = contour.x,
      py = contour.y;
    xs.push(px);
    ys.push(py);
    on.push(true);
    for (const raw of contour.segments) {
      const parts =
        raw[0] === 2 ? cubicToQuads(px, py, raw) : ([raw] as Segment[]);
      for (const s of parts) {
        if (s[0] === 1) {
          xs.push(s[1]);
          ys.push(s[2]);
          on.push(false);
        }
        const ex = s[s.length - 2] as number,
          ey = s[s.length - 1] as number;
        xs.push(ex);
        ys.push(ey);
        on.push(true);
        px = ex;
        py = ey;
      }
    }
    // 닫는 점이 시작점과 같으면 뺀다.
    if (
      xs.length - start > 1 &&
      on[xs.length - 1] &&
      xs[xs.length - 1] === xs[start] &&
      ys[ys.length - 1] === ys[start]
    ) {
      xs.pop();
      ys.pop();
      on.pop();
    }
    if (xs.length - start < 2) {
      xs.length = ys.length = on.length = start;
      continue;
    }
    ends.push(xs.length - 1);
  }
  if (!ends.length) return { bytes: new Uint8Array(0), box: null, points: 0, contours: 0 };
  let xMin = Infinity,
    yMin = Infinity,
    xMax = -Infinity,
    yMax = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    xMin = Math.min(xMin, xs[i]);
    xMax = Math.max(xMax, xs[i]);
    yMin = Math.min(yMin, ys[i]);
    yMax = Math.max(yMax, ys[i]);
  }
  const w = new Writer(12 + ends.length * 2 + xs.length * 5);
  w.i16(ends.length);
  w.i16(xMin);
  w.i16(yMin);
  w.i16(xMax);
  w.i16(yMax);
  for (const e of ends) w.u16(e);
  w.u16(0); // instructionLength
  const flags: number[] = [],
    xBytes = new Writer(xs.length * 2),
    yBytes = new Writer(ys.length * 2);
  let lx = 0,
    ly = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - lx,
      dy = ys[i] - ly;
    lx = xs[i];
    ly = ys[i];
    let f = on[i] ? 1 : 0;
    if (dx === 0) f |= 0x10;
    else if (dx > -256 && dx < 256) {
      f |= 0x02 | (dx > 0 ? 0x10 : 0);
      xBytes.u8(Math.abs(dx));
    } else xBytes.i16(dx);
    if (dy === 0) f |= 0x20;
    else if (dy > -256 && dy < 256) {
      f |= 0x04 | (dy > 0 ? 0x20 : 0);
      yBytes.u8(Math.abs(dy));
    } else yBytes.i16(dy);
    flags.push(f);
  }
  for (let i = 0; i < flags.length; ) {
    let repeat = 0;
    while (
      i + repeat + 1 < flags.length &&
      flags[i + repeat + 1] === flags[i] &&
      repeat < 255
    )
      repeat++;
    if (repeat > 0) {
      w.u8(flags[i] | 0x08);
      w.u8(repeat);
    } else w.u8(flags[i]);
    i += repeat + 1;
  }
  w.raw(xBytes.done());
  w.raw(yBytes.done());
  return {
    bytes: w.done(),
    box: { xMin, yMin, xMax, yMax },
    points: xs.length,
    contours: ends.length,
  };
}

/* ---------- CFF ---------- */
function cffNumber(w: Writer, v: number) {
  v = Math.round(v);
  if (v >= -107 && v <= 107) w.u8(v + 139);
  else if (v >= 108 && v <= 1131) {
    v -= 108;
    w.u8((v >> 8) + 247);
    w.u8(v & 0xff);
  } else if (v >= -1131 && v <= -108) {
    v = -v - 108;
    w.u8((v >> 8) + 251);
    w.u8(v & 0xff);
  } else if (v >= -32768 && v <= 32767) {
    w.u8(28);
    w.i16(v);
  } else {
    w.u8(29);
    w.i32(v);
  }
}
/** Type2 charstring 숫자(정수만). */
function t2Number(w: Writer, v: number) {
  if (v >= -107 && v <= 107) w.u8(v + 139);
  else if (v >= 108 && v <= 1131) {
    v -= 108;
    w.u8((v >> 8) + 247);
    w.u8(v & 0xff);
  } else if (v >= -1131 && v <= -108) {
    v = -v - 108;
    w.u8((v >> 8) + 251);
    w.u8(v & 0xff);
  } else {
    w.u8(28);
    w.i16(v);
  }
}
/** 윤곽의 방향을 뒤집는다(CFF 는 바깥 윤곽이 반시계 방향이 관례). */
export function reverseContour(contour: Contour): Contour {
  const points: [number, number][] = [[contour.x, contour.y]];
  for (const s of contour.segments) points.push([s[s.length - 2] as number, s[s.length - 1] as number]);
  const segments: Segment[] = [];
  for (let i = contour.segments.length - 1; i >= 0; i--) {
    const s = contour.segments[i];
    const [x, y] = points[i];
    if (s[0] === 0) segments.push([0, x, y]);
    else if (s[0] === 1) segments.push([1, s[1], s[2], x, y]);
    else segments.push([2, s[3], s[4], s[1], s[2], x, y]);
  }
  const end = points[points.length - 1];
  return { x: end[0], y: end[1], segments };
}

function charstring(source: OutlineGlyph): Uint8Array {
  const glyph = { ...source, contours: source.contours.map(reverseContour) };
  const w = new Writer(64);
  t2Number(w, glyph.advanceWidth); // nominalWidthX 0 이므로 너비를 그대로
  let px = 0,
    py = 0;
  for (const contour of glyph.contours) {
    t2Number(w, contour.x - px);
    t2Number(w, contour.y - py);
    w.u8(21); // rmoveto
    px = contour.x;
    py = contour.y;
    const segments = [...contour.segments];
    const last = segments.at(-1);
    if (
      last &&
      last[0] === 0 &&
      last[1] === contour.x &&
      last[2] === contour.y
    )
      segments.pop();
    let i = 0;
    while (i < segments.length) {
      if (segments[i][0] === 0) {
        let n = 0;
        while (i < segments.length && segments[i][0] === 0 && n < 24) {
          const s = segments[i] as [0, number, number];
          t2Number(w, s[1] - px);
          t2Number(w, s[2] - py);
          px = s[1];
          py = s[2];
          i++;
          n++;
        }
        w.u8(5); // rlineto
      } else {
        let n = 0;
        while (i < segments.length && segments[i][0] !== 0 && n < 8) {
          const s = segments[i];
          let c: number[];
          if (s[0] === 1) {
            // 2차 → 3차(정확히 같은 곡선)
            const [, qx, qy, x, y] = s;
            c = [
              px + (2 / 3) * (qx - px),
              py + (2 / 3) * (qy - py),
              x + (2 / 3) * (qx - x),
              y + (2 / 3) * (qy - y),
              x,
              y,
            ];
          } else c = s.slice(1) as number[];
          const r = c.map(Math.round);
          t2Number(w, r[0] - px);
          t2Number(w, r[1] - py);
          t2Number(w, r[2] - r[0]);
          t2Number(w, r[3] - r[1]);
          t2Number(w, r[4] - r[2]);
          t2Number(w, r[5] - r[3]);
          px = r[4];
          py = r[5];
          i++;
          n++;
        }
        w.u8(8); // rrcurveto
      }
    }
  }
  w.u8(14); // endchar
  return w.done();
}
function cffIndex(items: Uint8Array[]): Uint8Array {
  const w = new Writer(16);
  w.u16(items.length);
  if (!items.length) return w.done();
  const total = items.reduce((s, b) => s + b.length, 0) + 1;
  const offSize = total < 0x100 ? 1 : total < 0x10000 ? 2 : total < 0x1000000 ? 3 : 4;
  w.u8(offSize);
  let offset = 1;
  const put = (v: number) => {
    for (let k = offSize - 1; k >= 0; k--) w.u8((v >>> (k * 8)) & 0xff);
  };
  put(offset);
  for (const item of items) {
    offset += item.length;
    put(offset);
  }
  for (const item of items) w.raw(item);
  return w.done();
}
const latin1 = (s: string) =>
  Uint8Array.from(s, (c) => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63));

function buildCFF(info: FontInfo, glyphs: OutlineGlyph[], bbox: Box) {
  const header = Uint8Array.of(1, 0, 4, 4);
  const nameIndex = cffIndex([latin1(info.postScriptName)]);
  // 문자열: 글리프 이름(1번 글리프부터)을 먼저 넣어 SID 가 391부터 차례대로 오게 한다.
  const strings = glyphs.slice(1).map((g) => latin1(g.name));
  const sid = (s: string) => {
    strings.push(latin1(s));
    return 390 + strings.length;
  };
  const versionSID = sid(info.version.replace(/^Version\s*/, "")),
    fullSID = sid(info.familyEnglish),
    familySID = sid(info.familyEnglish),
    weightSID = sid("Regular");
  const stringIndex = cffIndex(strings);
  const globalSubrs = cffIndex([]);
  const charsetW = new Writer(8);
  charsetW.u8(2);
  if (glyphs.length > 1) {
    charsetW.u16(391);
    charsetW.u16(glyphs.length - 2);
  }
  const charset = charsetW.done();
  const charStrings = cffIndex(glyphs.map(charstring));
  const privateW = new Writer(8);
  cffNumber(privateW, 0);
  privateW.u8(20); // defaultWidthX
  cffNumber(privateW, 0);
  privateW.u8(21); // nominalWidthX
  const privateDict = privateW.done();

  // Top DICT: 위치 값은 5바이트 고정 길이로 써서 크기를 먼저 알 수 있게 한다.
  const topDict = (charsetAt: number, charStringsAt: number, privateAt: number) => {
    const w = new Writer(64);
    cffNumber(w, versionSID);
    w.u8(0);
    cffNumber(w, fullSID);
    w.u8(2);
    cffNumber(w, familySID);
    w.u8(3);
    cffNumber(w, weightSID);
    w.u8(4);
    for (const v of [bbox.xMin, bbox.yMin, bbox.xMax, bbox.yMax]) cffNumber(w, v);
    w.u8(5);
    const fixed = (v: number) => {
      w.u8(29);
      w.i32(v);
    };
    fixed(charsetAt);
    w.u8(15);
    fixed(charStringsAt);
    w.u8(17);
    fixed(privateDict.length);
    fixed(privateAt);
    w.u8(18);
    return w.done();
  };
  const topSize = cffIndex([topDict(0, 0, 0)]).length;
  const charsetAt =
    header.length + nameIndex.length + topSize + stringIndex.length + globalSubrs.length;
  const charStringsAt = charsetAt + charset.length;
  const privateAt = charStringsAt + charStrings.length;
  const top = cffIndex([topDict(charsetAt, charStringsAt, privateAt)]);
  const w = new Writer(privateAt + privateDict.length);
  for (const part of [header, nameIndex, top, stringIndex, globalSubrs, charset, charStrings, privateDict])
    w.raw(part);
  return w.done();
}

/* ---------- 공통 표 ---------- */
const UNICODE_RANGES: [number, number, number][] = [
  [0x0000, 0x007f, 0], [0x0080, 0x00ff, 1], [0x0100, 0x017f, 2],
  [0x0370, 0x03ff, 7], [0x0400, 0x04ff, 9], [0x1100, 0x11ff, 28],
  [0x2000, 0x206f, 31], [0x2070, 0x209f, 32], [0x20a0, 0x20cf, 33],
  [0x2100, 0x214f, 34], [0x2150, 0x218f, 35], [0x2190, 0x21ff, 36],
  [0x2200, 0x22ff, 37], [0x2300, 0x23ff, 38], [0x2460, 0x24ff, 42],
  [0x2500, 0x257f, 43], [0x2580, 0x259f, 44], [0x25a0, 0x25ff, 45],
  [0x2600, 0x26ff, 46], [0x2700, 0x27bf, 47], [0x3000, 0x303f, 48],
  [0x3130, 0x318f, 52], [0x3200, 0x32ff, 54], [0x3300, 0x33ff, 55],
  [0xac00, 0xd7af, 56], [0xff00, 0xffef, 68],
];
function utf16(s: string) {
  const b = new Uint8Array(s.length * 2),
    v = new DataView(b.buffer);
  for (let i = 0; i < s.length; i++) v.setUint16(i * 2, s.charCodeAt(i));
  return b;
}
function nameTable(info: FontInfo) {
  const records: [number, number, Uint8Array][] = []; // language, id, bytes
  const en: [number, string][] = [
    [0, " "],
    [1, info.familyEnglish],
    [2, "Regular"],
    [3, info.uniqueID],
    [4, info.familyEnglish],
    [5, info.version],
    [6, info.postScriptName],
    [16, info.familyEnglish],
    [17, "Regular"],
  ];
  for (const [id, s] of en) records.push([0x0409, id, utf16(s)]);
  for (const id of [1, 4, 16]) records.push([0x0412, id, utf16(info.familyKorean)]);
  records.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const w = new Writer(512);
  w.u16(0);
  w.u16(records.length);
  w.u16(6 + records.length * 12);
  let offset = 0;
  for (const [language, id, bytes] of records) {
    w.u16(3);
    w.u16(1);
    w.u16(language);
    w.u16(id);
    w.u16(bytes.length);
    w.u16(offset);
    offset += bytes.length;
  }
  for (const [, , bytes] of records) w.raw(bytes);
  return w.done();
}

function assemble(sfntVersion: number, tables: Record<string, Uint8Array>) {
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  const pow = 2 ** Math.floor(Math.log2(n));
  let size = 12 + n * 16;
  for (const t of tags) size += (tables[t].length + 3) & ~3;
  const w = new Writer(size);
  w.u32(sfntVersion);
  w.u16(n);
  w.u16(pow * 16);
  w.u16(Math.log2(pow));
  w.u16(n * 16 - pow * 16);
  let offset = 12 + n * 16;
  for (const t of tags) {
    w.tag(t);
    w.u32(checksum(tables[t]));
    w.u32(offset);
    w.u32(tables[t].length);
    offset += (tables[t].length + 3) & ~3;
  }
  let headAt = 0;
  for (const t of tags) {
    if (t === "head") headAt = w.length;
    w.raw(tables[t]);
    w.pad4();
  }
  const bytes = w.done();
  new DataView(bytes.buffer).setUint32(headAt + 8, (0xb1b0afba - checksum(bytes)) >>> 0);
  return bytes.buffer;
}

export interface WrittenFonts {
  ttf: ArrayBuffer;
  otf: ArrayBuffer;
}

/** 같은 글리프로 TTF 와 OTF 를 함께 쓴다. glyphs[0] 은 .notdef 여야 한다. */
export function writeFonts(info: FontInfo, glyphs: OutlineGlyph[]): WrittenFonts {
  const now = Math.floor(Date.now() / 1000) + 2082844800; // 1904년부터 초
  const boxes = glyphs.map(glyphBox);
  const all = boxes.filter((b): b is Box => !!b);
  const bbox: Box = all.length
    ? {
        xMin: Math.min(...all.map((b) => b.xMin)),
        yMin: Math.min(...all.map((b) => b.yMin)),
        xMax: Math.max(...all.map((b) => b.xMax)),
        yMax: Math.max(...all.map((b) => b.yMax)),
      }
    : { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };

  // glyf / loca
  const encoded = glyphs.map(encodeGlyf);
  const glyf = new Writer(encoded.reduce((s, g) => s + g.bytes.length + 4, 0));
  const locaW = new Writer((glyphs.length + 1) * 4);
  for (const g of encoded) {
    locaW.u32(glyf.length);
    glyf.raw(g.bytes);
    glyf.pad4();
  }
  locaW.u32(glyf.length);
  // TrueType 의 lsb 는 glyf 의 xMin 과 같아야 한다(곡선을 2차로 바꾸며 조금 달라질 수 있음).
  const ttBoxes = encoded.map((g) => g.box);

  const head = (box: Box) => {
    const w = new Writer(54);
    w.u32(0x00010000);
    w.u32(Math.round(1.5 * 65536));
    w.u32(0); // checkSumAdjustment
    w.u32(0x5f0f3cf5);
    w.u16(0x000b);
    w.u16(info.unitsPerEm);
    for (const t of [now, now]) {
      w.u32(Math.floor(t / 2 ** 32));
      w.u32(t >>> 0);
    }
    w.i16(box.xMin);
    w.i16(box.yMin);
    w.i16(box.xMax);
    w.i16(box.yMax);
    w.u16(0);
    w.u16(3);
    w.i16(2);
    w.i16(1); // long loca
    w.i16(0);
    return w.done();
  };
  const hmtxAndHhea = (boxList: (Box | null)[]) => {
    const hmtx = new Writer(glyphs.length * 4);
    let advanceMax = 0,
      minLsb = Infinity,
      minRsb = Infinity,
      maxExtent = -Infinity;
    glyphs.forEach((g, i) => {
      const box = boxList[i];
      const lsb = box ? box.xMin : 0;
      hmtx.u16(g.advanceWidth);
      hmtx.i16(lsb);
      advanceMax = Math.max(advanceMax, g.advanceWidth);
      if (box) {
        minLsb = Math.min(minLsb, lsb);
        minRsb = Math.min(minRsb, g.advanceWidth - box.xMax);
        maxExtent = Math.max(maxExtent, box.xMax);
      }
    });
    const w = new Writer(36);
    w.u32(0x00010000);
    w.i16(info.ascender);
    w.i16(info.descender);
    w.i16(0);
    w.u16(advanceMax);
    w.i16(Number.isFinite(minLsb) ? minLsb : 0);
    w.i16(Number.isFinite(minRsb) ? minRsb : 0);
    w.i16(Number.isFinite(maxExtent) ? maxExtent : 0);
    w.i16(1);
    w.i16(0);
    w.i16(0);
    for (let i = 0; i < 5; i++) w.i16(0);
    w.u16(glyphs.length);
    return { hmtx: hmtx.done(), hhea: w.done() };
  };

  const mapping: CharacterMapping[] = [];
  glyphs.forEach((g, index) => {
    if (g.unicode !== undefined) mapping.push({ code: g.unicode, index });
  });
  const codes = mapping.map((m) => m.code);
  const ranges = [0, 0, 0, 0];
  for (const code of codes)
    for (const [a, b, bit] of UNICODE_RANGES)
      if (code >= a && code <= b) ranges[bit >> 5] |= 1 << (bit & 31);
  const advances = glyphs.map((g) => g.advanceWidth).filter((a) => a > 0);
  const heightOf = (char: string) => {
    const i = glyphs.findIndex((g) => g.unicode === char.charCodeAt(0));
    return i >= 0 ? boxes[i]?.yMax : undefined;
  };
  const hasHangul = codes.some((c) => c >= 0xac00 && c <= 0xd7a3);
  const os2 = (() => {
    const w = new Writer(96);
    w.u16(4);
    w.i16(Math.round(advances.reduce((s, a) => s + a, 0) / Math.max(1, advances.length)));
    w.u16(400);
    w.u16(5);
    w.u16(0); // fsType: 설치 가능
    for (const v of [650, 699, 0, 140, 650, 699, 0, 479, 49, 258]) w.i16(v);
    w.i16(0);
    for (let i = 0; i < 10; i++) w.u8(0); // panose
    for (const r of ranges) w.u32(r);
    w.tag("OSNS");
    w.u16(0x40); // REGULAR
    w.u16(Math.min(0xffff, Math.min(...codes)));
    w.u16(Math.min(0xffff, Math.max(...codes)));
    w.i16(info.ascender);
    w.i16(info.descender);
    w.i16(0);
    w.u16(Math.max(0, bbox.yMax));
    w.u16(Math.max(0, -bbox.yMin));
    w.u32(hasHangul ? 1 | (1 << 19) : 1);
    w.u32(0);
    w.i16(Math.round(heightOf("x") ?? 400));
    w.i16(Math.round(heightOf("H") ?? info.ascender));
    w.u16(0);
    w.u16(32);
    w.u16(0);
    return w.done();
  })();
  const post = (() => {
    const w = new Writer(32);
    w.u32(0x00030000);
    w.u32(0);
    w.i16(-75);
    w.i16(50);
    for (let i = 0; i < 5; i++) w.u32(0);
    return w.done();
  })();
  const cmap = makeCmap(mapping);
  const name = nameTable(info);

  // TTF
  let maxPoints = 0,
    maxContours = 0;
  for (const g of encoded) {
    maxPoints = Math.max(maxPoints, g.points);
    maxContours = Math.max(maxContours, g.contours);
  }
  const maxpTT = new Writer(32);
  maxpTT.u32(0x00010000);
  maxpTT.u16(glyphs.length);
  maxpTT.u16(maxPoints);
  maxpTT.u16(maxContours);
  maxpTT.u16(0);
  maxpTT.u16(0);
  maxpTT.u16(2);
  for (let i = 0; i < 8; i++) maxpTT.u16(0);
  const ttAll = ttBoxes.filter((b): b is Box => !!b);
  const ttBox: Box = ttAll.length
    ? {
        xMin: Math.min(...ttAll.map((b) => b.xMin)),
        yMin: Math.min(...ttAll.map((b) => b.yMin)),
        xMax: Math.max(...ttAll.map((b) => b.xMax)),
        yMax: Math.max(...ttAll.map((b) => b.yMax)),
      }
    : bbox;
  const tt = hmtxAndHhea(ttBoxes);
  const ttf = assemble(0x00010000, {
    "OS/2": os2,
    cmap,
    glyf: glyf.done(),
    head: head(ttBox),
    hhea: tt.hhea,
    hmtx: tt.hmtx,
    loca: locaW.done(),
    maxp: maxpTT.done(),
    name,
    post,
  });

  // OTF
  const maxpCFF = new Writer(6);
  maxpCFF.u32(0x00005000);
  maxpCFF.u16(glyphs.length);
  const cff = hmtxAndHhea(boxes);
  const otf = assemble(0x4f54544f, {
    "OS/2": os2,
    "CFF ": buildCFF(info, glyphs, bbox),
    cmap,
    head: head(bbox),
    hhea: cff.hhea,
    hmtx: cff.hmtx,
    maxp: maxpCFF.done(),
    name,
    post,
  });
  return { ttf, otf };
}

/** TTF/OTF → WOFF 1.0 (표마다 zlib 압축). */
export function writeWoff(sfnt: ArrayBuffer): ArrayBuffer {
  const view = new DataView(sfnt),
    n = view.getUint16(4);
  const tables = Array.from({ length: n }, (_, i) => {
    const p = 12 + i * 16;
    const offset = view.getUint32(p + 8),
      length = view.getUint32(p + 12);
    const data = new Uint8Array(sfnt, offset, length);
    const packed = zlibSync(data, { level: 6 });
    return {
      tag: view.getUint32(p),
      checksum: view.getUint32(p + 4),
      length,
      data: packed.length < length ? packed : data,
    };
  });
  const w = new Writer(sfnt.byteLength);
  const headerSize = 44 + n * 20;
  w.u32(0x774f4646);
  w.u32(view.getUint32(0));
  w.u32(0); // 전체 길이(나중에)
  w.u16(n);
  w.u16(0);
  w.u32(12 + n * 16 + tables.reduce((s, t) => s + ((t.length + 3) & ~3), 0));
  w.u16(1);
  w.u16(0);
  for (let i = 0; i < 5; i++) w.u32(0);
  let offset = headerSize;
  for (const t of tables) {
    w.u32(t.tag);
    w.u32(offset);
    w.u32(t.data.length);
    w.u32(t.length);
    w.u32(t.checksum);
    offset += (t.data.length + 3) & ~3;
  }
  for (const t of tables) {
    w.raw(t.data);
    w.pad4();
  }
  const bytes = w.done();
  new DataView(bytes.buffer).setUint32(8, bytes.length);
  return bytes.buffer;
}
