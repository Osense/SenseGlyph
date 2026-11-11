import type { Metadata } from "next";
import "./globals.css";
import "./font-workshop.css";
import "./editor.css";
import "./workspace.css";
import "./journey.css";
import "./touch.css";
import "./mobile.css";
import "./canvas-navigation.css";
import "./paper-workspace.css";
import { BASE_PATH } from "../lib/base-path";

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
  font-family: "Gowun Dodum";
  src: url("${BASE_PATH}/fonts/GowunDodum.ttf") format("truetype");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Nanum Pen Script";
  src: url("${BASE_PATH}/fonts/NanumPenScript.ttf") format("truetype");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Nanum Brush Script";
  src: url("${BASE_PATH}/fonts/NanumBrushScript.ttf") format("truetype");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Noto Sans KR";
  src: url("${BASE_PATH}/fonts/NotoSansKR.ttf") format("truetype");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
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
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
