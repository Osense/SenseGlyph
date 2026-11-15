"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  basicCharsetFor,
  categoriesFor,
  charsetFor,
  extraCharsetFor,
  HIRAGANA,
  KANJI_BASIC,
  KANJI_MORE,
  KATAKANA,
  JA_PUNCT,
  isPremiumCategory,
} from "../data/charset";
import { newProject } from "../lib/defaults";
import { BASE_PATH } from "../lib/base-path";
import { APP_NAME, APP_VERSION, CREDIT, MAKER } from "../lib/version";
import { isNativeApp, saveToDevice } from "../lib/native";
import {
  loadProject,
  saveProject,
  parseProject,
  startProject,
  duplicateProject,
  switchProject,
} from "../lib/storage";
import { useStudio } from "../lib/store";
import WritingPad from "../components/WritingPad";
import PixelSizeControl from "../components/PixelSizeControl";
import FontWorkshop from "../components/FontWorkshop";
import {
  defaultReferenceFont,
  REFERENCE_FONTS,
  referenceFont,
} from "../lib/reference-fonts";
import { referenceUsesFallback } from "../lib/font/reference";
import { projectIssues } from "../lib/review";
import { BrushPreview, Thumbnail } from "../components/Preview";
import type {
  BrushId,
  CharCategory,
  ProjectSettings,
  WritingPreset,
  WritingScript,
} from "../lib/types";
import JourneySetup from "../components/JourneySetup";
import { characterGuide } from "../lib/character-guide";
import { useLang, useT, type UiLang } from "../lib/i18n";
import { LegalTabs } from "../components/LegalDocument";
import StepQuestion, { type StepAsk } from "../components/StepQuestion";
import LoginScreen from "../components/LoginScreen";
import AccountPanel from "../components/AccountPanel";
import { useAccount } from "../lib/account";
import {
  countingDisabled,
  countVisit,
  setCountingDisabled,
} from "../lib/analytics";
import { gsap } from "gsap";
import ProjectManager from "../components/ProjectManager";
import WritingTips, { WRITING_TIPS_KEY } from "../components/WritingTips";

type CharEntry = { char: string; category: CharCategory };
const inCategories =
  (...ids: CharCategory[]) =>
  ({ category }: CharEntry) =>
    ids.includes(category);
type ListId =
  | "basic"
  | "hangul"
  | "hiragana"
  | "katakana"
  | "kanji1"
  | "kanji"
  | "latin"
  | "symbol"
  | "premium"
  | "review";
type ListDef = { label: string; chars: readonly CharEntry[] };
function listsFor(script: WritingScript): Partial<Record<ListId, ListDef>> {
  const all = charsetFor(script);
  const pick = (chars: string[]) => {
    const set = new Set(chars);
    return all.filter((entry) => set.has(entry.char));
  };
  const shared = {
    latin: {
      label: "영어·숫자",
      chars: all.filter(inCategories("latin-upper", "latin-lower", "digit")),
    },
    symbol: {
      label: "기호",
      chars:
        script === "ja"
          ? all.filter(inCategories("ascii-symbol", "ja-punct"))
          : all.filter(inCategories("ascii-symbol")),
    },
    premium: { label: "특수문자", chars: extraCharsetFor(script) },
  };
  if (script === "ja")
    return {
      basic: { label: "기본 글자", chars: basicCharsetFor("ja") },
      hiragana: { label: "ひらがな", chars: pick(HIRAGANA) },
      katakana: { label: "カタカナ", chars: pick(KATAKANA) },
      kanji1: { label: "필체 한자", chars: pick(KANJI_BASIC) },
      kanji: { label: "한자 더 쓰기", chars: pick(KANJI_MORE) },
      ...shared,
      premium: {
        label: "특수문자",
        chars: all.filter(inCategories("special-symbol")),
      },
    };
  return {
    basic: { label: "기본 글자", chars: basicCharsetFor("ko") },
    hangul: {
      label: "한글",
      chars: all.filter(inCategories("hangul-syllable")),
    },
    ...shared,
  };
}
void JA_PUNCT;
const STEPS = ["브러시", "견본", "글자 쓰기", "자모 나누기", "폰트 완성"];
/** 일본어는 자모 나누기(3단계)가 없다. */
const stepsFor = (script: WritingScript) =>
  STEPS.map((label, step) => ({ label, step })).filter(
    ({ step }) => script === "ko" || step !== 3,
  );
