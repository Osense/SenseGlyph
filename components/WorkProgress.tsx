"use client";
// 폰트를 만들거나 파일을 꾸리는 동안 띄우는 작업 창: 퍼센트 게이지, 지금 하는 일, 중단 버튼.
// 기기마다 시간이 다르게 걸리므로(태블릿은 느림) 기다리는 동안 무슨 일을 하는지 짧게 보여 준다.
import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import { Square } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <AlertDialog open>
      <AlertDialogContent
        className="sg-work gap-5 sm:max-w-[420px]"
        aria-describedby="sg-work-line"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-4">
          <AlertDialogTitle
            id="sg-work-title"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            {t("작업 중입니다")}
          </AlertDialogTitle>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {t("{n}초", { n: seconds })}
          </span>
        </div>
        <div className="grid gap-3">
          <div
            className="sg-work-percent font-mono text-5xl leading-none font-semibold tracking-tight text-foreground tabular-nums"
            aria-live="polite"
          >
            {percent === null ? "…" : Math.round(percent)}
            {percent !== null && (
              <span className="ml-0.5 text-2xl text-muted-foreground">%</span>
            )}
          </div>
          <div
            className={cn(
              "sg-work-bar relative h-2 overflow-hidden rounded-full bg-muted",
              percent === null && "is-flowing",
            )}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            aria-label={t("작업 진행률")}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500",
                percent === null &&
                  "w-1/3 animate-[sg-flow_1.2s_ease-in-out_infinite]",
              )}
              style={percent === null ? undefined : { width: percent + "%" }}
            />
          </div>
        </div>
        <div className="grid gap-1">
          <p
            className="sg-work-line m-0 text-[14px] font-medium text-foreground"
            id="sg-work-line"
          >
            {t(line)}…
          </p>
          {step && (
            <p className="sg-work-step m-0 text-[13px] text-muted-foreground">
              {t(step)}
            </p>
          )}
        </div>
        <p className="sg-work-note m-0 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t(
            "기기 성능에 따라 시간이 걸릴 수 있어요. 태블릿·휴대폰은 컴퓨터보다 조금 더 걸려요.",
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="sg-work-cancel justify-self-end"
          onClick={onCancel}
        >
          <Square className="size-3.5 fill-current" />
          {t("작업 중단")}
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
}
