"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { useT } from "../lib/i18n";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Tip {
  id: string;
  title: string;
  body: ReactNode;
  art: ReactNode;
}

/** 쓰기 팁·자모 나누기 안내가 함께 쓰는 슬라이드 창.
 * 6.5초마다 자동으로 넘어가고, 사용자가 직접 넘기면 자동 넘김을 멈춥니다. */
export default function TipDeck({
  kicker,
  tips,
  doneLabel,
  skipLabel,
  onClose,
}: {
  kicker: string;
  tips: Tip[];
  doneLabel: string;
  skipLabel: string;
  onClose: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);
  const go = (next: number) => {
    setPaused(true);
    setIndex(Math.max(0, Math.min(tips.length - 1, next)));
  };
  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setPaused(true);
        setIndex((i) => Math.min(tips.length - 1, i + 1));
      }
      if (event.key === "ArrowLeft") {
        setPaused(true);
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose, tips.length]);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % tips.length),
      6500,
    );
    return () => clearTimeout(timer);
  }, [index, paused, tips.length]);
  const tip = tips[index];
  const last = index === tips.length - 1;
  return (
    <div
      data-ui
      className="sg-tips-backdrop fixed inset-0 z-[90] grid place-items-center bg-[rgb(30_10_10/0.42)] p-4 backdrop-blur-[2px]"
    >
      <section
        data-ui
        className="sg-tips grid max-h-full w-[min(560px,100%)] gap-4 overflow-auto rounded-2xl border border-border bg-card p-6 pb-4 text-card-foreground shadow-lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-tips-title"
      >
        <Kicker>{kicker}</Kicker>
        <div className="sg-tips-stage" key={index}>
          {tip.art}
          <h2
            id="sg-tips-title"
            className="flex items-start gap-2.5 text-xl leading-snug font-semibold break-keep"
          >
            <b className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-[13px] text-primary-foreground">
              {index + 1}
            </b>
            {tip.title}
          </h2>
          <p className="font-serif text-[15px] leading-[1.7] break-keep text-muted-foreground">
            {tip.body}
          </p>
        </div>
        <div
          data-ui
          className="sg-tips-dots flex justify-center gap-1"
          role="tablist"
          aria-label={t("안내 고르기")}
        >
          {tips.map((item, i) => (
            <button
              key={item.id}
              data-ui
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}. ${item.title}`}
              onClick={() => go(i)}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full"
            >
              <i
                className={cn(
                  "block h-2 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-primary" : "w-2 bg-border",
                )}
              />
            </button>
          ))}
        </div>
        <div className="sg-tips-actions grid grid-cols-[auto_1fr] gap-2">
          <Button
            variant="outline"
            size="lg"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ArrowLeft />
            {t("이전")}
          </Button>
          {last ? (
            <Button ref={primary} size="lg" onClick={onClose}>
              {doneLabel}
            </Button>
          ) : (
            <Button ref={primary} size="lg" onClick={() => go(index + 1)}>
              {t("다음")}
              <ArrowRight />
            </Button>
          )}
        </div>
        <Button
          variant="link"
          className="sg-tips-skip justify-self-center text-[13px] text-muted-foreground"
          onClick={onClose}
        >
          {skipLabel}
        </Button>
      </section>
    </div>
  );
}
