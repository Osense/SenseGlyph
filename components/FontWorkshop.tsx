"use client";

import FontOutput, { type OutputPlan } from "./FontOutput";
import { OUTPUT_PREFIX, type OutputNames } from "../lib/font/output-names";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASIC_CHARSET,
  HANGUL,
  PREMIUM_CHARSET,
  isPremiumCategory,
} from "../data/charset";
import HandwritingSearch from "./HandwritingSearch";
import SeparationEditor from "./SeparationEditor";
import MetricPreview from "./MetricPreview";
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
  confirmSeparation,
  separationStatus,
  type SeparationStatus,
} from "../lib/font/separation-status";
import { bodySize } from "../lib/font/layout";
import type { FontProject } from "../lib/types";
import type {
  BuildRequest,
  FontPreparation,
  FontStats,
  WorkerReply,
} from "../lib/font/types";

type GeneratedFont = {
  request: BuildRequest;
  preparation: FontPreparation;
  basicBuffer?: ArrayBuffer;
  buffer: ArrayBuffer;
  stats: FontStats;
  face: FontFace;
};

let lastGeneratedFont: GeneratedFont | null = null;

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
  const confirmedCount = writtenHangul.filter(
    (char) => statuses[char] === "confirmed",
  ).length;
  const [listMode, setListMode] = useState<"check" | "all">(() =>
    checkCount ? "check" : "all",
  );
  const [finishStep, setFinishStep] = useState<"refine" | "export">("refine");
  const [selected, setSelected] = useState(() => {
    if (initialChar && writtenHangul.includes(initialChar)) return initialChar;
    return (
      writtenHangul.find((char) => statuses[char] === "check") ??
      writtenHangul[0] ??
      ""
    );
  });
  useEffect(() => {
    if (initialChar && writtenHangul.includes(initialChar)) {
      setSelected(initialChar);
      setListMode("all");
    }
  }, [initialChar]);
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
  const worker = useRef<Worker | null>(null),
    exportWorker = useRef<Worker | null>(null),
    root = useRef<HTMLElement>(null);
  useEffect(() => {
    root.current?.parentElement?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [stage, finishStep]);
  const generation = useRef(0);
  const resetResult = () => {
    generation.current++;
    worker.current?.terminate();
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
      worker.current?.terminate();
      exportWorker.current?.terminate();
    },
    [],
  );

  const settings = (changes: Partial<FontPreparation["settings"]>) =>
    onChange({ ...prep, settings: { ...prep.settings, ...changes } });
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
    };
    const token = generation.current;
    try {
      const nextWorker = new Worker(FONT_WORKER_URL);
      worker.current = nextWorker;
      nextWorker.onmessage = async (event: MessageEvent<WorkerReply>) => {
        if (token !== generation.current) return;
        const reply = event.data;
        if (reply.type === "progress") {
          setProgress(reply.value);
          setMessage(reply.message);
        } else if (reply.type === "error") {
          setError(reply.message);
          setBuilding(false);
          nextWorker.terminate();
          worker.current = null;
        } else {
          nextWorker.terminate();
          worker.current = null;
          try {
            const family = "SenseGlyphPreview-" + crypto.randomUUID();
            const loaded = await new FontFace(family, reply.buffer).load();
            if (token !== generation.current) return;
            if (lastGeneratedFont)
              document.fonts.delete(lastGeneratedFont.face);
            document.fonts.add(loaded);
            const generated = {
              request,
              preparation: prep,
              buffer: reply.buffer,
              stats: reply.stats,
              face: loaded,
            };
            lastGeneratedFont = generated;
            setResult(generated);
            setProgress(100);
            setBuilding(false);
          } catch {
            if (token === generation.current) {
              setError(
                "폰트 미리보기를 불러오지 못했어요. 다시 만들어 주세요.",
              );
              setBuilding(false);
            }
          }
        }
      };
      nextWorker.onerror = () => {
        if (token === generation.current) {
          setError("폰트를 만드는 중 문제가 생겼어요. 다시 시도해 주세요.");
          setBuilding(false);
          nextWorker.terminate();
          worker.current = null;
        }
      };
      nextWorker.postMessage(request);
    } catch (error) {
      setBuilding(false);
      setError(
        error instanceof Error
          ? error.message
          : "폰트 생성기를 시작하지 못했어요.",
      );
    }
  };
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

  const written = (list: { char: string }[]) =>
    list.filter(({ char }) => project.samples[char]?.strokes.length).length;
  const basicWritten = written(BASIC_CHARSET);
  const premiumWritten = written(PREMIUM_CHARSET);
  const download = (
    format: ExportFormat,
    names: OutputNames,
    plan: OutputPlan,
  ) => {
    if (!result || !isCurrent || exportWorker.current) return;
    const filename = OUTPUT_PREFIX + names.korean;
    const save = (buffer: ArrayBuffer) => {
      const type = format === "zip" ? "application/zip" : "font/" + format;
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
    const convert = (buffer: ArrayBuffer) => {
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
        const request: ConversionRequest = { buffer, format, filename, names };
        converter.postMessage(request);
      } catch {
        fail("파일 변환을 시작하지 못했어요. 다시 시도해 주세요.");
      }
    };
    const hasPremium = Object.values(project.samples).some(
      (sample) => sample.strokes.length && isPremiumCategory(sample.category),
    );
    if (plan === "premium" || !hasPremium) {
      convert(result.buffer);
      return;
    }
    if (result.basicBuffer) {
      convert(result.basicBuffer);
      return;
    }
    try {
      const basicWorker = new Worker(FONT_WORKER_URL);
      exportWorker.current = basicWorker;
      basicWorker.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (exportWorker.current !== basicWorker) return;
        const reply = event.data;
        if (reply.type === "error") fail(reply.message);
        if (reply.type === "result") {
          basicWorker.terminate();
          result.basicBuffer = reply.buffer;
          convert(reply.buffer);
        }
      };
      basicWorker.onerror = () => {
        if (exportWorker.current === basicWorker)
          fail("기본형 폰트를 만들지 못했어요.");
      };
      basicWorker.postMessage({
        ...result.request,
        includePremium: false,
      } satisfies BuildRequest);
    } catch {
      fail("기본형 폰트 생성을 시작하지 못했어요.");
    }
  };
  const syllables = report.available.filter((ch) => decompose(ch)).length;
  const detail = correctionDetail(prep.settings);
  const strength = prep.settings.correction ?? (detail.layout || 0);
  const customDetail = !!prep.settings.correctionDetail;

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
      <div className="guided-workshop journey-panel">
        <section
          className="font-workshop fw"
          ref={root}
          aria-labelledby="fw-title"
        >
          <header className="fw-head">
            <div>
              <span className="step-kicker">04 / 자모 나누기</span>
              <h1 id="fw-title" tabIndex={-1}>
                자음과 모음이 잘 나뉘었는지 확인해요
              </h1>
              <p>
                <b>한 = ㅎ + ㅏ + ㄴ</b>처럼 글자를 나눠 두면, 쓰지 않은 한글
                11,172자를 내 글씨로 만들 수 있어요. 자동으로 나눈 결과 중{" "}
                <b>확인이 필요한 글자</b>만 보면 돼요.
              </p>
            </div>
            <div className="fw-head-side">
              <div className="fw-stats" role="status">
                <span>
                  <b>{confirmedCount}</b> / {writtenHangul.length} 확인 완료
                </span>
                <span>
                  <b>{syllables.toLocaleString()}</b> / 11,172 만들 수 있음
                </span>
              </div>
              {writtenHangul.length > 0 && (
                <div
                  className="fw-segment"
                  role="group"
                  aria-label="보여줄 글자"
                >
                  <button
                    type="button"
                    aria-pressed={listMode === "check"}
                    onClick={() => setListMode("check")}
                  >
                    확인 필요 <b>{checkCount}</b>
                  </button>
                  <button
                    type="button"
                    aria-pressed={listMode === "all"}
                    onClick={() => setListMode("all")}
                  >
                    쓴 한글 전체 <b>{writtenHangul.length}</b>
                  </button>
                </div>
              )}
            </div>
          </header>
          {writtenHangul.length ? (
            <>
              {listMode === "check" && !checkCount && (
                <p className="fw-done-note" role="status">
                  확인이 필요한 글자가 없어요. 바로 폰트를 다듬어도 좋아요.
                </p>
              )}
              <SeparationEditor
                project={project}
                preparation={prep}
                char={selected}
                chars={visibleChars}
                statuses={statuses}
                onSelect={setSelected}
                onWrite={() => onWrite(selected)}
                onChange={onChange}
                onConfirm={() => {
                  onChange(confirmSeparation(project, prep, selected));
                  const order = writtenHangul;
                  const start = order.indexOf(selected);
                  const next = [
                    ...order.slice(start + 1),
                    ...order.slice(0, start),
                  ].find((char) =>
                    listMode === "check"
                      ? statuses[char] === "check"
                      : statuses[char] !== "confirmed",
                  );
                  if (next) setSelected(next);
                }}
              />
            </>
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
          <footer className="fw-actions">
            <button type="button" className="fw-secondary" onClick={onClose}>
              ← 글자 쓰기
            </button>
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
          </footer>
        </section>
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
                      settings({
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
                          settings({
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
                    bodySize(prep.settings),
                    LIMITS.bodyMin,
                    LIMITS.bodyMax,
                    (value) => settings({ bodySize: value }),
                    bodySize(prep.settings) / 10 + "%",
                    undefined,
                    10,
                  )}
                  {slider(
                    "글자 사이 간격",
                    prep.settings.letterSpacing,
                    LIMITS.spacingMin,
                    LIMITS.spacingMax,
                    (value) => settings({ letterSpacing: value }),
                    String(prep.settings.letterSpacing),
                    "음수로 줄이면 획이 겹칠 수 있어요.",
                    10,
                  )}
                  {slider(
                    "기준선 높이",
                    prep.settings.baseline,
                    650,
                    900,
                    (value) => settings({ baseline: value }),
                    String(prep.settings.baseline),
                    "글자가 줄 위에 놓이는 높이예요.",
                    5,
                  )}
                </section>
                <section className="fw-card" aria-labelledby="fw-stroke">
                  <h3 id="fw-stroke">획</h3>
                  {slider(
                    "획 굵기",
                    prep.settings.strokeWeight ?? 100,
                    LIMITS.weightMin,
                    LIMITS.weightMax,
                    (value) => settings({ strokeWeight: value }),
                    (prep.settings.strokeWeight ?? 100) + "%",
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
              <MetricPreview project={project} preparation={prep} />
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
              projectName={project.name}
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
              basicWritten={basicWritten}
              premiumWritten={premiumWritten}
              premiumTotal={PREMIUM_CHARSET.length}
              onWritePremium={onWritePremium}
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
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
