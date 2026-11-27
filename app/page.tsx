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
import { APP_NAME, APP_VERSION, MAKER } from "../lib/version";
import { isNativeApp, saveToDevice } from "../lib/native";
import {
  loadProject,
  saveProject,
  parseProject,
  startProject,
  duplicateProject,
  switchProject,
  listProjects,
  renameStoredProject,
  copyStoredProject,
  deleteStoredProject,
  type ProjectSummary,
} from "../lib/storage";
import type { FontProject } from "../lib/types";
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
import { applyLabsFromUrl, labEnabled } from "../lib/labs";
import {
  countingDisabled,
  countVisit,
  setCountingDisabled,
} from "../lib/analytics";
import { gsap } from "gsap";
import LoadingScreen from "../components/LoadingScreen";
import HomeScreen from "../components/HomeScreen";
import {
  forgetResume,
  getResume,
  allResume,
  setResume,
  type ResumePoint,
} from "../lib/resume";
import { WsnsWordmark } from "../components/WsnsBrand";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleHelp,
  Download,
  Copy,
  Eraser,
  FolderOpen,
  Lock,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  SkipForward,
  SlidersHorizontal,
  Undo2,
  Upload,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { FieldHead, Panel, Segmented } from "@/components/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    [lockAsk, setLockAsk] = useState(false),
    [legalOpen, setLegalOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [noCount, setNoCount] = useState(false),
    [toolSheet, setToolSheet] = useState(false),
    [tipsOpen, setTipsOpen] = useState(false),
    [projectsOpen, setProjectsOpen] = useState(false),
    // 처음 들어오면 메인 화면(내 폰트 목록)부터. ?step= 으로 들어오면 바로 작업 화면.
    [home, setHome] = useState(true),
    [homeProjects, setHomeProjects] = useState<ProjectSummary[] | null>(null),
    [homeBusy, setHomeBusy] = useState(false),
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
  // 일본어 만들기는 숨은 기능(?labs=ja). 이미 일본어 프로젝트를 연 사람은 한글로 돌아갈 수 있게 선택지를 남긴다.
  const [jaLab, setJaLab] = useState(false);
  useEffect(() => {
    applyLabsFromUrl();
    setJaLab(labEnabled("ja"));
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
    // 대화창처럼 body 로 띄우는 요소도 같은 밝기의 색을 쓰도록
    document.documentElement.classList.toggle("dark", dark);
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
    if (requestedStep !== null) {
      setStep(requestedStep);
      setHome(false);
    }
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
    resume?: ResumePoint,
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
      setTool("pen");
      setProjectsOpen(false);
      if (resume) applyResume(next, resume);
      else {
        setIndex(0);
        setList("basic");
        changeStep(create ? 0 : 2);
      }
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
  /** 마지막으로 보던 단계·목록·글자로 돌아간다 */
  const applyResume = (target: FontProject, point?: ResumePoint) => {
    const chars = charsetFor(target.settings.script ?? "ko");
    const lists = listsFor(target.settings.script ?? "ko");
    const position = point?.char
      ? chars.findIndex((entry) => entry.char === point.char)
      : -1;
    setIndex(position >= 0 ? position : 0);
    setList(
      point?.list && (point.list === "review" || point.list in lists)
        ? (point.list as ListId)
        : "basic",
    );
    changeStep(
      point &&
        Number.isInteger(point.step) &&
        point.step >= 0 &&
        point.step <= 4
        ? point.step
        : 2,
    );
  };
  // 작업 화면에 있는 동안 지금 자리를 프로젝트별로 기억해 둔다.
  useEffect(() => {
    if (home || !project) return;
    setResume(project.id, { step, char, list });
  }, [home, project?.id, step, char, list]);

  /** 메인 화면 목록 새로 고침(열린 작업은 먼저 저장) */
  const refreshHome = async () => {
    const active = useStudio.getState().project;
    if (active && Object.values(active.samples).length) {
      persist();
      await saveChain.current.catch(() => {});
    }
    setHomeProjects(await listProjects().catch(() => []));
  };
  const goHome = () => {
    if (busy) return;
    setHome(true);
    setToolSheet(false);
    void refreshHome();
  };
  useEffect(() => {
    if (home && project) void refreshHome();
  }, [home, !!project]);
  const homeAction = async (work: () => Promise<void>) => {
    setHomeBusy(true);
    try {
      await work();
    } catch (error) {
      notify(
        error instanceof Error ? t(error.message) : t("작업하지 못했어요"),
      );
    } finally {
      setHomeBusy(false);
    }
  };
  const openFromHome = (id: string) =>
    homeAction(async () => {
      const point = getResume(id);
      if (id === useStudio.getState().project?.id)
        applyResume(useStudio.getState().project!, point);
      else await transitionProject(id, false, {}, point ?? { step: 2, at: 0 });
      setHome(false);
    });
  const newFromHome = () =>
    homeAction(async () => {
      const active = useStudio.getState().project!;
      const saved = homeProjects?.some((p) => p.id === active.id);
      // 아직 아무것도 쓰지 않은 새 작업이 열려 있으면 그대로 시작
      if (!saved && !Object.values(active.samples).length) {
        setIndex(0);
        setList("basic");
        changeStep(0);
      } else await transitionProject(t("새 손글씨"), true);
      setHome(false);
    });
  const renameFromHome = (id: string, name: string) =>
    homeAction(async () => {
      if (id === useStudio.getState().project?.id) {
        rename(name);
        persist();
        await saveChain.current.catch(() => {});
      } else await renameStoredProject(id, name);
      await refreshHome();
    });
  const duplicateFromHome = (id: string) =>
    homeAction(async () => {
      const source = homeProjects?.find((p) => p.id === id);
      if (id === useStudio.getState().project?.id) {
        persist();
        await saveChain.current.catch(() => {});
      }
      const copy = await copyStoredProject(
        id,
        t("{name}의 복사본", { name: source?.name ?? "" }),
      );
      const point = getResume(id);
      if (point) setResume(copy.id, point);
      await refreshHome();
      notify(t("‘{name}’(으)로 복제했어요.", { name: copy.name }));
    });
  const deleteFromHome = (id: string) =>
    homeAction(async () => {
      const wasActive = id === useStudio.getState().project?.id;
      const next = await deleteStoredProject(id);
      forgetResume(id);
      if (wasActive) setProject(next ?? newProject());
      await refreshHome();
      notify(t("프로젝트를 삭제했어요."));
    });

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
        home ||
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
    home,
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
  if (!project || !s) return <LoadingScreen />;
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

  /** 결제한 프로젝트를 복제해 결제 전 상태의 새 프로젝트로 이어서 작업 */
  const duplicateAndContinue = async () => {
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
  };
  // 결제한 프로젝트에서 고치는 칸(data-lock-zone)을 누르면 조용히 막지 않고 복제를 권한다.
  const lock = project.purchase ? "" : undefined;
  const guardLocked = (event: React.SyntheticEvent) => {
    if (!project.purchase) return;
    const zone = (event.target as Element | null)?.closest?.(
      "[data-lock-zone]",
    );
    if (!zone) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "pointerdown") setLockAsk(true);
  };

  return (
    <main
      ref={stageRoot}
      onPointerDownCapture={guardLocked}
      onClickCapture={guardLocked}
      className={
        (dark ? "studio dark" : "studio") +
        " journey sg-step-" +
        viewStep +
        (leftHanded ? " is-left-handed" : "")
      }
    >
      <header
        data-ui
        className="sg-topbar relative z-20 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-divider bg-card/85 px-3 py-2 backdrop-blur-md wide:h-16 wide:flex-nowrap wide:gap-x-5 wide:px-6 wide:py-0"
      >
        <a
          data-ui
          className="sg-brand group flex min-w-0 shrink-0 items-center gap-2 text-foreground no-underline"
          href="https://wsns.studio/"
          target="_blank"
          rel="noopener"
          aria-label={t("쎈스 글리프 — WSNS studio 홈페이지")}
        >
          <WsnsWordmark product={t("쎈스 글리프")} />
        </a>
        {!home && (
          <nav
            data-ui
            className="sg-steps order-last flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1 max-sm:rounded-lg max-sm:p-0.5 wide:order-none wide:mx-auto wide:w-auto"
            aria-label={t("폰트 만드는 순서")}
          >
            {stepsFor(script).map(({ label, step: position }, order) => {
              const current = viewStep === position,
                past = position < viewStep;
              return (
                <button
                  key={label}
                  data-ui
                  className={cn(
                    current ? "is-current" : past ? "is-past" : "",
                    "group/step flex h-10 min-w-0 flex-1 max-sm:h-8 max-sm:text-[13px] cursor-pointer data-[current=true]:max-[699px]:flex-[2.4] items-center justify-center gap-2 rounded-lg px-3 text-[14px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground disabled:cursor-default disabled:opacity-50 wide:flex-none wide:px-3.5",
                    current &&
                      "bg-card font-semibold text-foreground shadow-soft hover:bg-card",
                    past && "text-foreground/80",
                  )}
                  aria-current={current ? "step" : undefined}
                  data-current={current}
                  data-ink-locked={busy || undefined}
                  disabled={busy}
                  onClick={() => changeStep(position)}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] leading-none font-semibold tabular-nums",
                      current
                        ? "bg-brand-grad text-white"
                        : past
                          ? "bg-primary/15 text-primary"
                          : "bg-card text-dim",
                    )}
                  >
                    {past ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : (
                      order + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      !current && "max-wide:hidden min-[700px]:max-wide:inline",
                    )}
                  >
                    {t(label)}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 wide:ml-0">
          <span
            className="sg-save mr-1 hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground wide:inline-flex"
            data-ui
            role="status"
          >
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            {t(saved)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="sg-top-button"
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-pressed={home}
            onClick={goHome}
          >
            <FolderOpen />
            <span className="max-sm:sr-only">{t("내 폰트")}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sg-top-button"
            onClick={() => setModal(true)}
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-label={t("설정 열기")}
          >
            <Settings2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sg-top-button sg-profile-button rounded-full"
            onClick={() => setAccountOpen(true)}
            data-ink-locked={busy || undefined}
            disabled={busy}
            aria-label={t("내 계정 열기")}
            title={t(session?.name ?? "게스트")}
          >
            <span
              className="grid size-8 place-items-center rounded-full bg-brand-grad text-[13px] font-bold text-white ring-2 ring-card"
              aria-hidden="true"
            >
              {(session?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          </Button>
        </div>
      </header>
      {project.purchase && !home && (
        <div
          data-ui
          className="sg-locked-bar mx-3 mt-2 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-wash px-4 py-2.5 text-[13px] text-foreground wide:mx-6"
          role="status"
        >
          <span className="flex items-center gap-2.5">
            <Lock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <b className="font-semibold">{t("결제한 폰트예요.")}</b>{" "}
              <span className="text-muted-foreground">
                {t(
                  "글씨와 정돈은 더 고칠 수 없고, 같은 폰트만 다시 받을 수 있어요.",
                )}
              </span>
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void duplicateAndContinue()}
          >
            <Copy />
            {t("새 프로젝트로 복제해서 고치기")}
          </Button>
        </div>
      )}

      {home && (
        <HomeScreen
          projects={homeProjects}
          resume={allResume()}
          busy={homeBusy || busy}
          onOpen={openFromHome}
          onNew={newFromHome}
          onRename={renameFromHome}
          onDuplicate={duplicateFromHome}
          onDelete={deleteFromHome}
        />
      )}
      {step < 2 && !home && (
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
          onScript={jaLab || script === "ja" ? chooseScript : undefined}
          onLegal={() => setLegalOpen(true)}
          locked={!!project.purchase}
        />
      )}

      {step === 2 && !home && (
        <>
          <section className="sg-write journey-panel">
            <h1 className="sg-visually-hidden" tabIndex={-1}>
              {t("글자 쓰기")}
            </h1>
            <div className="sg-rail" role="toolbar" aria-label={t("쓰기 도구")}>
              <RailTool
                pressed={tool === "pen"}
                locked={busy}
                disabled={busy}
                data-lock-zone={lock}
                onClick={() => setTool("pen")}
                icon={<BrushPreview brush={s.activeBrush} />}
                label={t(brushLabel ?? "")}
              />
              <RailTool
                pressed={tool === "eraser"}
                locked={busy}
                disabled={busy}
                data-lock-zone={lock}
                onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
                icon={<Eraser />}
                label={t("지우개")}
              />
              <span className="sg-rail-gap" />
              <RailTool
                aria-label={t("실행 취소")}
                locked={busy && !!history?.past.length}
                disabled={busy || !history?.past.length}
                data-lock-zone={lock}
                onClick={() => undo(char)}
                icon={<Undo2 />}
                label={t("취소")}
              />
              <RailTool
                aria-label={t("다시 실행")}
                locked={busy && !!history?.future.length}
                disabled={busy || !history?.future.length}
                data-lock-zone={lock}
                onClick={() => redo(char)}
                icon={<Redo2 />}
                label={t("다시")}
              />
              <RailTool
                locked={busy && !!strokes.length}
                disabled={busy || !strokes.length}
                data-lock-zone={lock}
                onClick={resetGlyph}
                icon={<RotateCcw />}
                label={t("다시쓰기")}
              />
              {/* 다음 글자: 펜을 쥔 반대손이 도구 사이에서 바로 누르도록.
                  세로 화면에서는 줄의 맨 앞(왼손잡이는 맨 끝)으로 간다. */}
              <RailTool
                tone="primary"
                className="sg-tool-next sg-rail-next"
                aria-label={nextLabel}
                locked={busy}
                disabled={busy}
                onClick={nextWritingChar}
                icon={<ArrowRight strokeWidth={2.4} />}
                label={nextShort}
              />
              <span className="sg-rail-gap" />
              <RailTool
                aria-haspopup="dialog"
                aria-expanded={toolSheet}
                locked={busy}
                disabled={busy}
                onClick={() => setToolSheet(true)}
                icon={<SlidersHorizontal />}
                label={t("도구 설정")}
              />
              <RailTool
                aria-haspopup="dialog"
                locked={busy}
                disabled={busy}
                onClick={() => setTipsOpen(true)}
                icon={<CircleHelp />}
                label={t("쓰기 팁")}
              />
            </div>

            <div className="sg-stage">
              <div className="sg-char-head">
                <strong
                  data-ui
                  className="sg-char grid size-[60px] shrink-0 place-items-center rounded-xl border border-border bg-card text-[36px] leading-none font-semibold text-foreground shadow-soft max-sm:size-11 max-sm:rounded-lg max-sm:text-[26px]"
                >
                  {char}
                </strong>
                <div className="sg-char-info">
                  <span
                    data-ui
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {t(cat.label)}
                    </span>
                    {isPremiumCategory(category) && (
                      <em className="rounded-full bg-wash px-2 py-px text-[11px] font-semibold text-primary not-italic">
                        {t("특수문자")}
                      </em>
                    )}
                    {currentPosition >= 0 && (
                      <span className="font-mono text-[12px] tabular-nums">
                        {currentPosition + 1} / {navigationChars.length}
                      </span>
                    )}
                  </span>
                  <p
                    data-ui
                    className="mt-1 mb-0 text-[14px] leading-[1.65] break-keep text-foreground/85 max-sm:mt-0.5 max-sm:line-clamp-2 max-sm:min-h-[2.9em] max-sm:text-[12px] max-sm:leading-[1.45]"
                  >
                    {characterGuide(char, category, lang)}
                  </p>
                </div>
                <Segmented
                  className="max-sm:hidden"
                  label={t("견본 보기")}
                  value={
                    s.sampleMode === "outside" ? "outside" : "inside-faint"
                  }
                  options={[
                    { id: "inside-faint", label: t("따라 쓰기") },
                    { id: "outside", label: t("보고 쓰기") },
                  ]}
                  locked={busy}
                  disabled={busy}
                  onChange={(id) => update({ sampleMode: id })}
                />
              </div>
              <div
                className="sg-pad-area"
                data-locked={lock}
                data-lock-zone={lock}
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
                <Segmented
                  size="sm"
                  className="sm:hidden"
                  label={t("견본 보기")}
                  value={
                    s.sampleMode === "outside" ? "outside" : "inside-faint"
                  }
                  options={[
                    { id: "inside-faint", label: t("따라 쓰기") },
                    { id: "outside", label: t("보고 쓰기") },
                  ]}
                  locked={busy}
                  disabled={busy}
                  onChange={(id) => update({ sampleMode: id })}
                />
                <div
                  data-ui
                  className="sg-size inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1 text-xs shadow-soft max-sm:p-0.5 max-sm:shadow-none"
                  role="group"
                  aria-label={t("쓰기 칸 크기")}
                >
                  <span
                    aria-hidden="true"
                    className="pr-1 pl-2.5 font-medium text-muted-foreground max-[379px]:hidden"
                  >
                    {t("칸")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 rounded-full max-sm:size-7"
                    aria-label={t("쓰기 칸 더 작게")}
                    data-ink-locked={busy || undefined}
                    disabled={busy || shownPad <= PAD_SIZES[0]}
                    onClick={() => stepPad(-1)}
                  >
                    <Minus />
                  </Button>
                  <button
                    data-ui
                    className="sg-size-value flex h-8 min-w-14 max-sm:h-7 cursor-pointer items-baseline justify-center gap-0.5 rounded-full bg-muted px-3 font-mono hover:bg-wash"
                    aria-label={t("쓰기 칸 크기 자세히")}
                    onClick={() => setToolSheet(true)}
                  >
                    <b className="text-[13px] font-semibold text-foreground tabular-nums">
                      {shownPad}
                    </b>
                    <small className="text-[10px] text-muted-foreground">
                      px
                    </small>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-8 rounded-full max-sm:size-7"
                    aria-label={t("쓰기 칸 더 크게")}
                    data-ink-locked={busy || undefined}
                    disabled={busy || (!s.writingSize && legacyScale === 1)}
                    onClick={() => stepPad(1)}
                  >
                    <Plus />
                  </Button>
                  <button
                    data-ui
                    className="h-8 cursor-pointer rounded-full px-3 font-semibold text-muted-foreground hover:text-foreground max-sm:h-7 max-sm:px-2.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
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
              <div data-ui className="sg-nav grid grid-cols-2 gap-2 max-sm:gap-1.5 max-sm:[&>button]:h-9 max-sm:[&>button]:text-[13px]">
                <Button
                  variant="outline"
                  data-ink-locked={busy || undefined}
                  disabled={
                    busy ||
                    (list === "review"
                      ? navigationChars.length < 2
                      : currentPosition <= 0)
                  }
                  onClick={() => go(-1)}
                >
                  <ChevronLeft />
                  {t("이전")}
                </Button>
                <Button
                  variant="outline"
                  data-ink-locked={busy || undefined}
                  disabled={busy}
                  onClick={() => {
                    if (!strokes.length)
                      commit(char, category, strokes, "skipped");
                    go(1);
                  }}
                >
                  {t("건너뛰기")}
                  <SkipForward />
                </Button>
              </div>
              <Panel
                tone={currentIssues.length ? "danger" : "default"}
                className={cn(
                  "sg-check grid gap-3",
                  "min-w-0 max-sm:flex max-sm:flex-nowrap max-sm:items-center max-sm:gap-x-2 max-sm:gap-y-1.5 max-sm:px-3 max-sm:py-2 max-sm:shadow-none",
                  currentIssues.length > 0 && "has-issues",
                )}
                aria-label={t("현재 글자 확인")}
              >
                <div className="sg-check-head flex min-w-0 items-center justify-between gap-2 max-sm:min-w-0 max-sm:flex-1 max-sm:justify-start [&_strong]:max-sm:text-[13px]">
                  <strong className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <i
                      aria-hidden="true"
                      className={cn(
                        "size-2 rounded-full",
                        currentIssues.length
                          ? "bg-destructive"
                          : strokes.length
                            ? "bg-success"
                            : "bg-border",
                      )}
                    />
                    <span className="shrink-0 text-inherit [font-size:inherit]">
                      {currentIssues.length
                        ? t("다시 볼 글자")
                        : strokes.length
                          ? t("잘 썼어요")
                          : t("아직 안 쓴 글자")}
                    </span>
                    {/* 세로 화면: 이유를 같은 줄에 한 줄로. 경고가 떠도 쓰기 칸이 줄지 않게 */}
                    {currentIssues.length > 0 && (
                      <span
                        className="hidden min-w-0 truncate text-[12px] font-normal text-destructive max-wide:portrait:inline"
                        title={currentIssues.map((issue) => t(issue.label)).join(" · ")}
                      >
                        · {currentIssues.map((issue) => t(issue.label)).join(" · ")}
                      </span>
                    )}
                  </strong>
                  <span className="sg-stroke-count rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums max-sm:hidden">
                    {t("{n}획", { n: strokes.length })}
                  </span>
                </div>
                {currentIssues.length > 0 && (
                  <ul className="sg-reasons m-0 grid list-none gap-1 p-0 text-[13px] text-destructive max-wide:portrait:hidden">
                    {currentIssues.map((issue) => (
                      <li key={issue.kind} className="flex gap-1.5 break-keep">
                        <span aria-hidden="true">·</span>
                        {t(issue.label)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="sg-check-actions flex flex-wrap gap-2 max-sm:shrink-0 max-sm:flex-nowrap max-sm:gap-1.5 max-sm:[&>button]:h-8 max-sm:[&>button]:flex-none max-sm:[&>button]:px-2.5 max-sm:[&>button]:text-[12px]">
                  <Button
                    variant={
                      project.samples[char]?.needsReview ? "soft" : "secondary"
                    }
                    size="sm"
                    className="flex-1"
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    aria-pressed={!!project.samples[char]?.needsReview}
                    data-lock-zone={lock}
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
                  </Button>
                  {currentIssues.some((issue) => issue.kind === "outlier") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="sg-shape-ok flex-1"
                      data-ink-locked={busy || undefined}
                      disabled={busy}
                      data-lock-zone={lock}
                      onClick={() => useStudio.getState().acceptShape(char)}
                    >
                      {t("이 모양이 맞아요")}
                    </Button>
                  )}
                  {category === "hangul-syllable" && strokes.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      data-ink-locked={busy || undefined}
                      disabled={busy}
                      onClick={() => {
                        changeStep(3);
                        setFontReviewChar(char);
                      }}
                    >
                      {t("자모 확인")}
                    </Button>
                  )}
                </div>
              </Panel>
              <Panel
                className="sg-sample grid gap-3 max-wide:portrait:hidden"
                aria-label={t("견본")}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {t("견본")}{" "}
                    <b className="font-semibold text-foreground">
                      {sampleName}
                    </b>
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-[13px]"
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => changeStep(1)}
                  >
                    {t("바꾸기")}
                  </Button>
                </div>
                {referenceUsesFallback(char, s.referenceFont) && (
                  <small className="text-xs text-muted-foreground">
                    {t("‘{char}’은 기본 견본으로 보여요.", { char })}
                  </small>
                )}
                {s.sampleMode === "inside-faint" && (
                  <div className="grid gap-1.5">
                    <FieldHead
                      label={t("견본 진하기")}
                      value={Math.round(s.sampleOpacity * 100) + "%"}
                    />
                    <Slider
                      aria-label={t("견본 진하기")}
                      min={5}
                      max={40}
                      value={[Math.round(s.sampleOpacity * 100)]}
                      onValueChange={([value]) =>
                        update({ sampleOpacity: value / 100 })
                      }
                    />
                  </div>
                )}
              </Panel>
              <Button
                variant="soft"
                size="lg"
                className="sg-next-step mt-auto w-full border border-dashed border-primary/50 max-wide:portrait:hidden"
                data-ink-locked={busy || undefined}
                disabled={busy}
                onClick={() => goStep(3)}
              >
                {script === "ja"
                  ? t("쓴 글자로 폰트 만들기")
                  : t("쓴 글자로 자모 나누기")}
                <ArrowRight />
              </Button>
            </aside>
          </section>

          <footer
            data-ui
            className="sg-strip grid shrink-0 gap-2 border-t border-divider bg-card/70 px-3 pt-2 pb-2.5 backdrop-blur-sm wide:px-5 max-sm:gap-1.5 max-sm:px-2.5 max-sm:pt-1.5 max-sm:pb-[max(6px,env(safe-area-inset-bottom))]"
            aria-label={t("글자 모음")}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div
                data-ui
                className="sg-lists flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]"
                role="group"
                aria-label={t("글자 목록")}
              >
                {LIST_IDS.map((id) => (
                  <button
                    key={id}
                    data-ui
                    aria-pressed={list === id}
                    data-list={id}
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    onClick={() => selectList(id)}
                    className={cn(
                      "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] whitespace-nowrap max-sm:h-7 max-sm:px-2.5 max-sm:text-[12px] text-foreground/85 transition-colors hover:border-primary/40 disabled:cursor-default disabled:opacity-50",
                      "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground",
                      id === "premium" && "border-dashed",
                    )}
                  >
                    {id === "review" ? t("다시 확인") : t(LISTS[id]!.label)}
                    <b
                      className={cn(
                        "font-mono text-[11px] font-medium tabular-nums opacity-70",
                        id === "review" &&
                          reviewChars.length > 0 &&
                          list !== id &&
                          "text-destructive opacity-100",
                      )}
                    >
                      {id === "review"
                        ? reviewChars.length
                        : `${written(id)}/${listChars(id).length}`}
                    </b>
                  </button>
                ))}
              </div>
              <div
                className="flex shrink-0 items-center gap-2.5 text-xs whitespace-nowrap text-muted-foreground max-sm:hidden"
                aria-label={t("기본 글자 진행률")}
              >
                <span>
                  {t("기본 글자")}{" "}
                  <b className="font-mono font-semibold text-foreground tabular-nums">
                    {basicDone}
                  </b>
                  <span className="font-mono tabular-nums">
                    {" "}
                    / {BASIC_CHARSET.length}
                  </span>
                </span>
                <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-muted max-wide:hidden">
                  <i
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: (basicDone / BASIC_CHARSET.length) * 100 + "%",
                    }}
                  />
                </span>
              </div>
            </div>
            <div
              data-ui
              className="sg-glyphs flex snap-x snap-proximity gap-1.5 overflow-x-auto px-0.5 pt-0.5 pb-1"
              aria-label={t("{name} 목록", {
                name:
                  list === "review"
                    ? t("다시 확인")
                    : t((LISTS[list] ?? LISTS.basic!).label),
              })}
            >
              {!navigationChars.length && (
                <div
                  className="flex min-h-[58px] items-center gap-3 text-sm text-muted-foreground"
                  role="status"
                >
                  {list === "review"
                    ? t("다시 볼 글자가 없어요.")
                    : t("이 목록에 글자가 없어요.")}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectList("basic")}
                  >
                    {t("기본 글자 보기")}
                  </Button>
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
                const current = c.char === char;
                return (
                  <button
                    id={"glyph-" + c.char}
                    key={c.char}
                    data-ui
                    className={cn(
                      "sg-glyph relative grid h-[58px] w-[52px] shrink-0 max-sm:h-[46px] max-sm:w-[42px] max-sm:[&_canvas]:!h-7 max-sm:[&_canvas]:!w-7 max-sm:[&>span]:text-[18px] cursor-pointer snap-center grid-rows-[1fr_auto] justify-items-center rounded-[10px] border border-border bg-card p-0.5 transition-[border-color,box-shadow] hover:border-primary/40 disabled:cursor-default",
                      "[&_canvas]:!h-9 [&_canvas]:!w-9",
                      state === "review" &&
                        "border-destructive/60 bg-destructive-wash",
                      state === "done" && "bg-card",
                      state === "empty" && "bg-card/60",
                      current &&
                        "border-primary ring-[3px] ring-primary/20 hover:border-primary",
                    )}
                    data-state={state}
                    data-ink-locked={busy || undefined}
                    disabled={busy}
                    aria-current={current ? "step" : undefined}
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
                      <span
                        className={cn(
                          "self-center text-[22px] leading-none",
                          current ? "text-foreground" : "text-dim/70",
                        )}
                      >
                        {c.char}
                      </span>
                    )}
                    <small
                      className={cn(
                        "font-mono text-[10px] leading-4 text-muted-foreground tabular-nums",
                        state === "done" && "font-bold text-success",
                        state === "review" && "font-bold text-destructive",
                      )}
                    >
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
          <Sheet open={toolSheet} onOpenChange={setToolSheet}>
            <SheetContent
              id="tool-sheet"
              side={leftHanded ? "left" : "right"}
              className="sg-tool-sheet w-[min(400px,92vw)] gap-0 overflow-y-auto sm:max-w-[400px]"
              closeLabel={t("도구 설정 닫기")}
            >
              <SheetHeader className="border-b border-divider px-6 pt-5 pb-4">
                <SheetTitle className="text-lg">{t("도구 설정")}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("쓰는 도구, 지우개, 쓰기 칸 크기")}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 px-6 py-5">
                <section className="grid gap-3">
                  <h3 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
                    {t("쓰는 도구")}
                  </h3>
                  <div className="sg-brushes grid grid-cols-3 gap-2">
                    {BRUSHES.map((b) => (
                      <button
                        key={b.id}
                        data-ui
                        aria-pressed={s.activeBrush === b.id}
                        onClick={() => {
                          update({ activeBrush: b.id });
                          setTool("pen");
                        }}
                        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground aria-pressed:border-primary aria-pressed:bg-wash aria-pressed:text-primary [&_canvas]:!h-6 [&_canvas]:!w-14"
                      >
                        <BrushPreview brush={b.id} />
                        <span>{t(b.label)}</span>
                      </button>
                    ))}
                  </div>
                  <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
                    {t(
                      "한 폰트는 한 가지 도구로 쓰면 글자 모양이 고르게 나와요.",
                    )}
                  </p>
                  <div className="grid gap-2">
                    <FieldHead label={t("굵기")} value={params.size} />
                    <Slider
                      aria-label={t("펜 굵기")}
                      min={20}
                      max={120}
                      value={[params.size]}
                      onValueChange={([value]) => setParams({ size: value })}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                    {t("펜 누르는 힘 반영")}
                    <Switch
                      checked={params.usePressure}
                      onCheckedChange={(value) =>
                        setParams({ usePressure: value })
                      }
                    />
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
                    <div className="grid gap-2">
                      <FieldHead
                        label={t("펜촉 각도")}
                        value={params.nibAngle + "°"}
                      />
                      <Slider
                        aria-label={t("펜촉 각도")}
                        min={0}
                        max={180}
                        value={[params.nibAngle ?? 30]}
                        onValueChange={([value]) =>
                          setParams({ nibAngle: value })
                        }
                      />
                    </div>
                  )}
                </section>
                <section className="grid gap-3 border-t border-divider pt-5">
                  <h3 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
                    {t("지우개")}
                  </h3>
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    label={t("지우개 방식")}
                    value={s.eraserMode}
                    options={[
                      { id: "stroke", label: t("획 통째로") },
                      { id: "partial", label: t("닿은 부분만") },
                    ]}
                    onChange={(id) => update({ eraserMode: id })}
                  />
                  <div className="grid gap-2">
                    <FieldHead label={t("지우개 크기")} value={s.eraserSize} />
                    <Slider
                      aria-label={t("지우개 크기")}
                      min={20}
                      max={200}
                      value={[s.eraserSize]}
                      onValueChange={([value]) => update({ eraserSize: value })}
                    />
                  </div>
                </section>
                <section className="grid gap-3 border-t border-divider pt-5">
                  <h3 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
                    {t("쓰기 칸 크기 (고급)")}
                  </h3>
                  <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
                    {t(
                      "쓰기 칸 아래의 − · + 버튼은 정해진 단계로 바꾸고, 여기서는 10px 단위로 정할 수 있어요. 같은 숫자면 어느 기기에서나 비슷한 크기예요. 지금 화면에서는 {px}px까지 커질 수 있어요.",
                      { px: padFit },
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <Slider
                      className="flex-1"
                      aria-label={t("쓰기 칸 크기 슬라이더")}
                      min={140}
                      max={900}
                      step={10}
                      value={[s.writingSize ?? shownPad]}
                      onValueChange={([value]) =>
                        update({ writingSize: value })
                      }
                    />
                    <div className="relative w-28">
                      <Input
                        aria-label={t("쓰기 칸 크기 픽셀")}
                        type="number"
                        min="140"
                        max="900"
                        step="10"
                        className="pr-9 font-mono tabular-nums"
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
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        px
                      </span>
                    </div>
                  </div>
                  {s.writingSize && (
                    <Button
                      variant="link"
                      className="justify-self-start"
                      onClick={() => update({ writingSize: undefined })}
                    >
                      {t("화면 가득으로 되돌리기")}
                    </Button>
                  )}
                  <p className="m-0 text-xs text-muted-foreground">
                    {t("칸 크기를 바꿔도 폰트의 글자 크기는 바뀌지 않아요.")}
                  </p>
                </section>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {step >= 3 && !home && (
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
          onOpenProject={(id) => void openFromHome(id)}
          onManageProjects={goHome}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {session === null && <LoginScreen />}
      {toast && (
        <div
          data-ui
          className="toast fixed bottom-5 left-1/2 z-[110] flex max-w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 animate-in items-center gap-3 rounded-xl bg-foreground py-2.5 pr-2.5 pl-4 text-[13.5px] text-background shadow-lift fade-in-0 slide-in-from-bottom-2"
          role="status"
        >
          <span className="min-w-0 break-keep">{toast}</span>
          {toastUndo && (
            <button
              data-ui
              className="h-8 shrink-0 cursor-pointer rounded-lg px-3 text-[13px] font-semibold text-primary hover:bg-background/10"
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
      <AlertDialog open={lockAsk} onOpenChange={setLockAsk}>
        <AlertDialogContent
          className="sg-lock-ask sm:max-w-[440px]"
          onOverlayClick={() => setLockAsk(false)}
        >
          <AlertDialogHeader>
            <span className="mb-1 grid size-11 place-items-center rounded-xl bg-wash text-primary">
              <Lock className="size-5" />
            </span>
            <AlertDialogTitle className="text-xl">
              {t("이미 결제한 폰트예요")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-[1.7] break-keep">
              {t(
                "결제한 폰트는 글씨와 정돈을 고칠 수 없어요. 프로젝트를 복제해서 이어서 작업할까요? 복제본은 결제 전 상태라, 고친 뒤 다시 결제해 내려받을 수 있어요.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLockAsk(false)}>
              {t("그대로 두기")}
            </Button>
            <Button
              className="sg-lock-duplicate"
              autoFocus
              onClick={() => {
                setLockAsk(false);
                void duplicateAndContinue();
              }}
            >
              <Copy />
              {t("복제해서 이어서 하기")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={renameCopy} onOpenChange={setRenameCopy}>
        <DialogContent
          className="sg-rename-copy sm:max-w-md"
          closeLabel={t("닫기")}
        >
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!project.name.trim()) rename(t("새 프로젝트"));
              setRenameCopy(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("복제한 프로젝트 이름")}</DialogTitle>
              <DialogDescription>
                {t(
                  "결제 기록 없이 새로 고칠 수 있는 프로젝트예요. 알아보기 쉬운 이름으로 바꿔 두세요.",
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="rename-copy-name">{t("프로젝트 이름")}</Label>
              <Input
                id="rename-copy-name"
                value={project.name}
                maxLength={80}
                autoFocus
                onFocus={(event) => event.target.select()}
                onChange={(event) => rename(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit">{t("확인")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent
          id="settings-dialog"
          className="settings-dialog gap-0 p-0 sm:max-w-[520px]"
          closeLabel={t("설정 닫기")}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="border-b border-divider px-6 pt-5 pb-4">
            <DialogTitle className="text-lg">{t("설정")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("프로젝트 이름, 입력, 화면, 개인정보, 백업")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 px-6 py-5">
            <div className="grid gap-2">
              <Label htmlFor="settings-project-name">
                {t("프로젝트 이름")}
              </Label>
              <Input
                id="settings-project-name"
                value={project.name}
                maxLength={80}
                onChange={(e) => rename(e.target.value)}
              />
            </div>
            <SettingGroup title={t("입력")}>
              <SettingSwitch
                id="set-pen-only"
                checked={s.penOnly}
                onChange={(value) => update({ penOnly: value })}
                label={t("펜으로만 쓰기 (손바닥 오인식 방지)")}
              />
              <SettingSwitch
                id="set-mouse"
                checked={s.allowMouse}
                onChange={(value) => update({ allowMouse: value })}
                label={t("마우스로 쓰기 허용")}
              />
            </SettingGroup>
            <SettingGroup title={t("화면")}>
              <SettingSwitch
                id="set-dark"
                checked={dark}
                onChange={setDark}
                label={t("어두운 화면")}
              />
              <SettingSwitch
                id="set-left"
                checked={leftHanded}
                onChange={setLeftHanded}
                label={t("왼손잡이 모드 (도구와 다음 글자 버튼을 오른쪽에)")}
              />
              <SettingSwitch
                id="set-ask"
                checked={askSteps}
                onChange={setAskSteps}
                label={t("다음 단계로 넘어가기 전에 물어보기")}
              />
              <SettingSwitch
                id="set-size-guide"
                checked={s.grid.sizeGuide}
                onChange={(value) =>
                  update({ grid: { ...s.grid, sizeGuide: value } })
                }
                label={t("글자 크기 안내선")}
              />
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <Label htmlFor="set-lang" className="font-normal">
                  {t("화면 언어")}
                </Label>
                <Select
                  value={uiChoice.value}
                  onValueChange={(value) =>
                    uiChoice.set(value as UiLang | "auto")
                  }
                >
                  <SelectTrigger id="set-lang" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      {t("기기 언어 따르기")}
                    </SelectItem>
                    <SelectItem value="ko">한국어</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SettingGroup>
            <SettingGroup
              title={t("개인정보")}
              foot={
                <>
                  {t(
                    "글씨와 폰트는 이 기기 밖으로 나가지 않아요. 방문·내보내기 횟수만 숫자로 셉니다.",
                  )}{" "}
                  <Button
                    variant="link"
                    className="h-auto text-[13px]"
                    onClick={() => setLegalOpen(true)}
                  >
                    {t("개인정보·이용 안내")}
                  </Button>
                </>
              }
            >
              <SettingSwitch
                id="set-no-count"
                checked={noCount}
                onChange={(value) => {
                  setCountingDisabled(value);
                  setNoCount(value);
                }}
                label={t("방문 집계 보내지 않기")}
              />
            </SettingGroup>
            <SettingGroup
              title={t("백업")}
              foot={t(
                "글씨는 이 브라우저에 저장돼요. JSON으로 백업하면 다른 기기로 옮길 수 있어요. 가져오기는 새 프로젝트로 열려요.",
              )}
            >
              <div className="grid grid-cols-2 gap-2 p-3">
                <Button variant="outline" onClick={exportJSON}>
                  <Download />
                  {t("JSON 내보내기")}
                </Button>
                <Button variant="outline" onClick={() => file.current?.click()}>
                  <Upload />
                  {t("JSON 가져오기")}
                </Button>
              </div>
            </SettingGroup>
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
            <div className="grid gap-1 border-t border-divider pt-4 text-xs text-muted-foreground">
              <p className="m-0 max-sm:hidden">
                {t(
                  "키보드: P 펜 · E 지우개 · ← → 글자 이동 · Ctrl/⌘+Z 취소 · Shift+Z 다시",
                )}
              </p>
              <p className="version m-0 font-mono text-[11px]">
                {t("{maker} 제작", { maker: MAKER })} · {t(APP_NAME)} v
                {APP_VERSION} ·{" "}
                {t("{n}가지 견본 · 모든 획은 벡터로 보관됩니다.", {
                  n: REFERENCE_FONTS.length,
                })}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
      <Dialog open={legalOpen} onOpenChange={setLegalOpen}>
        <DialogContent
          className="sg-legal-dialog sm:max-w-2xl"
          closeLabel={t("닫기")}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            {t("개인정보·이용 안내")}
          </DialogTitle>
          <LegalTabs />
        </DialogContent>
      </Dialog>
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

/** 쓰기 화면 측면 도구 줄의 버튼 */
function RailTool({
  icon,
  label,
  pressed,
  locked,
  tone = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  icon: React.ReactNode;
  label: React.ReactNode;
  pressed?: boolean;
  locked?: boolean;
  tone?: "default" | "primary";
}) {
  return (
    <button
      data-ui
      type="button"
      aria-pressed={pressed}
      data-ink-locked={locked || undefined}
      className={cn(
        "sg-tool flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11.5px] leading-tight font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-default [&_svg]:size-[22px] [&_svg]:shrink-0",
        "sm:max-wide:portrait:min-h-14 sm:max-wide:portrait:flex-[1_0_64px]",
        "max-sm:min-h-11 max-sm:flex-[1_1_0] max-sm:min-w-0 max-sm:gap-0.5 max-sm:rounded-lg max-sm:px-0 max-sm:py-1 max-sm:text-[10px] max-sm:tracking-[-0.04em] max-sm:whitespace-nowrap max-sm:[&_svg]:size-[18px]",
        tone === "default" &&
          "min-h-[62px] border-border bg-card text-muted-foreground shadow-[0_1px_0_rgb(0_0_0/0.03)] hover:border-primary/40 hover:text-foreground disabled:opacity-35 aria-pressed:border-primary aria-pressed:bg-wash aria-pressed:font-semibold aria-pressed:text-primary aria-pressed:shadow-none",
        tone === "primary" &&
          "my-1 min-h-[88px] border-transparent bg-brand-grad text-[12.5px] font-semibold text-white shadow-[0_10px_22px_-10px_color-mix(in_oklch,var(--accent)_80%,transparent)] hover:brightness-[1.08] disabled:opacity-50 max-wide:portrait:order-first max-wide:portrait:my-0 sm:max-wide:portrait:flex-[1.4_0_88px] [&_svg]:size-7 max-sm:min-h-11 max-sm:flex-[2.3_1_0] max-sm:flex-row max-sm:gap-0.5 max-sm:text-[12px] max-sm:tracking-[-0.03em] max-sm:shadow-none max-sm:[&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** 설정 창의 묶음: 작은 제목 + 둥근 칸 안의 줄들 */
function SettingGroup({
  title,
  foot,
  children,
}: {
  title: React.ReactNode;
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
        {title}
      </h3>
      <div className="divide-y divide-divider overflow-hidden rounded-xl border border-border bg-background/60">
        {children}
      </div>
      {foot && (
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          {foot}
        </p>
      )}
    </section>
  );
}

/** 설정 한 줄: 글 + 오른쪽 스위치 */
function SettingSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <Label htmlFor={id} className="cursor-pointer leading-snug font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
