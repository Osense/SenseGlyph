"use client";
import { useT } from "../lib/i18n";
import type { BrushParams } from "../lib/types";

export default function PixelSizeControl({
  params,
  onChange,
  disabled = false,
}: {
  params: BrushParams;
  onChange: (params: BrushParams) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <label className="slider-label pixel-size-control">
      {t("픽셀 입자 크기")} <b>{params.pixelSize ?? 12}</b>
      <input
        aria-label={t("픽셀 입자 크기")}
        type="range"
        min="4"
        max="40"
        step="2"
        value={params.pixelSize ?? 12}
        disabled={disabled}
        onChange={(e) => onChange({ ...params, pixelSize: +e.target.value })}
      />
    </label>
  );
}
