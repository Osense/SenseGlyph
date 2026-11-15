"use client";
// 법적 고지 문서 보기: 가격 안내·이용약관·환불 규정·개인정보 처리방침.
// 앱 안의 안내 창(LegalTabs)과 공개 페이지(LegalPageShell)가 같은 화면을 쓴다.
import { useState } from "react";
import LegalNotice from "./LegalNotice";
import BusinessInfo from "./BusinessInfo";
import { BASE_PATH } from "../lib/base-path";
import {
  CONTACT_EMAIL,
  LEGAL_EFFECTIVE,
  LEGAL_PAGES,
  type LegalPage,
} from "../lib/business";
import { useLang, useT, type UiLang } from "../lib/i18n";
import { LEGAL_DOCS } from "../lib/legal-docs";
import { PRICE } from "../lib/payment";
import { APP_VERSION, MAKER } from "../lib/version";

/** 화면에 보이는 순서 */
export const LEGAL_ORDER: LegalPage[] = ["pricing", "terms", "refund", "privacy"];
export const LEGAL_LABELS: Record<LegalPage, string> = {
  pricing: "가격 안내",
  terms: "이용약관",
  refund: "환불 규정",
  privacy: "개인정보 처리방침",
};

export const legalHref = (page: LegalPage) =>
  `${BASE_PATH}/${LEGAL_PAGES[page]}`;

export function formatPrice(lang: UiLang, amount = PRICE) {
  const n = amount.toLocaleString("ko-KR");
  return lang === "ja" ? `${n}ウォン` : lang === "en" ? `₩${n}` : `${n}원`;
}

const EFFECTIVE: Record<UiLang, string> = {
  ko: "시행일",
  ja: "施行日",
  en: "Effective",
};

export function LegalDocument({
  page,
  headingLevel = 2,
}: {
  page: LegalPage;
  headingLevel?: 1 | 2;
}) {
  const lang = useLang((state) => state.lang);
  if (page === "privacy") return <LegalNotice headingLevel={headingLevel} />;
  const doc = LEGAL_DOCS[page][lang];
  const fill = (text: string) =>
    text.split("{price}").join(formatPrice(lang)).split("{email}").join(CONTACT_EMAIL);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="sg-legal" lang={lang}>
      <Heading>{doc.title}</Heading>
      <p className="sg-legal-meta">
        {EFFECTIVE[lang]} {LEGAL_EFFECTIVE} · v{APP_VERSION} · {MAKER}
      </p>
      <p>{fill(doc.intro)}</p>
      {doc.sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{fill(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

/** 문서 사이를 오가는 탭 줄. onPick 이 없으면 각 공개 페이지로 가는 링크가 된다. */
export function LegalNav({
  current,
  onPick,
}: {
  current: LegalPage;
  onPick?: (page: LegalPage) => void;
}) {
  const t = useT();
  return (
    <nav className="sg-legal-nav" aria-label={t("약관과 정책")}>
      {LEGAL_ORDER.map((page) =>
        onPick ? (
          <button
            key={page}
            type="button"
            aria-current={page === current ? "page" : undefined}
            onClick={() => onPick(page)}
          >
            {t(LEGAL_LABELS[page])}
          </button>
        ) : (
          <a
            key={page}
            href={legalHref(page)}
            aria-current={page === current ? "page" : undefined}
          >
            {t(LEGAL_LABELS[page])}
          </a>
        ),
      )}
    </nav>
  );
}

/** 앱 안의 안내 창: 탭으로 문서를 바꿔 보고, 아래에 판매자 정보 */
export function LegalTabs({ initial = "privacy" }: { initial?: LegalPage }) {
  const [page, setPage] = useState<LegalPage>(initial);
  return (
    <div className="sg-legal-tabs">
      <LegalNav current={page} onPick={setPage} />
      <LegalDocument page={page} />
      <BusinessInfo />
    </div>
  );
}

/** 공개 페이지(/pricing/ 등)의 틀: 돌아가기·언어·문서 탭·판매자 정보 */
export function LegalPageShell({ page }: { page: LegalPage }) {
  const t = useT();
  return (
    <main className="studio sg-legal-page">
      <div className="sg-legal-top">
        <a href={`${BASE_PATH}/`}>← {t("쎈스 글리프")}</a>
        <span className="sg-legal-langs" role="group" aria-label="Language">
          {(["ko", "ja", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => useLang.getState().choose(lang)}
            >
              {lang === "ko" ? "한국어" : lang === "ja" ? "日本語" : "English"}
            </button>
          ))}
        </span>
      </div>
      <LegalNav current={page} />
      <LegalDocument page={page} headingLevel={1} />
      <BusinessInfo />
    </main>
  );
}
