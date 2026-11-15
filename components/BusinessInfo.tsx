"use client";
// 판매자 정보(전자상거래법 제10조). 법적 고지 페이지와 결제 창 아래에 함께 보여 준다.
// 값은 lib/business.ts 한곳에서만 고친다.
import {
  BUSINESS,
  CONTACT_EMAIL,
  HOSTING,
  hasBusinessInfo,
} from "../lib/business";
import { cn } from "@/lib/utils";
import { useT } from "../lib/i18n";
import { MAKER } from "../lib/version";

export default function BusinessInfo({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useT();
  const rows: [string, string][] = hasBusinessInfo()
    ? [
        [t("상호"), BUSINESS.name],
        [t("대표자"), BUSINESS.owner],
        [t("주소"), BUSINESS.address],
        [t("전화"), BUSINESS.phone],
        [t("이메일"), BUSINESS.email],
        [t("사업자등록번호"), BUSINESS.registration],
        [t("통신판매업 신고번호"), BUSINESS.mailOrder],
        [t("개인정보 보호책임자"), BUSINESS.privacyOfficer],
        [t("호스팅서비스 제공자"), HOSTING],
      ]
    : [
        [t("운영"), MAKER],
        [t("호스팅서비스 제공자"), HOSTING],
      ];
  return (
    <footer
      data-ui
      className={cn(
        "sg-biz grid gap-2 text-muted-foreground",
        compact ? "is-compact text-[11px]" : "text-xs",
      )}
    >
      {!compact && (
        <h2 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
          {t("사업자 정보")}
        </h2>
      )}
      <dl
        className={cn(
          "m-0 grid gap-x-4 gap-y-1",
          compact ? "grid-cols-1 sm:grid-cols-2" : "sm:grid-cols-2",
        )}
      >
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 text-dim">{label}</dt>
              <dd className="m-0 min-w-0 break-words text-foreground/80">
                {value}
              </dd>
            </div>
          ))}
        <div className="flex gap-2">
          <dt className="shrink-0 text-dim">{t("문의")}</dt>
          <dd className="m-0 min-w-0">
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={`mailto:${BUSINESS.email || CONTACT_EMAIL}`}
            >
              {BUSINESS.email || CONTACT_EMAIL}
            </a>
          </dd>
        </div>
      </dl>
      {!hasBusinessInfo() && (
        <p className="m-0 leading-relaxed">
          {t(
            "지금은 무료 베타 기간이라 판매하지 않아요. 사업자 등록과 통신판매업 신고를 마치면 이곳에 판매자 정보를 모두 표시해요.",
          )}
        </p>
      )}
    </footer>
  );
}
