"use client";
// 첫 화면: 쎈스 글리프의 좋은 점을 배경에 띄우고, 가운데 로그인 창.
// 목업: 어떤 값을 넣어도 들어가고, '로그인 없이 시작하기'로 바로 입장할 수 있다.
import { useState } from "react";
import { useAccount } from "../lib/account";
import { useLang, useT } from "../lib/i18n";
import { APP_VERSION, MAKER } from "../lib/version";

const BENEFITS = [
  {
    head: "138자만 쓰면 11,172자",
    body: "자모를 나눠 조합해서 현대 한글 전부를 내 글씨로 채워요.",
  },
  {
    head: "태블릿과 펜이면 충분해요",
    body: "설치도 스캔도 없이, 브라우저에서 바로 써요.",
  },
  {
    head: "삐뚤어도 그럴싸하게",
    body: "기울기·떨림·자모 균형을 원하는 만큼만 정돈해요.",
  },
  {
    head: "바로 쓰는 폰트 파일",
    body: "TTF·OTF·웹폰트, 굵기 3종까지 한 번에 내보내요.",
  },
  {
    head: "한글 · 日本語 · English",
    body: "만들 글자를 고르면 그 언어의 폰트가 돼요.",
  },
  {
    head: "글씨는 이 기기 안에서",
    body: "쓴 글씨와 폰트는 서버로 보내지 않아요.",
  },
];

export default function LoginScreen() {
  const t = useT();
  const lang = useLang((state) => state.lang);
  const signIn = useAccount((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="sg-login" lang={lang}>
      <div className="sg-login-bg" aria-hidden="true">
        <p className="sg-login-hero">
          {t("내 손으로 쓴 한 획이,\n나만의 폰트가 됩니다.")}
        </p>
        <ul className="sg-login-benefits">
          {BENEFITS.map((b) => (
            <li key={b.head}>
              <strong>{t(b.head)}</strong>
              <span>{t(b.body)}</span>
            </li>
          ))}
        </ul>
        <span className="sg-login-glyphs">가 あ A 永 한</span>
      </div>
      <form
        className="sg-login-card"
        aria-labelledby="sg-login-title"
        onSubmit={(event) => {
          event.preventDefault();
          signIn("email", email);
        }}
      >
        <div className="sg-login-brand">
          <b>OSNS</b> <span>studio</span> / {t("쎈스 글리프")}
        </div>
        <h1 id="sg-login-title">{t("로그인")}</h1>
        <p className="sg-login-sub">
          {t(
            "로그인하면 쓴 글씨를 계정에 저장해 다른 기기에서도 이어서 쓸 수 있어요.",
          )}
        </p>
        <label>
          <span>{t("이메일")}</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          <span>{t("비밀번호")}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="sg-login-primary">
          {t("로그인")}
        </button>
        <div className="sg-login-or">
          <span>{t("또는")}</span>
        </div>
        <button type="button" onClick={() => signIn("google")}>
          {t("Google로 계속하기")}
        </button>
        <button type="button" onClick={() => signIn("kakao")}>
          {t("카카오로 계속하기")}
        </button>
        <button
          type="button"
          className="sg-login-guest"
          onClick={() => signIn("guest")}
        >
          {t("로그인 없이 시작하기 →")}
        </button>
        <p className="sg-login-note">
          {t(
            "베타 기간에는 로그인 없이도 모든 기능을 쓸 수 있어요. 계정 저장은 준비 중이라, 지금은 어떤 값을 넣어도 이 기기에서만 들어가져요.",
          )}
        </p>
        <p className="sg-login-credit">
          {t("{maker} 제작", { maker: MAKER })} · v{APP_VERSION}
        </p>
      </form>
    </div>
  );
}
