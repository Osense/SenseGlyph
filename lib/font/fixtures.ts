import { HANGUL } from "../../data/charset";
import { newProject } from "../defaults";
import { decompose, vowelType } from "../hangul";
import { layoutBoxes } from "./composition";
import { referenceGuide, referencePart } from "./reference";
import type { Part } from "./types";
import type { Stroke } from "../types";

// Synthetic geometry for tests only; never inserted into a user's project.
export function completeFixture() {
  const project = newProject();
  for (const char of HANGUL) {
    const d = decompose(char)!,
      boxes = layoutBoxes(char);
    const strokes = (Object.keys(boxes) as Part[]).map(
      (part, order): Stroke => {
        const b = boxes[part]!;
        const x =
          part === "jung" && vowelType(d.jung) === "C"
            ? 780
            : b.x + b.width / 2;
        const y = b.y + b.height / 2;
        return {
          id: char + "-" + part,
          order,
          createdAt: 1,
          brush: "pen",
          params: { size: 35, usePressure: true },
          points: [
            { x: x - 55, y: y - 25, p: 0.4, t: 0 },
            { x: x + 5, y: y + 35, p: 0.8, t: 10 },
            { x: x + 60, y: y - 25, p: 0.5, t: 20 },
          ],
        };
      },
    );
    // Keep synthetic component labels valid under the actual reference classifier.
    const guide = referenceGuide(char, project.settings)!;
    for (const [order, part] of (Object.keys(boxes) as Part[]).entries()) {
      const stroke = strokes[order];
      if (referencePart(char, stroke, project.settings) === part) continue;
      const box = guide.boxes[part]!,
        cx = box.x + box.width / 2,
        cy = box.y + box.height / 2;
      const candidates = Array.from(guide.pixels.entries())
        .filter(([, label]) => label === order + 1)
        .map(([index]) => ({
          x:
            guide.x +
            (((index % guide.resolution) - 1) / (guide.resolution - 3)) *
              guide.width,
          y:
            guide.y +
            ((Math.floor(index / guide.resolution) - 1) /
              (guide.resolution - 3)) *
              guide.height,
        }))
        .sort(
          (a, b) =>
            Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy),
        );
      const oldX = stroke.points[1].x - 5,
        oldY = stroke.points[1].y - 35,
        scale = Math.min(1, box.width / 160, box.height / 100);
      for (const candidate of candidates) {
        const moved = {
          ...stroke,
          points: stroke.points.map((p) => ({
            ...p,
            x: candidate.x + (p.x - oldX) * scale,
            y: candidate.y + (p.y - oldY) * scale,
          })),
        };
        if (referencePart(char, moved, project.settings) === part) {
          strokes[order] = moved;
          break;
        }
      }
    }
    project.samples[char] = {
      char,
      category: "hangul-syllable",
      strokes,
      updatedAt: 1,
      status: "done",
    };
  }
  return project;
}
