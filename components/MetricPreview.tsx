"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasCorrection, correctionAmounts } from "../lib/font/beautify";
import { baseHandwriting, correctHandwriting } from "../lib/font/composition";
import { mergeInk } from "../lib/font/layout";
import { outlines } from "../lib/brushes";
import { METRICS, UPM } from "../config/metrics";
import { fontLayout } from "../lib/font/pipeline";
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
  /** 이 글자의 기준선(폰트 단위). 쓴 그대로 줄은 쓰기 칸의 기준선 800 */
  baseline?: number;
  /** 직접 쓰지 않고 자모를 모아 만든 글자(쓴 그대로 줄에서 연하게) */
  faint?: boolean;
};

/** 실제 폰트 생성과 같은 계산(lib/font/pipeline)으로 그린 실시간 미리보기입니다.
 * 위: 쓴 그대로 · 아래: 정돈·크기·간격·굵기를 반영한 결과 */
export default function MetricPreview({
  project,
  preparation,
  pending = false,
}: {
  project: FontProject;
  preparation: FontPreparation;
  /** 슬라이더를 움직이는 중이라 아직 반영 전인 값이 있을 때 */
  pending?: boolean;
}) {
  const [text, setText] = useState(PREVIEW_SENTENCE);
  const [ready, setReady] = useState(0);
  const before = useRef<HTMLCanvasElement>(null),
    after = useRef<HTMLCanvasElement>(null);
  const { settings } = preparation;
  const amounts = correctionAmounts(settings);
  const amountsKey = JSON.stringify(amounts);
  // 1단계(비쌈): 자모 분리 — 글씨나 자모 배정이 바뀔 때만 다시 계산합니다.
  const base = useMemo(
    () => baseHandwriting(project, preparation),
    [project.samples, preparation.separations, project.settings.referenceFont],
  );
  // 2단계(중간): 정돈 — 정돈 강도가 바뀔 때만, 화면을 먼저 그린 뒤 계산합니다.
  const [corrected, setCorrected] = useState(base);
  const [correcting, setCorrecting] = useState(false);
  const latest = useRef({ project, preparation });
  latest.current = { project, preparation };
  useEffect(() => {
    if (!hasCorrection(amounts)) {
      setCorrected(base);
      setCorrecting(false);
      return;
    }
    setCorrecting(true);
    const timer = setTimeout(() => {
      const { project: p, preparation: prep } = latest.current;
      setCorrected(correctHandwriting(base, p, prep));
      setCorrecting(false);
    }, 40);
    return () => clearTimeout(timer);
  }, [base, amountsKey]);
  // 3단계(가벼움): 크기·간격·굵기·기준선 — 슬라이더마다 바로 반영합니다.
  const layoutKey = [
    settings.bodySize,
    settings.letterSpacing,
    settings.strokeWeight,
    settings.strokeFinish,
  ].join(":");
  const original = useMemo(
    () => fontLayout(project, base, settings),
    [base, layoutKey],
  );
  // 쓴 그대로 줄: 크기·간격·기준선·굵기 설정을 하나도 적용하지 않은 기본 배치
  const neutral = useMemo(
    () =>
      fontLayout(project, base, {
        ...settings,
        bodySize: 840,
        letterSpacing: 0,
        baseline: METRICS.baseline,
        strokeWeight: undefined,
        strokeFinish: "original",
      }),
    [base],
  );
  const shown = useMemo(
    () =>
      corrected === base
        ? original
        : fontLayout(project, corrected, settings, {
            sizeEvening: amounts.size,
          }),
    [corrected, original, layoutKey, amounts.size],
  );
  const busy = pending || correcting;
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
    // 쓴 그대로: 쓴 글자는 쓰기 칸(1000) 그대로, 칸 기준선 800에 맞춰 나란히 놓는다.
    const raw: Glyph[] = letters.map((char) => {
      const strokes = project.samples[char]?.strokes;
      if (strokes?.length)
        return {
          char,
          advance: UPM,
          baseline: METRICS.baseline,
          ink: strokes.flatMap((stroke) =>
            outlines(stroke.points, stroke.brush, stroke.params),
          ),
        };
      const glyph = neutral.glyph(char);
      if (glyph)
        return {
          char,
          advance: glyph.advanceWidth,
          baseline: METRICS.baseline,
          ink: mergeInk(glyph.contours),
          faint: true,
        };
      return {
        char,
        advance:
          /\s/.test(char) && char !== "　" ? neutral.plan.spaceWidth : UPM,
        baseline: METRICS.baseline,
      };
    });
    const rows = [raw, layout(shown)];
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
      ctx.strokeStyle = dark ? "#3a2628" : "#ecdedc";
      ctx.setLineDash([4, 4]);
      if (view === 1) ctx.strokeRect(12, top, WIDTH - 24, body);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(12, baseline);
      ctx.lineTo(WIDTH - 12, baseline);
      ctx.stroke();
      let x = Math.max(16, (WIDTH - total * scale) / 2);
      for (const glyph of glyphs) {
        if (glyph.ink) {
          ctx.fillStyle = glyph.faint
            ? dark
              ? "#a68488"
              : "#b59a9c"
            : dark
              ? "#f4ecea"
              : "#1f1515";
          ctx.beginPath();
          const glyphBaseline = glyph.baseline ?? settings.baseline;
          for (const ring of glyph.ink) {
            ring.forEach(([px, py], i) => {
              const dx = x + px * scale,
                dy = baseline + (py - glyphBaseline) * scale;
              if (i === 0) ctx.moveTo(dx, dy);
              else ctx.lineTo(dx, dy);
            });
            ctx.closePath();
          }
          ctx.fill("nonzero");
        } else if (!/\s/.test(glyph.char)) {
          ctx.fillStyle = dark ? "#a68488" : "#c9b3b5";
          ctx.font = `${original.plan.bodySize * scale * 0.86}px ${referenceStack(project.settings.referenceFont)}`;
          ctx.fillText(glyph.char, x + 4, baseline - 6);
        }
        x += glyph.advance * scale;
      }
    });
  }, [text, ready, original, shown, neutral, settings.baseline]);

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
        <figcaption>
          쓴 그대로
          <small> · 고치지 않은 원본 (연한 글자는 자모를 모아 만든 글자)</small>
        </figcaption>
        <canvas
          ref={before}
          width={WIDTH}
          height={HEIGHT}
          aria-label="쓴 그대로의 손글씨 미리보기"
        />
      </figure>
      <figure
        className={
          (hasCorrection(amounts) ? "is-corrected" : "") +
          (busy ? " is-busy" : "")
        }
        aria-busy={busy}
      >
        <figcaption>
          {hasCorrection(amounts)
            ? "정돈 후 · 폰트에 들어갈 모습"
            : "폰트에 들어갈 모습"}
          {busy && (
            <span className="fw-preview-busy" role="status">
              <i aria-hidden="true" />
              {correcting ? "정돈 결과 계산 중…" : "반영 중…"}
            </span>
          )}
        </figcaption>
        <canvas
          ref={after}
          width={WIDTH}
          height={HEIGHT}
          aria-label="폰트에 들어갈 손글씨 미리보기"
          data-hangul-scale={shown.plan.hangulScale}
          data-body-size={shown.plan.bodySize}
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
