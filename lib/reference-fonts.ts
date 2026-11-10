export const REFERENCE_FONTS = [
  {
    id: "sans",
    family: "Noto Sans KR",
    label: "단정한 고딕",
    file: "NotoSansKR.ttf",
  },
  {
    id: "serif",
    family: "Noto Serif KR",
    label: "또렷한 명조",
    file: "NotoSerifKR.ttf",
  },
  {
    id: "round",
    family: "Gowun Dodum",
    label: "부드러운 고운돋움",
    file: "GowunDodum.ttf",
  },
  {
    id: "hand",
    family: "Nanum Pen Script",
    label: "편안한 손글씨",
    file: "NanumPenScript.ttf",
  },
  {
    id: "calligraphy",
    family: "Nanum Brush Script",
    label: "자유로운 붓글씨",
    file: "NanumBrushScript.ttf",
  },
] as const;
export type ReferenceFontId = (typeof REFERENCE_FONTS)[number]["id"];
export function referenceFamily(id?: string) {
  return (
    REFERENCE_FONTS.find((font) => font.id === id)?.family ??
    REFERENCE_FONTS[0].family
  );
}
export function referenceStack(id?: string) {
  return '"' + referenceFamily(id) + '", "Noto Sans KR"';
}
export async function loadReferenceFont(id?: string, char = "가") {
  await Promise.all([
    document.fonts.load('600px "Noto Sans KR"', char),
    document.fonts.load('600px "' + referenceFamily(id) + '"', char),
  ]);
}
