"use client";
// 개인정보 처리방침. 앱 안의 안내 창과 /privacy 페이지가 같은 내용을 쓴다(LegalDocument).
// 수집 범위가 바뀌면 lib/analytics.ts 와 이 안내를 함께 고친다.
import { useLang, type UiLang } from "../lib/i18n";
import { APP_VERSION, MAKER } from "../lib/version";

export const LEGAL_UPDATED = "2026-11-15";

type Section = { title: string; items: string[] };

const KO: { title: string; intro: string; sections: Section[] } = {
  title: "개인정보 처리방침",
  intro:
    "쎈스 글리프는 회원 가입이 없고, 이름·이메일·연락처 같은 개인정보를 받지 않아요. 아래는 이 서비스가 처리하는 정보의 범위와 목적이에요. 이용 조건은 이용약관을, 결제와 환불은 가격 안내와 환불 규정을 확인해 주세요.",
  sections: [
    {
      title: "1. 손글씨와 폰트",
      items: [
        "쓴 글씨, 만든 폰트, 프로젝트 설정은 모두 이 기기(브라우저 저장소 또는 앱 저장소)에만 저장돼요. 서버로 보내지 않아요.",
        "폰트를 만드는 계산도 이 기기 안에서 해요.",
        "지우려면 ‘내 폰트’에서 프로젝트를 삭제하거나, 브라우저의 사이트 데이터를 지우거나, 앱을 삭제하면 돼요.",
      ],
    },
    {
      title: "2. 방문 집계",
      items: [
        "목적: 서비스를 몇 번, 몇 대의 기기에서 쓰는지 파악해 개선하는 데 써요.",
        "항목: ① 앱을 연 횟수(같은 창에서는 한 번만) ② 이 기기의 첫 방문 여부(방문자 수) ③ 폰트를 내려받거나 공유한 횟수. 모두 누적 숫자로만 남아요.",
        "보내지 않는 것: 글씨, 폰트, 이름, 프로젝트 내용, 기기 고유 번호는 보내지 않아요. 쿠키를 쓰지 않아요.",
        "중복 집계를 막는 표시(‘이미 셌음’)만 이 기기 저장소에 남겨요.",
        "처리 방식: 외부 무료 집계 서비스 Abacus(abacus.jasoncameron.dev)의 숫자를 1씩 올리는 요청을 보내요. 요청이 오가는 과정에서 그 서비스가 접속 IP 주소와 브라우저 정보를 일시적으로 받을 수 있어요. 쎈스 글리프는 이 정보를 받거나 보관하지 않아요.",
        "보관 기간: 누적 숫자는 서비스를 운영하는 동안 보관해요.",
        "거부: 설정 → ‘방문 집계 보내지 않기’를 켜면 그 뒤로 아무것도 보내지 않아요. 집계를 꺼도 모든 기능을 그대로 쓸 수 있어요.",
      ],
    },
    {
      title: "3. 웹사이트 호스팅",
      items: [
        "웹 버전은 GitHub Pages에서 제공돼요. GitHub가 보안과 운영을 위해 접속 기록(IP 주소 등)을 처리할 수 있으며, 이는 GitHub 개인정보처리방침을 따라요. 안드로이드 앱은 파일을 앱 안에 담고 있어 해당하지 않아요.",
      ],
    },
    {
      title: "4. 견본 글꼴과 라이선스",
      items: [
        "쓰지 않은 글자는 고른 견본 글꼴의 모양으로 채워져요. 견본 글꼴(G마켓 산스, 나눔명조, 검은고딕, 산돌 삼립호빵체, 학교안심 분필·붓펜, 갈무리11, Noto Sans KR, Klee One, Zen Maru Gothic, Yomogi 등)은 SIL 오픈 폰트 라이선스(OFL) 1.1을 따르며 저작권은 각 제작자에게 있어요.",
        "견본 글꼴로 채운 글자가 들어간 폰트를 남에게 나눠 주거나 판매할 때는 OFL 조건(같은 라이선스로 배포, 예약된 글꼴 이름 사용 금지 등)을 지켜 주세요. 폰트 파일 안과 ZIP 묶음에 이 내용을 함께 넣어 두었어요.",
      ],
    },
    {
      title: "5. 만든 폰트의 권리",
      items: [
        "직접 쓴 글자의 모양에 대한 권리는 쓴 사람에게 있어요. 쎈스 글리프는 만든 폰트에 대한 권리를 주장하지 않아요.",
        "다른 사람의 글씨나 저작물을 허락 없이 따라 써서 폰트로 배포하지 마세요.",
      ],
    },
    {
      title: "6. 베타 서비스",
      items: [
        "지금은 무료 베타 버전이에요. 결과물의 품질이나 특정 프로그램에서의 호환을 보장하지 않으며, 기능과 안내는 바뀔 수 있어요. 중요한 작업은 설정 → JSON 내보내기로 백업해 두세요.",
        "이 안내가 바뀌면 앱 안에서 알려 드려요.",
      ],
    },
    {
      title: "7. 문의",
      items: [
        "운영과 개인정보 보호책임자: OSNS.studio 운영자. 문의는 osns.studio@gmail.com 으로 보내 주세요.",
        "로그인 기능을 연 뒤에는 계정에 저장된 정보의 열람·정정·삭제·처리 정지를 언제든 요청할 수 있어요.",
        "개인정보 침해가 걱정되면 개인정보침해신고센터(국번 없이 118, privacy.kisa.or.kr)에도 신고하거나 상담할 수 있어요.",
      ],
    },
    {
      title: "8. 로그인·결제를 시작하면 바뀌는 점 (예정)",
      items: [
        "아래 내용은 계정·결제 기능을 열 때부터 적용돼요. 열기 전에 이 방침을 고쳐 앱 안에서 알리고, 처음 로그인할 때 동의를 받아요.",
        "수집 항목: 로그인한 서비스(구글·카카오·네이버)가 주는 회원 식별 번호·이메일·별명, 쓴 손글씨 데이터와 폰트 이름, 결제 기록(주문 번호·상품·금액·결제 일시·결제 수단 종류). 카드 번호는 결제대행사가 처리하고 쎈스 글리프는 받지 않아요.",
        "목적: 로그인, 다른 기기에서 이어 쓰기와 다시 받기, 폰트 이름 중복 방지, 결제 확인과 환불 처리",
        "보관 기간: 탈퇴하면 바로 지워요. 다만 전자상거래법에 따라 계약·청약 철회 기록과 대금 결제 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년 동안 따로 보관해요.",
        "처리 위탁과 국외 이전: 계정과 데이터 저장은 Google LLC(Firebase)에, 결제는 결제대행사에 맡길 예정이에요. 로그인 처리 과정에서 정보가 미국 등 국외 서버를 거칠 수 있어요. 맡기는 업체·국가·항목·기간은 기능을 열 때 이 방침에 적어요.",
        "만 14세 미만 아동이 로그인하려면 법정대리인의 동의가 필요해요. 로그인하지 않으면 지금처럼 이 기기 안에서만 쓸 수 있어요.",
      ],
    },
  ],
};

