"use client";

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
  return (
    <div
      className="sg-rewrite"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sg-rewrite-title"
      ref={root}
    >
      <div className="sg-rewrite-card">
        <header>
          <strong className="sg-char" id="sg-rewrite-title">
            {char}
          </strong>
          <p>이 글자만 다시 써요. {characterGuide(char, category)}</p>
          <button className="sg-primary" disabled={busy} onClick={onClose}>
            다 썼어요 · 자모 나누기로 →
          </button>
        </header>
        <div className="sg-rewrite-tools" role="toolbar" aria-label="쓰기 도구">
          <button
            aria-pressed={tool === "pen"}
            disabled={busy}
            onClick={() => setTool("pen")}
          >
            펜
          </button>
          <button
            aria-pressed={tool === "eraser"}
            disabled={busy}
            onClick={() => setTool("eraser")}
          >
            지우개
          </button>
          <button
            disabled={busy || !history?.past.length}
            onClick={() => undo(char)}
          >
            ↶ 취소
          </button>
          <button
            disabled={busy || !history?.future.length}
            onClick={() => redo(char)}
          >
            ↷ 다시
          </button>
          <button
            disabled={busy || !strokes.length}
            onClick={() => commit(char, category, [])}
          >
            ↺ 모두 지우기
          </button>
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
