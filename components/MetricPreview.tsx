"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { composeGlyph, prepareHandwriting } from "../lib/font/composition";
import { effectiveStrokes } from "../lib/font/editing";
import {
  createLayoutPlan,
  createStrokeRenderer,
  layoutGlyph,
  mergeInk,
  strokeContours,
} from "../lib/font/layout";
import { loadReferenceFont, referenceStack } from "../lib/reference-fonts";
import type { FontProject } from "../lib/types";
import type { FontPreparation } from "../lib/font/types";

function examples(project: FontProject) {
  const written = Object.values(project.samples).filter(
    (sample) => sample.strokes.length,
  );
  const selected = [
    written.find(
      (sample) =>
        /^[가-힣]$/.test(sample.char) &&
        (sample.char.charCodeAt(0) - 0xac00) % 28 !== 0,
    ),
    written.find((sample) => /^[아-잏ㅇ]$/.test(sample.char)),
    written.find((sample) => /^[사-싷ㅅ]$/.test(sample.char)),
    ...written,
  ];
  return [
    ...new Set(selected.flatMap((sample) => (sample ? [sample.char] : []))),
  ]
    .slice(0, 6)
    .join("");
}

export default function MetricPreview({
  project,
  preparation,
}: {
  project: FontProject;
  preparation: FontPreparation;
}) {
  const [text, setText] = useState(() => examples(project) || "한글 가나다");
  const [ready, setReady] = useState(0);
  const before = useRef<HTMLCanvasElement>(null),
    after = useRef<HTMLCanvasElement>(null);
  const { settings, separations } = preparation;
  const { strokeWeight, strokeFinish } = settings;
  const handwriting = useMemo(
    () => prepareHandwriting(project, preparation),
    [
      project.samples,
      separations,
      project.settings.referenceFont,
      project.settings.grid.diamond,
    ],
  );
  const originals = useMemo(
    () =>
      new Map(
        Object.values(project.samples)
          .filter((sample) => sample.strokes.length)
          .map((sample) => [
            sample.char,
            strokeContours(effectiveStrokes(sample, separations[sample.char])),
          ]),
      ),
    [project.samples, separations],
  );
  const writtenContours = useMemo(
    () =>
      new Map(
        Object.values(project.samples)
          .filter((sample) => sample.strokes.length)
          .map((sample) => [sample.char, strokeContours(sample.strokes)]),
      ),
    [project.samples],
  );
  const plan = useMemo(
    () => createLayoutPlan(originals, settings),
    [originals, settings.bodySize, settings.letterSpacing],
  );
  const renderer = useMemo(
    () => createStrokeRenderer(settings),
    [strokeWeight, strokeFinish],
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
    const views = [
      before.current?.getContext("2d"),
      after.current?.getContext("2d"),
    ];
    const letters = [...text.normalize("NFC")].slice(0, 12);
    const glyphs = letters.map((char) => {
      const direct = handwriting.direct.get(char);
      const strokes =
        direct ?? composeGlyph(char, handwriting.library, handwriting.pools);
      const reference =
        originals.get(char) ?? (strokes ? strokeContours(strokes) : []);
      if (!strokes || !reference.length)
        return {
          char,
          advance: /\s/.test(char)
            ? char === "　"
              ? plan.bodySize + 2 * plan.sideBearing
              : plan.spaceWidth
            : plan.bodySize + 2 * plan.sideBearing,
        };
      const original = layoutGlyph(
        char,
        writtenContours.get(char) ?? reference,
        plan,
        reference,
        !direct,
      );
      const styled = layoutGlyph(
        char,
        direct ? renderer(strokes) : reference,
        plan,
        reference,
        !direct,
      );
      return {
        char,
        advance: styled.advanceWidth,
        inks: [mergeInk(original.contours), mergeInk(styled.contours)],
      };
    });
    const total = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
    const scale = Math.min(0.108, 680 / Math.max(1, total));
    views.forEach((ctx, view) => {
      if (!ctx) return;
      ctx.fillStyle = "#fffef8";
      ctx.fillRect(0, 0, 720, 160);
      const baseline = 126;
      ctx.strokeStyle = "#d8d5c8";
      ctx.beginPath();
      ctx.moveTo(16, baseline);
      ctx.lineTo(704, baseline);
      ctx.stroke();
      let x = Math.max(20, (720 - total * scale) / 2);
      for (const glyph of glyphs) {
        const paths = glyph.inks?.[view];
        if (paths) {
          ctx.fillStyle = "#263c33";
          ctx.beginPath();
          for (const ring of paths) {
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
          ctx.fillStyle = "#929d8d";
          ctx.font = `${plan.bodySize * scale}px ${referenceStack(project.settings.referenceFont)}`;
          ctx.fillText(glyph.char, x, baseline);
        }
        x += glyph.advance * scale;
      }
    });
  }, [
    text,
    ready,
    originals,
    writtenContours,
    handwriting,
    plan,
    renderer,
    settings.baseline,
    project.settings.referenceFont,
  ]);

  return (
    <section className="metric-preview">
      <div className="preview-heading">
        <h3>보정 전후 비교</h3>
        <span>같은 출력 크기와 글자 간격으로 비교합니다.</span>
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
      <div className="font-comparison">
        <figure>
          <figcaption>보정 전</figcaption>
          <canvas
            ref={before}
            width={720}
            height={160}
            aria-label="보정 전 손글씨 견본"
          />
        </figure>
        <figure>
          <figcaption>보정 후</figcaption>
          <canvas
            ref={after}
            width={720}
            height={160}
            aria-label="간격 기준선 실시간 견본"
            data-hangul-scale={plan.hangulScale}
            data-body-size={plan.bodySize}
          />
        </figure>
      </div>
      <p className="font-help">
        직접 쓴 글자를 먼저 보여줍니다. 아직 만들 수 없는 글자는 연하게
        표시합니다.
      </p>
    </section>
  );
}