const JA: typeof KO = {
  title: "プライバシーポリシー",
  intro:
    "SenseGlyph には会員登録がなく、名前・メールアドレス・連絡先などの個人情報をお預かりしません。以下は、このサービスが扱う情報の範囲と目的です。ご利用条件は利用規約を、お支払いと返金は料金のご案内と返金ポリシーをご覧ください。",
  sections: [
    {
      title: "1. 手書き文字とフォント",
      items: [
        "書いた文字、作ったフォント、プロジェクトの設定は、すべてこの端末（ブラウザまたはアプリの保存領域）にだけ保存されます。サーバーには送りません。",
        "フォントを作る計算も、この端末の中で行います。",
        "消すときは「マイフォント」でプロジェクトを削除するか、ブラウザのサイトデータを消去するか、アプリを削除してください。",
      ],
    },
    {
      title: "2. 訪問の集計",
      items: [
        "目的：何回・何台の端末で使われているかを把握し、改善に役立てます。",
        "項目：① アプリを開いた回数（同じウィンドウでは1回だけ） ② この端末での初回訪問かどうか（訪問者数） ③ フォントをダウンロード・共有した回数。いずれも累計の数字としてだけ残ります。",
        "送らないもの：文字、フォント、名前、プロジェクトの内容、端末固有の番号は送りません。Cookie は使いません。",
        "重複カウントを防ぐための目印（「カウント済み」）だけを、この端末の保存領域に残します。",
        "処理方法：外部の無料集計サービス Abacus（abacus.jasoncameron.dev）の数字を1つ増やすリクエストを送ります。通信の過程で、同サービスが接続元の IP アドレスやブラウザ情報を一時的に受け取ることがあります。SenseGlyph はこれらの情報を受け取らず、保存もしません。",
        "保存期間：累計の数字はサービスを運営している間、保存します。",
        "拒否：設定 →「訪問の集計を送らない」をオンにすると、以後は何も送りません。オフにしてもすべての機能をそのまま使えます。",
      ],
    },
    {
      title: "3. ウェブサイトのホスティング",
      items: [
        "ウェブ版は GitHub Pages で提供しています。GitHub がセキュリティと運営のために接続記録（IP アドレスなど）を処理することがあり、これは GitHub のプライバシーポリシーに従います。Android アプリはファイルをアプリ内に持っているため該当しません。",
      ],
    },
    {
      title: "4. 見本フォントとライセンス",
      items: [
        "書かなかった文字は、選んだ見本フォントの形で補われます。見本フォント（Klee One、Zen Maru Gothic、Yomogi、Noto Sans KR、Gmarket Sans、Nanum Myeongjo ほか）は SIL Open Font License（OFL）1.1 に従い、著作権は各制作者にあります。",
        "見本フォントで補った文字を含むフォントを配布・販売するときは、OFL の条件（同じライセンスで配布する、予約フォント名を使わないなど）を守ってください。フォントファイルと ZIP にもこの内容を入れてあります。",
      ],
    },
    {
      title: "5. 作ったフォントの権利",
      items: [
        "自分で書いた文字の形に関する権利は、書いた人にあります。SenseGlyph は作られたフォントの権利を主張しません。",
        "他人の筆跡や著作物を許可なくなぞってフォントとして配布しないでください。",
      ],
    },
    {
      title: "6. ベータ版について",
      items: [
        "現在は無料のベータ版です。仕上がりの品質や特定のソフトでの互換性は保証しません。機能や案内は変わることがあります。大切な作業は 設定 → JSON 書き出し でバックアップしてください。",
        "この案内が変わったときは、アプリ内でお知らせします。",
      ],
    },
    {
      title: "7. お問い合わせ",
      items: [
        "運営と個人情報保護責任者：OSNS.studio の運営者。お問い合わせは osns.studio@gmail.com までお送りください。",
        "ログイン機能の提供開始後は、アカウントに保存された情報の閲覧・訂正・削除・処理停止をいつでも求めることができます。",
        "韓国の個人情報侵害申告センター（118、privacy.kisa.or.kr）に申告・相談することもできます。",
      ],
    },
    {
      title: "8. ログイン・お支払いの開始後に変わる点（予定）",
      items: [
        "以下は、アカウント・決済機能を提供し始めたときから適用されます。提供前にこのポリシーを改定してアプリ内でお知らせし、最初のログイン時に同意をいただきます。",
        "収集項目：ログインに使うサービス（Google・カカオ・ネイバー）から受け取る会員識別番号・メールアドレス・ニックネーム、書いた手書きデータとフォント名、決済記録（注文番号・商品・金額・決済日時・決済手段の種類）。カード番号は決済代行会社が処理し、SenseGlyph は受け取りません。",
        "目的：ログイン、別の端末での続きの作業と再ダウンロード、フォント名の重複防止、決済の確認と返金処理",
        "保存期間：退会するとすぐに削除します。ただし韓国の電子商取引法により、契約・申込み撤回の記録と代金決済の記録は5年、消費者の苦情・紛争処理の記録は3年、別途保存します。",
        "処理の委託と国外移転：アカウントとデータの保存は Google LLC（Firebase）に、決済は決済代行会社に委託する予定です。ログイン処理の過程で、情報が米国などの国外サーバーを経由することがあります。委託先・国・項目・期間は、機能の提供開始時にこのポリシーに記載します。",
        "14歳未満の方がログインするには、法定代理人の同意が必要です。ログインしなければ、これまでどおりこの端末の中だけで使えます。",
      ],
    },
  ],
};

