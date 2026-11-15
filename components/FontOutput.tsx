"use client";

import { isNativeApp } from "../lib/native";
import { romanizeName } from "../lib/font/romanize";
import type { Purchase } from "../lib/types";
import PaymentDialog from "./PaymentDialog";
import {
  checkFontName,
  cleanEnglishName,
  cleanLocalName,
  type NameCheck,
} from "../lib/font-name-registry";
import { useT } from "../lib/i18n";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ExportFormat } from "../lib/font/export-formats";
import type { InferredStyle } from "../lib/font/style-transfer";
import {
  isLocalOutputName,
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
const SPECIMEN_JA = `「あなただけの形で、物語を届けられるようになりました。」
'Hello, world!' (2026) ~ #1 & 100%? @_@ [OK]
ここに書いてみてください。`;
const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: "zip", label: "전체 묶음 ZIP", note: "모든 형식" },
  { id: "ttf", label: "TTF", note: "설치용 · 문서" },
  { id: "otf", label: "OTF", note: "설치용 · 디자인" },
  { id: "woff2", label: "WOFF2", note: "웹사이트용" },
  { id: "woff", label: "WOFF", note: "웹 · 예전 브라우저" },
];

/** 이 기기 브라우저가 해당 형식의 파일을 공유 창으로 보낼 수 있는지 */
function canShareFormat(format: ExportFormat) {
  // 안드로이드 앱은 안드로이드 공유 창을 직접 쓰므로 모든 형식을 보낼 수 있다.
  if (isNativeApp()) return true;
  try {
    const zipped = format === "zip" || format === "weights";
    const type = zipped ? "application/zip" : "font/" + format;
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [
          new File([new Uint8Array(4)], "font." + (zipped ? "zip" : format), {
            type,
          }),
        ],
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
  script: "ko" | "ja" = "ko",
) {
  const local = script === "ja" ? "일본어" : "한글";
  const list: { text: string; field?: "korean" | "english" }[] = [];
  if (status === "building")
    list.push({ text: "폰트를 만드는 중이에요. 잠시만 기다려 주세요!" });
  else if (status !== "ready")
    list.push({
      text: "설정이 바뀌었어요. 위의 ‘바뀐 설정으로 다시 만들기’를 먼저 눌러 주세요!",
    });
  if (!korean)
    list.push({ text: `${local} 폰트 이름을 넣어주세요!`, field: "korean" });
  else {
    if (/\s/.test(korean))
      list.push({
        text:
          script === "ja"
            ? "일본어 폰트 이름에 띄어쓰기는 하지 마세요! (예: わたしの字)"
            : "한글 폰트 이름에 띄어쓰기는 하지 마세요! (예: 나의손글씨)",
        field: "korean",
      });
    if (
      script === "ja"
        ? !/[\u3040-\u30ff\u4e00-\u9fff]/.test(korean)
        : !/[가-힣]/.test(korean)
    )
      list.push({
        text:
          script === "ja"
            ? "일본어 폰트 이름에는 가나나 한자가 한 글자 이상 들어가야 해요!"
            : "한글 폰트 이름에는 한글이 한 글자 이상 들어가야 해요!",
        field: "korean",
      });
    if (/[<>:"/\\|?*\x00-\x1f]/.test(korean) || korean.endsWith("."))
      list.push({
        text: `${local} 폰트 이름에 < > : " / \\ | ? * 기호나 끝의 마침표는 쓸 수 없어요!`,
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
  exportNotice,
  onDownload,
  shareFile,
  onShareDone,
  fallback,
  onWriteMissing,
  script = "ko",
  style,
  purchase,
  onPurchased,
}: {
  /** 결제한 프로젝트: 이름은 결제할 때 그대로, 결제창 없이 다시 받기 */
  purchase?: Purchase;
  onPurchased?: (purchase: Purchase) => void;
  script?: "ko" | "ja";
  /** 쓴 글자에서 찾은 필체 규칙(일본어) */
  style?: InferredStyle;
  family?: string;
  characters: string[];
  status: "empty" | "building" | "stale" | "ready";
  progress: number;
  message: string;
  error: string;
  onBuild: () => void;
  exporting: ExportFormat | null;
  exportError: string;
  /** 앱에서 기기에 저장한 뒤 알려 줄 말 */
  exportNotice?: string;
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
  const t = useT();
  const [korean, setKorean] = useState(purchase?.local ?? "");
  const [english, setEnglish] = useState(purchase?.english ?? "");
  const [format, setFormat] = useState<ExportFormat>("ttf");
  const [specimen, setSpecimen] = useState(
    script === "ja" ? SPECIMEN_JA : SPECIMEN,
  );
  // 영문 이름은 비워 두면 현지 이름을 로마자로 바꿔 자동으로 채운다(PostScript 이름은 영문이어야 함).
  const autoEnglish = romanizeName(
    korean.trim().normalize("NFC"),
    script,
  ).toLowerCase();
  const names = {
    korean: korean.trim().normalize("NFC"),
    english: cleanEnglishName(english) || autoEnglish,
    script,
  };
  const localName = script === "ja" ? "일본어" : "한글";
  const koreanValid = isLocalOutputName(names.korean, script);
  const englishValid = isEnglishOutputName(names.english);
  const available = new Set(characters);
  const canDownload =
    status === "ready" &&
    !!family &&
    koreanValid &&
    englishValid &&
    exporting === null;
  const reasons = blockers(
    status,
    korean.trim(),
    names.english,
    !!exporting,
    script,
  );
  const [blocked, setBlocked] = useState(false);
  const [mode, setMode] = useState<"download" | "share">("download");
  const [shareUnsupported, setShareUnsupported] = useState(false);
  const [shareError, setShareError] = useState("");
  // 이름 중복 확인: 이미 있는 폰트 이름(그리고 나중에는 다른 사용자가 쓰는 이름)은 쓸 수 없다.
  const nameKey = names.korean + "|" + names.english;
  const [nameCheck, setNameCheck] = useState<{
    key: string;
    result: NameCheck;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const checkedNow = nameCheck?.key === nameKey ? nameCheck.result : null;
  const runCheck = async () => {
    if (!names.korean) return null;
    setChecking(true);
    try {
      const result = await checkFontName(names.korean, names.english);
      setNameCheck({ key: nameKey, result });
      return result;
    } finally {
      setChecking(false);
    }
  };
  const start = async (next: "download" | "share" = "download") => {
    if (!canDownload) {
      setBlocked(true);
      return;
    }
    // 결제한 폰트는 이미 확인한 이름 그대로 다시 받는다.
    if (!purchase) {
      const result = checkedNow ?? (await runCheck());
      if (!result?.available) return;
    }
    // 안드로이드 크롬 등은 글꼴·압축 파일 공유를 막아 둡니다. 미리 확인하고 안내합니다.
    if (next === "share" && !canShareFormat(format)) {
      setShareUnsupported(true);
      return;
    }
    // 결제(목업): 이 창에서 결제나 코드 확인을 한 번 통과하면 다시 묻지 않는다.
    if (!purchase) {
      setPayFor(next);
      return;
    }
    setMode(next);
    onDownload(format, names, next);
  };
  const [payFor, setPayFor] = useState<"download" | "share" | null>(null);
  const share = async () => {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        title: shareFile.name,
        text: t("내 손글씨로 만든 폰트예요."),
      });
      onShareDone?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError(
        t(
          "공유 창을 열지 못했어요. 다운로드한 뒤 메신저에서 파일을 첨부해 주세요.",
        ),
      );
    }
  };

  return (
    <section className="fw-export" aria-label={t("폰트 내보내기")}>
      <div className="fw-specimen-card">
        <div className="fw-card-head">
          <h3>{t("내 손글씨 폰트로 써 보기")}</h3>
          {status === "ready" && (
            <span className="fw-badge is-ok">
              {t("최신 설정으로 만든 폰트")}
            </span>
          )}
          {status === "stale" && (
            <span className="fw-badge is-warn">{t("설정이 바뀌었어요")}</span>
          )}
        </div>
        {status === "building" ? (
          <div className="fw-building" role="status">
            <strong>{progress}%</strong>
            <progress
              max={100}
              value={progress}
              aria-label={t("폰트 생성 진행률")}
            />
            <span>{t(message || "폰트를 만들고 있어요")}</span>
          </div>
        ) : family ? (
          <>
            <textarea
              className={
                "fw-specimen" + (status === "stale" ? " is-stale" : "")
              }
              aria-label={t("완성된 폰트 시험 문장")}
              style={{ fontFamily: `"${family}"` }}
              value={specimen}
              rows={4}
              placeholder={t("여기에 직접 써 보세요.")}
              onChange={(event) => setSpecimen(event.target.value)}
            />
            <p className="fw-specimen-hint">
              {t("위 문장을 지우고 하고 싶은 말을 직접 써 보세요.")}
            </p>
            {(() => {
              const missing = [...new Set(specimen)].filter(
                (char) => !/\s/.test(char) && !available.has(char),
              );
              return missing.length ? (
                <p className="fw-note">
                  {t("폰트에 없는 글자:")} {missing.slice(0, 24).join(" ")}
                </p>
              ) : null;
            })()}
          </>
        ) : (
          <p className="fw-note">{t("아직 만든 폰트가 없어요.")}</p>
        )}
        {status !== "building" && status !== "ready" && (
          <button type="button" className="fw-primary" onClick={onBuild}>
            {status === "stale"
              ? t("바뀐 설정으로 다시 만들기")
              : t("폰트 만들기")}
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
            <span>{t(localName + " 폰트 이름")}</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                aria-label={t(localName + " 폰트 이름")}
                maxLength={60}
                value={korean}
                placeholder={
                  script === "ja"
                    ? "ここに名前を入れてください"
                    : t("여기에 이름을 넣어주세요!")
                }
                aria-invalid={(!!korean && !koreanValid) || undefined}
                readOnly={!!purchase}
                onChange={(event) =>
                  setKorean(cleanLocalName(event.target.value))
                }
              />
            </span>
            {!!korean && !koreanValid && (
              <small className="fw-error">
                {script === "ja"
                  ? t("띄어쓰기 없이, 가나나 한자를 한 글자 이상 넣어 주세요.")
                  : t("띄어쓰기 없이, 한글을 한 글자 이상 넣어 주세요.")}
              </small>
            )}
          </label>
          <label className="fw-field">
            <span>{t("영문 폰트 이름")}</span>
            <span className="fw-prefixed">
              <b>{OUTPUT_PREFIX.trim()}</b>
              <input
                aria-label={t("영문 폰트 이름")}
                maxLength={60}
                value={english}
                placeholder={autoEnglish}
                aria-invalid={(!!english && !englishValid) || undefined}
                readOnly={!!purchase}
                onChange={(event) =>
                  setEnglish(cleanEnglishName(event.target.value))
                }
              />
            </span>
            {!!english && !englishValid ? (
              <small className="fw-error">
                {t("띄어쓰기 없이 영어·숫자로만 입력해 주세요.")}
              </small>
            ) : (
              !english && (
                <small>
                  {t("비워 두면 ‘{name}’으로 자동으로 넣어요.", {
                    name: autoEnglish,
                  })}
                </small>
              )
            )}
          </label>
        </div>
        {purchase ? (
          <p className="fw-purchased">
            {t(
              "결제한 폰트예요. 이름과 글씨 모양은 결제할 때 그대로이고, 같은 폰트를 몇 번이든 다시 받을 수 있어요.",
            )}
          </p>
        ) : (
          <div className="fw-name-check">
            <button
              type="button"
              disabled={!names.korean || !koreanValid || checking}
              onClick={() => runCheck()}
            >
              {checking ? t("확인 중…") : t("이름 중복 확인")}
            </button>
            {checkedNow &&
              (checkedNow.available ? (
                <span className="is-ok" role="status">
                  {t("사용 가능합니다!")}
                </span>
              ) : (
                <span className="fw-error" role="alert">
                  {t("이미 있는 이름입니다.")}{" "}
                  {checkedNow.reason === "reserved"
                    ? t(
                        "‘{name}’은(는) 이미 있는 폰트 이름이에요. 다른 이름을 지어 주세요.",
                        {
                          name: checkedNow.name,
                        },
                      )
                    : t("‘{name}’은(는) 다른 사용자가 쓰고 있어요.", {
                        name: checkedNow.name,
                      })}
                </span>
              ))}
            <small>
              {t(
                "띄어쓰기는 자동으로 빠지고, 영문은 소문자로만 들어가요. 내려받을 때도 한 번 더 확인해요.",
              )}
            </small>
          </div>
        )}

        <fieldset className="fw-formats">
          <legend>{t("파일 형식")}</legend>
          <details className="fw-format-help">
            <summary>{t("어떤 형식을 받아야 할까요?")}</summary>
            <ul>
              {(
                [
                  [
                    "한글·워드·파워포인트 같은 문서에 쓸 때 → TTF",
                    "컴퓨터에 설치하는 글꼴 중 가장 널리 호환돼요.",
                  ],
                  [
                    "포토샵·일러스트·인디자인 등 디자인에 쓸 때 → OTF",
                    "이 앱이 처음 만드는 원본 형식이에요. Mac·Windows 모두 설치돼요.",
                  ],
                  [
                    "아이패드(굿노트·키노트 등)",
                    "글꼴 설치 앱이나 설정 프로파일로 TTF 또는 OTF를 설치해요.",
                  ],
                  [
                    "웹사이트에 쓸 때 → WOFF2",
                    "컴퓨터에 설치하는 파일이 아니에요. 웹페이지에 연결해서 쓰는 가벼운 형식이에요.",
                  ],
                  ["안드로이드 휴대폰·태블릿", "폰트를 직접 설치할 수 없어요."],
                ] as const
              ).map(([head, body]) => (
                <li key={head}>
                  <b>{t(head)}</b> {t(body)}
                </li>
              ))}
            </ul>
            <p>
              <b>{t("굵기 3종 ZIP")}</b>{" "}
              {t(
                "같은 손글씨로 가는·보통·굵은 폰트를 함께 만들어요. 세 개를 모두 설치하면 문서 프로그램의 '굵게(B)' 버튼이 내 손글씨의 굵은 모양으로 바뀌어요. 만드는 데 시간이 조금 더 걸려요.",
              )}
            </p>
            <p>
              {t(
                "TTF와 OTF는 글자 모양이 같고 곡선을 저장하는 방식만 달라요. 어느 쪽이 더 무겁거나 고급인 것은 아니니, 둘 중 하나만 설치하세요. 둘 다 설치하면 같은 이름의 글꼴이 겹칠 수 있어요.",
              )}
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
                <small>{t(item.note)}</small>
                {item.id === "ttf" && (
                  <em className="fw-recommend" aria-label={t("추천")}>
                    {t("추천!")}
                  </em>
                )}
              </label>
            ))}
          </div>
          <div className="fw-format-all">
            <span>{t("잘 모르겠다면 다 받기 →")}</span>
            <label className={format === "zip" ? "is-selected" : ""}>
              <input
                type="radio"
                name="format"
                checked={format === "zip"}
                onChange={() => setFormat("zip")}
              />
              <strong>{t("전체 묶음 ZIP")}</strong>
              <small>{t("TTF·OTF·WOFF2·WOFF 모두")}</small>
            </label>
          </div>
          <div className="fw-format-all">
            <span>{t("문서에서 굵게·가늘게도 쓰려면 →")}</span>
            <label className={format === "weights" ? "is-selected" : ""}>
              <input
                type="radio"
                name="format"
                checked={format === "weights"}
                onChange={() => setFormat("weights")}
              />
              <strong>{t("굵기 3종 ZIP")}</strong>
              <small>{t("가는(Light)·보통(Regular)·굵은(Bold) TTF·OTF")}</small>
            </label>
          </div>
          <p className="fw-android">
            {t(
              "※ 안드로이드 휴대폰·태블릿에서는 폰트를 직접 설치할 수 없어요.",
            )}
          </p>
        </fieldset>

        {fallback.total > 0 && (
          <div className="fw-fallback" role="note">
            <strong>⚠ {t("쓰지 않은 글자는 견본 글꼴로 대체됩니다")}</strong>
            <p>
              {t(
                "손글씨로 쓰지 않은 {n}자({groups})는 ‘{font}’ 모양으로 들어가요. 쓴 글자는 모두 내 손글씨로 나와요.",
                {
                  n: fallback.total.toLocaleString(),
                  groups: fallback.groups.join(" · "),
                  font: t(fallback.fontName),
                },
              )}
            </p>
            {script === "ja" && style && style.samples >= 3 && (
              <p className="fw-style-rules">
                <b>{t("내 글씨에서 찾은 필체 규칙")}</b>{" "}
                {t(
                  "획 굵기 ×{weight} · 가로획 {rise}° 오름 · 세로획 {lean}° 기울임 · 폭 {width}% · 높이 {height}%",
                  {
                    weight: style.weight.toFixed(2),
                    rise: style.rise.toFixed(1),
                    lean: style.lean.toFixed(1),
                    width: Math.round(style.width * 100),
                    height: Math.round(style.height * 100),
                  },
                )}
                <br />
                {t(
                  "쓰지 않은 가나·한자는 견본 모양에 이 규칙을 입혀 채웠어요. 필체 한자를 더 쓸수록 규칙이 정확해져요.",
                )}
              </p>
            )}
            {script === "ja" && (!style || style.samples < 3) && (
              <p className="fw-style-rules">
                {t(
                  "가나·한자를 3자 이상 쓰면 내 필체 규칙(굵기·기울기·비율)을 찾아 쓰지 않은 한자에 입혀요.",
                )}
              </p>
            )}
            {onWriteMissing && (
              <button
                type="button"
                className="fw-link"
                onClick={onWriteMissing}
              >
                {t("쓰지 않은 글자 쓰러 가기 →")}
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
              ? t("파일 준비 중…")
              : names.korean
                ? format === "weights"
                  ? t("{file} 다운로드 ↓", {
                      file: `${OUTPUT_PREFIX}${names.korean} ${t("굵기3종")}.zip`,
                    })
                  : t("{file} 다운로드 ↓", {
                      file: `${OUTPUT_PREFIX}${names.korean}.${format}`,
                    })
                : t("다운로드 ↓")}
          </button>
          <button
            type="button"
            className="fw-secondary fw-share"
            data-blocked={!canDownload || undefined}
            onClick={() => start("share")}
          >
            {exporting && mode === "share" ? t("준비 중…") : t("공유하기 ↗")}
          </button>
        </div>
        {status !== "ready" ? (
          <p className="fw-note">{t("폰트를 만든 뒤에 내려받을 수 있어요.")}</p>
        ) : (
          !names.korean && (
            <p className="fw-note">
              {script === "ja"
                ? t("일본어 폰트 이름을 넣으면 내려받을 수 있어요.")
                : t("한글 폰트 이름을 넣으면 내려받을 수 있어요.")}
            </p>
          )
        )}
        {exportError && (
          <p className="fw-error" role="alert">
            {exportError}
          </p>
        )}
        {exportNotice && (
          <p className="fw-saved" role="status">
            ✓ {exportNotice}
          </p>
        )}
      </form>

      {shareFile && (
        <FontDialog title={t("보낼 준비가 됐어요")} onClose={onShareDone}>
          <p className="output-filename">{shareFile.name}</p>
          <p>
            {t(
              "아래 버튼을 누르면 카카오톡, 네이버 웍스, 메일 등 이 기기의 앱으로 바로 보낼 수 있어요.",
            )}
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
              {t("닫기")}
            </button>
            <button
              type="button"
              className="fw-primary"
              autoFocus
              onClick={share}
            >
              {t("공유하기 ↗")}
            </button>
          </div>
        </FontDialog>
      )}
      {payFor && (
        <PaymentDialog
          order={{
            item: script === "ja" ? "정식 구매 · 일본어" : "정식 구매 · 한글",
            fontName: OUTPUT_PREFIX + names.korean,
            format: format === "weights" ? "zip · 3 weights" : format,
          }}
          onClose={() => setPayFor(null)}
          onPaid={() => {
            const next = payFor;
            setPayFor(null);
            onPurchased?.({
              at: Date.now(),
              local: names.korean,
              english: names.english,
              script,
            });
            setMode(next);
            onDownload(format, names, next);
          }}
        />
      )}
      {shareUnsupported && (
        <FontDialog
          title={t("이 기기에서는 폰트 파일을 바로 공유할 수 없어요")}
          onClose={() => setShareUnsupported(false)}
        >
          <p>
            {t(
              "안드로이드의 크롬·삼성 인터넷 같은 브라우저는 보안을 위해 사진·동영상·PDF 같은 파일만 공유 창으로 보낼 수 있게 막아 두었어요. 폰트({format}) 파일은 이렇게 보내 주세요.",
              { format: format.toUpperCase() },
            )}
          </p>
          <ol className="fw-steps">
            <li>{t("‘다운로드’로 파일을 기기에 저장해요.")}</li>
            <li>
              {t("카카오톡·네이버 웍스 채팅방에서 ＋(첨부) → 파일을 눌러요.")}
            </li>
            <li>
              {t("‘다운로드’ 폴더에서 {prefix} 폰트 파일을 골라 보내요.", {
                prefix: OUTPUT_PREFIX.trim(),
              })}
            </li>
          </ol>
          <div className="font-dialog-actions">
            <button
              type="button"
              className="fw-secondary"
              onClick={() => setShareUnsupported(false)}
            >
              {t("닫기")}
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
              {t("다운로드하기 ↓")}
            </button>
          </div>
        </FontDialog>
      )}
      {blocked && (
        <FontDialog
          title={t("⚠ 아직 내려받을 수 없어요")}
          onClose={() => setBlocked(false)}
        >
          <ul className="fw-blockers">
            {(reasons.length
              ? reasons
              : [{ text: "잠시 후 다시 눌러 주세요." }]
            ).map((reason) => (
              <li key={reason.text}>{t(reason.text)}</li>
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
                          `[aria-label="${t((field === "korean" ? localName : "영문") + " 폰트 이름")}"]`,
                        )
                        ?.focus(),
                    50,
                  );
              }}
            >
              {t("확인하고 고치기")}
            </button>
          </div>
        </FontDialog>
      )}
    </section>
  );
}
