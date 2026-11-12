"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasCorrection, correctionAmounts } from "../lib/font/beautify";
import { mergeInk } from "../lib/font/layout";
import { fontPipeline } from "../lib/font/pipeline";
import { loadReferenceFont, referenceStack } from "../lib/reference-fonts";
import type { FontProject } from "../lib/types";
import type { FontPreparation } from "../lib/font/types";

/** 쓴 글자와 조합 글자가 섞이도록 고른 기본 문장 */
export const PREVIEW_SENTENCE = "다람쥐 헌 쳇바퀴에 타고파";

const WIDTH = 760,
  HEIGHT = 150;

type Glyph = {
  char: string;
  advance: number;
  ink?: number[][][];
};

/** 실제 폰트 생성과 같은 계산(lib/font/pipeline)으로 그린 실시간 미리보기입니다.
 * 위: 쓴 그대로 · 아래: 정돈·크기·간격·굵기를 반영한 결과 */
export default function MetricPreview({
  project,
  preparation,
}: {
  project: FontProject;
  preparation: FontPreparation;
}) {
  const [text, setText] = useState(PREVIEW_SENTENCE);
  const [ready, setReady] = useState(0);
  const before = useRef<HTMLCanvasElement>(null),
    after = useRef<HTMLCanvasElement>(null);
  const { settings } = preparation;
  const correcting = hasCorrection(correctionAmounts(settings));
  const original = useMemo(
    () => fontPipeline(project, preparation, { correct: false }),
    [project.samples, preparation, project.settings.referenceFont],
  );
  const corrected = useMemo(
    () =>
      correcting
        ? fontPipeline(project, preparation, { correct: true })
        : original,
    [original, correcting, project.samples, preparation],
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

  const letters = [...text.normalize("NFC")].slice(0, 16);
  const missing = letters.filter(
    (char) => !/\s/.test(char) && !original.strokesFor(char),
  );
  useEffect(() => {
    const layout = (pipeline: typeof original): Glyph[] =>
      letters.map((char) => {
        const glyph = pipeline.glyph(char);
        const blank =
          char === "　"
            ? pipeline.plan.bodySize + 2 * pipeline.plan.sideBearing
            : /\s/.test(char)
              ? pipeline.plan.spaceWidth
              : pipeline.plan.bodySize + 2 * pipeline.plan.sideBearing;
        return glyph
          ? { char, advance: glyph.advanceWidth, ink: mergeInk(glyph.contours) }
          : { char, advance: blank };
      });
    const rows = [layout(original), layout(corrected)];
    const widest = Math.max(
      ...rows.map((row) => row.reduce((sum, g) => sum + g.advance, 0)),
    );
    const scale = Math.min(0.11, (WIDTH - 40) / Math.max(1, widest));
    const dark = document.querySelector(".studio")?.classList.contains("dark");
    [before.current, after.current].forEach((canvas, view) => {
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const glyphs = rows[view];
      const total = glyphs.reduce((sum, g) => sum + g.advance, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      const baseline = 112;
      const body = original.plan.bodySize * scale;
      const top =
        baseline +
        (500 - original.plan.bodySize / 2 - settings.baseline) * scale;
      ctx.strokeStyle = dark ? "#505d51" : "#e6e2d4";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(12, top, WIDTH - 24, body);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(12, baseline);
      ctx.lineTo(WIDTH - 12, baseline);
      ctx.stroke();
      let x = Math.max(16, (WIDTH - total * scale) / 2);
      for (const glyph of glyphs) {
        if (glyph.ink) {
          ctx.fillStyle = dark ? "#ecebe1" : "#232c29";
          ctx.beginPath();
          for (const ring of glyph.ink) {
            ring.forEach(([px, py], i) => {
              const dx = x + px * scale,
                dy = baseline + (py - settings.baseline) * scale;
              if (i === 0) ctx.moveTo(dx, dy);
              else ctx.lineTo(dx, dy);
            });
            ctx.closePath();
          }
          ctx.fill("nonzero");
        } else if (!/\s/.test(glyph.char)) {
          ctx.fillStyle = dark ? "#6f7a6c" : "#c3c6b8";
          ctx.font = `${original.plan.bodySize * scale * 0.86}px ${referenceStack(project.settings.referenceFont)}`;
          ctx.fillText(glyph.char, x + 4, baseline - 6);
        }
        x += glyph.advance * scale;
      }
    });
  }, [text, ready, original, corrected, settings.baseline]);

  return (
    <section className="fw-preview" aria-label="실시간 미리보기">
      <label className="fw-preview-input">
        <span>미리 볼 문장</span>
        <input
          aria-label="미리 볼 문장"
          maxLength={16}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <figure>
        <figcaption>쓴 그대로</figcaption>
        <canvas
          ref={before}
          width={WIDTH}
          height={HEIGHT}
          aria-label="쓴 그대로의 손글씨 미리보기"
        />
      </figure>
      <figure className={correcting ? "is-corrected" : ""}>
        <figcaption>
          {correcting ? "정돈 후 · 폰트에 들어갈 모습" : "폰트에 들어갈 모습"}
        </figcaption>
        <canvas
          ref={after}
          width={WIDTH}
          height={HEIGHT}
          aria-label="폰트에 들어갈 손글씨 미리보기"
          data-hangul-scale={corrected.plan.hangulScale}
          data-body-size={corrected.plan.bodySize}
        />
      </figure>
      {missing.length > 0 && (
        <p className="fw-note">
          연한 글자({[...new Set(missing)].join(" ")})는 아직 만들 수 없어요.
          자모 자리가 비어 있거나 쓰지 않은 글자예요.
        </p>
      )}
    </section>
  );
}
