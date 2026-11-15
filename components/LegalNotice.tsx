"use client";
// 개인정보 처리·이용 안내. 앱 안의 창과 /privacy 페이지가 같은 내용을 쓴다.
// 수집 범위가 바뀌면 lib/analytics.ts 와 이 안내를 함께 고친다.
import { useLang, type UiLang } from "../lib/i18n";
import { APP_VERSION, MAKER } from "../lib/version";

export const LEGAL_UPDATED = "2026-11-15";
const CONTACT = "https://osns.studio/";

type Section = { title: string; items: string[] };

const KO: { title: string; intro: string; sections: Section[] } = {
  title: "개인정보 처리 및 이용 안내",
  intro:
    "쎈스 글리프는 회원 가입이 없고, 이름·이메일·연락처 같은 개인정보를 받지 않아요. 아래는 이 서비스가 처리하는 정보의 범위와 목적이에요.",
  sections: [
    {
      title: "1. 손글씨와 폰트",
      items: [
        "쓴 글씨, 만든 폰트, 프로젝트 설정은 모두 이 기기(브라우저 저장소 또는 앱 저장소)에만 저장돼요. 서버로 보내지 않아요.",
        "폰트를 만드는 계산도 이 기기 안에서 해요.",
        "지우려면 ‘내 폰트’에서 프로젝트를 삭제하거나, 브라우저의 사이트 데이터를 지우거나, 앱을 삭제하면 돼요.",
        "로그인 화면(계정 기능 준비 중)에 넣은 이메일은 이 기기에만 저장되고 어디로도 보내지 않아요. 비밀번호는 저장하지 않아요.",
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
        "운영: OSNS.studio · 문의는 osns.studio 웹사이트의 연락 방법을 이용해 주세요.",
      ],
    },
  ],
};

const JA: typeof KO = {
  title: "個人情報の取り扱いとご利用案内",
  intro:
    "SenseGlyph には会員登録がなく、名前・メールアドレス・連絡先などの個人情報をお預かりしません。以下は、このサービスが扱う情報の範囲と目的です。",
  sections: [
    {
      title: "1. 手書き文字とフォント",
      items: [
        "書いた文字、作ったフォント、プロジェクトの設定は、すべてこの端末（ブラウザまたはアプリの保存領域）にだけ保存されます。サーバーには送りません。",
        "フォントを作る計算も、この端末の中で行います。",
        "消すときは「マイフォント」でプロジェクトを削除するか、ブラウザのサイトデータを消去するか、アプリを削除してください。",
        "ログイン画面（アカウント機能は準備中）で入力したメールアドレスはこの端末にだけ保存され、どこにも送りません。パスワードは保存しません。",
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
        "運営：OSNS.studio・お問い合わせは osns.studio ウェブサイトの連絡方法をご利用ください。",
      ],
    },
  ],
};

const EN: typeof KO = {
  title: "Privacy and Terms of Use",
  intro:
    "SenseGlyph has no sign-up and never asks for personal information such as your name, email, or phone number. This page explains what information the service handles and why.",
  sections: [
    {
      title: "1. Your handwriting and fonts",
      items: [
        "Your handwriting, the fonts you make, and project settings are stored only on this device (browser or app storage). Nothing is uploaded to a server.",
        "Fonts are built on this device as well.",
        "To delete them, remove the project in “My fonts”, clear this site’s data in your browser, or uninstall the app.",
        "An email typed on the sign-in screen (accounts are coming soon) is kept only on this device and sent nowhere. Passwords are never stored.",
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
        "Operated by OSNS.studio. Please use the contact options on the osns.studio website.",
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
    <article className="sg-legal" lang={lang}>
      <Heading>{text.title}</Heading>
      <p className="sg-legal-meta">
        {UPDATED[lang]} {LEGAL_UPDATED} · v{APP_VERSION} · {MAKER}
      </p>
      <p>{text.intro}</p>
      {text.sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        <a href={CONTACT} target="_blank" rel="noreferrer">
          osns.studio
        </a>
      </p>
    </article>
  );
}
