"use client";

import FontOutput from "./FontOutput";
import { OUTPUT_PREFIX, type OutputNames } from "../lib/font/output-names";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHARSET, HANGUL, isPremiumCategory } from "../data/charset";
import { fallbackTargets } from "../lib/font/fallback";
import { BASE_PATH } from "../lib/base-path";
import { referenceFont } from "../lib/reference-fonts";
import HandwritingSearch from "./HandwritingSearch";
import SeparationEditor from "./SeparationEditor";
import RewriteDialog from "./RewriteDialog";
import MetricPreview from "./MetricPreview";
import { APP_NAME, APP_VERSION, MAKER } from "../lib/version";
import type {
  ConversionReply,
  ConversionRequest,
  ExportFormat,
} from "../lib/font/export-formats";
import {
  FONT_EXPORT_WORKER_URL,
  FONT_WORKER_URL,
} from "../lib/font/worker-url";
import { decompose } from "../lib/hangul";
import { coverage } from "../lib/font/composition";
import {
  CORRECTION_KEYS,
  defaultPreparation,
  FONT_SETTING_LIMITS as LIMITS,
  type CorrectionDetail,
} from "../lib/font/types";
import { correctionDetail, detailFromStrength } from "../lib/font/beautify";
import {
  separationStatus,
  type SeparationStatus,
} from "../lib/font/separation-status";
import { bodySize } from "../lib/font/layout";
import type { FontProject } from "../lib/types";
import type {
  BuildRequest,
  FontPreparation,
  FontStats,
} from "../lib/font/types";
import { buildFontParallel, type BuildHandle } from "../lib/font/build-client";

type GeneratedFont = {
  request: BuildRequest;
  preparation: FontPreparation;
  ttf: ArrayBuffer;
  otf: ArrayBuffer;
  stats: FontStats;
  face: FontFace;
};

let lastGeneratedFont: GeneratedFont | null = null;

/** 쓰지 않은 글자를 채울 견본: 고른 견본 → 특수기호 보조 글꼴 → Noto Sans KR */
function fallbackFontUrls(referenceId?: string) {
  const url = (file: string) =>
    new URL(BASE_PATH + "/fonts/" + file, window.location.href).href;
  const chosen = referenceFont(referenceId);
  return [
    { name: chosen.name, url: url(chosen.file) },
    { name: "특수기호 보조", url: url("SpecialSymbolsFallback.ttf") },
    { name: "Noto Sans KR", url: url("NotoSansKR.ttf") },
  ];
}

const PRESETS = [
  { value: 0, label: "쓴 그대로" },
  { value: 25, label: "살짝" },
  { value: 50, label: "단정하게" },
  { value: 80, label: "많이" },
];
const DETAIL_LABELS: Record<
  keyof CorrectionDetail,
  { label: string; note: string }
> = {
  layout: {
    label: "자모 배치",
    note: "초성·중성·종성의 위치와 비율을 견본 쪽으로",
  },
  straighten: {
    label: "기울기",
    note: "거의 가로·세로인 획만 반듯하게",
  },
  smooth: { label: "떨림", note: "획의 잔떨림을 부드럽게" },
  size: { label: "글자 크기", note: "작게 쓴 글자를 보통 크기 쪽으로" },
  weight: { label: "굵기 고르게", note: "획마다 다른 필압을 고르게" },
};

interface Props {
  stage: "separation" | "build";
  onStageChange: (stage: "separation" | "build") => void;
  initialChar?: string;
  project: FontProject;
  onChange: (preparation: FontPreparation) => void;
  onClose: () => void;
  onWrite: (char: string) => void;
  onWritePremium?: () => void;
}

