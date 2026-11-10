import { it, expect } from "vitest";
import { parseProject } from "./storage";
import { newProject } from "./defaults";
it("imports a backup as a separate project and retains vector points and settings", () => {
  const p = newProject();
  p.samples["겨"] = {
    char: "겨",
    category: "hangul-syllable",
    status: "done",
    updatedAt: 1,
    strokes: [
      {
        id: "a",
        points: [{ x: -40, y: 1020, p: 0.7, t: 0, tiltX: 10 }],
        brush: "pen",
        params: { size: 50, usePressure: true },
        order: 0,
        createdAt: 1,
      },
    ],
  };
  const restored = parseProject(JSON.stringify(p));
  expect(restored.id).not.toBe(p.id);
  expect(restored.samples).toEqual(p.samples);
  expect(restored.settings).toEqual(p.settings);
});
it("rejects unsupported schema and invalid pressure/settings", () => {
  const p = newProject();
  expect(() =>
    parseProject(JSON.stringify({ ...p, schemaVersion: 2 })),
  ).toThrow();
  p.settings.sampleOpacity = 10;
  expect(() => parseProject(JSON.stringify(p))).toThrow();
});
