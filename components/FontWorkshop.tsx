"use client";

import FontOutput, { FontDialog, type OutputPlan } from "./FontOutput";
import { OUTPUT_PREFIX, type OutputNames } from "../lib/font/output-names";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HANGUL, SPECIAL_SYMBOLS } from "../data/charset";
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
  defaultPreparation,
  FONT_SETTING_LIMITS as LIMITS,
} from "../lib/font/types";
import { bodySize } from "../lib/font/layout";
import type { FontProject } from "../lib/types";
import type {
  BuildRequest,
  FontPreparation,
  FontStats,
  Part,
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

interface Props {
  guided?: boolean;
  journeyStage?: "separation" | "build";
  onStageChange?: (stage: "separation" | "build") => void;
  initialChar?: string;
  initialStage?: "separation" | "build";
  project: FontProject;
  onChange: (preparation: FontPreparation) => void;
  onClose: () => void;
  onWrite: (char: string) => void;
  onWriteSpecial?: () => void;
  saveStatus: string;
  onSave: () => void;
}

export default function FontWorkshop({
  project,
  onChange,
  onClose,
  onWrite,
  onWriteSpecial,
  saveStatus,
  onSave,
  initialChar,
  initialStage = "build",
  guided = false,
  journeyStage,
  onStageChange,
}: Props) {
  const controlId = useId();
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
  const [localStage, setLocalStage] = useState<"separation" | "build">(
    initialStage,
  );
  const stage = journeyStage ?? localStage;
  const setStage = (next: "separation" | "build") => {
    setLocalStage(next);
    onStageChange?.(next);
  };
  const [finishStep, setFinishStep] = useState<"refine" | "export">("refine");
  const [selected, setSelected] = useState(
    initialChar && writtenHangul.includes(initialChar)
      ? initialChar
      : (writtenHangul[0] ?? ""),
  );
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
    result?.request.project.samples === project.samples &&
    result.preparation === prep &&
    result.request.project.settings.referenceFont ===
      project.settings.referenceFont;
  const worker = useRef<Worker | null>(null),
    exportWorker = useRef<Worker | null>(null),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (guided && dialog.current?.parentElement)
      dialog.current.parentElement.scrollTop = 0;
  }, [guided, stage, finishStep]);
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
  useEffect(() => {
    if (guided) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (dialog.current?.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,a[href],[tabindex="0"],summary',
          ) ?? [],
        ).filter(
          (el) => !el.hasAttribute("disabled") && el.getClientRects().length,
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      generation.current++;
      worker.current?.terminate();
      exportWorker.current?.terminate();
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [guided]);
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
    if (isCurrent || building || worker.current || !report.direct) return;
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
      // Bundle locally before dev/build so the worker is available offline as plain JavaScript.
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
            const family = "HanhoekPreview-" + crypto.randomUUID();
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
                "폰트 미리보기를 불러오지 못했습니다. 자모와 획을 확인한 뒤 다시 생성하세요.",
              );
              setBuilding(false);
            }
          }
        }
      };
      nextWorker.onerror = () => {
        if (token === generation.current) {
          setError("폰트 생성 중 오류가 발생했습니다. 다시 시도해 주세요.");
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
          : "폰트 생성기를 시작하지 못했습니다.",
      );
    }
  };
  useEffect(() => {
    if (stage === "separation") setFinishStep("refine");
  }, [stage]);

  const specialWritten = SPECIAL_SYMBOLS.filter(
    (symbol) => project.samples[symbol]?.strokes.length,
  ).length;
  const resultSymbols = new Set(result?.stats.characters);
  const premiumReady = SPECIAL_SYMBOLS.every((symbol) =>
    resultSymbols.has(symbol),
  );
  const download = (
    format: ExportFormat,
    names: OutputNames,
    plan: OutputPlan,
  ) => {
    if (
      !result ||
      exportWorker.current ||
      (plan === "premium" && !premiumReady)
    )
      return;
    const filename = OUTPUT_PREFIX + names.korean;
    const save = (buffer: ArrayBuffer) => {
      const type = format === "zip" ? "application/zip" : "font/" + format;
      const url = URL.createObjectURL(new Blob([buffer], { type }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename + "." + format;
      link.click();
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
            fail("파일 변환에 실패했습니다. 다시 시도해 주세요.");
        };
        const request: ConversionRequest = { buffer, format, filename, names };
        converter.postMessage(request);
      } catch {
        fail("파일 변환을 시작하지 못했습니다. 다시 시도해 주세요.");
      }
    };
    if (
      plan === "premium" ||
      !SPECIAL_SYMBOLS.some((symbol) => resultSymbols.has(symbol))
    ) {
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
          fail("기본 폰트를 생성하지 못했습니다.");
      };
      basicWorker.postMessage({
        ...result.request,
        includeSpecial: false,
      } satisfies BuildRequest);
    } catch {
      fail("기본 폰트 생성을 시작하지 못했습니다.");
    }
  };
  const bothCorrections =
    prep.settings.alignToReference && prep.settings.averageStrokes;
  const syllables = report.available.filter((ch) => decompose(ch)).length;

  return (
    <div className={guided ? "guided-workshop journey-panel" : "font-backdrop"}>
      <section
        className="font-workshop"
        role={guided ? undefined : "dialog"}
        aria-modal={guided ? undefined : true}
        aria-labelledby="font-title"
        ref={dialog}
      >
        <header className="font-header">
          <div>
            <span className="eyebrow">
              {stage === "separation"
                ? "04 / 다른 글자도 만들 수 있도록"
                : "05 / 나만의 글꼴 완성"}
            </span>
            <h2 id="font-title">
              {stage === "separation"
                ? "자음과 모음을 나눠요."
                : finishStep === "refine"
                  ? "폰트 다듬기"
                  : "폰트 내보내기"}
            </h2>
          </div>
          {stage === "separation" && (
            <details className="separation-welcome">
              <summary
                className="jamo-example"
                aria-label="한의 초성 중성 종성 예시"
              >
                <span>한</span>
                <i>=</i>
                <span>
                  ㅎ<small>초성 · 첫 자음</small>
                </span>
                <span>
                  ㅏ<small>중성 · 모음</small>
                </span>
                <span>
                  ㄴ<small>종성 · 받침</small>
                </span>
                <em className="welcome-toggle">설명</em>
              </summary>
              <p>
                한 글자에서 초성·중성·종성을 나누면, 아직 쓰지 않은 한글도 만들
                수 있어요. 우선 자동으로 나눈 결과를 확인해주세요.
              </p>
              <ol>
                <li>
                  <b>여러 획 선택</b> 올가미로 원하는 획을 둘러싸 한꺼번에
                  잡아요.
                </li>
                <li>
                  <b>한 번에 배정</b> 선택 테두리 위에서 초성·중성·종성 버튼을
                  누르세요.
                </li>
                <li>
                  <b>모양 보정</b> 선택한 획을 끌어 위치를 옮기거나 부분 수정
                  도구로 다듬어요.
                </li>
              </ol>
            </details>
          )}
          <div className="font-save-controls">
            <span role="status">자동 저장 · {saveStatus}</span>
            <button className="font-secondary" onClick={onSave}>
              지금 저장
            </button>
          </div>
          <button onClick={onClose} aria-label="폰트 완성 닫기">
            ✕
          </button>
        </header>
        {!guided && (
          <nav className="font-steps" aria-label="폰트 제작 단계">
            <button
              className={stage === "separation" ? "active" : ""}
              disabled={building}
              onClick={() => setStage("separation")}
            >
              1. 자모 확인·보정
            </button>
            <button
              className={stage === "build" ? "active" : ""}
              disabled={building}
              onClick={() => setStage("build")}
            >
              2. 폰트 생성·다운로드
            </button>
          </nav>
        )}
        {!guided && (
          <div className="font-summary">
            <div>
              <b>{report.direct}</b>
              <span>직접 쓴 글자</span>
            </div>
            <div>
              <b>
                {report.slots} <small>/ 237</small>
              </b>
              <span>분리된 자모 자리</span>
            </div>
            <div>
              <b>
                {syllables.toLocaleString()} <small>/ 11,172</small>
              </b>
              <span>사용 가능한 한글</span>
            </div>
          </div>
        )}
        {stage === "separation" ? (
          <div className="separation-stage">
            {writtenHangul.length ? (
              <SeparationEditor
                project={project}
                preparation={prep}
                char={selected}
                chars={writtenHangul}
                onSelect={setSelected}
                onWrite={() => onWrite(selected)}
                onChange={onChange}
              />
            ) : (
              <div className="font-empty">
                아직 쓴 한글이 없습니다.
                <button onClick={() => onWrite(HANGUL[0])}>
                  한글 쓰러 가기 →
                </button>
              </div>
            )}
            {report.missingSlots.length > 0 && (
              <details className="missing-details">
                <summary>
                  비어 있는 자모 자리 {report.missingSlots.length}개 · 추가
                  확인할 글자
                </summary>
                <div className="missing-chars">
                  {report.missingSamples.map((char) => (
                    <button
                      key={char}
                      onClick={() => {
                        if (project.samples[char]?.strokes.length)
                          setSelected(char);
                        else onWrite(char);
                      }}
                    >
                      {char}
                      {project.samples[char]?.strokes.length ? " · 확인" : ""}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <button
              className="font-primary"
              disabled={!report.direct}
              onClick={() => {
                setStage("build");
                build();
              }}
            >
              손글씨를 이용해 폰트 생성하기 →
            </button>
          </div>
        ) : (
          <div className="font-build-stage" data-font-current={isCurrent}>
            <nav className="finish-track" aria-label="폰트 완성 순서">
              <button
                aria-current={finishStep === "refine" ? "step" : undefined}
                onClick={() => setFinishStep("refine")}
              >
                다듬기
              </button>
              <button
                aria-current={finishStep === "export" ? "step" : undefined}
                onClick={() => setFinishStep("export")}
              >
                내보내기
              </button>
            </nav>
            {finishStep === "refine" ? (
              <>
                <div className="font-specimen-layout" data-step="refine">
                  <div className="font-settings">
                    <label className="font-field">
                      출력 글자 크기 <b>{bodySize(prep.settings) / 10}%</b>
                      <input
                        aria-describedby={`${controlId}-font-range-note-0`}
                        aria-label="출력 글자 크기"
                        type="range"
                        min={LIMITS.bodyMin}
                        max={LIMITS.bodyMax}
                        step="10"
                        value={bodySize(prep.settings)}
                        disabled={building}
                        onChange={(e) =>
                          settings({ bodySize: +e.target.value })
                        }
                      />
                      <small
                        className="font-field-note"
                        id={`${controlId}-font-range-note-0`}
                      >
                        직접 쓴 글자의 출력 크기를 바꿉니다. 조합 글자는 원본
                        크기를 사용합니다.
                      </small>
                    </label>
                    <label className="font-field">
                      글자 사이 간격 <b>{prep.settings.letterSpacing}</b>
                      <input
                        aria-describedby={`${controlId}-font-range-note-1`}
                        aria-label="글자 사이 간격"
                        type="range"
                        min={LIMITS.spacingMin}
                        max={LIMITS.spacingMax}
                        value={prep.settings.letterSpacing}
                        disabled={building}
                        onChange={(e) =>
                          settings({ letterSpacing: +e.target.value })
                        }
                      />
                      <small
                        className="font-field-note"
                        id={`${controlId}-font-range-note-1`}
                      >
                        이웃 글자의 획 가장자리 사이를 좁히거나 넓힙니다.
                      </small>
                    </label>
                    <label className="font-field">
                      전체 획 굵기 <b>{prep.settings.strokeWeight ?? 100}%</b>
                      <input
                        aria-describedby={`${controlId}-font-range-note-5`}
                        aria-label="전체 획 굵기"
                        type="range"
                        min={LIMITS.weightMin}
                        max={LIMITS.weightMax}
                        value={prep.settings.strokeWeight ?? 100}
                        onChange={(e) =>
                          settings({ strokeWeight: +e.target.value })
                        }
                      />
                      <small
                        className="font-field-note"
                        id={`${controlId}-font-range-note-5`}
                      >
                        직접 쓴 글자의 획 굵기를 바꿉니다. 조합 글자는 원본
                        굵기를 사용합니다.
                      </small>
                    </label>
                    <label className="font-field">
                      획 끝 모양
                      <select
                        aria-label="획 끝 모양"
                        value={prep.settings.strokeFinish ?? "original"}
                        onChange={(e) =>
                          settings({
                            strokeFinish: e.target
                              .value as FontPreparation["settings"]["strokeFinish"],
                          })
                        }
                      >
                        <option value="original">원본</option>
                        <option value="round">둥글게</option>
                        <option value="pointed">뾰족하게</option>
                      </select>
                      <small className="font-field-note">
                        직접 쓴 글자의 획 끝을 둥글거나 뾰족하게 다듬습니다.
                      </small>
                    </label>
                    <label className="font-field">
                      기준선 <b>{prep.settings.baseline}</b>
                      <input
                        aria-describedby={`${controlId}-font-range-note-6`}
                        aria-label="기준선"
                        type="range"
                        min="650"
                        max="900"
                        value={prep.settings.baseline}
                        disabled={building}
                        onChange={(e) =>
                          settings({ baseline: +e.target.value })
                        }
                      />
                      <small
                        className="font-field-note"
                        id={`${controlId}-font-range-note-6`}
                      >
                        글자가 줄 위에 놓이는 세로 위치를 바꿉니다.
                      </small>
                    </label>
                    <fieldset className="font-correction-controls">
                      <legend>자동 보정</legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!prep.settings.alignToReference}
                          onChange={(event) =>
                            settings({ alignToReference: event.target.checked })
                          }
                        />
                        견본에 맞춰 자모 위치 다듬기
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!prep.settings.averageStrokes}
                          onChange={(event) =>
                            settings({ averageStrokes: event.target.checked })
                          }
                        />
                        비슷한 손글씨 획 평균으로 다듬기
                      </label>
                      <button
                        type="button"
                        className="font-secondary"
                        onClick={() =>
                          settings({
                            alignToReference: !bothCorrections,
                            averageStrokes: !bothCorrections,
                          })
                        }
                      >
                        {bothCorrections
                          ? "자동 보정 끄기"
                          : "한 번에 보정하기"}
                      </button>
                    </fieldset>
                  </div>
                  <MetricPreview project={project} preparation={prep} />
                </div>
                <HandwritingSearch
                  project={project}
                  preparation={prep}
                  onSeparate={(char) => {
                    setSelected(char);
                    setStage("separation");
                  }}
                  onWrite={onWrite}
                />
                {report.missingSlots.length > 0 && (
                  <div className="font-notice">
                    자모 자리 {report.missingSlots.length}개가 비어 있어 한글{" "}
                    {11172 - syllables}자는 아직 만들 수 없어요.{" "}
                    <button onClick={() => setStage("separation")}>
                      비어 있는 자모 확인 →
                    </button>
                  </div>
                )}
                {error && (
                  <p className="font-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="finish-navigation">
                  {isCurrent ? (
                    <button
                      className="font-primary"
                      onClick={() => setFinishStep("export")}
                    >
                      내보내기 →
                    </button>
                  ) : (
                    <button
                      className="font-primary"
                      disabled={building || !report.direct}
                      onClick={build}
                    >
                      폰트 생성하기
                    </button>
                  )}
                </div>
              </>
            ) : null}
            <div hidden={finishStep !== "export"}>
              {finishStep === "export" && !isCurrent && (
                <div className="font-notice">
                  {result
                    ? "마지막으로 생성한 폰트를 표시합니다."
                    : "아직 생성된 폰트가 없습니다. 내보내기 설정을 먼저 확인할 수 있어요."}
                  {building ? (
                    <p role="status">폰트 만드는 중 · {progress}%</p>
                  ) : (
                    report.direct > 0 && (
                      <button type="button" onClick={build}>
                        현재 설정으로 폰트 생성하기 →
                      </button>
                    )
                  )}
                  {error && <p role="alert">{error}</p>}
                </div>
              )}
              <FontOutput
                family={result?.face.family}
                characters={result?.stats.characters ?? []}
                exporting={exporting}
                exportError={exportError}
                onDownload={download}
                onWriteSpecial={onWriteSpecial}
                specialWritten={specialWritten}
                specialTotal={SPECIAL_SYMBOLS.length}
                premiumReady={premiumReady}
              />
            </div>
            {building && finishStep === "refine" && (
              <FontDialog title="손글씨로 폰트를 만들고 있어요">
                <div className="font-progress-number" aria-hidden="true">
                  {progress}%
                </div>
                <progress
                  className="font-progress-bar"
                  aria-label="폰트 생성 진행률"
                  max={100}
                  value={progress}
                />
                <p role="status">{message}</p>
                <div className="font-dialog-actions">
                  <button
                    className="font-secondary"
                    onClick={() => setFinishStep("export")}
                  >
                    내보내기 화면 열기
                  </button>
                  <button className="font-secondary" onClick={resetResult}>
                    생성 취소
                  </button>
                </div>
              </FontDialog>
            )}
            {!report.direct && (
              <p className="font-empty">
                한 글자 이상 쓰면 폰트를 만들 수 있어요.
                <button
                  className="font-primary"
                  onClick={() => onWrite(HANGUL[0])}
                >
                  첫 글자 쓰러 가기 →
                </button>
              </p>
            )}
          </div>
        )}
        <footer className="font-footer">
          손글씨와 폰트 생성은 이 기기 안에서만 처리됩니다.
          <button onClick={onClose}>쓰기 화면으로 돌아가기</button>
        </footer>
      </section>
    </div>
  );
}
