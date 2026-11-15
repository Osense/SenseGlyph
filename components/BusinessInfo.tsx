"use client";
// 판매자 정보(전자상거래법 제10조). 법적 고지 페이지와 결제 창 아래에 함께 보여 준다.
// 값은 lib/business.ts 한곳에서만 고친다.
import {
  BUSINESS,
  CONTACT_EMAIL,
  HOSTING,
  hasBusinessInfo,
} from "../lib/business";
import { useT } from "../lib/i18n";
import { MAKER } from "../lib/version";

export default function BusinessInfo({ compact = false }: { compact?: boolean }) {
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
    <footer className={compact ? "sg-biz is-compact" : "sg-biz"}>
      {!compact && <h2>{t("사업자 정보")}</h2>}
      <dl>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        <div>
          <dt>{t("문의")}</dt>
          <dd>
            <a href={`mailto:${BUSINESS.email || CONTACT_EMAIL}`}>
              {BUSINESS.email || CONTACT_EMAIL}
            </a>
          </dd>
        </div>
      </dl>
      {!hasBusinessInfo() && (
        <p>
          {t(
            "지금은 무료 베타 기간이라 판매하지 않아요. 사업자 등록과 통신판매업 신고를 마치면 이곳에 판매자 정보를 모두 표시해요.",
          )}
        </p>
      )}
    </footer>
  );
}