const BRUSHES: { id: BrushId; label: string }[] = [
  { id: "pen", label: "펜" },
  { id: "marker", label: "마커" },
  { id: "brush", label: "붓" },
  { id: "pencil", label: "연필" },
  { id: "nib", label: "납작펜" },
  { id: "pixel", label: "픽셀펜" },
];
const STEP_KEY = "hanhoek-journey";
/** 예전 단계(화면 대비 비율) — 저장된 설정을 읽을 때만 쓴다. */
const PAD_PRESETS: { id: WritingPreset; scale: number }[] = [
  { id: "xs", scale: 0.55 },
  { id: "s", scale: 0.7 },
  { id: "m", scale: 0.85 },
  { id: "fill", scale: 1 },
];
/** 쓰기 칸 한 변 길이(px). 화면 크기와 상관없이 같은 크기라 기기가 달라도 숫자로 맞출 수 있다. */
const PAD_SIZES = [
  140, 170, 200, 230, 260, 290, 320, 360, 400, 450, 500, 560, 620, 700, 800,
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
    [list, setList] = useState<ListId>("basic"),
    [tool, setTool] = useState<"pen" | "eraser">("pen"),
    [modal, setModal] = useState(false),
    [renameCopy, setRenameCopy] = useState(false),
    [legalOpen, setLegalOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [noCount, setNoCount] = useState(false),
    [toolSheet, setToolSheet] = useState(false),
    [tipsOpen, setTipsOpen] = useState(false),
    [projectsOpen, setProjectsOpen] = useState(false),
    [fontReviewChar, setFontReviewChar] = useState<string | undefined>(),
    [dark, setDark] = useState(false),
    // 왼손잡이: 도구 줄과 '다음 글자'를 오른쪽(쓰지 않는 손 쪽)으로
    [leftHanded, setLeftHanded] = useState(false),
    // 다음 단계로 넘어가기 전에 묻기(기본 켜짐)
    [askSteps, setAskSteps] = useState(true),
    [askTarget, setAskTarget] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [toastUndo, setToastUndo] = useState(false),
    [saved, setSaved] = useState("불러오는 중");
  const t = useT();
  const lang = useLang((state) => state.lang);
  const uiChoice = useUiChoice();
  const session = useAccount((state) => state.session);
  useEffect(() => {
    useAccount.getState().load();
    useLang.getState().detect();
    setNoCount(countingDisabled());
    countVisit();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title =
      lang === "ko"
        ? "쎈스 글리프 — 내 손으로 쓴 한 획이, 나만의 폰트가 됩니다"
        : lang === "ja"
          ? "SenseGlyph — 手書きの一画が、あなたのフォントに"
          : "SenseGlyph — Turn your handwriting into a font";
  }, [lang]);
  const file = useRef<HTMLInputElement>(null),
    stageRoot = useRef<HTMLElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    switching = useRef(false),
    saveChain = useRef(Promise.resolve()),
    padArea = useRef<HTMLDivElement>(null);
  // 지금 화면에서 쓰기 칸이 커질 수 있는 최대 크기(양옆 이동 버튼 104px 제외)
  const [padFit, setPadFit] = useState(600);
  // 고른 화면(밝게/어둡게)을 브라우저에도 알려, 휴대폰 다크 모드가 강제로 덧칠하지 않게 한다.
  useEffect(() => {
    const scheme = dark ? "dark" : "only light";
    document.documentElement.style.colorScheme = scheme;
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", scheme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#120e0e" : "#f7f1ef");
    document.body.style.background = dark ? "#120e0e" : "#f7f1ef";
  }, [dark]);
  useEffect(() => {
    const area = padArea.current;
    if (!area || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const box = area.getBoundingClientRect();
      setPadFit(
        Math.max(120, Math.floor(Math.min(box.width - 104, box.height))),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [step, project?.id]);
  const changeStep = (next: number) => {
    if (busy) return;
    // 일본어에는 자모 나누기가 없다.
    if (next === 3 && useStudio.getState().project?.settings.script === "ja")
      next = 4;
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
  const script: WritingScript = project?.settings.script ?? "ko";
  const CHARSET = charsetFor(script);
  const LISTS = listsFor(script);
  const LIST_IDS = [...(Object.keys(LISTS) as ListId[]), "review" as const];
  const BASIC_CHARSET = basicCharsetFor(script);
  const PREMIUM_CHARSET = extraCharsetFor(script);
  const reviewChars = CHARSET.filter((entry) => issues[entry.char]?.length);
  const listChars = (id: ListId): readonly CharEntry[] =>
    id === "review" ? reviewChars : (LISTS[id]?.chars ?? LISTS.basic!.chars);
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
  const cat = categoriesFor(script).find((c) => c.id === category)!;
  // 칸 크기는 언제나 숫자(px)로 보여 준다. '가득'이나 예전 단계일 때는 지금 실제 크기.
  const legacyScale =
    PAD_PRESETS.find((p) => p.id === (s?.writingPreset ?? "fill"))?.scale ?? 1;
  const shownPad = s?.writingSize
    ? Math.min(s.writingSize, padFit)
    : Math.round(padFit * legacyScale);
  const stepPad = (direction: 1 | -1) => {
    const current = shownPad;
    const next =
      direction < 0
        ? ([...PAD_SIZES].reverse().find((v) => v < current) ?? PAD_SIZES[0])
        : PAD_SIZES.find((v) => v > current);
    if (!next || next > padFit) {
      update({ writingPreset: "fill", writingSize: undefined });
      return;
    }
    update({ writingSize: next });
  };
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
    // 앱(안드로이드)은 파일을 앱 안에 담고 있어 오프라인 저장(서비스 워커)이 필요 없다.
    if ("serviceWorker" in navigator && !isNativeApp())
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
      // 밝은 화면이 기본. 이 버전 이후에 직접 고른 값만 따른다.
      setDark(pref.theme === "osns-light" ? !!pref.dark : false);
      setLeftHanded(pref.hand === "left");
      setAskSteps(pref.askSteps !== false);
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
        JSON.stringify({
          ...pref,
          dark,
          hand: leftHanded ? "left" : "right",
          askSteps,
          theme: "osns-light",
          journeyVersion: 2,
        }),
      );
    } catch {
      /* UI 선호 저장이 차단돼도 벡터 입력은 계속 허용한다. */
    }
  }, [dark, leftHanded, askSteps, !!project]);
  useEffect(() => {
    if (step !== 2 || !project) return;
    try {
      if (!localStorage.getItem(WRITING_TIPS_KEY)) setTipsOpen(true);
    } catch {}
  }, [step, !!project]);
  const closeTips = () => {
    setTipsOpen(false);
    try {
      localStorage.setItem(WRITING_TIPS_KEY, "1");
    } catch {}
  };
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
            ? t("저장됨") +
                " " +
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
  const transitionProject = async (
    value: string,
    create: boolean,
    settings: Partial<ProjectSettings> = {},
  ) => {
    if (switching.current) return;
    switching.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await saveChain.current.catch(() => {});
      const active = useStudio.getState().project!;
      const next = await (create
        ? startProject(active, value, settings)
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
          ? t("새 폰트를 시작했어요. 이전 작업은 보관함에 있어요.")
          : t("보관한 프로젝트를 열었어요."),
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
  /** 만들 글자(언어) 고르기. 이미 쓴 글자가 있으면 새 폰트로 시작하고 지금 작업은 보관한다. */
  const chooseScript = async (next: WritingScript) => {
    const active = useStudio.getState().project;
    if (!active || (active.settings.script ?? "ko") === next) return;
    const settings = {
      script: next,
      referenceFont: defaultReferenceFont(next),
    };
    const hasInk = Object.values(active.samples).some((x) => x.strokes.length);
    if (hasInk)
      await transitionProject(
        next === "ja" ? "日本語の手書き" : "새 손글씨",
        true,
        settings,
      );
    else {
      update(settings);
      setIndex(0);
      setList("basic");
    }
  };
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
        accountOpen ||
        session === null ||
        toolSheet ||
        tipsOpen ||
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
    accountOpen,
    session,
    toolSheet,
    tipsOpen,
    busy,
    navigationChars,
    list,
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
    if (isNativeApp()) {
      const name = (project.name || "손글씨") + ".json";
      saveToDevice(name, JSON.stringify(project, null, 2)).then(
        (place) =>
          notify(
            t("'{place}' 폴더에 {name} 백업을 저장했어요.", { place, name }),
          ),
        () => notify(t("백업 파일을 저장하지 못했어요.")),
      );
      return;
    }
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
      if (f.size > 100 * 1024 * 1024)
        throw Error(t("백업 파일이 너무 큽니다."));
      const p = parseProject(await f.text());
      // 펜 전용·마우스 허용은 기기마다 다르므로 가져온 값을 쓰지 않는다(다른 기기에서 손가락으로 못 쓰던 문제).
      p.settings = { ...p.settings, penOnly: false, allowMouse: true };
      setProject(p);
      setIndex(0);
      setList("basic");
      notify(t("새 프로젝트로 가져왔습니다"));
    } catch (e) {
      notify(e instanceof Error ? t(e.message) : t("가져오기 실패"));
    }
  };
  if (!project || !s)
    return (
      <main className="loading">
        <span className="brand-mark" aria-hidden="true">
          ㅆ
        </span>
        <p>{t("쎈스 글리프를 여는 중…")}</p>
        <p className="sg-credit">{CREDIT}</p>
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
      ? t("다음 →")
      : isLast
        ? list === "premium" || script === "ja"
          ? t("폰트 완성 →")
          : t("자모 나누기 →")
        : t("다음 →");
  /** 앞 단계로 갈 때는 바로, 다음 단계로 갈 때는 한 번 묻고 넘어간다(설정에서 끌 수 있음). */
  const goStep = (next: number) => {
    if (busy) return;
    const target = next === 3 && script === "ja" ? 4 : next;
    if (askSteps && target > step) setAskTarget(target);
    else changeStep(target);
  };
  /** 단계마다 묻는 말: 지금 한 일과 다음에 할 일을 짧게 */
  const stepAsk = (target: number): StepAsk => {
    if (target === 1)
      return {
        question: t("이 도구로 쓸까요?"),
        detail: t(
          "{brush}(으)로 시작해요. 쓰는 중에도 ‘도구 설정’에서 바꿀 수 있어요. 다음은 내 글씨와 닮은 견본을 고를 차례예요.",
          { brush: t(brushLabel ?? "") },
        ),
        yes: t("네, 견본 고르러 갈게요"),
        no: t("도구를 더 볼게요"),
      };
    if (target === 2)
      return {
        question: t("이 견본을 안내선으로 쓸까요?"),
        detail: t(
          "‘{font}’ 모양이 쓰기 칸에 연하게 깔려요. 따라 써도, 보고 써도 돼요. 다음은 글자를 하나씩 쓸 차례예요.",
          { font: sampleName },
        ),
        yes: t("네, 글씨 쓰러 갈게요"),
        no: t("견본을 더 볼게요"),
      };
    if (target === 3)
      return {
        question: t("다 썼다면 자모를 나눠 볼까요?"),
        detail: t(
          "지금까지 {n}자를 썼어요. 쓴 글자를 초성·중성·종성으로 나눠 나머지 한글을 조합해요. 더 쓰고 싶으면 언제든 돌아올 수 있어요.",
          {
            n: Object.values(project.samples).filter(
              (sample) => sample.strokes.length > 0,
            ).length,
          },
        ),
        yes: t("네, 자모 나누기로"),
        no: t("조금 더 쓸게요"),
      };
    return {
      question: t("이제 폰트를 만들어 볼까요?"),
      detail: t(
        "쓴 글씨를 정돈해 폰트로 묶어요. 결과를 미리 보고, 마음에 들 때만 내려받으면 돼요. 앞 단계로는 언제든 돌아올 수 있어요.",
      ),
      yes: t("네, 폰트 만들기로"),
      no: step === 3 ? t("조금 더 확인할게요") : t("조금 더 쓸게요"),
    };
  };
  const nextShort =
    list !== "review" && isLast
      ? list === "premium" || script === "ja"
        ? t("폰트 완성")
        : t("자모 나누기")
      : t("다음 글자");
  const nextWritingChar = () => {
    if (list !== "review" && isLast) goStep(list === "premium" ? 4 : 3);
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
    notify(t("지웠어요. 다시 써 주세요."), true);
  };
  const brushLabel = BRUSHES.find((b) => b.id === s.activeBrush)?.label;
  const viewStep = script === "ja" && step === 3 ? 4 : step;
  const sampleName = t(referenceFont(s.referenceFont, script).name);

  return (
    <main
      ref={stageRoot}
      className={
        (dark ? "studio dark" : "studio") +
        " journey sg-step-" +
        viewStep +
        (leftHanded ? " is-left-handed" : "")
      }
    >
      <header className="sg-topbar">
        <a
          className="sg-brand"
          href="./"
          aria-label={t("쎈스 글리프 처음 화면")}
        >
          <span className="sg-osns" aria-hidden="true">
            <img src={BASE_PATH + "/logo/osns-crayon.svg"} alt="" />
            <i>studio</i>
          </span>
          <span className="sg-brand-slash" aria-hidden="true">
            /
          </span>
          <span className="sg-brand-name">{t("쎈스 글리프")}</span>
        </a>
        <nav className="sg-steps" aria-label={t("폰트 만드는 순서")}>
          {stepsFor(script).map(({ label, step: position }, order) => (
            <button
              key={label}
              className={
                viewStep === position
                  ? "is-current"
                  : position < viewStep
                    ? "is-past"
                    : ""
              }
              aria-current={viewStep === position ? "step" : undefined}
              data-ink-locked={busy || undefined}
              disabled={busy}
              onClick={() => changeStep(position)}
            >
              <span>{t(label)}</span>
              <span className="step-number">
                {String(order + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </nav>
        <div className="sg-top-actions">
          <span className="sg-save" role="status">
            {t(saved)}
          </span>
          <button
            className="sg-top-button"
            data-ink-locked={busy || undefined}
            disabled={busy}
            onClick={() => setProjectsOpen(true)}
          >
            {t("내 폰트")}
          </button>
          <button
            className="sg-top-button sg-icon"
            onClick={() => setModal(true)}
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-label={t("설정 열기")}
          >
            ⚙
          </button>
          <button
            className="sg-top-button sg-icon sg-profile-button"
            onClick={() => setAccountOpen(true)}
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-label={t("내 계정 열기")}
            title={t(session?.name ?? "게스트")}
          >
            <span className="sg-avatar" aria-hidden="true">
              {(session?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          </button>
        </div>
      </header>
      {project.purchase && (
        <div className="sg-locked-bar" role="status">
          <span>
            <b>{t("결제한 폰트예요.")}</b>{" "}
            {t(
              "글씨와 정돈은 더 고칠 수 없고, 같은 폰트만 다시 받을 수 있어요.",
            )}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const active = useStudio.getState().project;
              if (!active) return;
              const copy = await duplicateProject(
                active,
                t("{name}의 복사본", { name: active.name }),
              );
              setProject(copy);
              setRenameCopy(true);
              notify(
                t(
                  "새 프로젝트로 복제했어요. 여기서 고친 뒤 다시 결제해 내려받을 수 있어요.",
                ),
              );
            }}
          >
            {t("새 프로젝트로 복제해서 고치기")}
          </button>
        </div>
      )}

      {step < 2 && (
        <JourneySetup
          step={step}
          settings={s}
          update={update}
          next={() => goStep(step + 1)}
          leftHanded={leftHanded}
          onHand={setLeftHanded}
          hasWriting={usedBrushes.size > 0}
          dark={dark}
          script={script}
          onScript={chooseScript}
          onLegal={() => setLegalOpen(true)}
        />
      )}

      {step === 2 && (
        <>
          <section className="sg-write journey-panel">
            <h1 className="sg-visually-hidden" tabIndex={-1}>
              {t("글자 쓰기")}
            </h1>
            <div className="sg-rail" role="toolbar" aria-label={t("쓰기 도구")}>
              <button
                className="sg-tool"
                aria-pressed={tool === "pen"}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setTool("pen")}
              >
                <BrushPreview brush={s.activeBrush} />
                <span>{t(brushLabel ?? "")}</span>
              </button>
              <button
                className="sg-tool"
                aria-pressed={tool === "eraser"}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              >
                <i aria-hidden="true">◇</i>
                <span>{t("지우개")}</span>
              </button>
              <span className="sg-rail-gap" />
              <button
                className="sg-tool"
                aria-label={t("실행 취소")}
                data-ink-locked={(busy && !!history?.past.length) || undefined}
                disabled={busy || !history?.past.length}
                onClick={() => undo(char)}
              >
                <i aria-hidden="true">↶</i>
                <span>{t("취소")}</span>
              </button>
              <button
                className="sg-tool"
                aria-label={t("다시 실행")}
                data-ink-locked={
                  (busy && !!history?.future.length) || undefined
                }
                disabled={busy || !history?.future.length}
                onClick={() => redo(char)}
              >
                <i aria-hidden="true">↷</i>
                <span>{t("다시")}</span>
              </button>
              <button
                className="sg-tool"
                data-ink-locked={(busy && !!strokes.length) || undefined}
                disabled={busy || !strokes.length}
                onClick={resetGlyph}
              >
                <i aria-hidden="true">↺</i>
                <span>{t("다시쓰기")}</span>
              </button>
              {/* 다음 글자: 펜을 쥔 반대손이 도구 사이에서 바로 누르도록 */}
              <button
                className="sg-tool sg-tool-next sg-rail-next"
                aria-label={nextLabel}
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={nextWritingChar}
              >
                <i aria-hidden="true">→</i>
                <span>{nextShort}</span>
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
                <span>{t("도구 설정")}</span>
              </button>
              <button
                className="sg-tool"
                aria-haspopup="dialog"
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => setTipsOpen(true)}
              >
                <i aria-hidden="true" className="sg-tool-q">
                  ?
                </i>
                <span>{t("쓰기 팁")}</span>
              </button>
            </div>

            <div className="sg-stage">
              <div className="sg-char-head">
                <strong className="sg-char">{char}</strong>
                <div className="sg-char-info">
                  <span>
                    {t(cat.label)}
                    {isPremiumCategory(category) && (
                      <em className="sg-tag">{t("특수문자")}</em>
                    )}
                    {currentPosition >= 0 && (
                      <>
                        {" "}
                        · {currentPosition + 1} / {navigationChars.length}
                      </>
                    )}
                  </span>
                  <p>{characterGuide(char, category, lang)}</p>
                </div>
                <div
                  className="sg-segment"
                  role="group"
                  aria-label={t("견본 보기")}
                >
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
                      {t(m.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="sg-pad-area"
                data-locked={project.purchase ? "" : undefined}
                ref={padArea}
                style={
                  (s.writingSize
                    ? { "--writing-size": `${s.writingSize}px` }
                    : {
                        "--pad-scale":
                          PAD_PRESETS.find(
                            (p) => p.id === (s.writingPreset ?? "fill"),
                          )?.scale ?? 1,
                      }) as unknown as React.CSSProperties
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
              <div className="sg-pad-foot">
                <div
                  className="sg-size"
                  role="group"
                  aria-label={t("쓰기 칸 크기")}
                >
                  <span aria-hidden="true">{t("칸")}</span>
                  <button
                    aria-label={t("쓰기 칸 더 작게")}
                    data-ink-locked={busy || undefined}
                    disabled={busy || shownPad <= PAD_SIZES[0]}
                    onClick={() => stepPad(-1)}
                  >
                    −
                  </button>
                  <button
                    className="sg-size-value"
                    aria-label={t("쓰기 칸 크기 자세히")}
                    onClick={() => setToolSheet(true)}
                  >
                    <b>{shownPad}</b>
                    <small>px</small>
                  </button>
                  <button
                    aria-label={t("쓰기 칸 더 크게")}
                    data-ink-locked={busy || undefined}
                    disabled={busy || (!s.writingSize && legacyScale === 1)}
                    onClick={() => stepPad(1)}
                  >
                    +
                  </button>
                  <button
                    aria-pressed={
                      !s.writingSize && (s.writingPreset ?? "fill") === "fill"
                    }
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() =>
                      update({ writingPreset: "fill", writingSize: undefined })
                    }
                  >
                    {t("가득")}
                  </button>
                </div>
                {mixedBrush && (
                  <p className="sg-hint" role="note">
                    {t(
                      "앞에서 쓴 글자와 다른 도구({brush})예요. 한 가지 도구로 쓰면 더 고르게 나와요.",
                      { brush: t(brushLabel ?? "") },
                    )}
                  </p>
                )}
              </div>
            </div>

            <aside className="sg-side" aria-label={t("이동과 글자 확인")}>
              <div className="sg-nav">
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
                    {t("← 이전")}
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
                    {t("건너뛰기")}
                  </button>
                </div>
              </div>
              <section
                className={
                  "sg-check" + (currentIssues.length ? " has-issues" : "")
                }
                aria-label={t("현재 글자 확인")}
              >
                <div className="sg-check-head">
                  <strong>
                    {currentIssues.length
                      ? t("다시 볼 글자")
                      : strokes.length
                        ? t("잘 썼어요")
                        : t("아직 안 쓴 글자")}
                  </strong>
                  <span>{t("{n}획", { n: strokes.length })}</span>
                </div>
                {currentIssues.length > 0 && (
                  <ul className="sg-reasons">
                    {currentIssues.map((issue) => (
                      <li key={issue.kind}>{t(issue.label)}</li>
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
                      ? t("표시 지우기")
                      : t("나중에 다시 보기")}
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
                      {t("자모 확인")}
                    </button>
                  )}
                </div>
              </section>
              <section className="sg-sample" aria-label={t("견본")}>
                <div className="sg-sample-head">
                  <span>
                    {t("견본")} <b>{sampleName}</b>
                  </span>
                  <button
                    className="sg-link"
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => changeStep(1)}
                  >
                    {t("바꾸기")}
                  </button>
                </div>
                {referenceUsesFallback(char, s.referenceFont) && (
                  <small>
                    {t("‘{char}’은 기본 견본으로 보여요.", { char })}
                  </small>
                )}
                {s.sampleMode === "inside-faint" && (
                  <label className="sg-slider">
                    <span>
                      {t("견본 진하기")}{" "}
                      <b>{Math.round(s.sampleOpacity * 100)}%</b>
                    </span>
                    <input
                      type="range"
                      aria-label={t("견본 진하기")}
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
                onClick={() => goStep(3)}
              >
                {script === "ja"
                  ? t("쓴 글자로 폰트 만들기 →")
                  : t("쓴 글자로 자모 나누기 →")}
              </button>
            </aside>
          </section>

          <footer className="sg-strip" aria-label={t("글자 모음")}>
            <div className="sg-strip-head">
              <div
                className="sg-lists"
                role="group"
                aria-label={t("글자 목록")}
              >
                {LIST_IDS.map((id) => (
                  <button
                    key={id}
                    aria-pressed={list === id}
                    data-list={id}
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => selectList(id)}
                  >
                    {id === "review" ? t("다시 확인") : t(LISTS[id]!.label)}{" "}
                    <b>
                      {id === "review"
                        ? reviewChars.length
                        : `${written(id)}/${listChars(id).length}`}
                    </b>
                  </button>
                ))}
              </div>
              <div className="sg-progress" aria-label={t("기본 글자 진행률")}>
                <span>
                  {t("기본 글자")} <b>{basicDone}</b> / {BASIC_CHARSET.length}
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
              aria-label={t("{name} 목록", {
                name:
                  list === "review"
                    ? t("다시 확인")
                    : t((LISTS[list] ?? LISTS.basic!).label),
              })}
            >
              {!navigationChars.length && (
                <div className="sg-strip-empty" role="status">
                  {list === "review"
                    ? t("다시 볼 글자가 없어요.")
                    : t("이 목록에 글자가 없어요.")}
                  <button onClick={() => selectList("basic")}>
                    {t("기본 글자 보기")}
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
                        ? t("다시 확인") +
                          " · " +
                          problems.map((issue) => t(issue.label)).join(" · ")
                        : state === "done"
                          ? t("완료")
                          : state === "skipped"
                            ? t("건너뜀")
                            : t("미완료"))
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

          {tipsOpen && <WritingTips onClose={closeTips} script={script} />}
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
                  <h2 id="tool-sheet-title">{t("도구 설정")}</h2>
                  <button
                    onClick={() => setToolSheet(false)}
                    aria-label={t("도구 설정 닫기")}
                  >
                    ✕
                  </button>
                </div>
                <h3>{t("쓰는 도구")}</h3>
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
                      <span>{t(b.label)}</span>
                    </button>
                  ))}
                </div>
                <p className="sg-help">
                  {t(
                    "한 폰트는 한 가지 도구로 쓰면 글자 모양이 고르게 나와요.",
                  )}
                </p>
                <label className="sg-slider">
                  <span>
                    {t("굵기")} <b>{params.size}</b>
                  </span>
                  <input
                    aria-label={t("펜 굵기")}
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
                  {t("펜 누르는 힘 반영")}
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
                      {t("펜촉 각도")} <b>{params.nibAngle}°</b>
                    </span>
                    <input
                      aria-label={t("펜촉 각도")}
                      type="range"
                      min="0"
                      max="180"
                      value={params.nibAngle}
                      onChange={(e) => setParams({ nibAngle: +e.target.value })}
                    />
                  </label>
                )}
                <h3>{t("지우개")}</h3>
                <div
                  className="sg-segment"
                  role="group"
                  aria-label={t("지우개 방식")}
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
                      {t(label)}
                    </button>
                  ))}
                </div>
                <label className="sg-slider">
                  <span>
                    {t("지우개 크기")} <b>{s.eraserSize}</b>
                  </span>
                  <input
                    aria-label={t("지우개 크기")}
                    type="range"
                    min="20"
                    max="200"
                    value={s.eraserSize}
                    onChange={(e) => update({ eraserSize: +e.target.value })}
                  />
                </label>
                <h3>{t("쓰기 칸 크기 (고급)")}</h3>
                <p className="sg-help">
                  {t(
                    "쓰기 칸 아래의 − · + 버튼은 정해진 단계로 바꾸고, 여기서는 10px 단위로 정할 수 있어요. 같은 숫자면 어느 기기에서나 비슷한 크기예요. 지금 화면에서는 {px}px까지 커질 수 있어요.",
                    { px: padFit },
                  )}
                </p>
                <div className="sg-px-row">
                  <input
                    aria-label={t("쓰기 칸 크기 슬라이더")}
                    type="range"
                    min="140"
                    max="900"
                    step="10"
                    value={s.writingSize ?? shownPad}
                    onChange={(e) => update({ writingSize: +e.target.value })}
                  />
                  <label>
                    <input
                      aria-label={t("쓰기 칸 크기 픽셀")}
                      type="number"
                      min="140"
                      max="900"
                      step="10"
                      value={s.writingSize ?? ""}
                      placeholder={t("자동")}
                      onChange={(e) => {
                        const value = +e.target.value;
                        if (
                          Number.isFinite(value) &&
                          value >= 140 &&
                          value <= 900
                        )
                          update({ writingSize: value });
                      }}
                    />
                    px
                  </label>
                </div>
                {s.writingSize && (
                  <button
                    className="sg-link"
                    onClick={() => update({ writingSize: undefined })}
                  >
                    {t("화면 가득으로 되돌리기")}
                  </button>
                )}
                <p className="sg-help">
                  {t("칸 크기를 바꿔도 폰트의 글자 크기는 바뀌지 않아요.")}
                </p>
              </section>
            </div>
          )}
        </>
      )}

      {step >= 3 && !projectsOpen && (
        <FontWorkshop
          key={project.id}
          stage={viewStep === 3 ? "separation" : "build"}
          onStageChange={(next) =>
            next === "separation" ? changeStep(3) : goStep(4)
          }
          project={project}
          onChange={useStudio.getState().prepareFont}
          initialChar={fontReviewChar}
          onWritePremium={() => {
            changeStep(2);
            const unwritten = (entries: readonly CharEntry[]) =>
              entries.find(
                ({ char: c }) => !project.samples[c]?.strokes.length,
              );
            const basic = unwritten(BASIC_CHARSET);
            const next =
              basic ?? unwritten(PREMIUM_CHARSET) ?? BASIC_CHARSET[0];
            setList(basic ? "basic" : "premium");
            goTo(next.char);
          }}
          onClose={() => changeStep(2)}
          onLegal={() => setLegalOpen(true)}
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
      {accountOpen && (
        <AccountPanel
          currentId={project.id}
          onOpenProject={(id) => transitionProject(id, false)}
          onManageProjects={() => setProjectsOpen(true)}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {session === null && <LoginScreen />}
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
              {t("되돌리기")}
            </button>
          )}
        </div>
      )}
      {renameCopy && (
        <div className="modal-backdrop" onClick={() => setRenameCopy(false)}>
          <form
            className="settings-modal sg-rename-copy"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-copy-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!project.name.trim()) rename(t("새 프로젝트"));
              setRenameCopy(false);
            }}
          >
            <h2 id="rename-copy-title">{t("복제한 프로젝트 이름")}</h2>
            <p>
              {t(
                "결제 기록 없이 새로 고칠 수 있는 프로젝트예요. 알아보기 쉬운 이름으로 바꿔 두세요.",
              )}
            </p>
            <label className="field">
              {t("프로젝트 이름")}
              <input
                value={project.name}
                maxLength={80}
                autoFocus
                onFocus={(event) => event.target.select()}
                onChange={(event) => rename(event.target.value)}
              />
            </label>
            <button type="submit" className="sg-primary">
              {t("확인")}
            </button>
          </form>
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
              <h2 id="settings-title">{t("설정")}</h2>
              <button
                onClick={() => setModal(false)}
                aria-label={t("설정 닫기")}
              >
                ✕
              </button>
            </div>
            <label className="field">
              {t("프로젝트 이름")}
              <input
                value={project.name}
                maxLength={80}
                onChange={(e) => rename(e.target.value)}
              />
            </label>
            <h3>{t("입력")}</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={s.penOnly}
                onChange={(e) => update({ penOnly: e.target.checked })}
              />
              {t("펜으로만 쓰기 (손바닥 오인식 방지)")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.allowMouse}
                onChange={(e) => update({ allowMouse: e.target.checked })}
              />
              {t("마우스로 쓰기 허용")}
            </label>
            <h3>{t("화면")}</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
              />
              {t("어두운 화면")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={leftHanded}
                onChange={(e) => setLeftHanded(e.target.checked)}
              />
              {t("왼손잡이 모드 (도구와 다음 글자 버튼을 오른쪽에)")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={askSteps}
                onChange={(e) => setAskSteps(e.target.checked)}
              />
              {t("다음 단계로 넘어가기 전에 물어보기")}
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
              {t("글자 크기 안내선")}
            </label>
            <label className="field">
              {t("화면 언어")}
              <select
                value={uiChoice.value}
                onChange={(event) =>
                  uiChoice.set(event.target.value as UiLang | "auto")
                }
              >
                <option value="auto">{t("기기 언어 따르기")}</option>
                <option value="ko">한국어</option>
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </label>
            <h3>{t("개인정보")}</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={noCount}
                onChange={(event) => {
                  setCountingDisabled(event.target.checked);
                  setNoCount(event.target.checked);
                }}
              />
              {t("방문 집계 보내지 않기")}
            </label>
            <p className="settings-help">
              {t(
                "글씨와 폰트는 이 기기 밖으로 나가지 않아요. 방문·내보내기 횟수만 숫자로 셉니다.",
              )}{" "}
              <button
                type="button"
                className="sg-link-button"
                onClick={() => setLegalOpen(true)}
              >
                {t("개인정보·이용 안내")}
              </button>
            </p>
            <h3>{t("백업")}</h3>
            <p className="settings-help">
              {t(
                "글씨는 이 브라우저에 저장돼요. JSON으로 백업하면 다른 기기로 옮길 수 있어요. 가져오기는 새 프로젝트로 열려요.",
              )}
            </p>
            <div className="backup-buttons">
              <button onClick={exportJSON}>{t("JSON 내보내기 ↓")}</button>
              <button onClick={() => file.current?.click()}>
                {t("JSON 가져오기 ↑")}
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
              {t(
                "키보드: P 펜 · E 지우개 · ← → 글자 이동 · Ctrl/⌘+Z 취소 · Shift+Z 다시",
              )}
            </p>
            <p className="version">
              {t("{maker} 제작", { maker: MAKER })} · {t(APP_NAME)} v
              {APP_VERSION} ·{" "}
              {t("{n}가지 견본 · 모든 획은 벡터로 보관됩니다.", {
                n: REFERENCE_FONTS.length,
              })}
            </p>
          </section>
        </div>
      )}
      {askTarget !== null && (
        <StepQuestion
          ask={stepAsk(askTarget)}
          onNo={() => setAskTarget(null)}
          onYes={(stopAsking) => {
            const target = askTarget;
            setAskTarget(null);
            if (stopAsking) setAskSteps(false);
            changeStep(target);
          }}
        />
      )}
      {legalOpen && (
        <div className="modal-backdrop" onClick={() => setLegalOpen(false)}>
          <section
            className="settings-modal sg-legal-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("개인정보·이용 안내")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title">
              <span />
              <button
                onClick={() => setLegalOpen(false)}
                aria-label={t("닫기")}
              >
                ✕
              </button>
            </div>
            <LegalTabs />
          </section>
        </div>
      )}
    </main>
  );
}

/** 설정의 화면 언어 고르기: 자동(기기 언어) 또는 직접 */
function useUiChoice() {
  const lang = useLang((state) => state.lang);
  const [value, setValue] = useState<UiLang | "auto">("auto");
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("hanhoek-ui") ?? "{}",
      ).uiLang;
      setValue(saved ?? "auto");
    } catch {}
  }, [lang]);
  return {
    value,
    set: (next: UiLang | "auto") => {
      useLang.getState().choose(next);
      setValue(next);
    },
  };
}
