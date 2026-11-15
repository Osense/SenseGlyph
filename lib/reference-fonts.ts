import { SPECIAL_SYMBOLS } from "../data/charset";

import type { WritingScript } from "./types";

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
  // 일본어 견본(OFL, 가나·상용한자 2,136자로 줄인 파일)
  {
    id: "ja-klee",
    family: "Klee One",
    label: "교과서체",
    name: "Klee One",
    file: "KleeOne-Regular.woff2",
    script: "ja",
  },
  {
    id: "ja-maru",
    family: "Zen Maru Gothic",
    label: "둥근 고딕",
    name: "Zen Maru Gothic",
    file: "ZenMaruGothic-Medium.woff2",
    script: "ja",
  },
  {
    id: "ja-yomogi",
    family: "Yomogi",
    label: "펜 손글씨",
    name: "Yomogi",
    file: "Yomogi-Regular.woff2",
    script: "ja",
  },
] as const;
export type ReferenceFontId = (typeof REFERENCE_FONTS)[number]["id"];

const scriptOf = (font: (typeof REFERENCE_FONTS)[number]): WritingScript =>
  "script" in font ? font.script : "ko";
/** 이 언어로 고를 수 있는 견본 */
export const referenceFontsFor = (script: WritingScript = "ko") =>
  REFERENCE_FONTS.filter((font) => scriptOf(font) === script);
export const defaultReferenceFont = (script: WritingScript = "ko") =>
  referenceFontsFor(script)[0].id;

export function referenceFont(id?: string, script?: WritingScript) {
  const found = REFERENCE_FONTS.find((font) => font.id === id);
  if (found && (!script || scriptOf(found) === script)) return found;
  return referenceFontsFor(script ?? "ko")[0];
}

export function referenceStack(id?: string) {
  return (
    '"' +
    referenceFont(id).family +
    (referenceFont(id).id.startsWith("ja-") ? '", "Klee One' : "") +
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
