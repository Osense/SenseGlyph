import { useSyncExternalStore } from "react";

/** 작업실(main.studio)의 어두운/밝은 화면이 바뀔 때 캔버스 미리보기를 다시 그리기 위한 구독. */
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function isDark() {
  return !!document.querySelector("main.studio.dark");
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => listeners.forEach((l) => l()));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

export function useStudioDark() {
  return useSyncExternalStore(subscribe, isDark, () => true);
}

/** 미리보기 손글씨 색: 테마의 글자색(--ink)을 그대로 쓴다. */
export function inkOf(element: Element | null, fallback = "#f4ecea") {
  if (!element) return fallback;
  const value = getComputedStyle(element).getPropertyValue("--ink").trim();
  return value || fallback;
}
