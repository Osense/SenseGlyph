"use client";
// 첫 화면: 쎈스 글리프의 좋은 점을 배경에 띄우고, 가운데 로그인 창.
// 목업: 어떤 값을 넣어도 들어가고, '로그인 없이 시작하기'로 바로 입장할 수 있다.
import { useState } from "react";
import { useAccount } from "../lib/account";
import { useLang, useT } from "../lib/i18n";
import { APP_VERSION, MAKER } from "../lib/version";

const BENEFITS = [
  {
    head: "만 천 자 대신, 백몇십 자",
    body: "손글씨 폰트 하나에 11,000자 넘게 쓰던 시간은 이제 그만. 자모를 나눠 몇 글자만 쓰면, 나머지 현대 한글은 조합이 채워요.",
  },
  {
    head: "스캔도, 한 글자씩 다듬기도 없이",
    body: "종이에 쓰고, 스캔하고, 글자마다 윤곽을 손보던 긴 밤이 사라져요. 태블릿에 펜을 대는 순간 바로 글자가 돼요.",
  },
  {
    head: "써서 받기까지, 가장 짧은 길",
    body: "작업 시간만 놓고 보면 손글씨 폰트를 만드는 가장 빠른 방법일 거예요. 한 달이 걸리던 일이 한나절이면 끝나요.",
  },
  {
    head: "완벽하진 않아도, 나머진 정돈이",
    body: "조합한 글자가 한 자씩 그린 것만큼 완벽할 순 없어요. 대신 기울기·떨림·자모 균형을 다듬는 후처리가 그 틈을 조용히 메워요.",
  },
  {
    head: "바로 쓰는 폰트 파일",
    body: "TTF·OTF·웹폰트, 굵기 3종까지 한 번에. 한글·日本語·English 무엇이든 내 글씨로 내보내요.",
  },
  {
    head: "어디에 써도, 내 목소리 그대로",
    body: "똑같은 기본 글꼴 사이에서 단 하나뿐인 표정. 사람 냄새 나는 글씨는 보는 사람의 마음을 먼저 붙잡아요.",
  },
];

/** 손글씨 폰트가 빛나는 곳 */
const USES = [
  ["웹 디자인", "화면에 체온을 더해요"],
  ["가게 운영", "메뉴판과 간판에 주인장의 손맛"],
  ["브랜딩", "로고와 패키지에 하나뿐인 얼굴"],
  ["예술 창작", "작품 캡션까지 작가의 획으로"],
  ["영상·SNS", "자막이 목소리처럼 들려요"],
  ["출판·그림책", "책장마다 쓴 사람의 숨결"],
  ["교실", "선생님 글씨 그대로 학습지"],
  ["편지·청첩장", "인쇄해도 마음은 손글씨"],
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
        <div className="sg-login-hero">
          <p>{t("펜 끝의 버릇까지,\n그대로 폰트가 됩니다.")}</p>
          <small>
            {t(
              "만 자를 쓰고, 스캔하고, 한 글자씩 다듬던 몇 주를 — 태블릿 하나로, 한나절에.",
            )}
          </small>
        </div>
        <ul className="sg-login-benefits">
          {BENEFITS.map((b) => (
            <li key={b.head}>
              <strong>{t(b.head)}</strong>
              <span>{t(b.body)}</span>
            </li>
          ))}
        </ul>
        {[USES.slice(0, 4), USES.slice(4)].map((group, index) => (
          <ul key={index} className="sg-login-uses">
            {group.map(([field, line]) => (
              <li key={field}>
                <b>{t(field)}</b>
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
        ))}
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
