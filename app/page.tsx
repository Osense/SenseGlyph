"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASIC_CHARSET,
  CATEGORIES,
  CHARSET,
  PREMIUM_CHARSET,
  isPremiumCategory,
} from "../data/charset";
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
import { REFERENCE_FONTS, referenceFont } from "../lib/reference-fonts";
import { referenceUsesFallback } from "../lib/font/reference";
import { projectIssues } from "../lib/review";
import { BrushPreview, Thumbnail } from "../components/Preview";
import type { BrushId, CharCategory } from "../lib/types";
import JourneySetup from "../components/JourneySetup";
import { characterGuide } from "../lib/character-guide";
import { gsap } from "gsap";
import ProjectManager from "../components/ProjectManager";

type CharEntry = { char: string; category: CharCategory };
const inCategories =
  (...ids: CharCategory[]) =>
  ({ category }: CharEntry) =>
    ids.includes(category);
const LISTS = {
  basic: { label: "기본 글자", chars: BASIC_CHARSET },
  hangul: {
    label: "한글",
    chars: CHARSET.filter(inCategories("hangul-syllable")),
  },
  latin: {
    label: "영어·숫자",
    chars: CHARSET.filter(inCategories("latin-upper", "latin-lower", "digit")),
  },
  symbol: {
    label: "기호",
    chars: CHARSET.filter(inCategories("ascii-symbol")),
  },
  premium: { label: "특수문자", chars: PREMIUM_CHARSET },
} as const;
type ListId = keyof typeof LISTS | "review";
const LIST_IDS: ListId[] = [
  "basic",
  "hangul",
  "latin",
  "symbol",
  "premium",
  "review",
];
const STEPS = ["브러시", "견본", "글자 쓰기", "자모 나누기", "폰트 완성"];
const BRUSHES: { id: BrushId; label: string }[] = [
  { id: "pen", label: "펜" },
  { id: "marker", label: "마커" },
  { id: "brush", label: "붓" },
  { id: "pencil", label: "연필" },
  { id: "nib", label: "납작펜" },
  { id: "pixel", label: "픽셀펜" },
];
const STEP_KEY = "hanhoek-journey";

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
    [list, setList] = useState<ListId>("basic"),
    [tool, setTool] = useState<"pen" | "eraser">("pen"),
    [modal, setModal] = useState(false),
    [toolSheet, setToolSheet] = useState(false),
    [projectsOpen, setProjectsOpen] = useState(false),
    [fontReviewChar, setFontReviewChar] = useState<string | undefined>(),
    [dark, setDark] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [toastUndo, setToastUndo] = useState(false),
    [saved, setSaved] = useState("불러오는 중");
  const file = useRef<HTMLInputElement>(null),
    stageRoot = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    switching = useRef(false),
    saveChain = useRef(Promise.resolve());
  const changeStep = (next: number) => {
    if (busy) return;
    setStep(next);
    setToolSheet(false);
    if (next !== 3) setFontReviewChar(undefined);
    try {
      localStorage.setItem(STEP_KEY, String(next));
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
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.38,
            ease: "power2.out",
            clearProps: "all",
          },
        );
      },
      stageRoot,
    );
    stageRoot.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
    return () => motion.revert();
  }, [step, !!project]);

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
  const listChars = (id: ListId): readonly CharEntry[] =>
    id === "review" ? reviewChars : LISTS[id].chars;
  const navigationChars = listChars(list);
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
    timer.current = setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const stepParameter = query.has("font")
      ? 4
      : query.has("step")
        ? Number(query.get("step"))
        : null;
    const requestedStep =
      stepParameter !== null &&
      Number.isInteger(stepParameter) &&
      stepParameter >= 0 &&
      stepParameter <= 4
        ? stepParameter
        : null;
    if (requestedStep !== null) setStep(requestedStep);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register(BASE_PATH + "/sw.js").catch(() => {});
    let alive = true;
    loadProject()
      .then((p) => {
        if (!alive) return;
        setProject(p ?? newProject());
        if (requestedStep === null && p) {
          let savedStep = 2;
          try {
            savedStep = Number(localStorage.getItem(STEP_KEY) ?? 2);
          } catch {}
          setStep(
            Number.isInteger(savedStep) && savedStep >= 0 && savedStep <= 4
              ? savedStep
              : 2,
          );
        }
        setSaved("기기에 저장됨");
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
    } catch {}
    return () => {
      alive = false;
    };
  }, [setProject]);
  useEffect(() => {
    if (!project) return;
    try {
      const pref = JSON.parse(localStorage.getItem("hanhoek-ui") ?? "{}");
      localStorage.setItem(
        "hanhoek-ui",
        JSON.stringify({ ...pref, dark, journeyVersion: 2 }),
      );
    } catch {
      /* UI 선호 저장이 차단돼도 벡터 입력은 계속 허용한다. */
    }
  }, [dark, !!project]);
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
            ? "저장됨 " +
                new Date().toLocaleTimeString("ko-KR", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                })
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
      const active = useStudio.getState().project!;
      const next = await (create
        ? startProject(active, value)
        : switchProject(active, value));
      setProject(next);
      setIndex(0);
      setList("basic");
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
  const goTo = (target: string) =>
    setIndex(CHARSET.findIndex((entry) => entry.char === target));
  const go = (delta: number) => {
    if (busy || !navigationChars.length) return;
    const order = (entry: CharEntry) =>
      CHARSET.findIndex((item) => item.char === entry.char);
    const candidates = navigationChars.filter((entry) =>
      delta > 0 ? order(entry) > index : order(entry) < index,
    );
    const target =
      delta > 0 ? candidates[0] : candidates[candidates.length - 1];
    const fallback =
      list === "review"
        ? delta > 0
          ? navigationChars[0]
          : navigationChars[navigationChars.length - 1]
        : undefined;
    if (target ?? fallback) goTo((target ?? fallback)!.char);
  };
  const selectList = (id: ListId) => {
    setList(id);
    const entries = listChars(id);
    if (entries.length && !entries.some((entry) => entry.char === char)) {
      const firstEmpty = entries.find(
        (entry) => !project?.samples[entry.char]?.strokes.length,
      );
      goTo((firstEmpty ?? entries[0]).char);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        modal ||
        projectsOpen ||
        toolSheet ||
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
  }, [char, modal, projectsOpen, toolSheet, busy, navigationChars, list, step]);
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
  }, [char, list, step, project?.id]);
  useEffect(() => {
    if (!modal && !toolSheet) return;
    const prev = document.activeElement as HTMLElement | null;
    const dialog = document.getElementById(
      modal ? "settings-dialog" : "tool-sheet",
    );
    dialog?.querySelector<HTMLElement>("button,input")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(false);
        setToolSheet(false);
      }
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
  }, [modal, toolSheet]);
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
      setList("basic");
      notify("새 프로젝트로 가져왔습니다");
    } catch (e) {
      notify(e instanceof Error ? e.message : "가져오기 실패");
    }
  };
  if (!project || !s)
    return (
      <main className="loading">
        <span className="brand-mark" aria-hidden="true">
          ㅆ
        </span>
        <p>쎈스 글리프를 여는 중…</p>
      </main>
    );
  const params = s.brushParams[s.activeBrush],
    history = histories[char];
  const isWritten = (entry: CharEntry) =>
    !!project.samples[entry.char]?.strokes.length;
  const written = (id: ListId) => listChars(id).filter(isWritten).length;
  const basicDone = written("basic");
  const isLast =
    currentPosition >= 0 && currentPosition === navigationChars.length - 1;
  const nextLabel =
    list === "review"
      ? "다음 →"
      : isLast
        ? list === "premium"
          ? "폰트 완성 →"
          : "자모 나누기 →"
        : "다음 →";
  const nextWritingChar = () => {
    if (list !== "review" && isLast) changeStep(list === "premium" ? 4 : 3);
    else if (list === "review" && !navigationChars.length) selectList("basic");
    else go(1);
  };
  const usedBrushes = new Set(
    Object.values(project.samples).flatMap((sample) =>
      sample.strokes.map((stroke) => stroke.brush),
    ),
  );
  const mixedBrush =
    usedBrushes.size > 0 && !usedBrushes.has(s.activeBrush) && tool === "pen";
  const setParams = (changes: Partial<typeof params>) =>
    update({
      brushParams: {
        ...s.brushParams,
        [s.activeBrush]: { ...params, ...changes },
      },
    });
  const resetGlyph = () => {
    commit(char, category, []);
    notify("지웠어요. 다시 써 주세요.", true);
  };
  const brushLabel = BRUSHES.find((b) => b.id === s.activeBrush)?.label;
  const sampleName = referenceFont(s.referenceFont).name;

  return (
    <main
      ref={stageRoot}
      className={(dark ? "studio dark" : "studio") + " journey sg-step-" + step}
    >
      <header className="sg-topbar">
        <a className="sg-brand" href="./" aria-label="쎈스 글리프 처음 화면">
          <span className="brand-mark" aria-hidden="true">
            ㅆ
          </span>
          <span className="sg-brand-name">
            쎈스 글리프<small>OSNS.studio</small>
          </span>
        </a>
        <nav className="sg-steps" aria-label="폰트 만드는 순서">
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
              data-ink-locked={busy || undefined}
              disabled={busy}
              onClick={() => changeStep(position)}
            >
              <span className="step-number">{position + 1}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sg-top-actions">
          <span className="sg-save" role="status">
            {saved}
          </span>
          <button
            className="sg-top-button"
            data-ink-locked={busy || undefined}
            disabled={busy}
            onClick={() => setProjectsOpen(true)}
          >
            내 폰트
          </button>
          <button
            className="sg-top-button sg-icon"
            onClick={() => setModal(true)}
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-label="설정 열기"
          >
            ⚙
          </button>
        </div>
      </header>

      {step < 2 && (
        <JourneySetup
          step={step}
          settings={s}
          update={update}
          next={() => changeStep(step + 1)}
          hasWriting={usedBrushes.size > 0}
        />
      )}

      {step === 2 && (
        <>
          <section className="sg-write journey-panel">
            <h1 className="sg-visually-hidden" tabIndex={-1}>
              글자 쓰기
            </h1>
            <div className="sg-rail" role="toolbar" aria-label="쓰기 도구">
              <button
                className="sg-tool"
                aria-pressed={tool === "pen"}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setTool("pen")}
              >
                <BrushPreview brush={s.activeBrush} />
                <span>{brushLabel}</span>
              </button>
              <button
                className="sg-tool"
                aria-pressed={tool === "eraser"}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              >
                <i aria-hidden="true">◇</i>
                <span>지우개</span>
              </button>
              <span className="sg-rail-gap" />
              <button
                className="sg-tool"
                aria-label="실행 취소"
                data-ink-locked={(busy && !!history?.past.length) || undefined}
                disabled={busy || !history?.past.length}
                onClick={() => undo(char)}
              >
                <i aria-hidden="true">↶</i>
                <span>취소</span>
              </button>
              <button
                className="sg-tool"
                aria-label="다시 실행"
                data-ink-locked={
                  (busy && !!history?.future.length) || undefined
                }
                disabled={busy || !history?.future.length}
                onClick={() => redo(char)}
              >
                <i aria-hidden="true">↷</i>
                <span>다시</span>
              </button>
              <button
                className="sg-tool"
                data-ink-locked={(busy && !!strokes.length) || undefined}
                disabled={busy || !strokes.length}
                onClick={resetGlyph}
              >
                <i aria-hidden="true">↺</i>
                <span>다시쓰기</span>
              </button>
              <span className="sg-rail-gap" />
              <button
                className="sg-tool"
                aria-haspopup="dialog"
                aria-expanded={toolSheet}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setToolSheet(true)}
              >
                <i aria-hidden="true">⚙</i>
                <span>도구 설정</span>
              </button>
            </div>

            <div className="sg-stage">
              <div className="sg-char-head">
                <strong className="sg-char">{char}</strong>
                <div className="sg-char-info">
                  <span>
                    {cat.label}
                    {isPremiumCategory(category) && (
                      <em className="sg-tag">특수문자</em>
                    )}
                    {currentPosition >= 0 && (
                      <>
                        {" "}
                        · {currentPosition + 1} / {navigationChars.length}
                      </>
                    )}
                  </span>
                  <p>{characterGuide(char, category)}</p>
                </div>
                <div className="sg-segment" role="group" aria-label="견본 보기">
                  {(
                    [
                      { id: "inside-faint", label: "따라 쓰기" },
                      { id: "outside", label: "보고 쓰기" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      aria-pressed={s.sampleMode === m.id}
                      data-ink-locked={busy || undefined}
                      disabled={busy}
                      onClick={() => update({ sampleMode: m.id })}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="sg-pad-area"
                style={
                  s.writingSize
                    ? ({
                        "--writing-size": `${s.writingSize}px`,
                      } as React.CSSProperties)
                    : undefined
                }
                data-fixed-size={s.writingSize ? true : undefined}
              >
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
                      list === "review"
                        ? navigationChars.length < 2
                        : currentPosition <= 0,
                    nextDisabled: false,
                    inkLocked: busy,
                    onPrevious: () => go(-1),
                    onNext: nextWritingChar,
                  }}
                />
              </div>
              {mixedBrush && (
                <p className="sg-hint" role="note">
                  앞에서 쓴 글자와 다른 도구({brushLabel})예요. 한 폰트는 한
                  가지 도구로 쓰면 더 고르게 나와요.
                </p>
              )}
            </div>

            <aside className="sg-side" aria-label="이동과 글자 확인">
              <div className="sg-nav">
                <button
                  className="sg-primary"
                  data-ink-locked={busy || undefined}
                  disabled={busy}
                  onClick={nextWritingChar}
                >
                  {nextLabel}
                </button>
                <div className="sg-nav-row">
                  <button
                    data-ink-locked={busy || undefined}
                    disabled={
                      busy ||
                      (list === "review"
                        ? navigationChars.length < 2
                        : currentPosition <= 0)
                    }
                    onClick={() => go(-1)}
                  >
                    ← 이전
                  </button>
                  <button
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => {
                      if (!strokes.length)
                        commit(char, category, strokes, "skipped");
                      go(1);
                    }}
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
              <section
                className={
                  "sg-check" + (currentIssues.length ? " has-issues" : "")
                }
                aria-label="현재 글자 확인"
              >
                <div className="sg-check-head">
                  <strong>
                    {currentIssues.length
                      ? "다시 볼 글자"
                      : strokes.length
                        ? "잘 썼어요"
                        : "아직 안 쓴 글자"}
                  </strong>
                  <span>{strokes.length}획</span>
                </div>
                {currentIssues.length > 0 && (
                  <ul className="sg-reasons">
                    {currentIssues.map((issue) => (
                      <li key={issue.kind}>{issue.label}</li>
                    ))}
                  </ul>
                )}
                <div className="sg-check-actions">
                  <button
                    data-ink-locked={busy || undefined}
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
                      ? "표시 지우기"
                      : "나중에 다시 보기"}
                  </button>
                  {category === "hangul-syllable" && strokes.length > 0 && (
                    <button
                      data-ink-locked={busy || undefined}
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
              <section className="sg-sample" aria-label="견본">
                <div className="sg-sample-head">
                  <span>
                    견본 <b>{sampleName}</b>
                  </span>
                  <button
                    className="sg-link"
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => changeStep(1)}
                  >
                    바꾸기
                  </button>
                </div>
                {referenceUsesFallback(char, s.referenceFont) && (
                  <small>‘{char}’은 기본 견본으로 보여요.</small>
                )}
                {s.sampleMode === "inside-faint" && (
                  <label className="sg-slider">
                    <span>
                      견본 진하기 <b>{Math.round(s.sampleOpacity * 100)}%</b>
                    </span>
                    <input
                      type="range"
                      aria-label="견본 진하기"
                      min="5"
                      max="40"
                      value={Math.round(s.sampleOpacity * 100)}
                      onChange={(e) =>
                        update({ sampleOpacity: +e.target.value / 100 })
                      }
                    />
                  </label>
                )}
              </section>
              <button
                className="sg-next-step"
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => changeStep(3)}
              >
                쓴 글자로 자모 나누기 →
              </button>
            </aside>
          </section>

          <footer className="sg-strip" aria-label="글자 모음">
            <div className="sg-strip-head">
              <div className="sg-lists" role="group" aria-label="글자 목록">
                {LIST_IDS.map((id) => (
                  <button
                    key={id}
                    aria-pressed={list === id}
                    data-list={id}
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => selectList(id)}
                  >
                    {id === "review" ? "다시 확인" : LISTS[id].label}{" "}
                    <b>
                      {id === "review"
                        ? reviewChars.length
                        : `${written(id)}/${listChars(id).length}`}
                    </b>
                  </button>
                ))}
              </div>
              <div className="sg-progress" aria-label="기본 글자 진행률">
                <span>
                  기본 글자 <b>{basicDone}</b> / {BASIC_CHARSET.length}
                </span>
                <span className="sg-progress-bar">
                  <i
                    style={{
                      width: (basicDone / BASIC_CHARSET.length) * 100 + "%",
                    }}
                  />
                </span>
              </div>
            </div>
            <div
              className="sg-glyphs"
              aria-label={
                (list === "review" ? "다시 확인" : LISTS[list].label) + " 목록"
              }
            >
              {!navigationChars.length && (
                <div className="sg-strip-empty" role="status">
                  {list === "review"
                    ? "다시 볼 글자가 없어요."
                    : "이 목록에 글자가 없어요."}
                  <button onClick={() => selectList("basic")}>
                    기본 글자 보기
                  </button>
                </div>
              )}
              {navigationChars.map((c, i) => {
                const sample = project.samples[c.char];
                const problems = issues[c.char] ?? [];
                const state = problems.length
                  ? "review"
                  : sample?.strokes.length
                    ? "done"
                    : sample?.status === "skipped"
                      ? "skipped"
                      : "empty";
                return (
                  <button
                    id={"glyph-" + c.char}
                    key={c.char}
                    className="sg-glyph"
                    data-state={state}
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    aria-current={c.char === char ? "step" : undefined}
                    aria-label={
                      c.char +
                      " " +
                      (problems.length
                        ? "다시 확인 · " +
                          problems.map((issue) => issue.label).join(" · ")
                        : state === "done"
                          ? "완료"
                          : state === "skipped"
                            ? "건너뜀"
                            : "미완료")
                    }
                    title={
                      problems.length
                        ? problems.map((issue) => issue.label).join(" · ")
                        : c.char
                    }
                    onClick={() => goTo(c.char)}
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
                      {state === "review"
                        ? "!"
                        : state === "done"
                          ? "✓"
                          : state === "skipped"
                            ? "–"
                            : i + 1}
                    </small>
                  </button>
                );
              })}
            </div>
          </footer>

          {toolSheet && (
            <div
              className="sg-sheet-backdrop"
              onClick={() => setToolSheet(false)}
            >
              <section
                className="sg-sheet"
                id="tool-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tool-sheet-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sg-sheet-head">
                  <h2 id="tool-sheet-title">도구 설정</h2>
                  <button
                    onClick={() => setToolSheet(false)}
                    aria-label="도구 설정 닫기"
                  >
                    ✕
                  </button>
                </div>
                <h3>쓰는 도구</h3>
                <div className="sg-brushes">
                  {BRUSHES.map((b) => (
                    <button
                      key={b.id}
                      aria-pressed={s.activeBrush === b.id}
                      onClick={() => {
                        update({ activeBrush: b.id });
                        setTool("pen");
                      }}
                    >
                      <BrushPreview brush={b.id} />
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
                <p className="sg-help">
                  한 폰트는 한 가지 도구로 쓰면 글자 모양이 고르게 나와요.
                </p>
                <label className="sg-slider">
                  <span>
                    굵기 <b>{params.size}</b>
                  </span>
                  <input
                    aria-label="펜 굵기"
                    type="range"
                    min="20"
                    max="120"
                    value={params.size}
                    onChange={(e) => setParams({ size: +e.target.value })}
                  />
                </label>
                <label className="sg-check-row">
                  <input
                    type="checkbox"
                    checked={params.usePressure}
                    onChange={(e) =>
                      setParams({ usePressure: e.target.checked })
                    }
                  />
                  펜 누르는 힘 반영
                </label>
                {s.activeBrush === "pixel" && (
                  <PixelSizeControl
                    params={params}
                    onChange={(pixel) =>
                      update({ brushParams: { ...s.brushParams, pixel } })
                    }
                  />
                )}
                {s.activeBrush === "nib" && (
                  <label className="sg-slider">
                    <span>
                      펜촉 각도 <b>{params.nibAngle}°</b>
                    </span>
                    <input
                      aria-label="펜촉 각도"
                      type="range"
                      min="0"
                      max="180"
                      value={params.nibAngle}
                      onChange={(e) => setParams({ nibAngle: +e.target.value })}
                    />
                  </label>
                )}
                <h3>지우개</h3>
                <div
                  className="sg-segment"
                  role="group"
                  aria-label="지우개 방식"
                >
                  {(
                    [
                      ["stroke", "획 통째로"],
                      ["partial", "닿은 부분만"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={s.eraserMode === id}
                      onClick={() => update({ eraserMode: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="sg-slider">
                  <span>
                    지우개 크기 <b>{s.eraserSize}</b>
                  </span>
                  <input
                    aria-label="지우개 크기"
                    type="range"
                    min="20"
                    max="200"
                    value={s.eraserSize}
                    onChange={(e) => update({ eraserSize: +e.target.value })}
                  />
                </label>
                <h3>쓰기 칸</h3>
                <div
                  className="sg-segment"
                  role="group"
                  aria-label="쓰기 칸 크기"
                >
                  <button
                    aria-pressed={!s.writingSize}
                    onClick={() => update({ writingSize: undefined })}
                  >
                    화면에 맞춤
                  </button>
                  <button
                    aria-pressed={!!s.writingSize}
                    onClick={() =>
                      update({ writingSize: s.writingSize ?? 480 })
                    }
                  >
                    직접 정하기
                  </button>
                </div>
                {s.writingSize && (
                  <label className="sg-slider">
                    <span>
                      칸 크기 <b>{s.writingSize}px</b>
                    </span>
                    <input
                      aria-label="쓰기 칸 크기"
                      type="range"
                      min="240"
                      max="900"
                      step="20"
                      value={s.writingSize}
                      onChange={(e) => update({ writingSize: +e.target.value })}
                    />
                  </label>
                )}
                <p className="sg-help">
                  칸 크기를 바꿔도 폰트의 글자 크기는 바뀌지 않아요.
                </p>
              </section>
            </div>
          )}
        </>
      )}

      {step >= 3 && !projectsOpen && (
        <FontWorkshop
          key={project.id}
          stage={step === 3 ? "separation" : "build"}
          onStageChange={(next) => changeStep(next === "separation" ? 3 : 4)}
          project={project}
          onChange={useStudio.getState().prepareFont}
          initialChar={fontReviewChar}
          onWritePremium={() => {
            changeStep(2);
            setList("premium");
            const next =
              PREMIUM_CHARSET.find(
                ({ char: c }) => !project.samples[c]?.strokes.length,
              ) ?? PREMIUM_CHARSET[0];
            goTo(next.char);
          }}
          onClose={() => changeStep(2)}
          onWrite={(next) => {
            changeStep(2);
            const entry = CHARSET.find((c) => c.char === next);
            setList(
              entry && isPremiumCategory(entry.category) ? "premium" : "basic",
            );
            goTo(next);
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
              되돌리기
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
              <h2 id="settings-title">설정</h2>
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
            <h3>입력</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={s.penOnly}
                onChange={(e) => update({ penOnly: e.target.checked })}
              />
              펜으로만 쓰기 (손바닥 오인식 방지)
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.allowMouse}
                onChange={(e) => update({ allowMouse: e.target.checked })}
              />
              마우스로 쓰기 허용
            </label>
            <h3>화면</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
              />
              어두운 화면
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.grid.sizeGuide}
                onChange={(event) =>
                  update({
                    grid: { ...s.grid, sizeGuide: event.target.checked },
                  })
                }
              />
              글자 크기 안내선
            </label>
            <h3>백업</h3>
            <p className="settings-help">
              글씨는 이 브라우저에 저장돼요. JSON으로 백업하면 다른 기기로 옮길
              수 있어요. 가져오기는 새 프로젝트로 열려요.
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
              키보드: P 펜 · E 지우개 · ← → 글자 이동 · Ctrl/⌘+Z 취소 · Shift+Z
              다시
            </p>
            <p className="version">
              쎈스 글리프 · {REFERENCE_FONTS.length}가지 견본 · 모든 획은 벡터로
              보관됩니다.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
