import { JA_PUNCT, SPECIAL_SYMBOLS } from "../data/charset";
import { t } from "./i18n";
import { METRICS } from "../config/metrics";
import type { CharCategory, ProjectSettings } from "./types";
import { referenceStack } from "./reference-fonts";
import { referenceFit, referenceUsesFallback } from "./font/reference";
import {
  categoryForChar,
  isBoxedCategory,
  isEmBoxed,
  isSymbolCategory,
  safetyBounds,
  sampleFontSize,
} from "./safety";
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  s: ProjectSettings,
  category: CharCategory,
  dark: boolean,
) {
  const latin = !isBoxedCategory(category),
    box = safetyBounds(category);
  ctx.clearRect(0, 0, 1000, 1000);
  ctx.strokeStyle = dark ? "#4e5556" : "#d7d8d1";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(1, 1, 998, 998);
  ctx.save();
  ctx.fillStyle = dark ? "#e4a06412" : "#b97c4d0b";
  ctx.fillRect(0, 0, 1000, box.top);
  ctx.fillRect(0, box.bottom, 1000, 1000 - box.bottom);
  ctx.fillRect(0, box.top, box.left, box.bottom - box.top);
  ctx.fillRect(box.right, box.top, 1000 - box.right, box.bottom - box.top);
  if (latin) {
    ctx.fillStyle = dark ? "#587e9e22" : "#5c97bf12";
    ctx.fillRect(
      box.left,
      METRICS.baseline,
      box.right - box.left,
      box.bottom - METRICS.baseline,
    );
    ctx.fillStyle = dark ? "#a4bad2" : "#7198b4";
    ctx.font = "17px sans-serif";
    ctx.fillText(
      isSymbolCategory(category)
        ? t("아래쪽 문장부호 영역")
        : t("디센더 영역 · g j p q y"),
      box.left + 14,
      METRICS.baseline + 30,
    );
  }
  ctx.strokeStyle = dark ? "#b69a73" : "#bda47f";
  ctx.setLineDash([8, 5]);
  ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = dark ? "#b69a73" : "#a18b6a";
  ctx.fillText(
    latin
      ? isSymbolCategory(category)
        ? t("기호 안전영역")
        : t("영문·숫자 안전영역")
      : category.startsWith("hangul")
        ? t("한글 안전영역")
        : t("글자 안전영역"),
    box.left + 8,
    Math.max(25, box.top - 12),
  );
  ctx.restore();
  const line = (x: number, y: number, a: number, b: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(a, b);
    ctx.stroke();
  };
  ctx.setLineDash([9, 9]);
  line(500, 0, 500, 1000);
  line(0, 500, 1000, 500);
  ctx.beginPath();
  ctx.moveTo(500, 0);
  ctx.lineTo(1000, 500);
  ctx.lineTo(500, 1000);
  ctx.lineTo(0, 500);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  if (!latin && s.grid.sizeGuide) {
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(80, 80, 840, 840);
    ctx.globalAlpha = 1;
  }
  if (latin) {
    for (const [label, y] of Object.entries(METRICS)) {
      ctx.strokeStyle = label === "baseline" ? "#98aaa2" : "#c5cec8";
      line(0, y, 1000, y);
      ctx.fillStyle = dark ? "#aab5ac" : "#7f9287";
      ctx.font = "18px sans-serif";
      ctx.fillText(label, 16, y - 8);
    }
  }
}
export function drawSample(
  ctx: CanvasRenderingContext2D,
  char: string,
  latin: boolean,
  opacity: number,
  dark: boolean,
  settings?: ProjectSettings,
  clear = true,
) {
  if (clear) ctx.clearRect(0, 0, 1000, 1000);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = dark ? "#f4f1e7" : "#333d36";
  ctx.textBaseline = "alphabetic";
  const family = referenceUsesFallback(char, settings?.referenceFont)
    ? '"Noto Sans KR"'
    : referenceStack(settings?.referenceFont);
  // 가나·한자·일본어 문장 기호: 글꼴의 네모 칸을 그대로 옮겨 작은 가나와 、。의 자리를 지킨다.
  const category = categoryForChar(char);
  if (
    isEmBoxed(category) ||
    (settings?.script === "ja" && JA_PUNCT.includes(char))
  ) {
    ctx.font = "800px " + family;
    const probe = ctx.measureText("国");
    const height =
      probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent || 800;
    const size = (800 * 780) / height;
    ctx.font = size + "px " + family;
    const ref = ctx.measureText("国"),
      mine = ctx.measureText(char);
    ctx.fillText(
      char,
      500 - mine.width / 2,
      500 + (ref.actualBoundingBoxAscent - ref.actualBoundingBoxDescent) / 2,
    );
    ctx.globalAlpha = 1;
    return;
  }
  ctx.font = "840px " + family;
  let m = ctx.measureText(char);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  let scale = latin
    ? 570 / (ctx.measureText("H").actualBoundingBoxAscent || 570)
    : sampleFontSize(w, h, true, referenceFit(char, settings?.referenceFont));
  if (latin) {
    const box = safetyBounds(categoryForChar(char));
    // Use a shared Latin scale so g/p/q/y retain their proportions to H/x.
    const characters = /^[A-Za-z0-9]$/.test(char)
      ? [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"]
      : SPECIAL_SYMBOLS.includes(char)
        ? [char]
        : [..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~·…“”‘’₩※°「」"];
    const metrics = characters.map((value) => ctx.measureText(value));
    const ascent = Math.max(...metrics.map((m) => m.actualBoundingBoxAscent)),
      descent = Math.max(...metrics.map((m) => m.actualBoundingBoxDescent));
    const maxWidth = Math.max(
      ...metrics.map((m) => m.actualBoundingBoxLeft + m.actualBoundingBoxRight),
    );
    scale = Math.min(
      scale,
      (METRICS.baseline - box.top - 12) / (ascent || 1),
      (box.bottom - METRICS.baseline - 12) / (descent || 1),
      (box.right - box.left - 24) / (maxWidth || 1),
    );
  }
  ctx.font = 840 * scale + "px " + family;
  m = ctx.measureText(char);
  const x = 500 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
  const y = latin
    ? METRICS.baseline
    : 500 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(char, x, y);
  ctx.globalAlpha = 1;
}
