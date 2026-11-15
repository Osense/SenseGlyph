"use client";
// 화면 언어: 기기 언어(브라우저·안드로이드 설정)를 따라 한국어·일본어·영어 중 하나로 보여 준다.
// 만들 글자(폰트 언어)와는 따로다. 문구는 한국어 원문을 열쇠로 쓰고, 번역이 없으면 한국어 그대로.
import { create } from "zustand";
import { JA, EN } from "./i18n-messages";

export type UiLang = "ko" | "ja" | "en";
const KEY = "hanhoek-ui";

export function detectLang(): UiLang {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}").uiLang;
    if (saved === "ko" || saved === "ja" || saved === "en") return saved;
  } catch {}
  const list =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  for (const tag of list) {
    const lang = (tag ?? "").toLowerCase();
    if (lang.startsWith("ko")) return "ko";
    if (lang.startsWith("ja")) return "ja";
    if (lang) return "en";
  }
  return "ko";
}

export const useLang = create<{
  lang: UiLang;
  /** 사용자가 직접 고른 언어(설정) */
  choose: (lang: UiLang | "auto") => void;
  detect: () => void;
}>((set) => ({
  // 정적 HTML은 한국어로 미리 그려 두고, 열린 뒤 기기 언어로 바꾼다(하이드레이션 어긋남 방지).
  lang: "ko",
  detect: () => set({ lang: detectLang() }),
  choose: (choice) => {
    try {
      const pref = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      if (choice === "auto") delete pref.uiLang;
      else pref.uiLang = choice;
      localStorage.setItem(KEY, JSON.stringify(pref));
    } catch {}
    set({ lang: choice === "auto" ? detectLang() : choice });
  },
}));

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

export function translate(lang: UiLang, text: string, vars?: Vars) {
  const table = lang === "ja" ? JA : lang === "en" ? EN : null;
  let out = (table && table[text]) || text;
  if (vars)
    for (const [name, value] of Object.entries(vars))
      out = out.split("{" + name + "}").join(String(value));
  return out;
}

export function useT(): T {
  const lang = useLang((state) => state.lang);
  return (text, vars) => translate(lang, text, vars);
}

/** 컴포넌트 밖(작업자 메시지 등)에서 지금 화면 언어로 */
export const t: T = (text, vars) =>
  translate(useLang.getState().lang, text, vars);
