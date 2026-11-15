"use client";
// 폰트를 만들거나 파일을 꾸리는 동안 띄우는 작업 창: 퍼센트 게이지, 지금 하는 일, 중단 버튼.
// 기기마다 시간이 다르게 걸리므로(태블릿은 느림) 기다리는 동안 무슨 일을 하는지 짧게 보여 준다.
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";

const BUILD_LINES = [
  "획 끝을 다듬는 중",
  "자모끼리 인사시키는 중",
  "초성을 모음 기둥에 줄 세우는 중",
  "받침이 앉을 자리를 찾는 중",
  "1만 1,172자 출석 부르는 중",
  "글자 사이 간격을 재는 중",
  "필압을 고르게 펴는 중",
  "곡선을 펴서 다시 접는 중",
  "빈 글자에 견본을 빌려 오는 중",
  "같은 자모끼리 평균 내는 중",
];
const BUILD_LINES_JA = [
  "가나의 둥근 획을 다듬는 중",
  "한자에 필체 규칙을 입히는 중",
  "작은 っ가 앉을 자리를 확인하는 중",
  "、。를 칸 왼쪽 아래에 앉히는 중",
  "전각 글자를 칸 가운데로 옮기는 중",
];
const EXPORT_LINES = [
  "폰트 파일에 이름표 붙이는 중",
  "글리프를 상자에 차곡차곡 담는 중",
  "압축기에 넣고 꾹 누르는 중",
  "설치용 파일 포장하는 중",
  "라이선스 안내문 끼워 넣는 중",
];
const WEIGHT_LINES = [
  "같은 손글씨를 가늘게 다시 쓰는 중",
  "같은 손글씨를 굵게 다시 쓰는 중",
  "굵기 세 가지를 한 가족으로 묶는 중",
];

export default function WorkProgress({
  kind,
  percent,
  step,
  script = "ko",
  onCancel,
}: {
  kind: "build" | "export" | "weights";
  /** 0~100, 모르면 null(흐르는 게이지) */
  percent: number | null;
  /** 작업자가 알려 주는 지금 단계 */
  step?: string;
  script?: "ko" | "ja";
  onCancel: () => void;
}) {
  const t = useT();
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setTick((v) => v + 1);
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, []);
  const lines =
    kind === "export"
      ? EXPORT_LINES
      : kind === "weights"
        ? WEIGHT_LINES
        : script === "ja"
          ? [...BUILD_LINES_JA, ...BUILD_LINES.slice(5)]
          : BUILD_LINES;
  // 문구는 약 2.5초마다 바뀐다(500ms × 5)
  const line = lines[Math.floor(tick / 5) % lines.length];
  return (
    <div className="sg-work-backdrop">
      <section
        className="sg-work"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sg-work-title"
        aria-describedby="sg-work-line"
      >
        <h2 id="sg-work-title">{t("작업 중입니다")}</h2>
        <div className="sg-work-percent" aria-live="polite">
          {percent === null ? "…" : Math.round(percent) + "%"}
        </div>
        <div
          className={"sg-work-bar" + (percent === null ? " is-flowing" : "")}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-label={t("작업 진행률")}
        >
          <span style={{ width: (percent ?? 100) + "%" }} />
        </div>
        <p className="sg-work-line" id="sg-work-line">
          {t(line)}… <small>({t("{n}초", { n: seconds })})</small>
        </p>
        {step && <p className="sg-work-step">{t(step)}</p>}
        <p className="sg-work-note">
          {t(
            "기기 성능에 따라 시간이 걸릴 수 있어요. 태블릿·휴대폰은 컴퓨터보다 조금 더 걸려요.",
          )}
        </p>
        <button type="button" className="sg-work-cancel" onClick={onCancel}>
          {t("작업 중단")}
        </button>
      </section>
    </div>
  );
}
