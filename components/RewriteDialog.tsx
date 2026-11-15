"use client";
import {
  ArrowRight,
  Eraser,
  PenLine,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, useT } from "../lib/i18n";

import { useEffect, useRef, useState } from "react";
import WritingPad from "./WritingPad";
import { useStudio } from "../lib/store";
import { categoryForChar } from "../lib/safety";
import { characterGuide } from "../lib/character-guide";

/** 자모 나누기 중에 한 글자만 잠깐 다시 쓰고 곧바로 돌아오는 창.
 * 글자 쓰기 단계와 같은 쓰기 칸·도구를 쓰며, 저장도 같은 곳에 됩니다. */
export default function RewriteDialog({
  char,
  onClose,
}: {
  char: string;
  onClose: () => void;
}) {
  const t = useT();
  const project = useStudio((state) => state.project)!;
  const commit = useStudio((state) => state.commit);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const history = useStudio((state) => state.histories[char]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const category = project.samples[char]?.category ?? categoryForChar(char);
  const strokes = project.samples[char]?.strokes ?? [];
  const dark = !!document.querySelector(".studio.dark");
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (busy) return;
      if (event.key === "Escape") onClose();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo(char) : undo(char);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy, char]);
  const tool_ =
    "h-11 gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-card aria-pressed:border-primary aria-pressed:bg-wash aria-pressed:font-semibold aria-pressed:text-primary";
  return (
    <div
      data-ui
      className="sg-rewrite fixed inset-0 z-[90] grid place-items-center bg-[rgb(30_10_10/0.42)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-rewrite-title"
      ref={root}
    >
      <div
        data-ui
        className="sg-rewrite-card grid h-[min(860px,100%)] w-[min(760px,100%)] grid-rows-[auto_auto_minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-background p-4 text-foreground shadow-lift sm:p-5"
      >
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 max-sm:grid-cols-[auto_1fr]">
          <strong
            className="sg-char grid size-14 place-items-center rounded-xl border border-border bg-card font-serif text-4xl leading-none shadow-soft"
            id="sg-rewrite-title"
          >
            {char}
          </strong>
          <p className="m-0 font-serif text-[13.5px] leading-relaxed break-keep text-muted-foreground">
            <b className="font-sans font-semibold text-foreground">
              {t("이 글자만 다시 써요.")}
            </b>{" "}
            {characterGuide(char, category, useLang.getState().lang)}
          </p>
          <Button
            className="sg-primary max-sm:col-span-full"
            disabled={busy}
            onClick={onClose}
          >
            {t("다 썼어요 · 자모 나누기로")}
            <ArrowRight />
          </Button>
        </header>
        <div
          className="sg-rewrite-tools flex flex-wrap gap-1.5"
          role="toolbar"
          aria-label={t("쓰기 도구")}
        >
          <Button
            variant="ghost"
            className={tool_}
            aria-pressed={tool === "pen"}
            disabled={busy}
            onClick={() => setTool("pen")}
          >
            <PenLine />
            {t("펜")}
          </Button>
          <Button
            variant="ghost"
            className={tool_}
            aria-pressed={tool === "eraser"}
            disabled={busy}
            onClick={() => setTool("eraser")}
          >
            <Eraser />
            {t("지우개")}
          </Button>
          <Button
            variant="ghost"
            className={tool_}
            disabled={busy || !history?.past.length}
            onClick={() => undo(char)}
          >
            <Undo2 />
            {t("취소")}
          </Button>
          <Button
            variant="ghost"
            className={tool_}
            disabled={busy || !history?.future.length}
            onClick={() => redo(char)}
          >
            <Redo2 />
            {t("다시")}
          </Button>
          <Button
            variant="ghost"
            className={tool_}
            disabled={busy || !strokes.length}
            onClick={() => commit(char, category, [])}
          >
            <RotateCcw />
            {t("모두 지우기")}
          </Button>
        </div>
        <div className="sg-pad-area sg-rewrite-pad">
          <WritingPad
            char={char}
            category={category}
            strokes={strokes}
            settings={project.settings}
            tool={tool}
            dark={dark}
            onBusy={setBusy}
          />
        </div>
      </div>
    </div>
  );
}
