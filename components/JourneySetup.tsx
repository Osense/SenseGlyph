"use client";
import { APP_NAME, APP_VERSION, MAKER } from "../lib/version";
import { useState } from "react";
import { BrushPreview } from "./Preview";
import WritingPad from "./WritingPad";
import PixelSizeControl from "./PixelSizeControl";
import { REFERENCE_FONTS, referenceStack } from "../lib/reference-fonts";
import type { BrushId, ProjectSettings } from "../lib/types";
const brushes: { id: BrushId; label: string; note: string }[] = [
  { id: "pen", label: "펜", note: "또박또박, 일정한 선" },
  { id: "marker", label: "마커", note: "도톰하고 선명하게" },
  { id: "brush", label: "붓", note: "힘에 따라 유연하게" },
  { id: "pencil", label: "연필", note: "가볍고 가는 선" },
  { id: "nib", label: "납작펜", note: "각도에 따라 다르게" },
  { id: "pixel", label: "픽셀펜", note: "네모 입자로 또렷하게" },
];
export default function JourneySetup({
  step,
  settings,
  update,
  next,
  hasWriting = false,
  dark = false,
}: {
  hasWriting?: boolean;
  dark?: boolean;
  step: number;
  settings: ProjectSettings;
  update: (settings: Partial<ProjectSettings>) => void;
  next: () => void;
}) {
  const [sentence, setSentence] = useState(
    "오늘의 한 획이 나의 글씨가 됩니다.",
  );
  const [trial, setTrial] = useState(0);
  const params = settings.brushParams[settings.activeBrush];
  return (
    <section className="setup-screen journey-panel" key={step}>
      <div className="setup-copy">
        <span className="step-kicker">
          {step === 0 ? "01 / 손에 맞는 도구" : "02 / 닮은 글씨 찾기"}
        </span>
        <h1 tabIndex={-1}>
          {step === 0 ? (
            <>
              원하는 브러시를
              <br />
              선택하세요.
            </>
          ) : (
            <>
              내 글씨와 닮은
              <br />
              견본을 골라보세요.
            </>
          )}
        </h1>
        <p>
          {step === 0
            ? "평소 쓰는 펜처럼 편한 도구로 시작해요. 굵기도 바꾸고, 옆 칸에 가볍게 그어보세요."
            : "가장 비슷한 느낌이면 충분해요. 고른 글씨는 쓸 때 연한 안내선이 되고, 자모를 나누고 손글씨를 정돈할 때 기준이 돼요."}
        </p>
        {step === 0 ? (
          <>
            <label className="setup-thickness">
              선의 굵기 <b>{params.size}</b>
              <input
                aria-label="시작 브러시 굵기"
                type="range"
                min="20"
                max="120"
                value={params.size}
                onChange={(e) =>
                  update({
                    brushParams: {
                      ...settings.brushParams,
                      [settings.activeBrush]: {
                        ...params,
                        size: +e.target.value,
                      },
                    },
                  })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={params.usePressure}
                onChange={(e) =>
                  update({
                    brushParams: {
                      ...settings.brushParams,
                      [settings.activeBrush]: {
                        ...params,
                        usePressure: e.target.checked,
                      },
                    },
                  })
                }
              />
              펜을 누르는 힘 반영하기
            </label>
            {settings.activeBrush === "pixel" && (
              <PixelSizeControl
                params={params}
                onChange={(pixel) =>
                  update({ brushParams: { ...settings.brushParams, pixel } })
                }
              />
            )}
            {settings.activeBrush === "nib" && (
              <label className="setup-thickness">
                펜촉 각도 <b>{params.nibAngle}°</b>
                <input
                  aria-label="시작 펜촉 각도"
                  type="range"
                  min="0"
                  max="180"
                  value={params.nibAngle}
                  onChange={(e) =>
                    update({
                      brushParams: {
                        ...settings.brushParams,
                        nib: { ...params, nibAngle: +e.target.value },
                      },
                    })
                  }
                />
              </label>
            )}
          </>
        ) : (
          <label className="setup-sentence">
            비교할 문장
            <input
              aria-label="견본 비교 문장"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              maxLength={80}
            />
          </label>
        )}
        <button className="journey-next" onClick={next}>
          {step === 0 ? "이 브러시로 할게요" : "이제 글자 써보기"}
          <span>→</span>
        </button>
        <small>
          {step === 0 && hasWriting
            ? "이미 쓴 글자가 있어요. 도구를 바꾸면 이후 글자와 모양이 달라질 수 있어요."
            : step === 0
              ? "한 폰트는 한 가지 도구로 쓰면 가장 고르게 나와요. 나중에 바꿀 수도 있어요."
              : "나중에 돌아와서 바꿀 수 있어요."}
        </small>
        <p className="sg-credit">
          <b>{MAKER}</b> 제작 · {APP_NAME} v{APP_VERSION}
        </p>
      </div>
      {step === 0 ? (
        <div className="brush-experience">
          <div
            className="setup-brushes"
            role="group"
            aria-label="시작 브러시 선택"
          >
            {brushes.map((b) => (
              <button
                key={b.id}
                aria-pressed={settings.activeBrush === b.id}
                onClick={() => update({ activeBrush: b.id })}
              >
                <BrushPreview brush={b.id} />
                <strong>{b.label}</strong>
                <small>{b.note}</small>
              </button>
            ))}
          </div>
          <div className="trial-heading">
            <span>여기에 자유롭게 그어보세요</span>
            <button onClick={() => setTrial((v) => v + 1)}>
              연습 지우기 ↺
            </button>
          </div>
          <div className="brush-trial">
            <WritingPad
              key={trial}
              char="가"
              category="hangul-syllable"
              strokes={[]}
              settings={{
                ...settings,
                sampleMode: "hidden",
                allowMouse: true,
                penOnly: false,
                grid: {
                  ...settings.grid,
                  diamond: false,
                  halfVertical: false,
                  halfHorizontal: false,
                  sizeGuide: false,
                },
              }}
              tool="pen"
              dark={dark}
              onBusy={() => {}}
              practice
            />
          </div>
          <small className="trial-note">
            연습 칸의 획은 폰트에 들어가지 않아요.
          </small>
        </div>
      ) : (
        <div
          className="setup-fonts"
          role="radiogroup"
          aria-label="시작 견본 글꼴"
        >
          {REFERENCE_FONTS.map((f, i) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={(settings.referenceFont ?? "sans") === f.id}
              onClick={() => update({ referenceFont: f.id })}
            >
              <span className="font-choice-label">
                {i + 1}. {f.label} · {f.name}
                <span>
                  {(settings.referenceFont ?? "sans") === f.id
                    ? "선택됨 ✓"
                    : "선택하기"}
                </span>
              </span>
              <span
                className="font-choice-sentence"
                style={{ fontFamily: referenceStack(f.id) }}
              >
                {sentence || "오늘의 한 획이 나의 글씨가 됩니다."}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
