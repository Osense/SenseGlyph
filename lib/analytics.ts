"use client";
// 방문 집계: 숫자만 센다. 이름·글씨·기기 정보 같은 내용은 보내지 않고, 쿠키도 쓰지 않는다.
// 외부 무료 집계 서비스(Abacus)의 카운터를 1씩 올리는 요청만 보낸다.
// 수집 범위·목적은 components/LegalNotice.tsx 의 안내와 같아야 한다.
import { isNativeApp } from "./native";

export const COUNTER_HOST = "https://abacus.jasoncameron.dev";
export const COUNTER_NAMESPACE = "osense-senseglyph";
const PREF = "hanhoek-ui";
const SEEN = "senseglyph-visitor";
const SESSION = "senseglyph-visit";

export type CounterKey = "visits" | "visitors" | "exports";

/** 사용자가 설정에서 방문 집계를 껐는지 */
export function countingDisabled() {
  try {
    return !!JSON.parse(localStorage.getItem(PREF) ?? "{}").noCount;
  } catch {
    return false;
  }
}
export function setCountingDisabled(disabled: boolean) {
  try {
    const pref = JSON.parse(localStorage.getItem(PREF) ?? "{}");
    if (disabled) pref.noCount = true;
    else delete pref.noCount;
    localStorage.setItem(PREF, JSON.stringify(pref));
  } catch {}
}

const keyFor = (key: CounterKey) =>
  (isNativeApp() ? "android-" : "web-") + key;

function hit(key: CounterKey) {
  if (countingDisabled() || typeof fetch === "undefined") return;
  // 집계가 실패해도 앱 사용에는 아무 영향이 없어야 한다.
  fetch(`${COUNTER_HOST}/hit/${COUNTER_NAMESPACE}/${keyFor(key)}`, {
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  }).catch(() => {});
}

/** 앱을 열 때 한 번. 같은 창(세션)에서는 다시 세지 않고, 이 기기에서 처음이면 방문자도 1 올린다. */
export function countVisit() {
  if (countingDisabled()) return;
  try {
    if (/^(localhost|127\.)/.test(location.hostname)) return;
    if (sessionStorage.getItem(SESSION)) return;
    sessionStorage.setItem(SESSION, "1");
    hit("visits");
    if (!localStorage.getItem(SEEN)) {
      localStorage.setItem(SEEN, "1");
      hit("visitors");
    }
  } catch {}
}

/** 폰트 파일을 내려받거나 공유할 때 */
export function countExport() {
  try {
    if (/^(localhost|127\.)/.test(location.hostname)) return;
  } catch {}
  hit("exports");
}

/** 누적 숫자 읽기(안내 화면 표시용). 실패하면 null */
export async function readCount(key: CounterKey): Promise<number | null> {
  try {
    const response = await fetch(
      `${COUNTER_HOST}/get/${COUNTER_NAMESPACE}/web-${key}`,
      { credentials: "omit", referrerPolicy: "no-referrer" },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.value === "number" ? data.value : null;
  } catch {
    return null;
  }
}
