"use client";
// 쎈스 글리프 화면 곳곳에서 쓰는 작은 조각들(shadcn/ui 위에 얹은 앱 전용 모양).
import * as React from "react";
import { cn } from "@/lib/utils";

/** 두세 개 중 하나를 고르는 알약 모양 버튼 묶음(따라 쓰기/보고 쓰기 등) */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  className,
  size = "default",
  locked,
  "data-lock-zone": lockZone,
}: {
  "data-lock-zone"?: string;
  value: T;
  options: readonly { id: T; label: React.ReactNode }[];
  onChange: (id: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
  /** 필기 중 잠김 표시(data-ink-locked) */
  locked?: boolean;
}) {
  return (
    <div
      data-ui
      role="group"
      aria-label={label}
      data-lock-zone={lockZone}
      className={cn(
        "sg-segment inline-flex shrink-0 items-center gap-0.5 rounded-xl bg-muted p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          data-ui
          type="button"
          aria-pressed={value === option.id}
          data-ink-locked={locked || undefined}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3.5 font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] hover:text-foreground disabled:cursor-default disabled:opacity-50",
            "aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-soft",
            size === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 카드 모양 칸 */
export function Panel({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"section"> & {
  tone?: "default" | "danger" | "accent" | "muted";
}) {
  return (
    <section
      data-ui
      className={cn(
        "rounded-xl border p-4 text-card-foreground",
        tone === "default" && "border-border bg-card shadow-soft",
        tone === "danger" && "border-destructive/40 bg-destructive-wash",
        tone === "accent" && "border-primary/30 bg-wash",
        tone === "muted" && "border-transparent bg-muted",
        className,
      )}
      {...props}
    />
  );
}

/** 이름 + 오른쪽 값이 붙는 슬라이더 머리 */
export function FieldHead({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-sm",
        className,
      )}
    >
      <span className="font-medium text-foreground">{label}</span>
      {value !== undefined && (
        <b className="font-mono text-[13px] font-semibold text-primary tabular-nums">
          {value}
        </b>
      )}
    </div>
  );
}

/** 작은 대문자 라벨(단계 번호 등) */
export function Kicker({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-ui
      className={cn(
        "m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-primary uppercase",
        className,
      )}
      {...props}
    />
  );
}
