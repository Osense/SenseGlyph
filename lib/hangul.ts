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
