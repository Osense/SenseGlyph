"use client";
// 숨은 기능 스위치. 화면 어디에도 켜는 버튼을 두지 않는다.
// 주소 끝에 ?labs=ja 를 붙여 한 번 열면 이 기기에서 켜지고, ?labs=off 로 끈다.
// 지금 숨긴 기능: 일본어 폰트 만들기(ja)
const KEY = "senseglyph-labs";

export type LabFeature = "ja";

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** 주소의 ?labs= 값을 이 기기에 기억한다. 앱이 처음 뜰 때 한 번 부른다. */
export function applyLabsFromUrl() {
  try {
    const value = new URLSearchParams(location.search).get("labs");
    if (value === null) return;
    const next =
      value === "off" ? [] : [...new Set([...read(), ...value.split(",")])];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function labEnabled(feature: LabFeature) {
  return read().has(feature);
}
