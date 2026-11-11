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

const specimen = [
  "축하해요! 이제 당신의 손글씨로 세상에 인사를 건넬 수 있어요.",
  "Hello, world! 내 글씨가 1·2·3, 마음을 전해요 :)",
  "Aa–Zz / 0123456789 / !? @#%&+ « » ( ) [ ] ₩",
];

export type OutputPlan = "basic" | "premium";

export default function FontOutput({
  family,
  characters,
  exporting,
  exportError,
  onDownload,
  onWriteSpecial,
  specialWritten,
  specialTotal,
  premiumReady,
}: {
  family?: string;
  characters: string[];
  exporting: ExportFormat | null;
  exportError: string;
  onWriteSpecial?: () => void;
  specialWritten: number;
  specialTotal: number;
  premiumReady: boolean;
  onDownload: (
    format: ExportFormat,
    names: OutputNames,
    plan: OutputPlan,
  ) => void;
}) {
  const [names, setNames] = useState<OutputNames>({ korean: "", english: "" });
  const [format, setFormat] = useState<ExportFormat>("zip");
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<OutputPlan>("basic");
  const [needsSpecial, setNeedsSpecial] = useState(false);
  const [nameChecked, setNameChecked] = useState(false);
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<"valid" | "invalid" | null>(null);
  const korean = names.korean.trim().normalize("NFC");
  const english = names.english.trim();
  const valid = isKoreanOutputName(korean) && isEnglishOutputName(english);
  const available = new Set(characters);
  const missing = [...new Set(specimen.join(""))].filter(
    (char) => !/\s/.test(char) && !available.has(char),
  );

  return (
    <section className="font-output" aria-label="폰트 내보내기">
      {family && (
        <div
          className="generated-preview output-specimen"
          aria-label="생성된 폰트 미리보기"
        >
          {specimen.map((line) => (
            <p key={line} style={{ fontFamily: family }}>
              {[...line].map((char, index) =>
                /\s/.test(char) || available.has(char) ? (
                  char
                ) : (
                  <span
                    className="missing-glyph"
                    key={index}
                    title={char + " · 아직 없는 글자"}
                  >
                    {char}
                  </span>
                ),
              )}
            </p>
          ))}
        </div>
      )}
      {family && missing.length > 0 && (
        <p className="font-help">
          회색으로 표시된 문자는 생성된 폰트에 없어요. {missing.join(" ")}
        </p>
      )}
      <form
        className="output-fields"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && nameChecked) {
            if (plan === "premium" && specialWritten < specialTotal) {
              setNeedsSpecial(true);
              return;
            }
            setCode("");
            setPromo(null);
            setOpen(true);
          }
        }}
      >
        <label className="font-field">
          한글 폰트 이름
          <span className="output-prefix">
            <span>OSNS</span>
            <input
              required
              aria-label="한글 폰트 이름"
              maxLength={60}
              value={names.korean}
              onChange={(event) => {
                setNameChecked(false);
                setNames({
                  ...names,
                  korean: event.target.value.replace(/\s/g, ""),
                });
              }}
            />
          </span>
          <small className="font-field-note">
            공백 없이 입력하고 한글을 한 글자 이상 포함해 주세요.
          </small>
        </label>
        <label className="font-field">
          영문 폰트 이름
          <span className="output-prefix">
            <span>OSNS</span>
            <input
              required
              aria-label="영문 폰트 이름"
              maxLength={60}
              value={names.english}
              onChange={(event) => {
                setNameChecked(false);
                setNames({
                  ...names,
                  english: event.target.value.replace(/\s/g, ""),
                });
              }}
            />
          </span>
          <small className="font-field-note">
            공백 없이 영문 키보드 문자로 입력해 주세요. 영문자나 숫자가
            필요합니다.
          </small>
        </label>
        <div className="output-name-check">
          <button
            type="button"
            className="font-secondary"
            disabled={!valid}
            onClick={() => setNameChecked(true)}
          >
            폰트 이름 중복확인
          </button>
          {nameChecked && (
            <p role="status" className="output-name-available">
              사용가능한 폰트명입니다!
            </p>
          )}
        </div>
        <label className="font-field">
          출력 플랜
          <select
            value={plan}
            onChange={(event) => {
              const premium = event.target.value === "premium";
              setPlan(premium ? "premium" : "basic");
              if (premium && specialWritten < specialTotal)
                setNeedsSpecial(true);
            }}
          >
            <option value="basic">기본 · 19,900원 · 특수 기호 제외</option>
            <option value="premium">
              프리미엄 · 29,900원 · 특수 기호 포함
            </option>
          </select>
          <small className="font-field-note">
            특수 기호 {specialWritten} / {specialTotal}자 작성
          </small>
        </label>
        <label className="font-field">
          파일 형식
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
          >
            <option value="zip">ZIP · 전체 형식</option>
            {(["ttf", "otf", "woff", "woff2"] as const).map((ext) => (
              <option key={ext} value={ext}>
                {ext.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <button
          className="font-primary"
          disabled={!valid || !nameChecked}
          type="submit"
        >
          다운로드 →
        </button>
      </form>
      {needsSpecial && (
        <FontDialog
          title="특수 기호 손글씨"
          onClose={() => {
            setNeedsSpecial(false);
            setPlan("basic");
          }}
        >
          <p>
            {specialWritten === 0
              ? "현재 특수기호 손글씨가 없습니다. 입력하시겠습니까?"
              : `프리미엄 출력까지 특수 기호 ${specialTotal - specialWritten}자가 남았습니다.`}
          </p>
          <div className="font-dialog-actions">
            <button
              className="font-secondary"
              onClick={() => {
                setNeedsSpecial(false);
                setPlan("basic");
              }}
            >
              취소
            </button>
            <button
              className="font-primary"
              onClick={() => {
                setNeedsSpecial(false);
                onWriteSpecial?.();
              }}
            >
              특수 기호 쓰러 가기
            </button>
          </div>
        </FontDialog>
      )}
      {open && (
        <FontDialog
          title="폰트 출력"
          onClose={exporting ? undefined : () => setOpen(false)}
        >
          <p className="output-filename">
            {OUTPUT_PREFIX}
            {korean}.{format}
          </p>
          <p className="output-price">
            <span>{plan === "premium" ? "프리미엄" : "기본"} 1회 출력</span>
            <del>{plan === "premium" ? "39,000원" : "29,000원"}</del>
            <strong>{plan === "premium" ? "29,900원" : "19,900원"}</strong>
            <span>
              {plan === "premium" ? "프로모션 가격" : "프로모션 · 30% 할인"}
            </span>
          </p>
          <p>
            폰트의 저작권은 전부 사용자에게 있습니다. 폰트명에는 서비스명 OSNS를
            남기는 조건입니다.
          </p>
          <p>
            수정 후 다시 출력하면 추가 비용이 발생할 수 있어요. 출력 전에 이름과
            글자 모양을 확인해 주세요.
          </p>
          <p className="font-help">
            프로토타입입니다. 프로모션 코드로 출력 기능을 체험할 수 있어요.
          </p>
          <form
            className="output-code"
            onSubmit={(event) => {
              event.preventDefault();
              setPromo(
                [
                  "osnsstudio",
                  "오쎈스",
                  "한울사랑",
                  "명천사랑",
                  "황금포도",
                  "쓰리에쓰부라더쓰",
                ].includes(code.trim().normalize("NFC").toLowerCase())
                  ? "valid"
                  : "invalid",
              );
            }}
          >
            <label className="font-field">
              프로모션 코드
              <input
                autoComplete="off"
                disabled={exporting !== null}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setPromo(null);
                }}
              />
            </label>
            <button
              type="submit"
              className="font-secondary"
              disabled={!code.trim() || exporting !== null}
            >
              적용
            </button>
          </form>
          {promo && (
            <p role="status">
              {promo === "valid"
                ? "인증되었습니다. 다운로드를 해주세요."
                : "프로모션 코드를 확인해 주세요."}
            </p>
          )}
          {!family && (
            <p className="font-help">
              실제 파일을 받으려면 폰트 파일이 필요합니다.
            </p>
          )}
          {family && plan === "premium" && !premiumReady && (
            <p className="font-help">
              특수 기호가 포함된 폰트를 생성한 뒤 다운로드할 수 있습니다.
            </p>
          )}
          {exportError && (
            <p className="font-error" role="alert">
              {exportError}
            </p>
          )}
          <div className="font-dialog-actions">
            <button
              type="button"
              className="font-secondary"
              disabled={exporting !== null}
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="font-primary"
              disabled={
                !family ||
                (plan === "premium" && !premiumReady) ||
                promo !== "valid" ||
                exporting !== null
              }
              onClick={() => onDownload(format, { korean, english }, plan)}
            >
              {exporting ? "파일 준비 중…" : "다운로드 ↓"}
            </button>
          </div>
        </FontDialog>
      )}
    </section>
  );
}
