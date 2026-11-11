"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { prepareHandwriting, composeGlyph } from "../lib/font/composition";
import { effectiveStrokes } from "../lib/font/editing";
import {
  createLayoutPlan,
  layoutGlyph,
  strokeContours,
  type Contours,
} from "../lib/font/layout";
import { drawSample } from "../lib/drawing";
import { loadReferenceFont, referenceStack } from "../lib/reference-fonts";
import type { FontProject } from "../lib/types";
import type { FontPreparation } from "../lib/font/types";

export default function MetricPreview({
  project,
  preparation,
}: {
  project: FontProject;
  preparation: FontPreparation;
}) {
  const initial = Object.values(project.samples)
    .filter((sample) => sample.strokes.length)
    .slice(0, 6)
    .map((sample) => sample.char)
    .join("");
  const [text, setText] = useState(initial || "한글 가나다"),
    [ready, setReady] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const handwriting = useMemo(
    () => prepareHandwriting(project, preparation),
    [
      project.samples,
      preparation.separations,
      preparation.settings.positionCorrection,
      preparation.settings.shapeInterpolation,
      project.settings.referenceFont,
      project.settings.grid.diamond,
    ],
  );
  const library = handwriting.library;
  const direct = useMemo(
    () =>
      new Map(
        Object.values(project.samples)
          .map(
            (sample) =>
              [
                sample.char,
                strokeContours(
                  handwriting.direct.get(sample.char) ?? sample.strokes,
                ),
              ] as [string, Contours],
          )
          .filter(([, paths]) => paths.length),
      ),
    [handwriting, project.samples],
  );
  const plan = useMemo(
    () => createLayoutPlan(direct, preparation.settings),
    [direct, preparation.settings.bodySize, preparation.settings.letterSpacing],
  );
  useEffect(() => {
    let alive = true;
    loadReferenceFont(project.settings.referenceFont, text).then(() => {
      if (alive) setReady((value) => value + 1);
    });
    return () => {
      alive = false;
    };
  }, [project.settings.referenceFont, text]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const chars = [...text.normalize("NFC")].slice(0, 12);
    const fill = (paths: Contours) => {
      for (const polygon of paths) {
        if (!polygon.length) continue;
        ctx.beginPath();
        ctx.moveTo(polygon[0][0], polygon[0][1]);
        for (const p of polygon.slice(1)) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
        ctx.fill();
      }
    };
    const previews = chars.map((char) => {
      const raw =
        direct.get(char) ??
        (() => {
          const strokes = composeGlyph(char, library);
          return strokes ? strokeContours(strokes) : undefined;
        })();
      if (raw?.length) {
        const shaped = layoutGlyph(char, raw, plan);
        const sample = project.samples[char];
        const original = sample
          ? strokeContours(
              effectiveStrokes(sample, preparation.separations[char]),
            )
          : raw;
        return { char, raw: original, shaped, advance: shaped.advanceWidth };
      }
      if (/\s/.test(char))
        return {
          char,
          advance:
            char === "　"
              ? plan.bodySize + plan.sideBearing * 2
              : plan.spaceWidth,
        };
      const hangul = /[가-힣ㄱ-ㅣ]/.test(char);
      ctx.font = "1000px " + referenceStack(project.settings.referenceFont);
      let m = ctx.measureText(char),
        width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      let factor = hangul
        ? plan.bodySize / Math.max(width, height, 1)
        : plan.capHeight /
          (ctx.measureText("H").actualBoundingBoxAscent || 700);
      if (!hangul)
        factor = Math.min(factor, plan.bodySize / Math.max(width, height, 1));
      ctx.font =
        1000 * factor + "px " + referenceStack(project.settings.referenceFont);
      m = ctx.measureText(char);
      width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const advance = width + plan.sideBearing * 2;
      return {
        char,
        advance,
        fallback: {
          font: ctx.font,
          x: plan.sideBearing + m.actualBoundingBoxLeft,
          y: hangul
            ? 500 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
            : 800,
        },
      };
    });
    const rawAdvance =
      (1000 + preparation.settings.letterSpacing) *
        chars.filter((c) => !/\s/.test(c)).length +
      (500 + preparation.settings.letterSpacing) *
        chars.filter((c) => /\s/.test(c)).length;
    const outputAdvance = previews.reduce((sum, item) => sum + item.advance, 0);
    const size = Math.min(
        120,
        1060 / Math.max(rawAdvance / 1000, outputAdvance / 1000, 4),
      ),
      scale = size / 1000;
    ctx.clearRect(0, 0, 1200, 320);
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, 1200, 320);
    ctx.font = '16px "Noto Sans KR"';
    for (const [base, label, cap] of [
      [120, "입력 칸 그대로", 570],
      [285, "폰트 출력 · 자모 정돈/크기/여백", plan.capHeight],
    ] as [number, string, number][]) {
      ctx.fillStyle = "#829078";
      ctx.fillText(label, 16, base - 103);
      ctx.strokeStyle = "#bc9967";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(15, base);
      ctx.lineTo(1185, base);
      ctx.stroke();
      ctx.strokeStyle = "#d7e0ce";
      ctx.beginPath();
      ctx.moveTo(15, base - cap * scale);
      ctx.lineTo(1185, base - cap * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    let rawX = 85,
      outputX = 85;
    for (const item of previews) {
      if (!/\s/.test(item.char)) {
        ctx.save();
        ctx.translate(rawX, 120 - preparation.settings.baseline * scale);
        ctx.scale(scale, scale);
        if (item.raw?.length) {
          ctx.fillStyle = "#84917d";
          fill(item.raw);
        } else
          drawSample(
            ctx,
            item.char,
            !/[가-힣ㄱ-ㅣ]/.test(item.char),
            0.5,
            false,
            project.settings,
            false,
          );
        ctx.restore();
        ctx.save();
        ctx.translate(outputX, 285 - preparation.settings.baseline * scale);
        ctx.scale(scale, scale);
        if (item.shaped) {
          ctx.fillStyle = "#263c33";
          fill(item.shaped.contours);
        } else if (item.fallback) {
          ctx.font = item.fallback.font;
          ctx.fillStyle = "#8da18b";
          ctx.fillText(item.char, item.fallback.x, item.fallback.y);
        }
        ctx.restore();
      }
      rawX +=
        (/\s/.test(item.char)
          ? 500 + preparation.settings.letterSpacing
          : 1000 + preparation.settings.letterSpacing) * scale;
      outputX += item.advance * scale;
    }
  }, [
    text,
    ready,
    direct,
    library,
    plan,
    project.settings,
    project.samples,
    preparation.separations,
    preparation.settings.baseline,
  ]);
  return (
    <section className="metric-preview">
      <div className="preview-heading">
        <h3>간격·기준선 실시간 견본</h3>
        <span>입력 크기와 실제 출력 크기를 비교하세요</span>
      </div>
      <label className="font-field">
        비교할 글자
        <input
          aria-label="간격 기준선 견본 문장"
          maxLength={12}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <canvas
        ref={canvas}
        width={1200}
        height={320}
        aria-label="간격 기준선 실시간 견본"
        data-hangul-scale={plan.hangulScale}
        data-body-size={plan.bodySize}
      />
      <p className="font-help">
        한글 대표 크기 기준 {plan.hangulScale.toFixed(2)}배 보정 · 출력 크기{" "}
        {plan.bodySize / 10}%. 위는 입력 칸 그대로, 아래는 파일에 적용되는
        크기와 간격입니다. 아직 없는 글자는 견본으로 연하게 표시합니다.
      </p>
    </section>
  );
}
