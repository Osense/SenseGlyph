// 처음 여는 동안 보이는 화면. 정적 HTML 에 그대로 들어가므로 자바스크립트가 늦게 뜨는
// 느린 기기에서도 CSS 애니메이션만으로 움직인다(손으로 ㅆ 을 쓰는 아이콘 + 흐르는 막대 + 바뀌는 문구).
import { useT } from "../lib/i18n";
import { CREDIT } from "../lib/version";

/** 파비콘과 같은 손글씨 ㅆ 획 */
const STROKES = [
  "M9.5 44.5c3.6-4.2 6.8-10.2 9.3-19.4",
  "M18.6 26c1.9 6.6 5.2 12.9 9.8 18.4",
  "M35.2 44.6c3.5-4.6 6.5-10.6 8.8-19.7",
  "M44 25.4c2 6.8 5.6 13.2 10.4 18.6",
];

const LINES = [
  "종이를 펴는 중",
  "붓을 고르는 중",
  "견본 글꼴을 펼치는 중",
  "쓴 글씨를 불러오는 중",
];

export default function LoadingScreen() {
  const t = useT();
  return (
    <main
      data-ui
      className="sg-loading fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-background px-6 text-foreground"
      aria-busy="true"
    >
      {/* 은은한 붉은 빛 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[min(120vw,760px)] -translate-x-1/2 -translate-y-[58%] rounded-full bg-[radial-gradient(circle_at_40%_45%,color-mix(in_oklch,var(--accent)_18%,transparent)_0%,transparent_55%),radial-gradient(circle_at_62%_58%,color-mix(in_oklch,var(--accent-2)_16%,transparent)_0%,transparent_55%)] motion-safe:animate-[sg-breathe_3.2s_ease-in-out_infinite]"
      />
      <div className="relative grid w-[min(400px,100%)] justify-items-center gap-8">
        <div className="relative motion-safe:animate-[sg-float_3.2s_ease-in-out_infinite]">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[34px] ring-2 ring-[color-mix(in_oklch,var(--accent)_45%,transparent)] motion-safe:animate-[sg-ring_3.2s_ease-out_infinite]"
          />
          <svg
            viewBox="0 0 64 64"
            className="relative block size-[clamp(132px,34vw,172px)] drop-shadow-[0_18px_30px_oklch(0.2_0.03_270/0.3)]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="sg-load-grad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#7C5CF0" />
                <stop offset="1" stopColor="#38BCD8" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="15" fill="url(#sg-load-grad)" />
            <rect
              x="1"
              y="1"
              width="62"
              height="62"
              rx="14"
              fill="none"
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth="2"
            />
            {STROKES.map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="sg-loading-stroke"
                style={{ animationDelay: `${i * 0.32}s` }}
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5.6"
              />
            ))}
            <circle
              cx="51.5"
              cy="14"
              r="3.4"
              fill="#ff6b6b"
              className="sg-loading-dot"
            />
          </svg>
        </div>

        <div className="grid justify-items-center gap-1.5 text-center">
          <p className="m-0 text-[14px] font-semibold text-muted-foreground">
            WSNS studio{" "}
            <span className="text-brand-grad font-bold">
              [웨스엔에스 스튜디오]
            </span>
          </p>
          <h1 className="m-0 text-[clamp(30px,8vw,40px)] leading-tight font-bold tracking-[-0.03em]">
            {t("쎈스 글리프")}
          </h1>
        </div>

        <div className="grid w-full gap-3">
          <div
            className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("쎈스 글리프를 여는 중…")}
          >
            <span className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-[linear-gradient(90deg,transparent,var(--accent)_35%,var(--accent-2)_70%,transparent)] motion-safe:animate-[sg-sweep_1.6s_cubic-bezier(.6,0,.3,1)_infinite] motion-reduce:w-full motion-reduce:bg-primary/60" />
          </div>
          <div className="relative h-7 w-full text-center text-[16px] font-medium text-foreground/85">
            <span className="sr-only">{t("쎈스 글리프를 여는 중…")}</span>
            {LINES.map((line, i) => (
              <span
                key={line}
                aria-hidden="true"
                className={
                  "sg-loading-line absolute inset-0" +
                  (i === 0 ? " is-first" : "")
                }
                style={{ animationDelay: `${i * 2.4}s` }}
              >
                {t(line)}
                <span className="sg-loading-dots" />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="sg-credit absolute inset-x-0 bottom-6 m-0 text-center font-mono text-[11px] text-dim">
        {CREDIT}
      </p>
    </main>
  );
}
