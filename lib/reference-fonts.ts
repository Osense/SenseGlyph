import { SPECIAL_SYMBOLS } from "../data/charset";

export const REFERENCE_FONTS = [
  {
    id: "sans",
    family: "Gmarket Sans",
    label: "정갈한 고딕",
    name: "G마켓 산스",
    file: "GmarketSansMedium.woff",
  },
  {
    id: "serif",
    family: "Nanum Myeongjo",
    label: "책에 쓰는 명조",
    name: "나눔명조",
    file: "NanumMyeongjo-Regular.ttf",
  },
  {
    id: "poster",
    family: "Black Han Sans",
    label: "묵직한 포스터",
    name: "검은고딕",
    file: "BlackHanSans-Regular.ttf",
  },
  {
    id: "round",
    family: "Samlip Hobbang",
    label: "통통한 캐릭터 글씨",
    name: "산돌 삼립호빵체",
    file: "SDSamliphopangche_Basic.woff",
  },
  {
    id: "hand",
    family: "School Safety Chalk",
    label: "또박또박 칠판 글씨",
    name: "학교안심 분필",
    file: "HakgyoansimBunpilR.woff2",
  },
  {
    id: "calligraphy",
    family: "School Safety Brush Pen",
    label: "굵기가 살아 있는 붓글씨",
    name: "학교안심 붓펜",
    file: "HakgyoansimButpenM.woff2",
  },
  {
    id: "pixel",
    family: "Galmuri11",
    label: "레트로 픽셀",
    name: "갈무리11",
    file: "Galmuri11.woff2",
  },
] as const;
export type ReferenceFontId = (typeof REFERENCE_FONTS)[number]["id"];

export function referenceFont(id?: string) {
  return REFERENCE_FONTS.find((font) => font.id === id) ?? REFERENCE_FONTS[0];
}

export function referenceStack(id?: string) {
  return (
    '"' +
    referenceFont(id).family +
    '", "Noto Sans KR", "Special Symbols Fallback", sans-serif'
  );
}

export async function loadReferenceFont(id?: string, char = "가") {
  await Promise.all([
    document.fonts.load('600px "Noto Sans KR"', char),
    document.fonts.load('600px "' + referenceFont(id).family + '"', char),
    ...([...char].some((value) => SPECIAL_SYMBOLS.includes(value))
      ? [document.fonts.load('600px "Special Symbols Fallback"', char)]
      : []),
  ]);
}
