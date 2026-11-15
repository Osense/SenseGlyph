"use client";
// 다운로드 전 결제창(목업). 결제 수단·주문 요약·약관 동의·결제하기, 그 아래 테스트 코드 칸.
// 지금은 PG가 연결되지 않아 결제하기는 '준비 중'으로 끝나고, 코드(권오현)를 넣으면 내려받는다.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n";
import {
  PRICE,
  redeemCode,
  requestPayment,
  type Order,
  type PayMethod,
} from "../lib/payment";

const METHODS: { id: PayMethod; label: string }[] = [
  { id: "card", label: "신용·체크카드" },
  { id: "kakaopay", label: "카카오페이" },
  { id: "naverpay", label: "네이버페이" },
  { id: "tosspay", label: "토스페이" },
];

export default function PaymentDialog({
  order,
  onPaid,
  onClose,
}: {
  order: Omit<Order, "amount">;
  onPaid: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [method, setMethod] = useState<PayMethod>("card");
  const [agree, setAgree] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !paying) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, paying]);
  const won = (n: number) => n.toLocaleString("ko-KR") + t("원");
  const pay = async () => {
    if (!agree || paying) return;
    setPaying(true);
    setNotice("");
    const result = await requestPayment({ ...order, amount: PRICE }, method);
    setPaying(false);
    if (result.status === "paid") onPaid();
    else
      setNotice(
        t(
          "결제 연결을 준비하고 있어요. 베타 기간에는 아래에 받은 코드를 넣으면 내려받을 수 있어요.",
        ),
      );
  };
  // 내보내기 칸의 <form> 안에서 열리므로 문서 끝(body)에 따로 그린다(폼 안의 폼 방지).
  return createPortal(
    <div className="modal-backdrop" onClick={() => !paying && onClose()}>
      <section
        className="settings-modal sg-pay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-pay-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <h2 id="sg-pay-title">{t("결제하고 내려받기")}</h2>
          <button onClick={onClose} aria-label={t("닫기")} disabled={paying}>
            ✕
          </button>
        </div>
        <div className="sg-pay-order">
          <div>
            <small>{t("주문 상품")}</small>
            <strong>{t(order.item)}</strong>
            <span>
              {order.fontName} · {order.format.toUpperCase()}
            </span>
          </div>
          <div className="sg-pay-amount">
            <small>{t("결제 금액")}</small>
            <strong>{won(PRICE)}</strong>
            <span>{t("부가세 포함 · 한 번 결제로 다시 받기 무제한")}</span>
          </div>
        </div>
        <fieldset className="sg-pay-methods">
          <legend>{t("결제 수단")}</legend>
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={method === m.id ? "is-selected" : undefined}
            >
              <input
                type="radio"
                name="pay-method"
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
              />
              {t(m.label)}
            </label>
          ))}
        </fieldset>
        <label className="sg-pay-agree">
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
          />
          {t(
            "주문 내용을 확인했고, 디지털 상품 특성상 내려받은 뒤에는 청약 철회가 제한되는 데 동의합니다.",
          )}
        </label>
        <button
          type="button"
          className="sg-pay-button"
          disabled={!agree || paying}
          onClick={pay}
        >
          {paying
            ? t("결제창을 여는 중…")
            : t("{amount} 결제하기", { amount: won(PRICE) })}
        </button>
        {notice && (
          <p className="sg-pay-notice" role="status">
            {notice}
          </p>
        )}
        <form
          className="sg-pay-code"
          onSubmit={(event) => {
            event.preventDefault();
            if (redeemCode(code)) onPaid();
            else setCodeError(t("코드가 맞지 않아요. 다시 확인해 주세요."));
          }}
        >
          <label htmlFor="sg-pay-code">{t("코드가 있나요?")}</label>
          <div>
            <input
              id="sg-pay-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError("");
              }}
              placeholder={t("코드 입력")}
              autoComplete="off"
            />
            <button type="submit" disabled={!code.trim()}>
              {t("코드로 내려받기")}
            </button>
          </div>
          {codeError && (
            <small className="fw-error" role="alert">
              {codeError}
            </small>
          )}
        </form>
        <p className="sg-pay-foot">
          {t(
            "결제는 안전한 결제대행사(PG)를 통해 처리되며, 카드 정보는 쎈스 글리프에 저장되지 않아요.",
          )}
        </p>
      </section>
    </div>,
    // 화면 색·글꼴 변수가 있는 앱 바탕(.studio) 안에 그린다.
    document.querySelector(".studio") ?? document.body,
  );
}
