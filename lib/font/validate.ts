import type { FontPreparation } from "./types";
import { CORRECTION_KEYS, FONT_SETTING_LIMITS as LIMITS } from "./types";

export function validPreparation(value: unknown): value is FontPreparation {
  const record = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const finite = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  if (!record(value) || !record(value.settings) || !record(value.separations))
    return false;
  const s = value.settings;
  for (const key of ["alignToReference", "averageStrokes"])
    if (s[key] !== undefined && typeof s[key] !== "boolean") return false;
  for (const key of [
    "correction",
    "positionCorrection",
    "shapeInterpolation",
    "widthCorrection",
  ]) {
    if (s[key] !== undefined && (!finite(s[key]) || s[key] < 0 || s[key] > 100))
      return false;
  }
  if (s.correctionDetail !== undefined) {
    const detail = s.correctionDetail;
    if (!record(detail)) return false;
    for (const key of CORRECTION_KEYS)
      if (!finite(detail[key]) || detail[key] < 0 || detail[key] > 100)
        return false;
  }
  if (
    s.strokeWeight !== undefined &&
    (!finite(s.strokeWeight) ||
      s.strokeWeight < LIMITS.weightMin ||
      s.strokeWeight > LIMITS.weightMax)
  )
    return false;
  if (
    s.strokeFinish !== undefined &&
    s.strokeFinish !== "original" &&
    s.strokeFinish !== "round" &&
    s.strokeFinish !== "pointed"
  )
    return false;
  if (
    s.bodySize !== undefined &&
    (!finite(s.bodySize) ||
      s.bodySize < LIMITS.bodyMin ||
      s.bodySize > LIMITS.bodyMax)
  )
    return false;
  if (
    typeof s.familyName !== "string" ||
    s.familyName.length > 80 ||
    (s.englishFamilyName !== undefined &&
      (typeof s.englishFamilyName !== "string" ||
        s.englishFamilyName.length > 60)) ||
    !finite(s.letterSpacing) ||
    s.letterSpacing < LIMITS.spacingMin ||
    s.letterSpacing > LIMITS.spacingMax ||
    !finite(s.baseline) ||
    s.baseline < 650 ||
    s.baseline > 900 ||
    typeof s.includeComposed !== "boolean"
  )
    return false;
  for (const [char, separation] of Object.entries(value.separations)) {
    if (
      [...char].length !== 1 ||
      char < "가" ||
      char > "힣" ||
      !record(separation) ||
      !record(separation.assignments)
    )
      return false;
    for (const part of Object.values(separation.assignments))
      if (!["cho", "jung", "jong"].includes(String(part))) return false;
    if (
      separation.sourceUpdatedAt !== undefined &&
      !finite(separation.sourceUpdatedAt)
    )
      return false;
    if (separation.strokes !== undefined) {
      if (!Array.isArray(separation.strokes)) return false;
      const ids = new Set<string>();
      for (const stroke of separation.strokes) {
        if (
          !record(stroke) ||
          typeof stroke.id !== "string" ||
          ids.has(stroke.id) ||
          !["pen", "marker", "brush", "pencil", "nib", "pixel"].includes(
            String(stroke.brush),
          ) ||
          !finite(stroke.order) ||
          stroke.order < 0 ||
          !Number.isInteger(stroke.order) ||
          !finite(stroke.createdAt) ||
          !record(stroke.params) ||
          !finite(stroke.params.size) ||
          stroke.params.size < 20 ||
          stroke.params.size > 120 ||
          typeof stroke.params.usePressure !== "boolean" ||
          (stroke.params.pixelSize !== undefined &&
            (!finite(stroke.params.pixelSize) ||
              stroke.params.pixelSize < 4 ||
              stroke.params.pixelSize > 40)) ||
          (stroke.brush === "nib" &&
            (!finite(stroke.params.nibAngle) ||
              stroke.params.nibAngle < 0 ||
              stroke.params.nibAngle > 180)) ||
          !Array.isArray(stroke.points) ||
          !stroke.points.length
        )
          return false;
        ids.add(stroke.id);
        let last = -Infinity;
        for (const p of stroke.points) {
          if (
            !record(p) ||
            ![p.x, p.y, p.p, p.t].every(finite) ||
            !finite(p.p) ||
            p.p < 0 ||
            p.p > 1 ||
            !finite(p.t) ||
            p.t < 0 ||
            p.t < last ||
            (p.tiltX !== undefined && !finite(p.tiltX)) ||
            (p.tiltY !== undefined && !finite(p.tiltY))
          )
            return false;
          last = p.t;
        }
      }
    }
    if (separation.boxes !== undefined) {
      if (!record(separation.boxes)) return false;
      for (const [part, box] of Object.entries(separation.boxes)) {
        if (!["cho", "jung", "jong"].includes(part) || !record(box))
          return false;
        for (const key of ["x", "y", "width", "height"])
          if (
            !finite(box[key]) ||
            box[key] < (key === "width" || key === "height" ? 50 : 0) ||
            box[key] > 1000
          )
            return false;
      }
    }
  }
  return true;
}
