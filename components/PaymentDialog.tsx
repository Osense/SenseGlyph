"use client";
// 다운로드 전 결제창(목업). 결제 수단·주문 요약·약관 동의·결제하기, 그 아래 테스트 코드 칸.
// 지금은 PG가 연결되지 않아 결제하기는 '준비 중'으로 끝나고, 코드(권오현)를 넣으면 내려받는다.
import { useState } from "react";
import { CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import BusinessInfo from "./BusinessInfo";
import { legalHref } from "./LegalDocument";
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
  // Radix 대화창은 문서 끝(body)에 따로 그려지므로 내보내기 칸의 <form> 과 겹치지 않는다.
  return (
    <Dialog open onOpenChange={(open) => !open && !paying && onClose()}>
      <DialogContent
        className="sg-pay gap-5 sm:max-w-[520px]"
        closeLabel={t("닫기")}
        aria-describedby={undefined}
        onInteractOutside={(event) => paying && event.preventDefault()}
      >
        <DialogTitle id="sg-pay-title" className="text-xl">
          {t("결제하고 내려받기")}
        </DialogTitle>
        <div className="sg-pay-order grid grid-cols-[1fr_auto] gap-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="grid min-w-0 content-start gap-0.5">
            <small className="text-xs text-muted-foreground">
              {t("주문 상품")}
            </small>
            <strong className="text-[15px] font-semibold">
              {t(order.item)}
            </strong>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {order.fontName} · {order.format.toUpperCase()}
            </span>
          </div>
          <div className="sg-pay-amount grid content-start justify-items-end gap-0.5 text-right">
            <small className="text-xs text-muted-foreground">
              {t("결제 금액")}
            </small>
            <strong className="font-mono text-2xl leading-tight font-semibold text-primary tabular-nums">
              {won(PRICE)}
            </strong>
            <span className="max-w-[180px] text-[11px] leading-snug text-muted-foreground">
              {t("부가세 포함 · 한 번 결제로 다시 받기 무제한")}
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <p className="sg-pay-lock m-0 flex gap-2.5 rounded-lg border border-primary/25 bg-wash px-3.5 py-3 text-[13px] leading-relaxed">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <b className="font-semibold">
                {t("결제 후에는 이 폰트를 수정할 수 없어요.")}
              </b>{" "}
              <span className="text-muted-foreground">
                {t(
                  "글씨·정돈·이름이 결제한 그대로 고정되고, 같은 폰트는 언제든 다시 받을 수 있어요. 고치고 싶으면 새 프로젝트로 복제해서 다시 만들어야 해요.",
                )}
              </span>
            </span>
          </p>
          <p className="sg-pay-trial m-0 px-1 text-xs leading-relaxed text-muted-foreground">
            {t(
              "결제 전에 문장 미리보기와 글자별 확인으로 완성될 모양을 꼭 확인해 주세요. 이 미리보기가 시험 사용이에요.",
            )}
          </p>
        </div>
        <fieldset className="sg-pay-methods m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
            {t("결제 수단")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <label
                key={m.id}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-wash has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30",
                  method === m.id && "is-selected",
                )}
              >
                <input
                  type="radio"
                  name="pay-method"
                  className="peer sr-only"
                  checked={method === m.id}
                  onChange={() => setMethod(m.id)}
                />
                <span
                  aria-hidden="true"
                  className="grid size-4 place-items-center rounded-full border-2 border-border peer-checked:border-primary peer-checked:[&>i]:block"
                >
                  <i className="hidden size-1.5 rounded-full bg-primary" />
                </span>
                {t(m.label)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="sg-pay-agree flex cursor-pointer gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[var(--accent)]"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
          />
          {t(
            "미리보기로 결과물을 확인했고, 결제 후 수정할 수 없으며 내려받은 뒤에는 어떤 이유로도 환불되지 않는다는 데(파일이 열리지 않는 오류만 예외) 동의합니다.",
          )}
        </label>
        <p className="sg-pay-links -mt-2 m-0 pl-7 text-xs">
          {(["pricing", "terms", "refund"] as const).map((page, index) => (
            <span key={page}>
              {index > 0 && <span className="text-dim"> · </span>}
              <a
                href={legalHref(page)}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t(
                  page === "pricing"
                    ? "가격 안내"
                    : page === "terms"
                      ? "이용약관"
                      : "환불 규정",
                )}
              </a>
            </span>
          ))}
        </p>
        <Button
          type="button"
          size="xl"
          className="sg-pay-button w-full"
          disabled={!agree || paying}
          onClick={pay}
        >
          {paying ? <Loader2 className="animate-spin" /> : <CreditCard />}
          {paying
            ? t("결제창을 여는 중…")
            : t("{amount} 결제하기", { amount: won(PRICE) })}
        </Button>
        {notice && (
          <p
            className="sg-pay-notice -mt-2 m-0 rounded-lg bg-warning-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground"
            role="status"
          >
            {notice}
          </p>
        )}
        <form
          className="sg-pay-code grid gap-2 border-t border-dashed border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (redeemCode(code)) onPaid();
            else setCodeError(t("코드가 맞지 않아요. 다시 확인해 주세요."));
          }}
        >
          <Label htmlFor="sg-pay-code" className="text-[13px]">
            {t("코드가 있나요?")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="sg-pay-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError("");
              }}
              placeholder={t("코드 입력")}
              autoComplete="off"
              aria-invalid={!!codeError || undefined}
            />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>
              {t("코드로 내려받기")}
            </Button>
          </div>
          {codeError && (
            <small className="fw-error text-xs text-destructive" role="alert">
              {codeError}
            </small>
          )}
        </form>
        <div className="grid gap-3 border-t border-divider pt-4 text-[11px] text-muted-foreground">
          <p className="sg-pay-foot m-0 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0" />
            {t(
              "결제는 안전한 결제대행사(PG)를 통해 처리되며, 카드 정보는 쎈스 글리프에 저장되지 않아요.",
            )}
          </p>
          <BusinessInfo compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}
