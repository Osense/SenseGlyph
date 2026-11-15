// 폰트 영문 이름 자동 만들기: 한글은 국어의 로마자 표기법(음절 단위, 소리 바뀜은 무시),
// 가나는 헵번식. 한자처럼 읽을 수 없는 글자는 건너뛰고, 남는 게 없으면 MyHandwriting.
const CHO = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const JUNG = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
const JONG = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "p",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];

const KANA: Record<string, string> = {};
(() => {
  const rows: [string, string[]][] = [
    ["あいうえお", ["a", "i", "u", "e", "o"]],
    ["かきくけこ", ["ka", "ki", "ku", "ke", "ko"]],
    ["がぎぐげご", ["ga", "gi", "gu", "ge", "go"]],
    ["さしすせそ", ["sa", "shi", "su", "se", "so"]],
    ["ざじずぜぞ", ["za", "ji", "zu", "ze", "zo"]],
    ["たちつてと", ["ta", "chi", "tsu", "te", "to"]],
    ["だぢづでど", ["da", "ji", "zu", "de", "do"]],
    ["なにぬねの", ["na", "ni", "nu", "ne", "no"]],
    ["はひふへほ", ["ha", "hi", "fu", "he", "ho"]],
    ["ばびぶべぼ", ["ba", "bi", "bu", "be", "bo"]],
    ["ぱぴぷぺぽ", ["pa", "pi", "pu", "pe", "po"]],
    ["まみむめも", ["ma", "mi", "mu", "me", "mo"]],
    ["やゆよ", ["ya", "yu", "yo"]],
    ["らりるれろ", ["ra", "ri", "ru", "re", "ro"]],
    ["わをん", ["wa", "o", "n"]],
    ["ぁぃぅぇぉ", ["a", "i", "u", "e", "o"]],
  ];
  for (const [chars, sounds] of rows)
    [...chars].forEach((c, i) => {
      KANA[c] = sounds[i];
      KANA[String.fromCharCode(c.charCodeAt(0) + 0x60)] = sounds[i]; // 가타카나
    });
})();
const SMALL_Y: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };

function kanaToRomaji(text: string) {
  const chars = [...text].map((c) =>
    /[ァ-ヶ]/.test(c) ? String.fromCharCode(c.charCodeAt(0) - 0x60) : c,
  );
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i],
      next = chars[i + 1];
    if (c === "っ") {
      const following = KANA[next ?? ""] ?? "";
      out += following.startsWith("ch") ? "t" : (following[0] ?? "");
      continue;
    }
    if (c === "ー") continue;
    let sound = KANA[c];
    if (!sound) continue;
    if (next && SMALL_Y[next] && sound.endsWith("i")) {
      // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja
      const base = sound.slice(0, -1);
      sound =
        (base === "sh" || base === "ch" || base === "j" ? base : base + "y") +
        SMALL_Y[next];
      i++;
    }
    out += sound;
  }
  return out;
}

function hangulToRoman(text: string) {
  let out = "";
  for (const c of text) {
    const code = c.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) {
      out +=
        CHO[Math.floor(code / 588)] +
        JUNG[Math.floor(code / 28) % 21] +
        JONG[code % 28];
    } else if (/[A-Za-z0-9]/.test(c)) out += c;
  }
  return out;
}

/** 현지 이름 → 영문 폰트 이름(첫 글자 대문자, 띄어쓰기 없음) */
export function romanizeName(name: string, script: "ko" | "ja" = "ko") {
  const raw = (script === "ja" ? kanaToRomaji(name) : hangulToRoman(name))
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 40);
  if (!/[A-Za-z]/.test(raw)) return "MyHandwriting";
  return raw[0].toUpperCase() + raw.slice(1);
}
