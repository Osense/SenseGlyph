"use client";
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
  return (
    <label className="slider-label pixel-size-control">
      픽셀 입자 크기 <b>{params.pixelSize ?? 12}</b>
      <input
        aria-label="픽셀 입자 크기"
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
