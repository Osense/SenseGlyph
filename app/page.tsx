"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CHARSET } from "../data/charset";
import { newProject } from "../lib/defaults";
import { BASE_PATH } from "../lib/base-path";
import {
  loadProject,
  saveProject,
  parseProject,
  startProject,
  switchProject,
} from "../lib/storage";
import { useStudio } from "../lib/store";
import WritingPad from "../components/WritingPad";
import PixelSizeControl from "../components/PixelSizeControl";
import FontWorkshop from "../components/FontWorkshop";
import { REFERENCE_FONTS, referenceStack } from "../lib/reference-fonts";
import { projectIssues } from "../lib/review";
import { BrushPreview, Reference, Thumbnail } from "../components/Preview";
import type { BrushId, CharCategory, ProjectSettings } from "../lib/types";
import JourneySetup from "../components/JourneySetup";
import { characterGuide } from "../lib/character-guide";
import { gsap } from "gsap";
import ProjectManager from "../components/ProjectManager";
const STEPS = ["브러시", "견본", "글자 쓰기", "자모 나누기", "폰트 만들기"];
const BRUSHES: { id: BrushId; label: string }[] = [
  { id: "pen", label: "펜" },
  { id: "marker", label: "마커" },
  { id: "brush", label: "붓" },
  { id: "pencil", label: "연필" },
  { id: "nib", label: "납작펜" },
  { id: "pixel", label: "픽셀펜" },
];
export default function Page() {
  const {
    project,
    setProject,
    settings: update,
    commit,
    undo,
    redo,
    histories,
    rename,
    markReview,
  } = useStudio();
  const [index, setIndex] = useState(0),
    [step, setStep] = useState(0),
    [listFilter, setListFilter] = useState<"all" | "review" | "unsafe">("all"),
    [tool, setTool] = useState<"pen" | "eraser">("pen"),
    [modal, setModal] = useState(false),
    [projectsOpen, setProjectsOpen] = useState(false),
    [fontOpen, setFontOpen] = useState(false),
    [fontReviewChar, setFontReviewChar] = useState<string | undefined>(),
    [dark, setDark] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [toastUndo, setToastUndo] = useState(false),
    [saved, setSaved] = useState("불러오는 중"),
    [enabled, setEnabled] = useState<CharCategory[]>(
      CATEGORIES.map((c) => c.id),
    );
  const file = useRef<HTMLInputElement>(null),
    stageRoot = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    switching = useRef(false),
    saveChain = useRef(Promise.resolve());
  const changeStep = (next: number) => {
    if (busy) return;
    setStep(next);
    setFontOpen(next >= 3);
    setFontReviewChar(undefined);
    try {
      localStorage.setItem("hanhoek-journey", String(next));
    } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.has("step")) {
      url.searchParams.delete("step");
      window.history.replaceState(null, "", url);
    }
  };
  useEffect(() => {
    const motion = gsap.matchMedia();
    motion.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.fromTo(
          ".journey-panel",
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.42,
            ease: "power2.out",
            clearProps: "all",
          },
        );
        gsap.fromTo(
          ".journey-track .is-current .step-number",
          { scale: 0.88 },
          { scale: 1, duration: 0.35, ease: "power2.out" },
        );
      },
      stageRoot,
    );
    stageRoot.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
    return () => motion.revert();
  }, [step, !!project]);
  const chars = CHARSET.filter((c) => enabled.includes(c.category));
  const issues = useMemo(
    () => projectIssues(project),
    [
      project?.samples,
      project?.fontPreparation?.separations,
      project?.settings.referenceFont,
      project?.settings.grid.diamond,
    ],
  );
  const reviewChars = CHARSET.filter((entry) => issues[entry.char]?.length);
  const unsafeChars = reviewChars.filter((entry) =>
    issues[entry.char].some((issue) => issue.kind === "unsafe"),
  );
  const navigationChars =
    listFilter === "review"
      ? reviewChars
      : listFilter === "unsafe"
        ? unsafeChars
        : chars;
  const current = CHARSET[Math.max(0, Math.min(index, CHARSET.length - 1))],
    char = current.char,
    category = current.category;
  const currentPosition = navigationChars.findIndex(
    (entry) => entry.char === char,
  );
  const currentIssues = issues[char] ?? [];
  const strokes = project?.samples[char]?.strokes ?? [],
    s = project?.settings;
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const notify = (message: string, canUndo = false) => {
    setToast(message);
    setToastUndo(canUndo);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3000);
  };
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedFont = query.has("font");
    const stepParameter = query.has("step") ? Number(query.get("step")) : null;
    const requestedStep = requestedFont
      ? 4
      : stepParameter !== null &&
          Number.isInteger(stepParameter) &&
          stepParameter >= 0 &&
          stepParameter <= 4
        ? stepParameter
        : null;
    if (requestedStep !== null) {
      setStep(requestedStep);
      setFontOpen(requestedStep >= 3);
    }
    if (requestedFont) {
      setFontOpen(true);
      setStep(4);
    }
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register(BASE_PATH + "/sw.js").catch(() => {});
    let alive = true;
    loadProject()
      .then((p) => {
        if (alive) {
          setProject(p ?? newProject());
          if (requestedStep === null && p) {
            let savedStep = 2;
            try {
              savedStep = Number(localStorage.getItem("hanhoek-journey") ?? 2);
            } catch {}
            const resumed =
              Number.isInteger(savedStep) && savedStep >= 0 && savedStep <= 4
                ? savedStep
                : 2;
            setStep(resumed);
            setFontOpen(resumed >= 3);
          }
          setSaved("기기에 저장됨");
        }
      })
      .catch(() => {
        if (alive) {
          setProject(newProject());
          setSaved("저장소 접근 실패 · JSON 백업을 사용하세요");
        }
      });
    try {
      const pref = JSON.parse(localStorage.getItem("hanhoek-ui") ?? "{}");
      setDark(!!pref.dark);
      if (Array.isArray(pref.enabled))
        setEnabled(
          CATEGORIES.filter(
            (c) =>
              c.required ||
              pref.enabled.includes(c.id) ||
              (!pref.journeyVersion && c.id === "korean-punct"),
          ).map((c) => c.id),
        );
    } catch {}
    return () => {
      alive = false;
    };
  }, [setProject]);
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(
        "hanhoek-ui",
        JSON.stringify({ dark, enabled, journeyVersion: 1 }),
      );
    } catch {
      /* UI 선호 저장이 차단돼도 벡터 입력은 계속 허용한다. */
    }
  }, [dark, enabled, project]);
  const persist = () => {
    if (switching.current) return saveChain.current;
    const p = useStudio.getState().project;
    if (!p) return;
    setSaved("저장 중…");
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() => saveProject(p))
      .then(() =>
        setSaved(
          useStudio.getState().project === p
            ? "저장됨 · " +
                new Date().toLocaleTimeString("ko-KR", { hour12: false })
            : "저장 대기 중",
        ),
      )
      .catch(() => setSaved("저장 실패 · JSON으로 백업하세요"));
    return saveChain.current;
  };
  useEffect(() => {
    if (!project) return;
    setSaved("저장 대기 중");
    const t = setTimeout(persist, 500);
    saveTimer.current = t;
    return () => clearTimeout(t);
  }, [project]);
  const transitionProject = async (value: string, create: boolean) => {
    if (switching.current) return;
    switching.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await saveChain.current.catch(() => {});
      const current = useStudio.getState().project!;
      const next = await (create
        ? startProject(current, value)
        : switchProject(current, value));
      setProject(next);
      setIndex(0);
      setListFilter("all");
      setTool("pen");
      setProjectsOpen(false);
      changeStep(create ? 0 : 2);
      setSaved("기기에 저장됨");
      notify(
        create
          ? "새 폰트를 시작했어요. 이전 작업은 보관함에 있어요."
          : "보관한 프로젝트를 열었어요.",
      );
    } finally {
      switching.current = false;
    }
  };
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", persist);
    };
  }, []);
  const go = (delta: number) => {
    if (busy || !navigationChars.length) return;
    const candidates = navigationChars.filter((entry) =>
      delta > 0
        ? CHARSET.findIndex((item) => item.char === entry.char) > index
        : CHARSET.findIndex((item) => item.char === entry.char) < index,
    );
    const target =
      delta > 0 ? candidates[0] : candidates[candidates.length - 1];
    const fallback =
      listFilter === "all"
        ? undefined
        : delta > 0
          ? navigationChars[0]
          : navigationChars[navigationChars.length - 1];
    if (target ?? fallback)
      setIndex(
        CHARSET.findIndex((entry) => entry.char === (target ?? fallback)!.char),
      );
  };
  const selectFilter = (filter: "all" | "review" | "unsafe") => {
    setListFilter(filter);
    const entries =
      filter === "review"
        ? reviewChars
        : filter === "unsafe"
          ? unsafeChars
          : chars;
    if (filter === "all" && !enabled.includes(category))
      setEnabled((previous) => [...previous, category]);
    else if (entries.length && !entries.some((entry) => entry.char === char))
      setIndex(CHARSET.findIndex((entry) => entry.char === entries[0].char));
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        modal ||
        projectsOpen ||
        fontOpen ||
        step !== 2 ||
        busy ||
        (e.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo(char) : undo(char);
      } else if (!mod) {
        if (e.key.toLowerCase() === "e") setTool("eraser");
        if (e.key.toLowerCase() === "p") setTool("pen");
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    char,
    modal,
    projectsOpen,
    fontOpen,
    busy,
    navigationChars,
    listFilter,
    step,
  ]);
  useEffect(() => {
    if (toastUndo) {
      setToast("");
      setToastUndo(false);
    }
    const selected = document.getElementById("glyph-" + char),
      strip = selected?.parentElement;
    if (selected && strip)
      strip.scrollTo({
        left:
          selected.offsetLeft -
          strip.offsetLeft -
          strip.clientWidth / 2 +
          selected.offsetWidth / 2,
        behavior: "smooth",
      });
  }, [char, listFilter, step, project?.id]);
  useEffect(() => {
    if (!modal) return;
    const prev = document.activeElement as HTMLElement | null;
    const dialog = document.getElementById("settings-dialog");
    dialog?.querySelector<HTMLElement>("button,input")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(false);
      if (e.key === "Tab") {
        const items = Array.from(
          dialog?.querySelectorAll<HTMLElement>("button,input,select") ?? [],
        ).filter((x) => !x.hasAttribute("disabled"));
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
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      prev?.focus();
    };
  }, [modal]);
  const exportJSON = () => {
    if (!project) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = (project.name || "손글씨") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importJSON = async (f: File) => {
    try {
      if (f.size > 100 * 1024 * 1024) throw Error("백업 파일이 너무 큽니다.");
      const p = parseProject(await f.text());
      setProject(p);
      setIndex(0);
      setListFilter("all");
      notify("새 프로젝트로 가져왔습니다");
    } catch (e) {
      notify(e instanceof Error ? e.message : "가져오기 실패");
    }
  };
  if (!project || !s)
    return (
      <main className="loading">
        <span className="brand-mark" aria-hidden="true">ㅅ</span>
        <p>센스글리프를 여는 중…</p>
      </main>
    );
  const params = s.brushParams[s.activeBrush],
    history = histories[char];
  const done = chars.filter(
    (c) =>
      project.samples[c.char]?.status === "done" && !issues[c.char]?.length,
  ).length;
  const isLast = currentPosition === navigationChars.length - 1;
  const setGrid = (key: keyof ProjectSettings["grid"]) =>
    update({ grid: { ...s.grid, [key]: !s.grid[key] } });
  return (
    <main
      ref={stageRoot}
      className={
        (dark ? "studio dark" : "studio") + " journey journey-step-" + step
      }
    >
      <header className="topbar">
        <a className="brand" href="./">
          <span className="brand-mark" aria-hidden="true">ㅅ</span>
          <span>
            센스글리프<small className="brand-credit">OSNS.studio 제작</small>
          </span>
        </a>
        <span className="journey-tagline">손글씨가 글꼴이 되는 다섯 걸음</span>
        <div className="top-actions">
          <button
            className="new-project-trigger"
            aria-label="처음부터 다시하기"
            disabled={busy}
            onClick={() => setProjectsOpen(true)}
          >
            <span>처음부터 다시하기</span>
            <small>새 폰트</small>
          </button>
          <span className="save-state" role="status">
            <i /> {saved}
          </span>
          <button
            className="make-font-button"
            disabled={busy}
            onClick={() => changeStep(3)}
          >
            자모 확인하기 →
          </button>
          <button
            className="icon-button"
            onClick={() => setModal(true)}
            disabled={busy}
            aria-label="설정 열기"
          >
            ⚙
          </button>
        </div>
      </header>
      <nav className="journey-track" aria-label="서비스 이용 순서">
        {STEPS.map((label, position) => (
          <button
            key={label}
            className={
              step === position
                ? "is-current"
                : position < step
                  ? "is-past"
                  : ""
            }
            aria-current={step === position ? "step" : undefined}
            disabled={busy}
            onClick={() => changeStep(position)}
          >
            <span className="step-number">
              {String(position + 1).padStart(2, "0")}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {step < 2 && (
        <JourneySetup
          step={step}
          settings={s}
          update={update}
          next={() => changeStep(step + 1)}
        />
      )}
      {step === 2 && (
        <>
          <section className="writing-intro journey-panel">
            <div>
              <span className="step-kicker">03 / 한 글자씩, 차근차근</span>
              <h1 tabIndex={-1}>이제 한 글자씩 써봅시다!</h1>
            </div>
            <button onClick={() => changeStep(3)} disabled={busy}>
              쓴 글자로 자모 나누기 →
            </button>
          </section>
          <section className="workspace journey-panel">
            <aside className="tools" aria-label="그리기 도구">
              <div className="section-label">
                쓰는 도구{" "}
                <button className="change-brush" onClick={() => changeStep(0)}>
                  바꾸기
                </button>
              </div>
              <div className="brushes">
                {BRUSHES.map((b) => (
                  <button
                    key={b.id}
                    className={
                      "brush-button " +
                      (s.activeBrush === b.id && tool === "pen"
                        ? "selected"
                        : "")
                    }
                    disabled={busy}
                    onClick={() => {
                      update({ activeBrush: b.id });
                      setTool("pen");
                    }}
                  >
                    <span>{b.label}</span>
                    <BrushPreview brush={b.id} />
                  </button>
                ))}
              </div>
              <div className="tool-divider" />
              <div className="pen-options" hidden={tool === "eraser"}>
                <label className="slider-label">
                  굵기 <b>{params.size}</b>
                  <input
                    aria-label="펜 굵기"
                    type="range"
                    min="20"
                    max="120"
                    value={params.size}
                    disabled={busy}
                    onChange={(e) =>
                      update({
                        brushParams: {
                          ...s.brushParams,
                          [s.activeBrush]: { ...params, size: +e.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={params.usePressure}
                    disabled={busy}
                    onChange={(e) =>
                      update({
                        brushParams: {
                          ...s.brushParams,
                          [s.activeBrush]: {
                            ...params,
                            usePressure: e.target.checked,
                          },
                        },
                      })
                    }
                  />
                  필압 반영
                </label>
                {s.activeBrush === "pixel" && (
                  <PixelSizeControl
                    params={params}
                    disabled={busy}
                    onChange={(pixel) =>
                      update({ brushParams: { ...s.brushParams, pixel } })
                    }
                  />
                )}
                {s.activeBrush === "nib" && (
                  <label className="slider-label">
                    펜촉 각도 <b>{params.nibAngle}°</b>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      value={params.nibAngle}
                      onChange={(e) =>
                        update({
                          brushParams: {
                            ...s.brushParams,
                            nib: { ...params, nibAngle: +e.target.value },
                          },
                        })
                      }
                    />
                  </label>
                )}
              </div>
              <div className="tool-divider" />
              <button
                className={
                  "wide-button " + (tool === "eraser" ? "selected" : "")
                }
                disabled={busy}
                onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              >
                ◇ 지우개 <kbd>E</kbd>
              </button>
              {tool === "eraser" && (
                <div className="eraser-controls">
                  <select
                    aria-label="지우개 모드"
                    value={s.eraserMode}
                    disabled={busy}
                    onChange={(e) =>
                      update({
                        eraserMode: e.target.value as "stroke" | "partial",
                      })
                    }
                  >
                    <option value="stroke">획 전체 지우기</option>
                    <option value="partial">부분 지우기</option>
                  </select>
                  <label className="slider-label">
                    크기 <b>{s.eraserSize}</b>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      value={s.eraserSize}
                      disabled={busy}
                      onChange={(e) => update({ eraserSize: +e.target.value })}
                    />
                  </label>
                </div>
              )}
              <div className="history-buttons">
                <button
                  disabled={busy || !history?.past.length}
                  onClick={() => undo(char)}
                  aria-label="실행 취소"
                >
                  ↶
                </button>
                <button
                  disabled={busy || !history?.future.length}
                  onClick={() => redo(char)}
                  aria-label="다시 실행"
                >
                  ↷
                </button>
              </div>
              <button
                className="reset-button"
                disabled={busy || !strokes.length}
                onClick={() => {
                  commit(char, category, []);
                  notify("다시 쓸 준비가 됐어요", true);
                }}
              >
                ↺ 다시쓰기
              </button>
            </aside>
            <div
              className={
                "writing-area" + (s.writingSize ? " custom-writing-size" : "")
              }
              style={
                s.writingSize
                  ? ({
                      "--writing-size": `${s.writingSize}px`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="character-instruction">
                <div>
                  <strong>{char}</strong>
                  <span>
                    {cat.label} · {currentPosition + 1} /{" "}
                    {navigationChars.length}
                  </span>
                </div>
                <p>{characterGuide(char, category)}</p>
              </div>
              <div className="mobile-ink-tools" aria-label="간단한 그리기 도구">
                <button
                  aria-pressed={tool === "pen"}
                  onClick={() => setTool("pen")}
                  disabled={busy}
                >
                  펜
                </button>
                <button
                  aria-pressed={tool === "eraser"}
                  onClick={() => setTool("eraser")}
                  disabled={busy}
                >
                  지우개
                </button>
                <button
                  aria-label="간단 실행 취소"
                  onClick={() => undo(char)}
                  disabled={busy || !history?.past.length}
                >
                  ↶
                </button>
                <button
                  aria-label="간단 다시 실행"
                  onClick={() => redo(char)}
                  disabled={busy || !history?.future.length}
                >
                  ↷
                </button>
                <button
                  onClick={() => {
                    commit(char, category, []);
                    notify("다시 쓸 준비가 됐어요", true);
                  }}
                  disabled={busy || !strokes.length}
                >
                  다시쓰기
                </button>
              </div>
              <div className="canvas-toolbar">
                <div className="mode-tabs" aria-label="견본 표시">
                  {(
                    [
                      { id: "inside-faint", label: "따라 쓰기" },
                      { id: "outside", label: "보고 쓰기" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      disabled={busy}
                      className={s.sampleMode === m.id ? "active" : ""}
                      onClick={() => update({ sampleMode: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <label className="writing-size-control">
                  쓰기 칸 <b>{s.writingSize ? `${s.writingSize}px` : "자동"}</b>
                  <input
                    aria-label="쓰기 칸 크기"
                    type="range"
                    min="180"
                    max="900"
                    step="20"
                    value={s.writingSize ?? 400}
                    disabled={busy}
                    onChange={(e) => update({ writingSize: +e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => update({ writingSize: undefined })}
                  >
                    자동
                  </button>
                </label>
              </div>
              <WritingPad
                key={char}
                char={char}
                category={category}
                strokes={strokes}
                settings={s}
                tool={tool}
                dark={dark}
                onBusy={setBusy}
                navigation={{
                  previousDisabled:
                    busy ||
                    (listFilter === "all"
                      ? currentPosition <= 0
                      : navigationChars.every((entry) => entry.char === char)),
                  nextDisabled: busy,
                  onPrevious: () => go(-1),
                  onNext: () =>
                    listFilter !== "all"
                      ? navigationChars.length
                        ? go(1)
                        : selectFilter("all")
                      : isLast
                        ? changeStep(3)
                        : go(1),
                }}
              />
              <div className="canvas-footer">
                <span>
                  <i className="small-dot" />
                  {s.penOnly ? "펜 전용 입력" : "펜 또는 터치로 입력"}
                  {s.allowMouse ? " · 마우스 허용" : ""}
                </span>
                <span>{strokes.length}획 · 자동 저장</span>
              </div>
              <p className="safety-caption">
                {category.startsWith("hangul")
                  ? "갈색 점선은 한글 안전영역입니다. 획의 가장자리까지 안쪽에 써주세요."
                  : "기준선 아래는 디센더·문장부호 영역입니다. 아래쪽 점선까지 사용할 수 있어요."}
              </p>
              <div className="grid-tools">
                {category.startsWith("hangul") ? (
                  <>
                    <span>가이드</span>
                    <button
                      disabled={busy}
                      className={
                        s.grid.halfVertical || s.grid.halfHorizontal
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        const on = !(
                          s.grid.halfVertical || s.grid.halfHorizontal
                        );
                        update({
                          grid: {
                            ...s.grid,
                            halfVertical: on,
                            halfHorizontal: on,
                          },
                        });
                      }}
                    >
                      ⊞ 2분할
                    </button>
                    <button
                      disabled={busy}
                      className={s.grid.diamond ? "active" : ""}
                      onClick={() => setGrid("diamond")}
                    >
                      ◇ 다이아몬드
                    </button>
                    <button
                      disabled={busy}
                      className={s.grid.sizeGuide ? "active" : ""}
                      onClick={() => setGrid("sizeGuide")}
                    >
                      □ 크기
                    </button>
                  </>
                ) : (
                  <div
                    className="metric-guide-legend"
                    aria-label="영문 기호 기준선 가이드"
                  >
                    <span>cap 230 · x 420</span>
                    <strong>기준선 800</strong>
                    <span>디센더 950</span>
                  </div>
                )}
              </div>
            </div>
            <aside className="reference-panel">
              <div
                className="reference-font-picker"
                role="radiogroup"
                aria-label="견본 글꼴"
              >
                {REFERENCE_FONTS.map((font) => (
                  <button
                    key={font.id}
                    role="radio"
                    aria-checked={(s.referenceFont ?? "sans") === font.id}
                    disabled={busy}
                    className={
                      (s.referenceFont ?? "sans") === font.id ? "selected" : ""
                    }
                    onClick={() => update({ referenceFont: font.id })}
                  >
                    <span style={{ fontFamily: referenceStack(font.id) }}>
                      한글
                    </span>
                    <small>{font.label}</small>
                  </button>
                ))}
              </div>

              <div className="section-label">YOUR HANDWRITING</div>
              {s.sampleMode === "outside" && (
                <Reference
                  char={char}
                  settings={s}
                  latin={!category.startsWith("hangul")}
                  dark={dark}
                  category={category}
                />
              )}
              {s.sampleMode === "inside-faint" && (
                <label className="slider-label opacity-control">
                  견본 농도 <b>{Math.round(s.sampleOpacity * 100)}%</b>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    value={Math.round(s.sampleOpacity * 100)}
                    onChange={(e) =>
                      update({ sampleOpacity: +e.target.value / 100 })
                    }
                  />
                </label>
              )}
              <section
                className={
                  "review-card " + (currentIssues.length ? "has-issues" : "")
                }
                aria-label="현재 글자 확인 상태"
              >
                <div className="review-card-heading">
                  <strong>
                    {currentIssues.length ? "다시 확인할 글자" : "글자 확인"}
                  </strong>
                  <span>
                    {currentIssues.length
                      ? currentIssues.length + "개 항목"
                      : strokes.length
                        ? "문제 없음"
                        : "미작성"}
                  </span>
                </div>
                {currentIssues.length > 0 && (
                  <p className="review-reasons" role="status">
                    {currentIssues.map((issue) => issue.label).join(" · ")}
                  </p>
                )}
                <div className="review-actions">
                  <button
                    disabled={busy}
                    aria-pressed={!!project.samples[char]?.needsReview}
                    onClick={() =>
                      markReview(
                        char,
                        category,
                        !project.samples[char]?.needsReview,
                      )
                    }
                  >
                    {project.samples[char]?.needsReview
                      ? "직접 표시 해제"
                      : "다시 확인 표시"}
                  </button>
                  {currentIssues.some(
                    (issue) => issue.kind === "components",
                  ) && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        changeStep(3);
                        setFontReviewChar(char);
                      }}
                    >
                      자모 확인
                    </button>
                  )}
                </div>
              </section>
              <div className="next-block">
                <span className="section-label">
                  {listFilter === "all" ? "진행" : "확인 목록"}{" "}
                  {currentPosition >= 0
                    ? currentPosition + 1
                    : "현재 글자 완료"}{" "}
                  / {navigationChars.length}
                </span>
                <div className="navigation">
                  <button
                    disabled={
                      busy ||
                      (listFilter === "all"
                        ? currentPosition <= 0
                        : navigationChars.every((entry) => entry.char === char))
                    }
                    onClick={() => go(-1)}
                  >
                    ← 이전
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      listFilter !== "all"
                        ? navigationChars.length
                          ? go(1)
                          : selectFilter("all")
                        : isLast
                          ? changeStep(3)
                          : go(1)
                    }
                  >
                    {listFilter !== "all" && !navigationChars.length
                      ? "전체 글자로 →"
                      : listFilter === "all" && isLast
                        ? "자모 나누기 →"
                        : "다음 →"}
                  </button>
                </div>
                <button
                  className="skip-button"
                  disabled={busy}
                  onClick={() => {
                    commit(char, category, strokes, "skipped");
                    go(1);
                  }}
                >
                  지금은 건너뛰기
                </button>
                <p className="tiny-note">
                  언제든 아래 글자를 눌러 돌아올 수 있어요.
                </p>
              </div>
            </aside>
          </section>
          <footer className="progress-panel">
            <div className="progress-heading">
              <div>
                <strong>나의 글자 모음</strong>
                <span>
                  {done} / {chars.length} 완료
                </span>
              </div>
              <div
                className="strip-filters"
                role="group"
                aria-label="글자 목록 필터"
              >
                <button
                  disabled={busy}
                  aria-pressed={listFilter === "all"}
                  onClick={() => selectFilter("all")}
                >
                  전체 <b>{chars.length}</b>
                </button>
                <button
                  disabled={busy}
                  aria-pressed={listFilter === "review"}
                  onClick={() => selectFilter("review")}
                >
                  다시 확인 <b>{reviewChars.length}</b>
                </button>
                <button
                  disabled={busy}
                  aria-pressed={listFilter === "unsafe"}
                  onClick={() => selectFilter("unsafe")}
                >
                  영역 벗어남 <b>{unsafeChars.length}</b>
                </button>
              </div>
              <select
                aria-label="카테고리로 이동"
                value={category}
                disabled={busy || !navigationChars.length}
                onChange={(e) => {
                  const target = navigationChars.find(
                    (entry) => entry.category === e.target.value,
                  );
                  if (target)
                    setIndex(CHARSET.findIndex((c) => c.char === target.char));
                }}
              >
                {CATEGORIES.filter((c) =>
                  listFilter === "all"
                    ? enabled.includes(c.id)
                    : navigationChars.some(
                        (entry) => entry.category === c.id,
                      ) || category === c.id,
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} {c.chars.length}
                  </option>
                ))}
              </select>
            </div>
            <div className="progress-track">
              <div style={{ width: (done / chars.length) * 100 + "%" }} />
            </div>
            <div
              className="glyph-strip"
              aria-label={
                listFilter === "all"
                  ? "전체 글자 목록"
                  : listFilter === "unsafe"
                    ? "안전영역 벗어난 글자 목록"
                    : "다시 확인할 글자 목록"
              }
            >
              {!navigationChars.length && (
                <div className="strip-empty" role="status">
                  {listFilter === "unsafe"
                    ? "안전영역을 벗어난 글자가 없습니다."
                    : "다시 확인할 글자가 없습니다."}
                  <button onClick={() => selectFilter("all")}>
                    전체 글자 보기
                  </button>
                </div>
              )}
              {navigationChars.map((c, i) => {
                const sample = project.samples[c.char];
                const problems = issues[c.char] ?? [],
                  unsafe = problems.some((issue) => issue.kind === "unsafe");
                return (
                  <button
                    id={"glyph-" + c.char}
                    key={c.char}
                    disabled={busy}
                    aria-label={
                      c.char +
                      " " +
                      (problems.length
                        ? "다시 확인 · " +
                          problems.map((issue) => issue.label).join(" · ")
                        : sample?.status === "done"
                          ? "완료"
                          : sample?.status === "skipped"
                            ? "건너뜀"
                            : "미완료")
                    }
                    title={
                      problems.length
                        ? problems.map((issue) => issue.label).join(" · ")
                        : c.char
                    }
                    aria-current={c.char === char ? "step" : undefined}
                    data-review={problems.length > 0}
                    data-unsafe={unsafe}
                    className={
                      "glyph " +
                      (c.char === char ? "current " : "") +
                      (sample?.status ?? "empty") +
                      (problems.length ? " needs-review" : "") +
                      (unsafe ? " unsafe" : "")
                    }
                    onClick={() =>
                      setIndex(
                        CHARSET.findIndex((entry) => entry.char === c.char),
                      )
                    }
                  >
                    {sample?.strokes.length ? (
                      <Thumbnail
                        strokes={sample.strokes}
                        tone={problems.length ? "error" : "normal"}
                      />
                    ) : (
                      <span>{c.char}</span>
                    )}
                    <small>
                      {problems.length
                        ? "!"
                        : sample?.status === "done"
                          ? "✓"
                          : sample?.status === "skipped"
                            ? "–"
                            : String(i + 1).padStart(2, "0")}
                    </small>
                  </button>
                );
              })}
            </div>
          </footer>
        </>
      )}
      {fontOpen && !projectsOpen && (
        <FontWorkshop
          key={project.id}
          guided
          journeyStage={step === 3 ? "separation" : "build"}
          onStageChange={(next) => changeStep(next === "separation" ? 3 : 4)}
          project={project}
          onChange={useStudio.getState().prepareFont}
          saveStatus={saved}
          initialChar={fontReviewChar}
          initialStage={step === 3 ? "separation" : "build"}
          onSave={persist}
          onClose={() => {
            changeStep(2);
          }}
          onWrite={(next) => {
            changeStep(2);
            setIndex(CHARSET.findIndex((c) => c.char === next));
          }}
        />
      )}
      {projectsOpen && (
        <ProjectManager
          current={project}
          onClose={() => setProjectsOpen(false)}
          onTransition={transitionProject}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          {toastUndo && (
            <button
              onClick={() => {
                undo(char);
                setToast("");
              }}
            >
              실행 취소
            </button>
          )}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <section
            className="settings-modal"
            id="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <h2 id="settings-title">작업실 설정</h2>
              <button onClick={() => setModal(false)} aria-label="설정 닫기">
                ✕
              </button>
            </div>
            <label className="field">
              프로젝트 이름
              <input
                value={project.name}
                maxLength={80}
                onChange={(e) => rename(e.target.value)}
              />
            </label>
            <h3>격자</h3>
            <div className="settings-grid">
              {(
                [
                  { key: "halfVertical", label: "2분할 세로" },
                  { key: "halfHorizontal", label: "2분할 가로" },
                  { key: "diamond", label: "다이아몬드" },
                  { key: "sizeGuide", label: "글자 크기 가이드" },
                ] as const
              ).map((g) => (
                <label className="check" key={g.key}>
                  <input
                    type="checkbox"
                    checked={s.grid[g.key]}
                    onChange={() => setGrid(g.key)}
                  />
                  {g.label}
                </label>
              ))}
            </div>
            <h3>입력과 화면</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={s.penOnly}
                onChange={(e) => update({ penOnly: e.target.checked })}
              />
              펜으로만 쓰기
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.allowMouse}
                onChange={(e) => update({ allowMouse: e.target.checked })}
              />
              마우스로 쓰기 허용
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
              />
              어두운 화면
            </label>
            <h3>모을 글자</h3>
            <div className="settings-grid">
              {CATEGORIES.map((c) => (
                <label className="check" key={c.id}>
                  <input
                    type="checkbox"
                    disabled={c.required}
                    checked={enabled.includes(c.id)}
                    onChange={(e) => {
                      setIndex(0);
                      setEnabled(
                        e.target.checked
                          ? [...enabled, c.id]
                          : enabled.filter((x) => x !== c.id),
                      );
                    }}
                  />
                  {c.label} {c.chars.length}
                  {c.required ? " · 필수" : ""}
                </label>
              ))}
            </div>
            <h3>백업</h3>
            <p className="settings-help">
              글씨는 이 브라우저에 저장됩니다. JSON 백업을 보관하면 다른 기기로
              옮길 수 있어요. 가져오기는 새 프로젝트로 열립니다.
            </p>
            <div className="backup-buttons">
              <button onClick={exportJSON}>JSON 내보내기 ↓</button>
              <button onClick={() => file.current?.click()}>
                JSON 가져오기 ↑
              </button>
            </div>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJSON(f);
                e.target.value = "";
              }}
            />
            <p className="settings-help">
              단축키: P 펜 · E 지우개 · ← → 글자 이동
              <br />
              Ctrl / ⌘ + Z 실행 취소 · Shift + Z 다시 실행
            </p>
            <p className="version">
              센스글리프 · 모든 획은 벡터로 보관됩니다.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
