"use client";
// 첫 화면: 쎈스 글리프의 좋은 점을 배경에 띄우고, 가운데 로그인 창.
// 목업: 구글·카카오·네이버 버튼은 아직 이 기기 안에서만 들어가고, '로그인 없이 시작하기'로 바로 입장할 수 있다.
// 자체 계정(이메일·비밀번호)은 만들지 않는다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BASE_PATH } from "../lib/base-path";
import { legalHref } from "./LegalDocument";
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

/** 좁은 화면(휴대폰 세로 등)에서 배경 문구 대신 한 장씩 넘어가는 소개 */
function PitchSlides() {
  const t = useT();
  const slides: { head: string; body: ReactNode; accent?: boolean }[] = [
    {
      head: t("만든 폰트의 라이선스, 전부 당신의 것."),
      body: t(
        "가게 간판에도, 유튜브 자막에도, 판매하는 굿즈에도. 사용료도 출처 표기도 묻지 않아요.",
      ),
      accent: true,
    },
    ...BENEFITS.map((b) => ({ head: t(b.head), body: t(b.body) })),
    ...[USES.slice(0, 4), USES.slice(4)].map((group) => ({
      head: t("내 글씨가 빛나는 곳"),
      body: (
        <span className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {group.map(([field, line]) => (
            <span key={field} className="grid leading-snug">
              <b className="text-[12.5px] font-semibold text-primary">
                {t(field)}
              </b>
              <span className="text-[12px]">{t(line)}</span>
            </span>
          ))}
        </span>
      ),
    })),
  ];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % slides.length),
      4200,
    );
    return () => clearTimeout(timer);
  }, [index, paused, slides.length]);
  const go = (step: number) => {
    setPaused(true);
    setIndex((i) => (i + step + slides.length) % slides.length);
  };
  return (
    <div
      data-ui
      className="sg-login-slides grid w-full gap-2.5"
      aria-roledescription="carousel"
      aria-label={t("쎈스 글리프 소개")}
      onTouchStart={(event) => {
        touch.current = event.touches[0].clientX;
      }}
      onTouchEnd={(event) => {
        if (touch.current === null) return;
        const dx = event.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="relative h-[118px] overflow-hidden">
        {slides.map((slide, i) => {
          const offset = (i - index + slides.length) % slides.length;
          return (
            <div
              key={i}
              aria-hidden={i !== index}
              className={cn(
                "absolute inset-0 grid content-start gap-1.5 border-l-[3px] pl-3.5 transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none",
                slide.accent ? "border-primary" : "border-primary/40",
                offset === 0
                  ? "translate-x-0 opacity-100"
                  : offset === slides.length - 1
                    ? "-translate-x-8 opacity-0"
                    : "translate-x-8 opacity-0",
              )}
            >
              <strong
                className={cn(
                  "text-[16px] leading-snug font-semibold break-keep",
                  slide.accent ? "text-primary" : "text-foreground",
                )}
              >
                {slide.head}
              </strong>
              <span className="text-[13px] leading-relaxed break-keep text-muted-foreground">
                {slide.body}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 pl-3.5" role="tablist">
        {slides.map((slide, i) => (
          <button
            key={i}
            data-ui
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${i + 1}. ${slide.head}`}
            onClick={() => {
              setPaused(true);
              setIndex(i);
            }}
            className="grid h-6 cursor-pointer place-items-center px-0.5"
          >
            <i
              className={cn(
                "block h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginScreen() {
  const t = useT();
  const lang = useLang((state) => state.lang);
  const signIn = useAccount((state) => state.signIn);
  return (
    <div
      className="sg-login max-wide:content-center-safe max-wide:gap-0"
      lang={lang}
    >
      <div className="sg-login-bg" aria-hidden="true">
        <div className="sg-login-hero max-wide:hidden">
          <p>{t("펜 끝의 버릇까지,\n그대로 폰트가 됩니다.")}</p>
          <small>
            {t(
              "만 자를 쓰고, 스캔하고, 한 글자씩 다듬던 몇 주를 — 태블릿 하나로, 한나절에.",
            )}
          </small>
          <p className="sg-login-license">
            <b>{t("만든 폰트의 라이선스, 전부 당신의 것.")}</b>
            <span>
              {t(
                "가게 간판에도, 유튜브 자막에도, 판매하는 굿즈에도. 사용료도 출처 표기도 묻지 않아요.",
              )}
            </span>
          </p>
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
      <div
        data-ui
        className="sg-login-intro relative grid w-[min(400px,100%)] gap-4 pt-2 pb-5 wide:hidden"
      >
        <div className="grid gap-2">
          <p className="m-0 text-[clamp(24px,7vw,30px)] leading-[1.25] font-bold tracking-[-0.02em] whitespace-pre-line text-foreground">
            {t("펜 끝의 버릇까지,\n그대로 폰트가 됩니다.")}
          </p>
          <small className="text-[13px] leading-relaxed break-keep text-muted-foreground">
            {t(
              "만 자를 쓰고, 스캔하고, 한 글자씩 다듬던 몇 주를 — 태블릿 하나로, 한나절에.",
            )}
          </small>
        </div>
        <PitchSlides />
      </div>
      <section
        data-ui
        className="sg-login-card relative grid w-[min(400px,100%)] gap-3 rounded-2xl border border-border bg-card px-7 pt-7 pb-5 text-card-foreground shadow-lift"
        aria-labelledby="sg-login-title"
      >
        <div className="flex items-end gap-1.5 text-[13px] text-muted-foreground">
          <img
            src={BASE_PATH + "/logo/osns-crayon.svg"}
            alt="OSNS"
            className="h-[18px] w-auto"
          />
          <i className="font-serif leading-none">studio</i>
          <span className="text-dim">/</span>
          <span className="font-medium text-foreground">
            {t("쎈스 글리프")}
          </span>
        </div>
        <div className="grid gap-1.5 pt-2 pb-1">
          <h1
            id="sg-login-title"
            className="m-0 font-serif text-[28px] leading-tight font-normal tracking-[-0.02em]"
          >
            {t("로그인")}
          </h1>
          <p className="m-0 text-[13.5px] leading-relaxed text-muted-foreground">
            {t(
              "로그인하면 쓴 글씨를 계정에 저장해 다른 기기에서도 이어서 쓸 수 있어요.",
            )}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="sg-login-primary w-full"
          onClick={() => signIn("google")}
        >
          {t("Google로 계속하기")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          className="w-full bg-[#FEE500] font-semibold text-[#191600] hover:bg-[#f5dc00]"
          onClick={() => signIn("kakao")}
        >
          {t("카카오로 계속하기")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          className="w-full bg-[#03C75A] font-semibold text-white hover:bg-[#02b350] hover:text-white"
          onClick={() => signIn("naver")}
        >
          {t("네이버로 계속하기")}
        </Button>
        <p className="m-0 text-[11.5px] leading-relaxed text-muted-foreground">
          {t(
            "계속하면 이용약관에 동의하고 개인정보 처리방침을 확인한 것으로 봐요.",
          )}{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={legalHref("terms")}
            target="_blank"
            rel="noreferrer"
          >
            {t("이용약관")}
          </a>{" "}
          ·{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={legalHref("privacy")}
            target="_blank"
            rel="noreferrer"
          >
            {t("개인정보 처리방침")}
          </a>
        </p>
        <div className="my-1 flex items-center gap-3 text-xs text-dim before:h-px before:flex-1 before:bg-divider after:h-px after:flex-1 after:bg-divider">
          {t("또는")}
        </div>
        <Button
          type="button"
          variant="soft"
          size="lg"
          className="sg-login-guest w-full"
          onClick={() => signIn("guest")}
        >
          {t("로그인 없이 시작하기")}
          <ArrowRight />
        </Button>
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          {t(
            "따로 회원가입은 없어요. 베타 기간에는 로그인 없이도 모든 기능을 쓸 수 있고, 계정 저장은 준비 중이라 지금은 이 기기에만 저장돼요.",
          )}
        </p>
        <p className="m-0 border-t border-divider pt-3 text-center font-mono text-[11px] text-dim">
          {t("{maker} 제작", { maker: MAKER })} · v{APP_VERSION}
        </p>
      </section>
    </div>
  );
}
