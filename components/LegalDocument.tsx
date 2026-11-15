"use client";
// 법적 고지 문서 보기: 가격 안내·이용약관·환불 규정·개인정보 처리방침.
// 앱 안의 안내 창(LegalTabs)과 공개 페이지(LegalPageShell)가 같은 화면을 쓴다.
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
export const LEGAL_ORDER: LegalPage[] = [
  "pricing",
  "terms",
  "refund",
  "privacy",
];
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
    text
      .split("{price}")
      .join(formatPrice(lang))
      .split("{email}")
      .join(CONTACT_EMAIL);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <article data-ui className={legalArticle} lang={lang}>
      <Heading className="m-0 font-serif text-[28px] leading-tight font-normal tracking-[-0.02em]">
        {doc.title}
      </Heading>
      <p className="sg-legal-meta m-0 font-mono text-[11px] text-dim">
        {EFFECTIVE[lang]} {LEGAL_EFFECTIVE} · v{APP_VERSION} · {MAKER}
      </p>
      <p className="m-0 font-serif text-[15px] leading-[1.8] text-foreground/85">
        {fill(doc.intro)}
      </p>
      {doc.sections.map((section) => (
        <section key={section.title} className="grid gap-2">
          <h3 className="m-0 text-[15px] font-semibold">{section.title}</h3>
          <ul className="m-0 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed text-muted-foreground marker:text-primary/60">
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
const legalArticle =
  "sg-legal grid gap-5 text-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline";
const legalTab =
  "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground no-underline transition-colors hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-foreground aria-[current=page]:shadow-soft";

export function LegalNav({
  current,
  onPick,
}: {
  current: LegalPage;
  onPick?: (page: LegalPage) => void;
}) {
  const t = useT();
  return (
    <nav
      data-ui
      className="sg-legal-nav flex flex-wrap gap-1 rounded-xl bg-muted p-1"
      aria-label={t("약관과 정책")}
    >
      {LEGAL_ORDER.map((page) =>
        onPick ? (
          <button
            key={page}
            data-ui
            type="button"
            className={legalTab}
            aria-current={page === current ? "page" : undefined}
            onClick={() => onPick(page)}
          >
            {t(LEGAL_LABELS[page])}
          </button>
        ) : (
          <a
            key={page}
            data-ui
            className={legalTab}
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
    <div data-ui className="sg-legal-tabs grid gap-6 pt-6">
      <LegalNav current={page} onPick={setPage} />
      <LegalDocument page={page} />
      <div className="border-t border-divider pt-5">
        <BusinessInfo />
      </div>
    </div>
  );
}

/** 공개 페이지(/pricing/ 등)의 틀: 돌아가기·언어·문서 탭·판매자 정보 */
export function LegalPageShell({ page }: { page: LegalPage }) {
  const t = useT();
  return (
    <main
      data-ui
      className="studio sg-legal-page min-h-dvh bg-background font-sans text-foreground"
    >
      <div className="mx-auto grid w-full max-w-[760px] gap-7 px-5 py-8 sm:py-12">
        <div className="sg-legal-top flex flex-wrap items-center justify-between gap-3">
          <a
            href={`${BASE_PATH}/`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            {t("쎈스 글리프")}
          </a>
          <span
            className="sg-legal-langs flex gap-1"
            role="group"
            aria-label="Language"
          >
            {(["ko", "ja", "en"] as const).map((lang) => (
              <Button
                key={lang}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => useLang.getState().choose(lang)}
              >
                {lang === "ko"
                  ? "한국어"
                  : lang === "ja"
                    ? "日本語"
                    : "English"}
              </Button>
            ))}
          </span>
        </div>
        <LegalNav current={page} />
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <LegalDocument page={page} headingLevel={1} />
        </div>
        <BusinessInfo />
      </div>
    </main>
  );
}
