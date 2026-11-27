import type { CharCategory, WritingScript } from "../lib/types";
import { JOYO_REST, KANJI_GRADE } from "./kanji";
// 앞의 138자: 초성·중성·종성의 모든 자리(237개)를 한 번씩 채우는 글자.
// 뒤의 12자: 글에서 가장 자주 나오는 글자. 직접 쓴 그대로 폰트에 들어가서 본문이 내 글씨에 더 가까워지고,
// 가장 많이 쓰이는 자모 자리(이·다·는…)에 표본이 하나 더 생긴다.
export const HANGUL =
  "겨 구 귀 갛 겪 곧 곬 괆 괬 괶 끼 꾜 꽈 껍 꿎 뀓 너 뉴 놔 냄 늉 눷 뎌 됴 둬 닺 돝 듡 뒹 떼 뜨 뙈 떪 뚧 뙚 뛟 띊 려 로 롸 랖 륨 뤽 머 무 뭬 밌 몫 묽 뭏 묄 볘 뷰 붜 밗 받 볕 빛 볶 붶 뺘 쁘 뾔 뻁 뽈 뾗 세 수 숴 싫 숯 싌 써 쑤 쒀 쎈 쓨 쒡 얘 요 의 얹 없 엌 엷 읽 옳 읊 읔 왯 왼 웸 쟤 즈 좨 잺 졺 줍 좶 쥝 찌 쪼 쬐 짢 쭉 쬙 쬩 쳐 츠 최 챨 촚 췧 카 쿠 쾌 캑 콧 퀋 테 튜 퇴 팃 톺 튑 페 퓨 퓌 펭 푠 풪 해 호 홰 혨 홅 흖 휰 이 다 는 에 을 가 하 한 고 지 서 를".split(
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

/** 기본형: 한글 필수 150자·숫자·기본 기호·영문. 프리미엄: 낱자모·문장 기호·특수 기호를 더합니다. */
export const PREMIUM_CATEGORIES: ReadonlySet<CharCategory> = new Set([
  "hangul-jamo",
  "korean-punct",
  "special-symbol",
]);
export const isPremiumCategory = (category: CharCategory) =>
  PREMIUM_CATEGORIES.has(category);
export const BASIC_CHARSET = CHARSET.filter(
  ({ category }) => !PREMIUM_CATEGORIES.has(category),
);
export const PREMIUM_CHARSET = CHARSET.filter(({ category }) =>
  PREMIUM_CATEGORIES.has(category),
);

// ── 일본어 ───────────────────────────────────────────────
const HIRAGANA_BASE =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
const HIRAGANA_VOICED = "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ";
const HIRAGANA_SMALL = "ぁぃぅぇぉっゃゅょゎ";
const toKatakana = (text: string) =>
  [...text].map((c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).join("");
export const HIRAGANA = [...(HIRAGANA_BASE + HIRAGANA_VOICED + HIRAGANA_SMALL)];
export const KATAKANA = [
  ...toKatakana(HIRAGANA_BASE + HIRAGANA_VOICED + HIRAGANA_SMALL),
  "ヴ",
  "ー",
];
/** 필체를 읽어 낼 한자 24자: 永(영자팔법의 여덟 가지 획)부터, 좌우·상하·에워싸기 구조와 자주 쓰는 부수를 고루 담았다.
 * 이 글자들에서 찾은 규칙(굵기·기울기·비율)을 쓰지 않은 한자에 입힌다. */
export const KANJI_BASIC = [
  ..."永一十人大小口日月木水山中子女心学国道語書花東京",
];
const KANJI_BASIC_SET = new Set(KANJI_BASIC);
/** 더 쓰고 싶은 사람을 위한 교육한자(학년·빈도순). 쓰면 그 글자는 견본 대신 내 글씨로 들어간다. */
export const KANJI_MORE = [
  ...(KANJI_GRADE[1] + KANJI_GRADE[2] + KANJI_GRADE[3] + KANJI_GRADE[456]),
].filter((c) => !KANJI_BASIC_SET.has(c));
export const JA_PUNCT = [..."、。「」『』・々〜…【】"];

type Category = (typeof CATEGORIES)[number];
const shared = (id: CharCategory) => CATEGORIES.find((c) => c.id === id)!;
export const JA_CATEGORIES: Category[] = [
  { id: "hiragana", label: "히라가나", required: true, chars: HIRAGANA },
  { id: "katakana", label: "가타카나", required: true, chars: KATAKANA },
  {
    id: "kanji",
    label: "한자",
    required: true,
    chars: [...KANJI_BASIC, ...KANJI_MORE],
  },
  shared("digit"),
  shared("latin-upper"),
  shared("latin-lower"),
  shared("ascii-symbol"),
  {
    id: "ja-punct",
    label: "일본어 문장 기호",
    required: true,
    chars: JA_PUNCT,
  },
  shared("special-symbol"),
];
export const JA_CHARSET = JA_CATEGORIES.flatMap((c) =>
  c.chars.map((char) => ({ char, category: c.id })),
);
const KANJI_MORE_SET = new Set(KANJI_MORE);
/** 일본어 기본형: 가나 전부·1학년 한자·숫자·영문·기호·문장 기호. 2~6학년 한자와 특수 기호는 더 쓰기. */
export const isJaExtra = (char: string, category: CharCategory) =>
  category === "special-symbol" ||
  (category === "kanji" && KANJI_MORE_SET.has(char));
/** 쓰지 않아도 견본 글꼴로 채우는 나머지 상용한자 */
export const JA_FALLBACK_EXTRA = [...JOYO_REST];

export type CharEntry = { char: string; category: CharCategory };
export const charsetFor = (script: WritingScript = "ko"): CharEntry[] =>
  script === "ja" ? JA_CHARSET : CHARSET;
export const categoriesFor = (script: WritingScript = "ko"): Category[] =>
  script === "ja" ? JA_CATEGORIES : CATEGORIES;
export const isExtraEntry = (
  script: WritingScript = "ko",
  { char, category }: CharEntry,
) =>
  script === "ja" ? isJaExtra(char, category) : isPremiumCategory(category);
export const basicCharsetFor = (script: WritingScript = "ko") =>
  charsetFor(script).filter((entry) => !isExtraEntry(script, entry));
export const extraCharsetFor = (script: WritingScript = "ko") =>
  charsetFor(script).filter((entry) => isExtraEntry(script, entry));
/** 어느 언어든 이 앱에서 쓰는 글자의 갈래 */
const ANY_CATEGORY = new Map<string, CharCategory>(
  [...JA_CHARSET, ...CHARSET].map((e) => [e.char, e.category]),
);
export const knownCategory = (char: string) => ANY_CATEGORY.get(char);
