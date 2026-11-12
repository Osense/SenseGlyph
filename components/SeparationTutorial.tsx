"use client";

import { useEffect, useRef } from "react";
import { PART_COLORS } from "../lib/font/composition";

export const TUTORIAL_KEY = "senseglyph-separation-tutorial-v1";

/** 자모 나누기 첫 진입 안내: '한'을 예로 올가미 선택 → 초성 버튼, 획 터치 → 종성 버튼을 반복해서 보여 줍니다. */
export default function SeparationTutorial({
  onClose,
}: {
  onClose: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const style = {
    "--cho": PART_COLORS.cho,
    "--jung": PART_COLORS.jung,
    "--jong": PART_COLORS.jong,
  } as React.CSSProperties;
  return (
    <div
      className="sg-tutorial"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-tutorial-title"
      style={style}
    >
      <div className="sg-tutorial-card">
        <h2 id="sg-tutorial-title">이렇게 나눠요</h2>
        <svg viewBox="0 0 1000 1000" aria-hidden="true">
          <rect
            x="40"
            y="40"
            width="920"
            height="920"
            rx="24"
            className="tut-sheet"
          />
          {/* ㅎ */}
          <g className="tut-cho">
            <path d="M300 165 L370 190" />
            <path d="M200 260 L460 255" />
            <circle cx="330" cy="390" r="80" />
          </g>
          {/* ㅏ: 자동으로 이미 중성 */}
          <g className="tut-jung">
            <path d="M610 130 L605 570" />
            <path d="M610 350 L720 345" />
          </g>
          {/* ㄴ */}
          <g className="tut-jong">
            <path d="M250 640 L255 830 L780 820" />
          </g>
          <path
            className="tut-lasso"
            d="M160 140 C 330 70, 520 120, 510 300 C 505 520, 330 540, 210 500 C 120 470, 110 260, 160 140 Z"
          />
          <rect
            className="tut-pick tut-pick-cho"
            x="175"
            y="140"
            width="320"
            height="345"
            rx="12"
          />
          <rect
            className="tut-pick tut-pick-jong"
            x="215"
            y="610"
            width="600"
            height="250"
            rx="12"
          />
          <g className="tut-buttons tut-buttons-cho">
            <rect x="140" y="40" width="390" height="80" rx="16" />
            <text x="205" y="94" className="is-cho">
              초성
            </text>
            <text x="310" y="94">
              중성
            </text>
            <text x="415" y="94">
              종성
            </text>
            <circle cx="240" cy="80" r="44" className="tut-tap" />
          </g>
          <g className="tut-buttons tut-buttons-jong">
            <rect x="320" y="510" width="390" height="80" rx="16" />
            <text x="385" y="564">
              초성
            </text>
            <text x="490" y="564">
              중성
            </text>
            <text x="595" y="564" className="is-jong">
              종성
            </text>
            <circle cx="630" cy="550" r="44" className="tut-tap tut-tap-2" />
          </g>
          <circle cx="520" cy="826" r="34" className="tut-finger" />
        </svg>
        <ol>
          <li className="tut-step-1">
            <b>둘러싸거나 톡</b> 손가락이나 펜으로 획을 둘러싸거나 눌러서
            골라요.
          </li>
          <li className="tut-step-2">
            <b>초성·중성·종성</b> 선택한 획 위에 뜬 버튼을 누르면 색이 바뀌어요.
          </li>
          <li className="tut-step-3">
            <b>이대로 좋아요 ✓</b> 다 맞으면 눌러서 다음 글자로 넘어가요.
          </li>
        </ol>
        <button ref={button} className="fw-primary" onClick={onClose}>
          알겠어요
        </button>
      </div>
    </div>
  );
}
