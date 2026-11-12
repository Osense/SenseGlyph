"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ExportFormat } from "../lib/font/export-formats";
import {
  isKoreanOutputName,
  isEnglishOutputName,
  OUTPUT_PREFIX,
  type OutputNames,
} from "../lib/font/output-names";
import {
  isDownloadCode,
  rememberDownloadCode,
  rememberedDownloadCode,
} from "../lib/download-codes";

export function FontDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      className="font-flow-dialog"
      ref={dialog}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      <h3 id={heading}>{title}</h3>
      {children}
    </dialog>
  );
}

const SPECIMEN = `"세상에 당신만의 모양으로 이야기를 건넬 수 있게 되었어요!"
'Hello, world!' (2026) ~ #1 & 100%? @_@ [OK]
여기에 직접 써 보세요.`;
const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: "zip", label: "전체 묶음", note: "ZIP · 모든 형식" },
  { id: "otf", label: "OTF", note: "컴퓨터 설치용" },
  { id: "ttf", label: "TTF", note: "컴퓨터·태블릿" },
  { id: "woff2", label: "WOFF2", note: "웹사이트용" },
  { id: "woff", label: "WOFF", note: "웹(예전 형식)" },
];

export default function FontOutput({
  family,
  characters,
  status,
  progress,
  message,
  error,
  onBuild,
  exporting,
  exportError,
  onDownload,
  fallback,
  onWriteMissing,
}: {
  family?: string;
  characters: string[];
  status: "empty" | "building" | "stale" | "ready";
  progress: number;
  message: string;
  error: string;
  onBuild: () => void;
  exporting: ExportFormat | null;
  exportError: string;
  onDownload: (format: ExportFormat, names: OutputNames) => void;
  /** 쓰지 않아서 견본 글꼴로 채울 글자 */
  fallback: { total: number; groups: string[]; fontName: string };
  onWriteMissing?: () => void;
}) {
  const [korean, setKorean] = useState("");
  const [english, setEnglish] = useState("");
  const [format, setFormat] = useState<ExportFormat>("zip");
  const [specimen, setSpecimen] = useState(SPECIMEN);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const names = {
    korean: korean.trim().normalize("NFC"),
    english: english.trim(),
  };
  const koreanValid = isKoreanOutputName(names.korean);
  const englishValid = isEnglishOutputName(names.english);
  const available = new Set(characters);
  const canDownload =
    status === "ready" &&
    !!family &&
    koreanValid &&
    englishValid &&
    exporting === null;
  const start = () => {
    if (!canDownload) return;
    if (rememberedDownloadCode()) onDownload(format, names);
    else {
      setCode("");
      setCodeError("");
      setAsking(true);
    }
  };
  const submitCode = () => {
    if (!isDownloadCode(code)) {
      setCodeError("코드를 다시 확인해 주세요.");
      return;
    }
    rememberDownloadCode();
    setAsking(false);
    onDownload(format, names);
  };

  return (
    <section className="fw-export" aria-label="폰트 내보내기">
      <div className="fw-specimen-card">
        <div className="fw-card-head">
          <h3>내 손글씨 폰트로 써 보기</h3>
          {status === "ready" && (
            <span className="fw-badge is-ok">최신 설정으로 만든 폰트</span>
          )}
          {status === "stale" && (
            <span className="fw-badge is-warn">설정이 바뀌었어요</span>
          )}
        </div>
        {status === "building" ? (
          <div className="fw-building" role="status">
            <strong>{progress}%</strong>
            <progress
              max={100}
              value={progress}
              aria-label="폰트 생성 진행률"
            />
            <span>{message || "폰트를 만들고 있어요"}</span>
          </div>
        ) : family ? (
          <>
            <textarea
              className={
                "fw-specimen" + (status === "stale" ? " is-stale" : "")
              }
              aria-label="완성된 폰트 시험 문장"
              style={{ fontFamily: `"${family}"` }}
              value={specimen}
              rows={4}
              placeholder="여기에 직접 써 보세요."
              onChange={(event) => setSpecimen(event.target.value)}
            />
            <p className="fw-specimen-hint">
              위 문장을 지우고 하고 싶은 말을 직접 써 보세요.
            </p>
            {(() => {
              const missing = [...new Set(specimen)].filter(
                (char) => !/\s/.test(char) && !available.has(char),
              );
              return missing.length ? (
                <p className="fw-note">
                  폰트에 없는 글자: {missing.slice(0, 24).join(" ")}
                </p>
              ) : null;
            })()}
          </>
        ) : (
          <p className="fw-note">아직 만든 폰트가 없어요.</p>
        )}
        {status !== "building" && status !== "ready" && (
          <button type="button" className="fw-primary" onClick={onBuild}>
            {status === "stale" ? "바뀐 설정으로 다시 만들기" : "폰트 만들기"}
          </button>
        )}
        {error && (
          <p className="fw-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <form
        className="fw-export-form"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <div className="fw-names">
          <label className="fw-field">
            <span>한글 폰트 이름</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                required
                aria-label="한글 폰트 이름"
                maxLength={60}
                value={korean}
                placeholder="여기에 이름을 넣어주세요!"
                aria-invalid={(!!korean && !koreanValid) || undefined}
                onChange={(event) =>
                  setKorean(event.target.value.replace(/\s/g, ""))
                }
              />
            </span>
            {!!korean && !koreanValid && (
              <small className="fw-error">
                공백 없이, 한글을 한 글자 이상 넣어 주세요.
              </small>
            )}
          </label>
          <label className="fw-field">
            <span>영문 폰트 이름</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                required
                aria-label="영문 폰트 이름"
                maxLength={60}
                value={english}
                placeholder="Type a name here!"
                aria-invalid={(!!english && !englishValid) || undefined}
                onChange={(event) =>
                  setEnglish(event.target.value.replace(/\s/g, ""))
                }
              />
            </span>
            {!!english && !englishValid && (
              <small className="fw-error">
                공백 없이 영문자·숫자로 입력해 주세요.
              </small>
            )}
          </label>
        </div>

        <fieldset className="fw-formats">
          <legend>파일 형식</legend>
          {FORMATS.map((item) => (
            <label
              key={item.id}
              className={format === item.id ? "is-selected" : ""}
            >
              <input
                type="radio"
                name="format"
                checked={format === item.id}
                onChange={() => setFormat(item.id)}
              />
              <strong>{item.label}</strong>
              <small>{item.note}</small>
            </label>
          ))}
        </fieldset>

        {fallback.total > 0 && (
          <div className="fw-fallback" role="note">
            <strong>⚠ 쓰지 않은 글자는 견본 글꼴로 대체됩니다</strong>
            <p>
              손글씨로 쓰지 않은 {fallback.total.toLocaleString()}자(
              {fallback.groups.join(" · ")})는 ‘{fallback.fontName}’ 모양으로
              들어가요. 쓴 글자는 모두 내 손글씨로 나와요.
            </p>
            {onWriteMissing && (
              <button
                type="button"
                className="fw-link"
                onClick={onWriteMissing}
              >
                쓰지 않은 글자 쓰러 가기 →
              </button>
            )}
          </div>
        )}
        <button
          className="fw-primary fw-download"
          type="submit"
          disabled={!canDownload}
        >
          {exporting
            ? "파일 준비 중…"
            : names.korean
              ? `${OUTPUT_PREFIX}${names.korean}.${format} 다운로드 ↓`
              : "다운로드 ↓"}
        </button>
        {status !== "ready" ? (
          <p className="fw-note">폰트를 만든 뒤에 내려받을 수 있어요.</p>
        ) : (
          (!names.korean || !names.english) && (
            <p className="fw-note">
              한글·영문 폰트 이름을 넣으면 내려받을 수 있어요.
            </p>
          )
        )}
        {exportError && (
          <p className="fw-error" role="alert">
            {exportError}
          </p>
        )}
      </form>

      {asking && (
        <FontDialog title="다운로드 코드" onClose={() => setAsking(false)}>
          <form
            className="fw-code"
            onSubmit={(event) => {
              event.preventDefault();
              submitCode();
            }}
          >
            <p>받은 다운로드 코드를 입력하면 바로 내려받아요.</p>
            {fallback.total > 0 && (
              <p className="fw-fallback-inline">
                ⚠ 쓰지 않은 {fallback.total.toLocaleString()}자는 견본 글꼴(‘
                {fallback.fontName}’)로 대체됩니다.
              </p>
            )}
            <input
              autoFocus
              autoComplete="off"
              aria-label="다운로드 코드"
              value={code}
              aria-invalid={!!codeError || undefined}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError("");
              }}
            />
            {codeError && (
              <p className="fw-error" role="alert">
                {codeError}
              </p>
            )}
            <div className="font-dialog-actions">
              <button
                type="button"
                className="fw-secondary"
                onClick={() => setAsking(false)}
              >
                취소
              </button>
              <button
                type="submit"
                className="fw-primary"
                disabled={!code.trim()}
              >
                확인하고 내려받기
              </button>
            </div>
          </form>
        </FontDialog>
      )}
    </section>
  );
}
