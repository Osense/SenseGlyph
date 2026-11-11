import type { CharCategory } from "../lib/types";
export const HANGUL =
  "겨 구 귀 갛 겪 곧 곬 괆 괬 괶 끼 꾜 꽈 껍 꿎 뀓 너 뉴 놔 냄 늉 눷 뎌 됴 둬 닺 돝 듡 뒹 떼 뜨 뙈 떪 뚧 뙚 뛟 띊 려 로 롸 랖 륨 뤽 머 무 뭬 밌 몫 묽 뭏 묄 볘 뷰 붜 밗 받 볕 빛 볶 붶 뺘 쁘 뾔 뻁 뽈 뾗 세 수 숴 싫 숯 싌 써 쑤 쒀 쎈 쓨 쒡 얘 요 의 얹 없 엌 엷 읽 옳 읊 읔 왯 왼 웸 쟤 즈 좨 잺 졺 줍 좶 쥝 찌 쪼 쬐 짢 쭉 쬙 쬩 쳐 츠 최 챨 촚 췧 카 쿠 쾌 캑 콧 퀋 테 튜 퇴 팃 톺 튑 페 퓨 퓌 펭 푠 풪 해 호 홰 혨 홅 흖 휰".split(
    " ",
  );
export const SPECIAL_SYMBOLS = [
  ..."①②③④⑤⑥⑦⑧⑨⑩",
  ..."㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭",
  ..."ⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ",
  ..."•○●□■✓✔✕✗☑☒",
  ..."←↑→↓↔↕↖↗↘↙⇒⇔↳☜☞",
  ..."×÷≠≤≥−±≈≡√∞∠⊥∥∝",
  ..."℃℉㎜㎝㎞㎎㎏㎖㎥㎠㎡ℓ",
  ..."★☆♡♥✦✧△▲▽▼◇◆▷▶◁◀◎▪▫⊙◈▣◐◑▒▤▥▦▧▨▩",
];

// Recognize retired samples in older project backups without offering them for export.
export const RETIRED_SPECIAL_SYMBOLS = new Set(
  "⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻½⅓¼¾⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞¹²³⁴",
);

export const CATEGORIES: {
  id: CharCategory;
  label: string;
  required: boolean;
  chars: string[];
}[] = [
  { id: "hangul-syllable", label: "한글 음절", required: true, chars: HANGUL },
  { id: "digit", label: "숫자", required: true, chars: [..."0123456789"] },
  {
    id: "ascii-symbol",
    label: "기호",
    required: true,
    chars: Array.from({ length: 94 }, (_, i) =>
      String.fromCharCode(i + 33),
    ).filter((c) => !/[A-Za-z0-9]/.test(c)),
  },
  {
    id: "latin-upper",
    label: "영문 대문자",
    required: false,
    chars: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  },
  {
    id: "latin-lower",
    label: "영문 소문자",
    required: false,
    chars: [..."abcdefghijklmnopqrstuvwxyz"],
  },
  {
    id: "hangul-jamo",
    label: "한글 낱자모",
    required: false,
    chars: Array.from({ length: 51 }, (_, i) =>
      String.fromCharCode(0x3131 + i),
    ),
  },
  {
    id: "korean-punct",
    label: "문장 기호",
    required: false,
    chars: [..."·…“”‘’₩※°「」"],
  },
  {
    id: "special-symbol",
    label: "특수 기호",
    required: false,
    chars: SPECIAL_SYMBOLS,
  },
];
// SPEC 해석: ASCII 기호는 명세에 적힌 제시 순서를 유지한다.
CATEGORIES[2].chars = [
  "~",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
  "(",
  ")",
  "{",
  "}",
  ":",
  '"',
  "<",
  ">",
  "?",
  ",",
  ".",
  "/",
  ";",
  "'",
  "[",
  "]",
  "+",
  "-",
  "=",
  "_",
  "\\",
  "|",
  String.fromCharCode(96),
];
export const CHARSET = CATEGORIES.flatMap((c) =>
  c.chars.map((char) => ({ char, category: c.id })),
);
