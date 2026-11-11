import type { Metadata } from "next";
import "./globals.css";
import "./font-workshop.css";
import "./editor.css";
import "./workspace.css";
import "./journey.css";
import "./touch.css";
import "./mobile.css";
import "./canvas-navigation.css";
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
export const metadata: Metadata = {
  title: "한 획 — 나만의 손글씨",
  description: "오프라인에서 차곡차곡 모으는 나의 손글씨",
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
