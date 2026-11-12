"use client";

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
    <div className="sg-tips-backdrop">
      <section
        className="sg-tips"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-tips-title"
      >
        <span className="sg-tips-kicker">{kicker}</span>
        <div className="sg-tips-stage" key={index}>
          {tip.art}
          <h2 id="sg-tips-title">
            <b>{index + 1}</b> {tip.title}
          </h2>
          <p>{tip.body}</p>
        </div>
        <div className="sg-tips-dots" role="tablist" aria-label="안내 고르기">
          {tips.map((item, i) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}. ${item.title}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <div className="sg-tips-actions">
          <button
            className="fw-secondary"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            ← 이전
          </button>
          {last ? (
            <button ref={primary} className="fw-primary" onClick={onClose}>
              {doneLabel}
            </button>
          ) : (
            <button
              ref={primary}
              className="fw-primary"
              onClick={() => go(index + 1)}
            >
              다음 →
            </button>
          )}
        </div>
        <button className="sg-tips-skip" onClick={onClose}>
          {skipLabel}
        </button>
      </section>
    </div>
  );
}
