"use client";

export interface CanvasNavigation {
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  inkLocked?: boolean;
}

export default function CanvasStepButtons({
  navigation,
  context,
}: {
  navigation: CanvasNavigation;
  context: string;
}) {
  return (
    <>
      <button
        type="button"
        className="canvas-step-button canvas-step-previous"
        aria-label={`이전 ${context} 글자`}
        title="이전 글자"
        data-ink-locked={
          (navigation.inkLocked && !navigation.previousDisabled) || undefined
        }
        disabled={navigation.inkLocked || navigation.previousDisabled}
        onClick={navigation.onPrevious}
      >
        <span aria-hidden="true">‹</span>
        <small>이전</small>
      </button>
      <button
        type="button"
        className="canvas-step-button canvas-step-next"
        aria-label={`다음 ${context} 글자`}
        title="다음 글자"
        data-ink-locked={
          (navigation.inkLocked && !navigation.nextDisabled) || undefined
        }
        disabled={navigation.inkLocked || navigation.nextDisabled}
        onClick={navigation.onNext}
      >
        <span aria-hidden="true">›</span>
        <small>다음</small>
      </button>
    </>
  );
}
