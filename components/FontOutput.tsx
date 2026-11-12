"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ExportFormat } from "../lib/font/export-formats";
import {
  isKoreanOutputName,
  isEnglishOutputName,
  OUTPUT_PREFIX,
  type OutputNames,
} from "../lib/font/output-names";

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
  { id: "zip", label: "전체 묶음 ZIP", note: "모든 형식" },
  { id: "ttf", label: "TTF", note: "설치용 · 문서" },
  { id: "otf", label: "OTF", note: "설치용 · 디자인" },
  { id: "woff2", label: "WOFF2", note: "웹사이트용" },
  { id: "woff", label: "WOFF", note: "웹 · 예전 브라우저" },
];

/** 이 기기 브라우저가 해당 형식의 파일을 공유 창으로 보낼 수 있는지 */
function canShareFormat(format: ExportFormat) {
  try {
    const type = format === "zip" ? "application/zip" : "font/" + format;
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [new File([new Uint8Array(4)], "font." + format, { type })],
      })
    );
  } catch {
    return false;
  }
}

/** 내려받을 수 없는 이유를 사람이 바로 고칠 수 있는 말로 */
function blockers(
  status: string,
  korean: string,
  english: string,
  exporting: boolean,
) {
  const list: { text: string; field?: "korean" | "english" }[] = [];
  if (status === "building")
    list.push({ text: "폰트를 만드는 중이에요. 잠시만 기다려 주세요!" });
  else if (status !== "ready")
    list.push({
      text: "설정이 바뀌었어요. 위의 ‘바뀐 설정으로 다시 만들기’를 먼저 눌러 주세요!",
    });
  if (!korean)
    list.push({ text: "한글 폰트 이름을 넣어주세요!", field: "korean" });
  else {
    if (/\s/.test(korean))
      list.push({
        text: "한글 폰트 이름에 띄어쓰기는 하지 마세요! (예: 나의손글씨)",
        field: "korean",
      });
    if (!/[가-힣]/.test(korean))
      list.push({
        text: "한글 폰트 이름에는 한글이 한 글자 이상 들어가야 해요!",
        field: "korean",
      });
    if (/[<>:"/\\|?*\x00-\x1f]/.test(korean) || korean.endsWith("."))
      list.push({
        text: '한글 폰트 이름에 < > : " / \\ | ? * 기호나 끝의 마침표는 쓸 수 없어요!',
        field: "korean",
      });
  }
  if (!english)
    list.push({ text: "영문 폰트 이름을 넣어주세요!", field: "english" });
  else {
    if (/\s/.test(english))
      list.push({
        text: "영문 폰트 이름에 띄어쓰기는 하지 마세요! (예: MyHand)",
        field: "english",
      });
    if (!/^[\x20-\x7e]+$/.test(english))
      list.push({
        text: "영문 폰트 이름은 영어·숫자로만 써 주세요! 한글은 넣을 수 없어요.",
        field: "english",
      });
    else if (!/[a-zA-Z0-9]/.test(english))
      list.push({
        text: "영문 폰트 이름에 영어나 숫자를 한 글자 이상 넣어 주세요!",
        field: "english",
      });
  }
  if (exporting) list.push({ text: "파일을 준비하고 있어요. 잠시만요!" });
  return list;
}

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
  shareFile,
  onShareDone,
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
  onDownload: (
    format: ExportFormat,
    names: OutputNames,
    mode?: "download" | "share",
  ) => void;
  /** 공유할 준비가 된 파일(변환 완료 후) */
  shareFile?: File | null;
  onShareDone?: () => void;
  /** 쓰지 않아서 견본 글꼴로 채울 글자 */
  fallback: { total: number; groups: string[]; fontName: string };
  onWriteMissing?: () => void;
}) {
  const [korean, setKorean] = useState("");
  const [english, setEnglish] = useState("");
  const [format, setFormat] = useState<ExportFormat>("ttf");
  const [specimen, setSpecimen] = useState(SPECIMEN);
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
  const reasons = blockers(status, korean.trim(), english.trim(), !!exporting);
  const [blocked, setBlocked] = useState(false);
  const [mode, setMode] = useState<"download" | "share">("download");
  const [shareUnsupported, setShareUnsupported] = useState(false);
  const [shareError, setShareError] = useState("");
  const start = (next: "download" | "share" = "download") => {
    if (!canDownload) {
      setBlocked(true);
      return;
    }
    // 안드로이드 크롬 등은 글꼴·압축 파일 공유를 막아 둡니다. 미리 확인하고 안내합니다.
    if (next === "share" && !canShareFormat(format)) {
      setShareUnsupported(true);
      return;
    }
    setMode(next);
    onDownload(format, names, next);
  };
  const share = async () => {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        title: shareFile.name,
        text: "내 손글씨로 만든 폰트예요.",
      });
      onShareDone?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError(
        "공유 창을 열지 못했어요. 다운로드한 뒤 메신저에서 파일을 첨부해 주세요.",
      );
    }
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
          start("download");
        }}
      >
        <div className="fw-names">
          <label className="fw-field">
            <span>한글 폰트 이름</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                aria-label="한글 폰트 이름"
                maxLength={60}
                value={korean}
                placeholder="여기에 이름을 넣어주세요!"
                aria-invalid={(!!korean && !koreanValid) || undefined}
                onChange={(event) => setKorean(event.target.value)}
              />
            </span>
            {!!korean && !koreanValid && (
              <small className="fw-error">
                띄어쓰기 없이, 한글을 한 글자 이상 넣어 주세요.
              </small>
            )}
          </label>
          <label className="fw-field">
            <span>영문 폰트 이름</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                aria-label="영문 폰트 이름"
                maxLength={60}
                value={english}
                placeholder="Type a name here!"
                aria-invalid={(!!english && !englishValid) || undefined}
                onChange={(event) => setEnglish(event.target.value)}
              />
            </span>
            {!!english && !englishValid && (
              <small className="fw-error">
                띄어쓰기 없이 영어·숫자로만 입력해 주세요.
              </small>
            )}
          </label>
        </div>

        <fieldset className="fw-formats">
          <legend>파일 형식</legend>
          <details className="fw-format-help">
            <summary>어떤 형식을 받아야 할까요?</summary>
            <ul>
              <li>
                <b>한글·워드·파워포인트 같은 문서에 쓸 때 → TTF</b> 컴퓨터에
                설치하는 글꼴 중 가장 널리 호환돼요.
              </li>
              <li>
                <b>포토샵·일러스트·인디자인 등 디자인에 쓸 때 → OTF</b> 이 앱이
                처음 만드는 원본 형식이에요. Mac·Windows 모두 설치돼요.
              </li>
              <li>
                <b>아이패드(굿노트·키노트 등)</b> 글꼴 설치 앱이나 설정
                프로파일로 TTF 또는 OTF를 설치해요.
              </li>
              <li>
                <b>웹사이트에 쓸 때 → WOFF2</b> 컴퓨터에 설치하는 파일이
                아니에요. 웹페이지에 연결해서 쓰는 가벼운 형식이에요.
              </li>
              <li>
                <b>안드로이드 휴대폰·태블릿</b> 폰트를 직접 설치할 수 없어요.
              </li>
            </ul>
            <p>
              TTF와 OTF는 글자 모양이 같고 곡선을 저장하는 방식만 달라요. 어느
              쪽이 더 무겁거나 고급인 것은 아니니, <b>둘 중 하나만</b>{" "}
              설치하세요. 둘 다 설치하면 같은 이름의 글꼴이 겹칠 수 있어요.
            </p>
          </details>
          <div className="fw-format-grid">
            {FORMATS.filter((item) => item.id !== "zip").map((item) => (
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
                {item.id === "ttf" && (
                  <em className="fw-recommend" aria-label="추천">
                    추천!
                  </em>
                )}
              </label>
            ))}
          </div>
          <div className="fw-format-all">
            <span>잘 모르겠다면 다 받기 →</span>
            <label className={format === "zip" ? "is-selected" : ""}>
              <input
                type="radio"
                name="format"
                checked={format === "zip"}
                onChange={() => setFormat("zip")}
              />
              <strong>전체 묶음 ZIP</strong>
              <small>TTF·OTF·WOFF2·WOFF 모두</small>
            </label>
          </div>
          <p className="fw-android">
            ※ 안드로이드 휴대폰·태블릿에서는 폰트를 직접 설치할 수 없어요.
          </p>
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
        <div className="fw-download-row">
          <button
            className="fw-primary fw-download"
            type="submit"
            data-blocked={!canDownload || undefined}
          >
            {exporting && mode === "download"
              ? "파일 준비 중…"
              : names.korean
                ? `${OUTPUT_PREFIX}${names.korean}.${format} 다운로드 ↓`
                : "다운로드 ↓"}
          </button>
          <button
            type="button"
            className="fw-secondary fw-share"
            data-blocked={!canDownload || undefined}
            onClick={() => start("share")}
          >
            {exporting && mode === "share" ? "준비 중…" : "공유하기 ↗"}
          </button>
        </div>
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

      {shareFile && (
        <FontDialog title="보낼 준비가 됐어요" onClose={onShareDone}>
          <p className="output-filename">{shareFile.name}</p>
          <p>
            아래 버튼을 누르면 카카오톡, 네이버 웍스, 메일 등 이 기기의 앱으로
            바로 보낼 수 있어요.
          </p>
          {shareError && (
            <p className="fw-error" role="alert">
              {shareError}
            </p>
          )}
          <div className="font-dialog-actions">
            <button
              type="button"
              className="fw-secondary"
              onClick={() => {
                setShareError("");
                onShareDone?.();
              }}
            >
              닫기
            </button>
            <button
              type="button"
              className="fw-primary"
              autoFocus
              onClick={share}
            >
              공유하기 ↗
            </button>
          </div>
        </FontDialog>
      )}
      {shareUnsupported && (
        <FontDialog
          title="이 기기에서는 폰트 파일을 바로 공유할 수 없어요"
          onClose={() => setShareUnsupported(false)}
        >
          <p>
            안드로이드의 크롬·삼성 인터넷 같은 브라우저는 보안을 위해
            사진·동영상·PDF 같은 파일만 공유 창으로 보낼 수 있게 막아 두었어요.
            폰트(
            {format.toUpperCase()}) 파일은 이렇게 보내 주세요.
          </p>
          <ol className="fw-steps">
            <li>‘다운로드’로 파일을 기기에 저장해요.</li>
            <li>카카오톡·네이버 웍스 채팅방에서 ＋(첨부) → 파일을 눌러요.</li>
            <li>
              ‘다운로드’ 폴더에서 {OUTPUT_PREFIX.trim()} 폰트 파일을 골라
              보내요.
            </li>
          </ol>
          <div className="font-dialog-actions">
            <button
              type="button"
              className="fw-secondary"
              onClick={() => setShareUnsupported(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="fw-primary"
              autoFocus
              onClick={() => {
                setShareUnsupported(false);
                start("download");
              }}
            >
              다운로드하기 ↓
            </button>
          </div>
        </FontDialog>
      )}
      {blocked && (
        <FontDialog
          title="⚠ 아직 내려받을 수 없어요"
          onClose={() => setBlocked(false)}
        >
          <ul className="fw-blockers">
            {(reasons.length
              ? reasons
              : [{ text: "잠시 후 다시 눌러 주세요." }]
            ).map((reason) => (
              <li key={reason.text}>{reason.text}</li>
            ))}
          </ul>
          <div className="font-dialog-actions">
            <button
              type="button"
              className="fw-primary"
              autoFocus
              onClick={() => {
                setBlocked(false);
                const field = reasons.find((reason) => reason.field)?.field;
                if (field)
                  setTimeout(
                    () =>
                      document
                        .querySelector<HTMLInputElement>(
                          `[aria-label="${field === "korean" ? "한글" : "영문"} 폰트 이름"]`,
                        )
                        ?.focus(),
                    50,
                  );
              }}
            >
              확인하고 고치기
            </button>
          </div>
        </FontDialog>
      )}
    </section>
  );
}
