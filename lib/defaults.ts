import type { FontProject, ProjectSettings } from "./types";
export function defaultSettings(): ProjectSettings {
  return {
    referenceFont: "sans",
    grid: {
      halfVertical: true,
      halfHorizontal: true,
      diamond: true,
      sizeGuide: false,
    },
    sampleMode: "inside-faint",
    sampleOpacity: 0.15,
    penOnly: false,
    allowMouse: true,
    activeBrush: "pen",
    brushParams: {
      pen: { size: 50, usePressure: true },
      marker: { size: 50, usePressure: false },
      brush: { size: 50, usePressure: true },
      pencil: { size: 50, usePressure: true },
      nib: { size: 50, usePressure: true, nibAngle: 30 },
      pixel: { size: 50, usePressure: false, pixelSize: 12 },
    },
    eraserSize: 70,
    eraserMode: "stroke",
  };
}
export function newProject(): FontProject {
  return {
    id: crypto.randomUUID(),
    name: "나의 첫 손글씨",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    samples: {},
    settings: defaultSettings(),
    schemaVersion: 1,
  };
}
