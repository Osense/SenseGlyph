export function decompose(ch: string) {
  const n = ch.codePointAt(0)! - 0xac00;
  if ([...ch].length !== 1 || n < 0 || n >= 11172) return null;
  return {
    cho: Math.floor(n / 588),
    jung: Math.floor(n / 28) % 21,
    jong: n % 28,
  };
}
export function vowelType(jung: number): "V" | "H" | "C" {
  if (!Number.isInteger(jung) || jung < 0 || jung > 20)
    throw new RangeError("Invalid vowel");
  return [0, 1, 2, 3, 4, 5, 6, 7, 20].includes(jung)
    ? "V"
    : [8, 12, 13, 17, 18].includes(jung)
      ? "H"
      : "C";
}
export function slotKeys(ch: string): string[] {
  const d = decompose(ch);
  if (!d) return [];
  const type = vowelType(d.jung),
    hasJong = d.jong > 0;
  return [
    "cho:" + d.cho + ":" + type + ":" + hasJong,
    "jung:" + d.jung + ":" + hasJong,
    ...(hasJong ? ["jong:" + d.jong + ":" + type] : []),
  ];
}

export const JAMO = {
  cho: "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",
  jung: "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
  jong: " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ",
} as const;

const typedJamo: Record<string, string> = {
  ㄱㄱ: "ㄲ",
  ㄷㄷ: "ㄸ",
  ㅂㅂ: "ㅃ",
  ㅅㅅ: "ㅆ",
  ㅈㅈ: "ㅉ",
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
  ㅗㅏ: "ㅘ",
  ㅗㅐ: "ㅙ",
  ㅗㅣ: "ㅚ",
  ㅜㅓ: "ㅝ",
  ㅜㅔ: "ㅞ",
  ㅜㅣ: "ㅟ",
  ㅡㅣ: "ㅢ",
};

export function jamoFilterIndex(value: string, part: keyof typeof JAMO) {
  const raw = value.replace(/\s/g, "");
  if (!raw) return null;
  const text = [...raw]
    .map((char) => {
      const code = char.charCodeAt(0);
      return (
        JAMO.cho[code - 0x1100] ??
        JAMO.jung[code - 0x1161] ??
        JAMO.jong[code - 0x11a7] ??
        char
      );
    })
    .join("");
  const jamo = text.length === 2 ? (typedJamo[text] ?? text) : text;
  return [...jamo].length === 1 ? JAMO[part].indexOf(jamo) : -1;
}
