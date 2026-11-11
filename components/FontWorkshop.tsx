"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HANGUL } from "../data/charset";
import SeparationEditor from "./SeparationEditor";
import MetricPreview from "./MetricPreview";
import { FONT_WORKER_URL } from "../lib/font/worker-url";
import { decompose } from "../lib/hangul";
import { coverage } from "../lib/font/composition";
import {
  defaultPreparation,
  FONT_SETTING_LIMITS as LIMITS,
} from "../lib/font/types";
import { bodySize } from "../lib/font/layout";
import { correction, interpolation } from "../lib/font/interpolation";
import type { FontProject } from "../lib/types";
import type {
  FontPreparation,
  FontStats,
  Part,
  WorkerReply,
} from "../lib/font/types";

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
  saveStatus: string;
  onSave: () => void;
}

export default function FontWorkshop({
  project,
  onChange,
  onClose,
  onWrite,
  saveStatus,
  onSave,
  initialChar,
  initialStage = "build",
  guided = false,
  journeyStage,
  onStageChange,
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
  const [localStage, setLocalStage] = useState<"separation" | "build">(
    initialStage,
  );
  const stage = journeyStage ?? localStage;
  const setStage = (next: "separation" | "build") => {
    setLocalStage(next);
    onStageChange?.(next);
  };
  const [finishStep, setFinishStep] = useState(0);
  const [selected, setSelected] = useState(
    initialChar && writtenHangul.includes(initialChar)
      ? initialChar
      : (writtenHangul[0] ?? ""),
  );
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    buffer: ArrayBuffer;
    stats: FontStats;
    family: string;
  } | null>(null);
  const [text, setText] = useState(
    "나의 글씨로 쓰는 새로운 이야기\n안녕하세요. 한 획씩 나답게! 0123456789",
  );
  const [previewSize, setPreviewSize] = useState(42);
  const worker = useRef<Worker | null>(null),
    face = useRef<FontFace | null>(null),
    dialog = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const resetResult = () => {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    setBuilding(false);
    setResult(null);
    setError("");
    if (face.current) {
      document.fonts.delete(face.current);
      face.current = null;
    }
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
      if (face.current) document.fonts.delete(face.current);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [guided]);
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
      if (face.current) document.fonts.delete(face.current);
    },
    [],
  );

  const settings = (changes: Partial<FontPreparation["settings"]>) =>
    onChange({ ...prep, settings: { ...prep.settings, ...changes } });
  const build = () => {
    resetResult();
    setBuilding(true);
    setProgress(0);
    setMessage("폰트 생성을 시작합니다");
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
            const family = "HanhoekPreview" + Date.now();
            const loaded = await new FontFace(family, reply.buffer).load();
            if (token !== generation.current) return;
            document.fonts.add(loaded);
            face.current = loaded;
            setResult({ buffer: reply.buffer, stats: reply.stats, family });
            setProgress(100);
            setMessage("폰트가 완성됐어요. 내 글씨로 문장을 써보세요.");
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
      nextWorker.postMessage({ project, preparation: prep });
    } catch (error) {
      setBuilding(false);
      setError(
        error instanceof Error
          ? error.message
          : "폰트 생성기를 시작하지 못했습니다.",
      );
    }
  };
  const latestBuild = useRef(build);
  latestBuild.current = build;
  useEffect(() => {
    if (
      !guided ||
      stage !== "build" ||
      !report.direct ||
      !prep.settings.familyName.trim()
    )
      return;
    const timer = setTimeout(() => latestBuild.current(), 650);
    return () => clearTimeout(timer);
  }, [
    guided,
    stage,
    project.samples,
    prep,
    project.settings.referenceFont,
    project.settings.grid.diamond,
  ]);
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([result.buffer], { type: "font/otf" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (prep.settings.familyName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") ||
        "손글씨") + ".otf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const available = new Set(result?.stats.characters ?? report.available);
  const unsupported = [
    ...new Set(
      [...text.normalize("NFC")].filter(
        (ch) => !/\s/.test(ch) && !available.has(ch),
      ),
    ),
  ];
  const syllables = report.available.filter((ch) => decompose(ch)).length;

  return (
    <div
      className={guided ? "guided-workshop journey-panel" : "font-backdrop"}
      data-finish-step={finishStep}
    >
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
                : [
                    "내 글씨로 먼저 써보세요.",
                    "글씨체의 이름을 정해요!",
                    "글자 사이 간격을 정해요.",
                    "이제 어디서든 써보세요.",
                  ][finishStep]}
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
                  <b>한 번에 배정</b> 선택한 획 목록에서 초성·중성·종성 버튼을
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
          <button onClick={onClose} aria-label="폰트 만들기 닫기">
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
            <button className="font-primary" onClick={() => setStage("build")}>
              내 폰트로 써보기 →
            </button>
          </div>
        ) : (
          <div className="font-build-stage">
            {guided && (
              <>
                <nav className="finish-track" aria-label="폰트 완성 순서">
                  {["써보기", "이름", "간격", "내보내기"].map((label, i) => (
                    <button
                      key={label}
                      aria-current={i === finishStep ? "step" : undefined}
                      onClick={() => setFinishStep(i)}
                    >
                      {i + 1}. {label}
                    </button>
                  ))}
                </nav>
                <p className="finish-description">
                  {
                    [
                      "쓴 글자로 폰트를 자동으로 만들어요. 아래에 원하는 문장을 입력해 확인해보세요.",
                      "문서의 글꼴 목록에 표시될 이름이에요. 마음에 드는 이름을 붙여주세요.",
                      "견본을 보며 편안하게 읽히는 간격을 찾아보세요. 크기와 기준선도 함께 조절할 수 있어요.",
                      "OTF 파일을 내려받아 설치하면 문서와 디자인 작업에 사용할 수 있어요.",
                    ][finishStep]
                  }
                </p>
              </>
            )}
            <div
              className="font-settings"
              data-setting-step={guided ? finishStep : "all"}
            >
              <label className="font-field">
                폰트 이름
                <input
                  aria-label="폰트 이름"
                  maxLength={60}
                  value={prep.settings.familyName}
                  disabled={building && !guided}
                  onChange={(e) => settings({ familyName: e.target.value })}
                />
              </label>
              <label className="font-field">
                출력 글자 크기 <b>{bodySize(prep.settings) / 10}%</b>
                <input
                  aria-label="출력 글자 크기"
                  type="range"
                  min={LIMITS.bodyMin}
                  max={LIMITS.bodyMax}
                  step="10"
                  value={bodySize(prep.settings)}
                  disabled={building && !guided}
                  onChange={(e) => settings({ bodySize: +e.target.value })}
                />
              </label>
              <label className="font-field">
                글자 사이 간격 <b>{prep.settings.letterSpacing}</b>
                <input
                  aria-label="글자 사이 간격"
                  type="range"
                  min={LIMITS.spacingMin}
                  max={LIMITS.spacingMax}
                  value={prep.settings.letterSpacing}
                  disabled={building && !guided}
                  onChange={(e) => settings({ letterSpacing: +e.target.value })}
                />
              </label>
              <label className="font-field">
                자모 위치 정돈 <b>{correction(prep.settings)}%</b>
                <input
                  aria-label="자모 위치 정돈"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={correction(prep.settings)}
                  disabled={building && !guided}
                  onChange={(e) =>
                    settings({ positionCorrection: +e.target.value })
                  }
                />
              </label>
              <label className="font-field">
                획 모양 보간 <b>{interpolation(prep.settings)}%</b>
                <input
                  aria-label="획 모양 보간"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={interpolation(prep.settings)}
                  disabled={building && !guided}
                  onChange={(e) =>
                    settings({ shapeInterpolation: +e.target.value })
                  }
                />
              </label>
              <label className="font-field">
                기준선 <b>{prep.settings.baseline}</b>
                <input
                  aria-label="기준선"
                  type="range"
                  min="650"
                  max="900"
                  value={prep.settings.baseline}
                  disabled={building && !guided}
                  onChange={(e) => settings({ baseline: +e.target.value })}
                />
              </label>
            </div>
            {guided && finishStep === 3 && (
              <p className="font-help">
                크기와 간격을 바꾸면 미리보기와 내보낼 폰트가 자동으로 다시
                만들어져요. 간격을 아주 좁히면 획이 겹칠 수도 있어요.
              </p>
            )}
            {(!guided || finishStep === 2) && (
              <MetricPreview project={project} preparation={prep} />
            )}
            {(!guided || finishStep === 2) && (
              <p className="font-help">
                같은 자모를 반복해 쓴 표본으로 위치와 크기를 정돈하고, 획 구조가
                비슷한 표본끼리 모양을 보간합니다. 두 강도를 모두 0으로 낮추면
                기존 방식과 비교할 수 있어요. 원본 글씨와 직접 보정한 모양은
                보존됩니다. 자간은 획 가장자리 사이의 간격입니다.
              </p>
            )}
            {report.missingSlots.length > 0 && (
              <div className="font-notice">
                자모 자리 {report.missingSlots.length}개가 비어 있어 한글{" "}
                {11172 - syllables}자는 아직 만들 수 없어요. 현재 가능한
                글자만으로도 다운로드할 수 있습니다.{" "}
                <button onClick={() => setStage("separation")}>
                  비어 있는 자모 확인 →
                </button>
              </div>
            )}
            <div className="font-build-actions">
              {(!guided || !!error) && (
                <button
                  className="font-primary"
                  disabled={
                    building ||
                    !report.direct ||
                    !prep.settings.familyName.trim()
                  }
                  onClick={build}
                >
                  {building
                    ? "폰트 만드는 중…"
                    : result
                      ? "다시 생성하기"
                      : "폰트 생성하기"}
                </button>
              )}
              {building && (
                <button className="font-secondary" onClick={resetResult}>
                  생성 취소
                </button>
              )}
              {result && (!guided || finishStep === 3) && (
                <button className="font-download" onClick={download}>
                  OTF 폰트 다운로드 ↓
                </button>
              )}
            </div>
            {(building || result) && (
              <div className="build-progress" role="status">
                <progress max="100" value={progress} />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <p className="font-error" role="alert">
                {error}
              </p>
            )}
            {result && (!guided || finishStep === 0 || finishStep === 3) && (
              <section className="font-preview">
                <div className="preview-heading">
                  <h3>내 폰트로 써보기</h3>
                  <span>
                    {result.stats.direct}자 원본 +{" "}
                    {result.stats.composed.toLocaleString()}자 조합 ·{" "}
                    {(result.buffer.byteLength / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <label className="font-field">
                  미리 볼 문장
                  <textarea
                    aria-label="미리 볼 문장"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                  />
                </label>
                <label className="font-field preview-size">
                  미리보기 크기 {previewSize}px
                  <input
                    aria-label="미리보기 크기"
                    type="range"
                    min="20"
                    max="96"
                    value={previewSize}
                    onChange={(e) => setPreviewSize(+e.target.value)}
                  />
                </label>
                <div
                  className="generated-preview"
                  aria-label="생성된 폰트 미리보기"
                  style={{ fontSize: previewSize }}
                >
                  {[...text.normalize("NFC")].map((ch, i) =>
                    /\s/.test(ch) || available.has(ch) ? (
                      <span key={i} style={{ fontFamily: result.family }}>
                        {ch}
                      </span>
                    ) : (
                      <span
                        key={i}
                        className="missing-glyph"
                        title={ch + " · 아직 없는 글자"}
                      >
                        □
                      </span>
                    ),
                  )}
                </div>
                {unsupported.length > 0 && (
                  <p className="font-help">
                    아직 없는 글자: {unsupported.join(" ")} · 미리보기에서 □로
                    표시됩니다.
                  </p>
                )}
                <p className="font-install-help">
                  다운로드한 .otf 파일을 열어 설치하면 문서·디자인 프로그램의
                  글꼴 목록에서 사용할 수 있어요. 기존 프로그램은 다시
                  열어주세요.
                </p>
              </section>
            )}
            {guided && finishStep === 0 && result && (
              <button
                className="font-secondary"
                onClick={() => setStage("separation")}
              >
                글자 모양 수정하기 ←
              </button>
            )}
            {guided && (
              <div className="finish-navigation">
                {finishStep > 0 && (
                  <button onClick={() => setFinishStep((v) => v - 1)}>
                    ← 이전
                  </button>
                )}
                {finishStep < 3 && (
                  <button
                    className="font-primary"
                    disabled={finishStep === 0 && !result}
                    onClick={() => setFinishStep((v) => v + 1)}
                  >
                    {["이름 정하기", "간격 맞추기", "내보내기로"][finishStep]} →
                  </button>
                )}
              </div>
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
