"use client";
// 다음 단계로 넘어가기 전에 한 번 묻는 창. 무엇을 했고 다음에 무엇을 하는지 짧게 알려 주고,
// '네'를 눌러야 넘어간다. '다음부터 묻지 않기'를 고르면 설정에서 다시 켤 때까지 묻지 않는다.
import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

export interface StepAsk {
  question: string;
  detail: string;
  yes: string;
  no: string;
}

export default function StepQuestion({
  ask,
  onYes,
  onNo,
}: {
  ask: StepAsk;
  onYes: (stopAsking: boolean) => void;
  onNo: () => void;
}) {
  const t = useT();
  const [stop, setStop] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    yes.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onNo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNo]);
  return (
    <div className="modal-backdrop" onClick={onNo}>
      <section
        className="settings-modal sg-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sg-ask-question"
        aria-describedby="sg-ask-detail"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="sg-ask-question">{ask.question}</h2>
        <p id="sg-ask-detail">{ask.detail}</p>
        <div className="sg-ask-actions">
          <button type="button" className="sg-ask-no" onClick={onNo}>
            {ask.no}
          </button>
          <button
            ref={yes}
            type="button"
            className="sg-ask-yes"
            onClick={() => onYes(stop)}
          >
            {ask.yes}
          </button>
        </div>
        <label className="sg-ask-stop">
          <input
            type="checkbox"
            checked={stop}
            onChange={(event) => setStop(event.target.checked)}
          />
          {t("다음부터 묻지 않고 바로 넘어가기")}
        </label>
      </section>
    </div>
  );
}