const EN: typeof KO = {
  title: "Privacy Policy",
  intro:
    "SenseGlyph has no sign-up and never asks for personal information such as your name, email, or phone number. This page explains what information the service handles and why. See the Terms of Service for conditions of use, and the Pricing page and Refund Policy for payments and refunds.",
  sections: [
    {
      title: "1. Your handwriting and fonts",
      items: [
        "Your handwriting, the fonts you make, and project settings are stored only on this device (browser or app storage). Nothing is uploaded to a server.",
        "Fonts are built on this device as well.",
        "To delete them, remove the project in “My fonts”, clear this site’s data in your browser, or uninstall the app.",
      ],
    },
    {
      title: "2. Visit counting",
      items: [
        "Purpose: to understand how often and on how many devices the service is used, so we can improve it.",
        "What is counted: (1) times the app is opened (once per window), (2) whether this is the device’s first visit (number of visitors), (3) times a font is downloaded or shared. Only running totals are kept.",
        "Never sent: your handwriting, fonts, names, project contents, or device identifiers. No cookies are used.",
        "Only a small marker (“already counted”) is kept in this device’s storage to avoid double counting.",
        "How: the app sends a request that adds 1 to a counter on Abacus (abacus.jasoncameron.dev), a free third-party counting service. In handling the request, that service may briefly receive your IP address and browser information. SenseGlyph never receives or stores this information.",
        "Retention: totals are kept while the service is operated.",
        "Opting out: turn on Settings → “Don’t send visit counts”. Nothing is sent after that, and every feature keeps working.",
      ],
    },
    {
      title: "3. Website hosting",
      items: [
        "The web version is hosted on GitHub Pages. GitHub may process access logs (such as IP addresses) for security and operations under the GitHub Privacy Statement. The Android app bundles its files and is not affected.",
      ],
    },
    {
      title: "4. Sample fonts and licenses",
      items: [
        "Characters you did not write are filled in with the chosen sample font. The sample fonts (Gmarket Sans, Nanum Myeongjo, Black Han Sans, Samlip Hobbang, School Safety Chalk and Brush Pen, Galmuri11, Noto Sans KR, Klee One, Zen Maru Gothic, Yomogi and others) are licensed under the SIL Open Font License (OFL) 1.1; copyright belongs to their authors.",
        "If you share or sell a font that contains filled-in sample glyphs, please follow the OFL (distribute under the same license, do not use Reserved Font Names, etc.). This notice is also included in the font file and ZIP downloads.",
      ],
    },
    {
      title: "5. Rights to your font",
      items: [
        "The rights to the shapes of characters you wrote belong to you. SenseGlyph claims no rights to the fonts you make.",
        "Do not trace someone else’s handwriting or copyrighted work and distribute it as a font without permission.",
      ],
    },
    {
      title: "6. Beta service",
      items: [
        "This is a free beta. Output quality and compatibility with specific software are not guaranteed, and features and this notice may change. Back up important work with Settings → Export JSON.",
        "We will let you know in the app if this notice changes.",
      ],
    },
    {
      title: "7. Contact",
      items: [
        "Operator and privacy officer: the operator of OSNS.studio. Contact us at osns.studio@gmail.com.",
        "Once sign-in is available, you can ask at any time to view, correct, delete or stop the processing of information stored in your account.",
        "You can also report or consult the Korea Personal Information Infringement Report Center (118, privacy.kisa.or.kr).",
      ],
    },
    {
      title: "8. What changes when sign-in and payments start (planned)",
      items: [
        "The following applies from the moment account and payment features open. Before then, we will update this policy, announce it in the app, and ask for your consent when you first sign in.",
        "Collected: the member ID, email and nickname provided by the sign-in service (Google, Kakao, Naver); your handwriting data and font names; payment records (order number, product, amount, payment time, type of payment method). Card numbers are handled by the payment gateway and never received by SenseGlyph.",
        "Purpose: sign-in, continuing work and re-downloading on other devices, preventing duplicate font names, confirming payments and processing refunds.",
        "Retention: deleted as soon as you close your account, except that, under Korea's e-commerce law, contract and withdrawal records and payment records are kept separately for 5 years, and complaint and dispute records for 3 years.",
        "Outsourcing and transfers abroad: we plan to entrust account and data storage to Google LLC (Firebase) and payments to a payment gateway. Sign-in may pass information through servers abroad, such as in the United States. The companies, countries, items and periods will be listed here when the features open.",
        "Children under 14 need a legal guardian's consent to sign in. Without signing in, the service keeps working only on this device, as it does now.",
      ],
    },
  ],
};

const TEXTS: Record<UiLang, typeof KO> = { ko: KO, ja: JA, en: EN };
const UPDATED: Record<UiLang, string> = {
  ko: "시행일",
  ja: "施行日",
  en: "Effective",
};

export default function LegalNotice({
  headingLevel = 2,
}: {
  headingLevel?: 1 | 2;
}) {
  const lang = useLang((state) => state.lang);
  const text = TEXTS[lang];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <article
      data-ui
      className="sg-legal grid gap-5 text-foreground [&_a]:text-primary"
      lang={lang}
    >
      <Heading className="m-0 font-serif text-[28px] leading-tight font-normal tracking-[-0.02em]">
        {text.title}
      </Heading>
      <p className="sg-legal-meta m-0 font-mono text-[11px] text-dim">
        {UPDATED[lang]} {LEGAL_UPDATED} · v{APP_VERSION} · {MAKER}
      </p>
      <p className="m-0 font-serif text-[15px] leading-[1.8] text-foreground/85">
        {text.intro}
      </p>
      {text.sections.map((section) => (
        <section key={section.title} className="grid gap-2">
          <h3 className="m-0 text-[15px] font-semibold">{section.title}</h3>
          <ul className="m-0 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed text-muted-foreground marker:text-primary/60">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
