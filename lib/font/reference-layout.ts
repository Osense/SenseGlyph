// 견본 글꼴의 글자별 자모 배치(상용 한글 2,350자). scripts/build-reference-layouts.py 가 만든다.
// 조합 엔진은 자모 자리를 237가지로만 나눠 보지만, 네모꼴 글꼴은 같은 자리 안에서도 글자마다
// 자모 크기·자리를 조금씩 바꾼다. 견본을 따라 쓴 사람의 조합 글자에 그 차이를 되살리는 데 쓴다.
import data from "../../data/reference-layouts.json";
import type { Box, Part } from "./types";

const PARTS: Part[] = ["cho", "jung", "jong"];
const index = new Map([...data.chars].map((char, i) => [char, i]));
const decoded = new Map<string, Uint8Array | null>();

function bytesOf(font: string) {
  if (!decoded.has(font)) {
    const text = (data.fonts as Record<string, string>)[font];
    decoded.set(
      font,
      text ? Uint8Array.from(atob(text), (c) => c.charCodeAt(0)) : null,
    );
  }
  return decoded.get(font)!;
}

/** 이 견본에 글자별 배치 자료가 있는지 */
export const hasReferenceLayout = (font: string) => !!bytesOf(font);

/** 견본 글꼴에서 이 글자의 자모 상자(글자의 잉크 범위를 0~1 로 본 값, y 는 위에서부터). 없으면 null */
export function referenceLayout(
  font: string,
  char: string,
): Partial<Record<Part, Box>> | null {
  const bytes = bytesOf(font),
    i = index.get(char);
  if (!bytes || i === undefined) return null;
  const out: Partial<Record<Part, Box>> = {};
  for (let p = 0; p < 3; p++) {
    const o = i * 12 + p * 4;
    if (!bytes[o + 2] || !bytes[o + 3]) continue;
    out[PARTS[p]] = {
      x: bytes[o] / 255,
      y: bytes[o + 1] / 255,
      width: bytes[o + 2] / 255,
      height: bytes[o + 3] / 255,
    };
  }
  return out.cho && out.jung ? out : null;
}
