"use client";
// 공개 안내 페이지(/privacy/): 앱 마켓 등록 등에 쓰는 개인정보 처리방침 주소.
import { useEffect } from "react";
import LegalNotice from "../../components/LegalNotice";
import { useLang, useT } from "../../lib/i18n";

export default function PrivacyPage() {
  const t = useT();
  useEffect(() => useLang.getState().detect(), []);
  return (
    <main className="studio sg-legal-page">
      <div className="sg-legal-top">
        <a href="../">← {t("쎈스 글리프")}</a>
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
      <LegalNotice headingLevel={1} />
    </main>
  );
}
