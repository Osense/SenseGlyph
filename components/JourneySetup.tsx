"use client";
import { APP_NAME, APP_VERSION, MAKER } from "../lib/version";
import { useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FieldHead, Kicker } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { useT } from "../lib/i18n";
import { compositionFit } from "../lib/font/reference";
import { BrushPreview } from "./Preview";
import WritingPad from "./WritingPad";
import PixelSizeControl from "./PixelSizeControl";
import {
  defaultReferenceFont,
  referenceFontsFor,
  referenceStack,
} from "../lib/reference-fonts";
import type { BrushId, ProjectSettings, WritingScript } from "../lib/types";
const SCRIPTS: { id: WritingScript; label: string; note: string }[] = [
  { id: "ko", label: "한글", note: "한국어 폰트" },
  { id: "ja", label: "日本語", note: "ひらがな・カタカナ・漢字" },
];
const SENTENCE: Record<WritingScript, string> = {
  ko: "오늘의 한 획이 나의 글씨가 됩니다.",
  ja: "今日の一画が、わたしの文字になる。",
};
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
  script = "ko",
  onScript,
  onLegal,
  leftHanded = false,
  onHand,
}: {
  leftHanded?: boolean;
  onHand?: (left: boolean) => void;
  onLegal?: () => void;
  script?: WritingScript;
  onScript?: (script: WritingScript) => void;
  hasWriting?: boolean;
  dark?: boolean;
  step: number;
  settings: ProjectSettings;
  update: (settings: Partial<ProjectSettings>) => void;
  next: () => void;
}) {
  const t = useT();
  const [sentence, setSentence] = useState(SENTENCE[script]);
  const fonts = referenceFontsFor(script);
  const chosenFont = fonts.some((f) => f.id === settings.referenceFont)
    ? settings.referenceFont
    : defaultReferenceFont(script);
  const [trial, setTrial] = useState(0);
  const params = settings.brushParams[settings.activeBrush];
  const setBrush = (patch: Partial<typeof params>) =>
    update({
      brushParams: {
        ...settings.brushParams,
        [settings.activeBrush]: { ...params, ...patch },
      },
    });
  return (
    <section
      data-ui
      className="setup-screen journey-panel mx-auto grid min-h-0 w-full max-w-[1280px] flex-1 items-center wide:items-start gap-10 overflow-y-auto px-5 py-8 wide:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] wide:gap-16 wide:px-12 wide:py-10"
      key={step}
    >
      <div className="setup-copy grid content-start gap-5 wide:sticky wide:top-0 wide:self-start">
        <div className="grid gap-3">
          <Kicker className="step-kicker">
            {step === 0 ? t("01 / 손에 맞는 도구") : t("02 / 닮은 글씨 찾기")}
          </Kicker>
          <h1
            tabIndex={-1}
            className="m-0 font-serif text-[clamp(28px,3.1vw,44px)] leading-[1.35] font-normal tracking-[-0.03em] whitespace-pre-line text-foreground outline-none"
          >
            {step === 0
              ? t("원하는 브러시를\n선택하세요.")
              : t("내 글씨와 닮은\n견본을 골라보세요.")}
          </h1>
          <p className="m-0 max-w-[34em] font-serif text-[15px] leading-[1.75] break-keep text-muted-foreground">
            {step === 0
              ? t(
                  "평소 쓰는 펜처럼 편한 도구로 시작해요. 굵기도 바꾸고, 옆 칸에 가볍게 그어보세요.",
                )
              : script === "ja"
                ? t(
                    "가장 비슷한 느낌이면 충분해요. 고른 글씨는 쓸 때 연한 안내선이 되고, 쓰지 않은 글자를 채우는 모양이 돼요.",
                  )
                : t(
                    "가장 비슷한 느낌이면 충분해요. 고른 글씨는 쓸 때 연한 안내선이 되고, 자모를 나누고 손글씨를 정돈할 때 기준이 돼요.",
                  )}
          </p>
        </div>
        {step === 0 && onScript && (
          <ChoiceGroup
            className="setup-script"
            label={t("만들 글자")}
            note={
              hasWriting
                ? t(
                    "다른 글자를 고르면 새 폰트로 시작해요. 지금 작업은 ‘내 폰트’에 보관돼요.",
                  )
                : undefined
            }
          >
            {SCRIPTS.map((item) => (
              <ChoiceCard
                key={item.id}
                checked={script === item.id}
                title={item.label}
                note={t(item.note)}
                onClick={() => {
                  onScript(item.id);
                  setSentence(SENTENCE[item.id]);
                }}
              />
            ))}
          </ChoiceGroup>
        )}
        {step === 0 && onHand && (
          <ChoiceGroup
            className="setup-script setup-hand"
            label={t("어느 손으로 쓰세요?")}
            note={t(
              "쓰는 손이 화면을 가리지 않게, 도구와 ‘다음 글자’ 버튼을 반대쪽 손 가까이에 둬요. 설정에서 언제든 바꿀 수 있어요.",
            )}
          >
            {(
              [
                [false, "오른손", "도구는 왼쪽, 왼손으로 넘겨요"],
                [true, "왼손", "도구는 오른쪽, 오른손으로 넘겨요"],
              ] as const
            ).map(([left, label, note]) => (
              <ChoiceCard
                key={label}
                checked={leftHanded === left}
                title={t(label)}
                note={t(note)}
                onClick={() => onHand(left)}
              />
            ))}
          </ChoiceGroup>
        )}
        {step === 0 ? (
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="grid gap-2">
              <FieldHead label={t("선의 굵기")} value={params.size} />
              <Slider
                aria-label={t("시작 브러시 굵기")}
                min={20}
                max={120}
                value={[params.size]}
                onValueChange={([size]) => setBrush({ size })}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              {t("펜을 누르는 힘 반영하기")}
              <Switch
                checked={params.usePressure}
                onCheckedChange={(usePressure) => setBrush({ usePressure })}
              />
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
              <div className="grid gap-2">
                <FieldHead
                  label={t("펜촉 각도")}
                  value={(params.nibAngle ?? 30) + "°"}
                />
                <Slider
                  aria-label={t("시작 펜촉 각도")}
                  min={0}
                  max={180}
                  value={[params.nibAngle ?? 30]}
                  onValueChange={([nibAngle]) => setBrush({ nibAngle })}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="setup-sentence grid gap-2">
            <Label htmlFor="setup-sentence">{t("비교할 문장")}</Label>
            <Input
              id="setup-sentence"
              aria-label={t("견본 비교 문장")}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              maxLength={80}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Button
            size="xl"
            className="journey-next w-full justify-between"
            onClick={next}
          >
            {step === 0 ? t("이 브러시로 할게요") : t("이제 글자 써보기")}
            <ArrowRight className="size-5" />
          </Button>
          <small className="text-xs leading-relaxed text-muted-foreground">
            {step === 0 && hasWriting
              ? t(
                  "이미 쓴 글자가 있어요. 도구를 바꾸면 이후 글자와 모양이 달라질 수 있어요.",
                )
              : step === 0
                ? t(
                    "한 폰트는 한 가지 도구로 쓰면 가장 고르게 나와요. 나중에 바꿀 수도 있어요.",
                  )
                : t("나중에 돌아와서 바꿀 수 있어요.")}
          </small>
        </div>
        {step === 0 && (
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">
            {t(
              "회원 가입이 없고, 글씨와 폰트는 이 기기 밖으로 나가지 않아요. 방문 횟수만 숫자로 셉니다.",
            )}{" "}
            {onLegal && (
              <Button
                variant="link"
                className="h-auto text-xs"
                type="button"
                onClick={onLegal}
              >
                {t("개인정보·이용 안내")}
              </Button>
            )}
          </p>
        )}
        <p className="m-0 font-mono text-[11px] text-dim">
          {t("{maker} 제작", { maker: MAKER })} · {t(APP_NAME)} v{APP_VERSION}
        </p>
      </div>
      {step === 0 ? (
        <div className="brush-experience grid min-w-0 gap-4">
          <div
            data-ui
            className="setup-brushes grid grid-cols-3 gap-2 sm:grid-cols-6"
            role="group"
            aria-label={t("시작 브러시 선택")}
          >
            {brushes.map((b) => (
              <button
                key={b.id}
                data-ui
                aria-pressed={settings.activeBrush === b.id}
                onClick={() => update({ activeBrush: b.id })}
                className="group flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-border bg-card px-1.5 pt-3 pb-2.5 text-center shadow-soft transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-wash aria-pressed:shadow-none [&_canvas]:!h-7 [&_canvas]:!w-[60px]"
              >
                <BrushPreview brush={b.id} />
                <strong className="text-[13px] font-semibold text-foreground group-aria-pressed:text-primary">
                  {t(b.label)}
                </strong>
                <small className="text-[11px] leading-snug break-keep text-muted-foreground max-sm:hidden">
                  {t(b.note)}
                </small>
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("여기에 자유롭게 그어보세요")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrial((v) => v + 1)}
              >
                <RotateCcw />
                {t("연습 지우기")}
              </Button>
            </div>
            <div
              data-ui
              className="brush-trial flex h-[min(42vh,380px)] justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-soft max-sm:h-72"
            >
              <WritingPad
                key={trial}
                char={script === "ja" ? "あ" : "가"}
                category={script === "ja" ? "hiragana" : "hangul-syllable"}
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
            <small className="text-xs text-muted-foreground">
              {t("연습 칸의 획은 폰트에 들어가지 않아요.")}
            </small>
          </div>
        </div>
      ) : (
        <div
          data-ui
          className="setup-fonts grid min-w-0 content-start gap-2.5 self-start"
          role="radiogroup"
          aria-label={t("시작 견본 글꼴")}
        >
          {fonts.map((f, i) => {
            const checked = chosenFont === f.id;
            const fit = script === "ko" ? compositionFit(f.id) : undefined;
            return (
              <button
                key={f.id}
                data-ui
                role="radio"
                aria-checked={checked}
                onClick={() => update({ referenceFont: f.id })}
                className="group grid cursor-pointer gap-2 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-soft transition-[border-color,background-color,box-shadow] hover:border-primary/40 aria-checked:border-primary aria-checked:bg-wash aria-checked:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)]"
              >
                <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    <span className="font-mono tabular-nums">{i + 1}.</span>{" "}
                    {t(f.label)} ·{" "}
                    <b className="font-semibold text-foreground">{t(f.name)}</b>
                  </span>
                  <span
                    className={
                      checked
                        ? "flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground"
                        : "shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium"
                    }
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                    {checked ? t("선택됨") : t("선택하기")}
                  </span>
                </span>
                <span
                  className="font-choice-sentence block truncate text-[clamp(20px,2.1vw,28px)] leading-snug text-foreground"
                  style={{ fontFamily: referenceStack(f.id) }}
                >
                  {sentence || SENTENCE[script]}
                </span>
                {fit === "good" && (
                  <span className="font-choice-fit is-good text-xs font-medium text-primary">
                    {t(
                      "추천 · 자모 자리가 일정해서 조합한 글자가 고르게 나와요",
                    )}
                  </span>
                )}
                {fit === "loose" && (
                  <span className="font-choice-fit text-xs text-muted-foreground">
                    {t(
                      "글자마다 자모 자리가 달라 조합한 글자가 덜 고를 수 있어요",
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** 라디오처럼 하나를 고르는 큰 카드 묶음 */
function ChoiceGroup({
  label,
  note,
  className,
  children,
}: {
  label: string;
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-ui className={cn("grid gap-2", className)}>
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-2"
      >
        {children}
      </div>
      {note && (
        <small className="text-xs leading-relaxed break-keep text-muted-foreground">
          {note}
        </small>
      )}
    </div>
  );
}

function ChoiceCard({
  checked,
  title,
  note,
  onClick,
}: {
  checked: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      data-ui
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className="relative grid cursor-pointer gap-0.5 rounded-xl border border-border bg-card px-4 py-3 pr-9 text-left shadow-soft transition-[border-color,background-color] hover:border-primary/40 aria-checked:border-primary aria-checked:bg-wash aria-checked:shadow-none"
    >
      <strong className="text-[15px] font-semibold text-foreground">
        {title}
      </strong>
      <small className="text-xs leading-snug break-keep text-muted-foreground">
        {note}
      </small>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-3 right-3 grid size-[18px] place-items-center rounded-full border-2",
          checked ? "border-primary bg-primary" : "border-border bg-card",
        )}
      >
        {checked && (
          <span className="size-1.5 rounded-full bg-primary-foreground" />
        )}
      </span>
    </button>
  );
}