export default function FontWorkshop({
  project,
  onChange,
  onClose,
  onWrite,
  onWritePremium,
  initialChar,
  stage,
  onStageChange: setStage,
}: Props) {
  const defaults = useMemo(
    () => defaultPreparation(project.name),
    [project.id, project.name],
  );
  const prep = useMemo(() => {
    const value = project.fontPreparation ?? defaults;
    return value.settings.includeComposed
      ? value
      : { ...value, settings: { ...value.settings, includeComposed: true } };
  }, [project.fontPreparation, defaults]);
  const report = useMemo(
    () => coverage(project, prep),
    [
      project.samples,
      prep.separations,
      project.settings.referenceFont,
      project.settings.grid.diamond,
    ],
  );
  const writtenHangul = HANGUL.filter(
    (char) => project.samples[char]?.strokes.length,
  );
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        writtenHangul.map((char) => [
          char,
          separationStatus(project, prep, char),
        ]),
      ) as Record<string, SeparationStatus>,
    [project.samples, prep.separations, project.settings.referenceFont],
  );
  const checkCount = writtenHangul.filter(
    (char) => statuses[char] === "check",
  ).length;
  const [listMode, setListMode] = useState<"check" | "all">("all");
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [finishStep, setFinishStep] = useState<"refine" | "export">("refine");
  const [selected, setSelected] = useState(() => {
    if (initialChar && writtenHangul.includes(initialChar)) return initialChar;
    return writtenHangul[0] ?? "";
  });
  useEffect(() => {
    if (initialChar && writtenHangul.includes(initialChar)) {
      setSelected(initialChar);
      setListMode("all");
    }
  }, [initialChar]);
  // 살펴본 글자: 글자를 다시 쓰면(updatedAt 변경) 다시 살펴볼 대상이 됩니다.
  const visitedKey = "senseglyph-reviewed-" + project.id;
  const [visitedMap, setVisitedMap] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(visitedKey) ?? "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    const sample = project.samples[selected];
    if (stage !== "separation" || !sample) return;
    if (visitedMap[selected] === sample.updatedAt) return;
    const next = { ...visitedMap, [selected]: sample.updatedAt };
    setVisitedMap(next);
    try {
      localStorage.setItem(visitedKey, JSON.stringify(next));
    } catch {}
  }, [selected, stage, project.samples]);
  const visited = useMemo(
    () =>
      new Set(
        writtenHangul.filter(
          (char) => visitedMap[char] === project.samples[char]?.updatedAt,
        ),
      ),
    [visitedMap, project.samples],
  );
  const visibleChars =
    listMode === "check"
      ? writtenHangul.filter(
          (char) => statuses[char] === "check" || char === selected,
        )
      : writtenHangul;

  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState("");
  const [result, setResult] = useState(() =>
    lastGeneratedFont?.request.project.id === project.id
      ? lastGeneratedFont
      : null,
  );
  const isCurrent =
    !!result &&
    result.request.project.samples === project.samples &&
    result.preparation === prep &&
    result.request.project.settings.referenceFont ===
      project.settings.referenceFont;
  const worker = useRef<BuildHandle | null>(null),
    exportWorker = useRef<Worker | null>(null),
    root = useRef<HTMLElement>(null);
  useEffect(() => {
    root.current?.parentElement?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [stage, finishStep]);
  const generation = useRef(0);
  const resetResult = () => {
    generation.current++;
    worker.current?.cancel();
    worker.current = null;
    exportWorker.current?.terminate();
    exportWorker.current = null;
    setExporting(null);
    setExportError("");
    setBuilding(false);
    setError("");
  };
  useEffect(() => {
    resetResult();
  }, [
    project.samples,
    prep,
    project.settings.referenceFont,
    project.settings.grid.diamond,
  ]);
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.cancel();
      exportWorker.current?.terminate();
    },
    [],
  );

  // 슬라이더를 끄는 동안의 값은 화면에만 먼저 보이고, 손을 멈추거나 떼면 한 번에 반영합니다.
  // 정돈 강도처럼 계산이 큰 값이 슬라이더 칸마다 다시 계산되며 화면이 멈추는 것을 막습니다.
  const [draft, setDraft] = useState<Partial<
    FontPreparation["settings"]
  > | null>(null);
  const draftRef = useRef<Partial<FontPreparation["settings"]> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPrep = useRef(prep);
  latestPrep.current = prep;
  const settings = (changes: Partial<FontPreparation["settings"]>) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const pending = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    const current = latestPrep.current;
    onChange({
      ...current,
      settings: { ...current.settings, ...pending, ...changes },
    });
  };
  const flushDraft = () => {
    if (draftRef.current) settings({});
  };
  const stageSetting = (
    changes: Partial<FontPreparation["settings"]>,
    delay = 220,
  ) => {
    draftRef.current = { ...draftRef.current, ...changes };
    setDraft(draftRef.current);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(flushDraft, delay);
  };
  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    },
    [],
  );
  const view = draft ? { ...prep.settings, ...draft } : prep.settings;
  const build = () => {
    if (isCurrent || worker.current || !report.direct) return;
    resetResult();
    setBuilding(true);
    setProgress(0);
    setMessage("폰트 생성을 시작합니다");
    const request: BuildRequest = {
      project,
      preparation: {
        ...prep,
        settings: {
          ...prep.settings,
          familyName: "OSNS Preview",
          englishFamilyName: "OSNS Preview",
        },
      },
      fallbackFonts: fallbackFontUrls(project.settings.referenceFont),
    };
    const token = generation.current;
    const handle = buildFontParallel(
      FONT_WORKER_URL,
      request,
      (value, text) => {
        if (token !== generation.current) return;
        setProgress(value);
        setMessage(text);
      },
    );
    worker.current = handle;
    handle.promise.then(
      async (reply) => {
        if (token !== generation.current) return;
        worker.current = null;
        try {
          const family = "SenseGlyphPreview-" + crypto.randomUUID();
          const loaded = await new FontFace(family, reply.ttf).load();
          if (token !== generation.current) return;
          if (lastGeneratedFont) document.fonts.delete(lastGeneratedFont.face);
          document.fonts.add(loaded);
          const generated = {
            request,
            preparation: prep,
            ttf: reply.ttf,
            otf: reply.otf,
            stats: reply.stats,
            face: loaded,
          };
          lastGeneratedFont = generated;
          setResult(generated);
          setProgress(100);
          setBuilding(false);
        } catch {
          if (token === generation.current) {
            setError("폰트 미리보기를 불러오지 못했어요. 다시 만들어 주세요.");
            setBuilding(false);
          }
        }
      },
      (failure: Error) => {
        if (token !== generation.current) return;
        worker.current = null;
        setError(failure.message || "폰트를 만드는 중 문제가 생겼어요.");
        setBuilding(false);
      },
    );
  };
  // 다듬기 화면에서 손을 멈추면 뒤에서 미리 만들어 두어, 내보내기를 누르면 바로 받을 수 있게 합니다.
  useEffect(() => {
    if (
      stage !== "build" ||
      finishStep !== "refine" ||
      isCurrent ||
      building ||
      error ||
      draft ||
      !report.direct
    )
      return;
    const timer = setTimeout(build, 1500);
    return () => clearTimeout(timer);
  }, [stage, finishStep, isCurrent, building, error, draft, prep]);
  // 내보내기 화면에 오면 최신 설정의 폰트를 바로 만듭니다.
  useEffect(() => {
    if (
      stage === "build" &&
      finishStep === "export" &&
      !isCurrent &&
      !building &&
      !error &&
      report.direct
    )
      build();
  }, [stage, finishStep, isCurrent, building]);

  const fallback = useMemo(() => {
    const covered = new Set(report.available);
    const missing = fallbackTargets().filter((char) => !covered.has(char));
    const count = (test: (char: string) => boolean) =>
      missing.filter(test).length;
    const category = new Map(CHARSET.map((e) => [e.char, e.category]));
    const groups = [
      ["한글", count((c) => /^[가-힣]$/.test(c))],
      [
        "영문·숫자",
        count((c) =>
          ["latin-upper", "latin-lower", "digit"].includes(category.get(c)!),
        ),
      ],
      ["기호", count((c) => category.get(c) === "ascii-symbol")],
      [
        "특수문자",
        count((c) => !!category.get(c) && isPremiumCategory(category.get(c)!)),
      ],
    ] as const;
    return {
      total: missing.length,
      groups: groups
        .filter(([, n]) => n > 0)
        .map(([label, n]) => `${label} ${n.toLocaleString()}자`),
      fontName: referenceFont(project.settings.referenceFont).name,
    };
  }, [report, project.settings.referenceFont]);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const download = (
    format: ExportFormat,
    names: OutputNames,
    mode: "download" | "share" = "download",
  ) => {
    if (!result || !isCurrent || exportWorker.current) return;
    const filename = OUTPUT_PREFIX + names.korean;
    const type = format === "zip" ? "application/zip" : "font/" + format;
    const save = (buffer: ArrayBuffer) => {
      // 공유는 파일 변환이 끝난 뒤 다시 한 번 누르게 합니다(브라우저는 터치 직후에만 공유 창을 열어 줌).
      if (mode === "share") {
        setShareFile(new File([buffer], filename + "." + format, { type }));
        return;
      }
      const url = URL.createObjectURL(new Blob([buffer], { type }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename + "." + format;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    setExportError("");
    setExporting(format);
    const fail = (message: string) => {
      exportWorker.current?.terminate();
      exportWorker.current = null;
      setExporting(null);
      setExportError(message);
    };
    const convert = () => {
      try {
        const converter = new Worker(FONT_EXPORT_WORKER_URL);
        exportWorker.current = converter;
        converter.onmessage = (event: MessageEvent<ConversionReply>) => {
          if (exportWorker.current !== converter) return;
          const reply = event.data;
          if ("error" in reply) {
            fail(reply.error);
            return;
          }
          converter.terminate();
          exportWorker.current = null;
          setExporting(null);
          save(reply.buffer);
        };
        converter.onerror = () => {
          if (exportWorker.current === converter)
            fail("파일 변환에 실패했어요. 다시 시도해 주세요.");
        };
        const request: ConversionRequest = {
          ttf: result.ttf,
          otf: result.otf,
          format,
          filename,
          names,
        };
        converter.postMessage(request);
      } catch {
        fail("파일 변환을 시작하지 못했어요. 다시 시도해 주세요.");
      }
    };
    convert();
  };
  const syllables = report.available.filter((ch) => decompose(ch)).length;
  const detail = correctionDetail(view);
  const strength = view.correction ?? (detail.layout || 0);
  const customDetail = !!view.correctionDetail;

  const missingSlots =
    report.missingSlots.length > 0 ? (
      <details className="fw-missing">
        <summary>
          자모 자리 {report.missingSlots.length}개가 비어 있어 한글{" "}
          {(11172 - syllables).toLocaleString()}자는 아직 만들 수 없어요
        </summary>
        <p>아래 글자를 쓰면 빈 자리가 채워져요.</p>
        <div className="fw-chip-list">
          {report.missingSamples.map((char) => (
            <button
              key={char}
              type="button"
              onClick={() => {
                if (project.samples[char]?.strokes.length) {
                  setSelected(char);
                  setListMode("all");
                  setStage("separation");
                } else onWrite(char);
              }}
            >
              {char}
              <small>
                {project.samples[char]?.strokes.length ? "확인" : "쓰기"}
              </small>
            </button>
          ))}
        </div>
      </details>
    ) : null;

  if (stage === "separation")
    return (
      <div className="guided-workshop journey-panel sg-sep-page">
        <section
          className="font-workshop fw fw-sep"
          ref={root}
          aria-labelledby="fw-title"
        >
          <h1 id="fw-title" className="sg-visually-hidden" tabIndex={-1}>
            자모 나누기
          </h1>
          <div className="fw-sep-top">
            <button type="button" className="fw-secondary" onClick={onClose}>
              ← 글자 쓰기
            </button>
            {writtenHangul.length > 0 && (
              <div className="fw-segment" role="group" aria-label="보여줄 글자">
                <button
                  type="button"
                  aria-pressed={listMode === "all"}
                  onClick={() => setListMode("all")}
                >
                  전체 <b>{writtenHangul.length}</b>
                </button>
                <button
                  type="button"
                  aria-pressed={listMode === "check"}
                  onClick={() => setListMode("check")}
                >
                  주의 <b>{checkCount}</b>
                </button>
              </div>
            )}
            <span className="fw-sep-stats" role="status">
              살펴본 글자 <b>{visited.size}</b>/{writtenHangul.length} · 만들 수
              있는 한글 <b>{syllables.toLocaleString()}</b>
            </span>
            <button
              type="button"
              className="fw-primary"
              disabled={!report.direct}
              onClick={() => {
                setFinishStep("refine");
                setStage("build");
              }}
            >
              폰트 다듬기 →
            </button>
          </div>
          {writtenHangul.length > 0 && (
            <p className="fw-sep-notice" role="note">
              자동으로 나눈 결과예요. 한 글자가 잘못 나뉘면 그 자모를 쓰는 다른
              글자들까지 함께 어긋나요. <b>전체를 한 번씩 넘겨 보며</b> 확인해
              주세요.{" "}
              {checkCount > 0 ? (
                <>
                  <i className="fw-warn-dot">!</i> 표시는 특히 잘못 나뉜 것 같은
                  글자예요.
                </>
              ) : null}
            </p>
          )}
          {writtenHangul.length ? (
            <SeparationEditor
              project={project}
              preparation={prep}
              char={selected}
              chars={visibleChars}
              statuses={statuses}
              onSelect={setSelected}
              onWrite={() => setRewriting(selected)}
              onChange={onChange}
              visited={visited}
            />
          ) : (
            <div className="fw-empty">
              아직 쓴 한글이 없어요.
              <button
                type="button"
                className="fw-primary"
                onClick={() => onWrite(HANGUL[0])}
              >
                한글 쓰러 가기 →
              </button>
            </div>
          )}
          {missingSlots}
        </section>
        {rewriting && (
          <RewriteDialog char={rewriting} onClose={() => setRewriting(null)} />
        )}
      </div>
    );

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    onInput: (value: number) => void,
    shown: string = String(value),
    note?: string,
    step = 1,
  ) => (
    <label className="fw-slider">
      <span>
        {label} <b>{shown}</b>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onInput(+event.target.value)}
        onPointerUp={flushDraft}
        onKeyUp={flushDraft}
        onBlur={flushDraft}
      />
      {note && <small>{note}</small>}
    </label>
  );

  return (
    <div className="guided-workshop journey-panel">
      <section
        className="font-workshop fw"
        ref={root}
        aria-labelledby="fw-title"
      >
        <header className="fw-head">
          <div>
            <span className="step-kicker">05 / 폰트 완성</span>
            <h1 id="fw-title" tabIndex={-1}>
              {finishStep === "refine" ? "폰트를 다듬어요" : "폰트를 내보내요"}
            </h1>
          </div>
          <nav className="fw-tabs" aria-label="폰트 완성 순서">
            <button
              type="button"
              aria-current={finishStep === "refine" ? "step" : undefined}
              onClick={() => setFinishStep("refine")}
            >
              <span>1</span> 다듬기
            </button>
            <button
              type="button"
              aria-current={finishStep === "export" ? "step" : undefined}
              disabled={!report.direct}
              onClick={() => setFinishStep("export")}
            >
              <span>2</span> 내보내기
            </button>
          </nav>
        </header>

        {!report.direct ? (
          <div className="fw-empty">
            한 글자 이상 쓰면 폰트를 만들 수 있어요.
            <button
              type="button"
              className="fw-primary"
              onClick={() => onWrite(HANGUL[0])}
            >
              첫 글자 쓰러 가기 →
            </button>
          </div>
        ) : finishStep === "refine" ? (
          <>
            <div className="fw-refine">
              <div className="fw-controls">
                <section className="fw-card" aria-labelledby="fw-correction">
                  <div className="fw-card-head">
                    <h3 id="fw-correction">손글씨 정돈</h3>
                    {customDetail && (
                      <span className="fw-badge">고급 설정 사용 중</span>
                    )}
                  </div>
                  <p className="fw-help">
                    0%는 쓴 획 그대로예요. 올릴수록 자모 배치와 기울기를 견본
                    글꼴 쪽으로 정돈하지만, 내 글씨의 획과 개성은 남겨요.
                  </p>
                  <div
                    className="fw-segment"
                    role="group"
                    aria-label="정돈 단계"
                  >
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        aria-pressed={
                          !customDetail && strength === preset.value
                        }
                        onClick={() =>
                          settings({
                            correction: preset.value,
                            correctionDetail: undefined,
                            alignToReference: undefined,
                            averageStrokes: undefined,
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {slider(
                    "정돈 강도",
                    strength,
                    0,
                    100,
                    (value) =>
                      stageSetting({
                        correction: value,
                        correctionDetail: undefined,
                        alignToReference: undefined,
                        averageStrokes: undefined,
                      }),
                    strength + "%",
                    undefined,
                    5,
                  )}
                  <details
                    className="fw-advanced"
                    open={customDetail || undefined}
                  >
                    <summary>고급 설정 · 항목별로 조절</summary>
                    {CORRECTION_KEYS.map((key) =>
                      slider(
                        DETAIL_LABELS[key].label,
                        detail[key],
                        0,
                        100,
                        (value) =>
                          stageSetting({
                            correctionDetail: { ...detail, [key]: value },
                            alignToReference: undefined,
                            averageStrokes: undefined,
                          }),
                        detail[key] + "%",
                        DETAIL_LABELS[key].note,
                        5,
                      ),
                    )}
                    {customDetail && (
                      <button
                        type="button"
                        className="fw-link"
                        onClick={() =>
                          settings({
                            correctionDetail: undefined,
                            correction: strength,
                          })
                        }
                      >
                        정돈 강도에 맞춰 되돌리기
                      </button>
                    )}
                  </details>
                </section>
                <section className="fw-card" aria-labelledby="fw-size">
                  <h3 id="fw-size">크기와 간격</h3>
                  {slider(
                    "글자 크기",
                    bodySize(view),
                    LIMITS.bodyMin,
                    LIMITS.bodyMax,
                    (value) => stageSetting({ bodySize: value }, 90),
                    bodySize(view) / 10 + "%",
                    undefined,
                    10,
                  )}
                  {slider(
                    "글자 사이 간격",
                    view.letterSpacing,
                    LIMITS.spacingMin,
                    LIMITS.spacingMax,
                    (value) => stageSetting({ letterSpacing: value }, 90),
                    String(view.letterSpacing),
                    "음수로 줄이면 획이 겹칠 수 있어요.",
                    10,
                  )}
                  {slider(
                    "기준선 높이",
                    view.baseline,
                    650,
                    900,
                    (value) => stageSetting({ baseline: value }, 90),
                    String(view.baseline),
                    "글자가 줄 위에 놓이는 높이예요.",
                    5,
                  )}
                </section>
                <section className="fw-card" aria-labelledby="fw-stroke">
                  <h3 id="fw-stroke">획</h3>
                  {slider(
                    "획 굵기",
                    view.strokeWeight ?? 100,
                    LIMITS.weightMin,
                    LIMITS.weightMax,
                    (value) => stageSetting({ strokeWeight: value }, 90),
                    (view.strokeWeight ?? 100) + "%",
                    undefined,
                    5,
                  )}
                  <div className="fw-field-row">
                    <span>획 끝</span>
                    <div
                      className="fw-segment"
                      role="group"
                      aria-label="획 끝 모양"
                    >
                      {(
                        [
                          ["original", "쓴 그대로"],
                          ["round", "둥글게"],
                          ["pointed", "뾰족하게"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={
                            (prep.settings.strokeFinish ?? "original") === value
                          }
                          onClick={() => settings({ strokeFinish: value })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="fw-link"
                    onClick={() =>
                      settings({
                        correction: 0,
                        correctionDetail: undefined,
                        alignToReference: undefined,
                        averageStrokes: undefined,
                        bodySize: defaults.settings.bodySize,
                        letterSpacing: 0,
                        baseline: 800,
                        strokeWeight: 100,
                        strokeFinish: "original",
                      })
                    }
                  >
                    모든 다듬기 설정 처음으로
                  </button>
                </section>
              </div>
              <MetricPreview
                project={project}
                preparation={prep}
                pending={!!draft}
              />
            </div>
            {missingSlots}
            <details className="fw-more">
              <summary>
                원본 손글씨 찾기 · 어떤 글자의 자모가 쓰였는지 보기
              </summary>
              <HandwritingSearch
                project={project}
                preparation={prep}
                onSeparate={(char) => {
                  setSelected(char);
                  setListMode("all");
                  setStage("separation");
                }}
                onWrite={onWrite}
              />
            </details>
            <footer className="fw-actions">
              <button
                type="button"
                className="fw-secondary"
                onClick={() => setStage("separation")}
              >
                ← 자모 나누기
              </button>
              <button
                type="button"
                className="fw-primary"
                onClick={() => {
                  setFinishStep("export");
                  build();
                }}
              >
                폰트 만들기 →
              </button>
            </footer>
          </>
        ) : (
          <>
            <FontOutput
              family={result?.face.family}
              characters={result?.stats.characters ?? []}
              status={
                building
                  ? "building"
                  : result
                    ? isCurrent
                      ? "ready"
                      : "stale"
                    : "empty"
              }
              progress={progress}
              message={message}
              error={error}
              onBuild={() => {
                setError("");
                build();
              }}
              exporting={exporting}
              exportError={exportError}
              onDownload={download}
              shareFile={shareFile}
              onShareDone={() => setShareFile(null)}
              fallback={fallback}
              onWriteMissing={onWritePremium}
            />
            <footer className="fw-actions">
              <button
                type="button"
                className="fw-secondary"
                onClick={() => setFinishStep("refine")}
              >
                ← 다듬기
              </button>
              <span className="fw-note">
                손글씨와 폰트는 이 기기 안에서만 만들어져요.
              </span>
              <span className="sg-credit">
                <b>{MAKER}</b> 제작 · {APP_NAME} v{APP_VERSION}
              </span>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
