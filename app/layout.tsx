import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./font-workshop.css";
import "./editor.css";
import "./workspace.css";
import "./journey.css";
import "./touch.css";
import "./mobile.css";
import "./canvas-navigation.css";
import "./paper-workspace.css";
import "./studio.css";
import "./osns.css";
import { BASE_PATH } from "../lib/base-path";
import { REFERENCE_FONTS } from "../lib/reference-fonts";

// Bundled reference fonts. Declared here (not in CSS) so their URLs follow the
// deployment base path.
const FONT_FACES = `
@font-face {
  font-family: "Noto Serif KR";
  src: url("${BASE_PATH}/fonts/NotoSerifKR.ttf") format("truetype");
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Noto Sans KR";
  src: url("${BASE_PATH}/fonts/NotoSansKR.ttf") format("truetype");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: "Special Symbols Fallback";
  src: url("${BASE_PATH}/fonts/SpecialSymbolsFallback.ttf") format("truetype");
  font-display: swap;
}
${REFERENCE_FONTS.map(({ family, file }) => {
  const format = file.endsWith(".ttf") ? "truetype" : file.split(".").at(-1);
  return `
@font-face {
  font-family: "${family}";
  src: url("${BASE_PATH}/fonts/${file}") format("${format}");
  font-display: swap;
}
`;
}).join("")}
`;
const title = "쎈스 글리프 — 손글씨 폰트 작업실";
const description =
  "직접 쓴 손글씨의 자모와 간격을 다듬어 나만의 한글 폰트를 만드세요. OSNS.studio 제작.";
const siteUrl = "https://osense.github.io/SenseGlyph/";
const shareImage = {
  url: new URL("senseglyph-share.png", siteUrl).href,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "쎈스 글리프. 손글씨를 써서 나만의 한글 폰트로. OSNS.studio 제작.",
};

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: [
      {
        url: `${BASE_PATH}/brand-icon-32.png`,
        type: "image/png",
        sizes: "32x32",
      },
      { url: `${BASE_PATH}/brand-icon.svg`, type: "image/svg+xml" },
    ],
    apple: [{ url: `${BASE_PATH}/apple-touch-icon.png`, sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "쎈스 글리프",
    url: siteUrl,
    title,
    description,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage],
  },
};
// 안드로이드 크롬 등은 휴대폰이 다크 모드면 페이지를 강제로 어둡게 칠한다(자동 다크).
// 앱이 밝은/어두운 화면을 직접 고르므로, 기본은 '밝은 화면만'이라고 알려 강제 어둡게를 막는다.
export const viewport: Viewport = {
  themeColor: "#f7f1ef",
  colorScheme: "only light",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" style={{ colorScheme: "only light" }}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
