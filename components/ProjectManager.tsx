"use client";
import { useEffect, useRef, useState } from "react";
import { deleteProject, listProjects } from "../lib/storage";
import type { FontProject } from "../lib/types";
export default function ProjectManager({
  current,
  onClose,
  onTransition,
}: {
  current: FontProject;
  onClose: () => void;
  onTransition: (idOrName: string, create: boolean) => Promise<void>;
}) {
  const [projects, setProjects] = useState<
      Awaited<ReturnType<typeof listProjects>>
    >([]),
    [name, setName] = useState("새 손글씨"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const refresh = () =>
    listProjects().then((items) =>
      setProjects([
        {
          id: current.id,
          name: current.name,
          updatedAt: current.updatedAt,
          count: Object.values(current.samples).filter((s) => s.strokes.length)
            .length,
        },
        ...items.filter((item) => item.id !== current.id),
      ]),
    );
  useEffect(() => {
    refresh().catch(() => setError("프로젝트 목록을 불러오지 못했어요."));
    const before = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => before?.focus();
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "저장하지 못했어요. 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !busy) {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Tab") {
      const items = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input",
        ) ?? [],
      );
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };
  return (
    <div className="project-backdrop">
      <section
        className="project-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-title"
        ref={root}
        onKeyDown={key}
      >
        <header>
          <div>
            <span className="step-kicker">나의 작업 보관함</span>
            <h2 id="projects-title">새로운 글씨를 시작할까요?</h2>
          </div>
          <button
            aria-label="프로젝트 관리 닫기"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <p>
          지금 작업은 그대로 보관해요. 새 프로젝트로 시작하고, 아래 목록에서
          언제든 다시 열 수 있어요.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => onTransition(name, true));
          }}
        >
          <label>
            새 프로젝트 이름
            <input
              aria-label="새 프로젝트 이름"
              maxLength={72}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            className="font-primary"
            type="submit"
            disabled={busy || !name.trim()}
          >
            {busy ? "저장 중…" : "새 폰트 시작하기 →"}
          </button>
        </form>
        <h3>보관한 프로젝트</h3>
        <div className="saved-projects">
          {projects.map((item) => (
            <article key={item.id} data-project-id={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.count}자 작성 ·{" "}
                  {new Date(item.updatedAt).toLocaleDateString("ko-KR")}
                  {item.id === current.id ? " · 현재 작업" : ""}
                </small>
              </div>
              <button
                disabled={busy || item.id === current.id}
                onClick={() => void run(() => onTransition(item.id, false))}
                aria-label={item.name + " 프로젝트 열기"}
              >
                열기
              </button>
              <button
                disabled={busy || item.id === current.id}
                onClick={() => setDeleting(item.id)}
                aria-label={item.name + " 프로젝트 삭제"}
              >
                삭제
              </button>
              {deleting === item.id && (
                <div className="project-delete-confirm">
                  <p>
                    ‘{item.name}’ 프로젝트를 영구 삭제할까요? 이 동작은 되돌릴
                    수 없어요.
                  </p>
                  <button disabled={busy} onClick={() => setDeleting(null)}>
                    취소
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteProject(item.id);
                        setDeleting(null);
                        await refresh();
                      })
                    }
                  >
                    확인하고 삭제
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {error && (
          <p role="alert" className="font-error">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
