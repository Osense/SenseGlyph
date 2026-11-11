import data from "../../data/reference-regions.json";
import { sampleFontSize } from "../safety";
import type { ProjectSettings, Stroke } from "../types";
import type { Box, Part } from "./types";
export type ReferenceSettings = Pick<ProjectSettings, "referenceFont" | "grid">;
interface Entry {
  size: number[];
  fit?: number;
  boxes: Record<string, number[]>;
  regions: number[];
}
const fonts = data.fonts as unknown as Record<string, Record<string, Entry>>;
const referenceEntry = (char: string, font = "sans") =>
  fonts[font]?.[char] ?? fonts.fallback?.[char];
const guides = new Map<string, ReturnType<typeof createGuide>>();
const parts: Part[] = ["cho", "jung", "jong"];
function createGuide(entry: Entry, diamond: boolean) {
  const [w, h] = entry.size,
    scale = sampleFontSize(w, h, diamond, entry.fit),
    width = w * scale,
    height = h * scale;
  const x = 500 - width / 2,
    y = 500 - height / 2;
  const boxes = Object.fromEntries(
    Object.entries(entry.boxes).map(([part, b]) => [
      part,
      {
        x: x + b[0] * width,
        y: y + b[1] * height,
        width: Math.max(1, b[2] * width),
        height: Math.max(1, b[3] * height),
      },
    ]),
  ) as Partial<Record<Part, Box>>;
  // Stored labels: 1-3 = nearest-part region, 4-6 = the reference font's own
  // ink of that part (see scripts/build-reference-regions.py).
  const pixels = new Uint8Array(data.resolution ** 2),
    ink = new Uint8Array(data.resolution ** 2);
  let offset = 0;
  for (let i = 0; i < entry.regions.length; i += 2) {
    const label = entry.regions[i + 1];
    pixels.fill(((label - 1) % 3) + 1, offset, offset + entry.regions[i]);
    if (label > 3) ink.fill(1, offset, offset + entry.regions[i]);
    offset += entry.regions[i];
  }
  return {
    boxes,
    pixels,
    ink,
    x,
    y,
    width,
    height,
    resolution: data.resolution,
  };
}
export function referenceGuide(char: string, settings?: ReferenceSettings) {
  if (!settings) return null;
  const font = settings.referenceFont ?? "sans",
    diamond = settings.grid.diamond,
    key = font + ":" + diamond + ":" + char;
  const entry = referenceEntry(char, font);
  if (!entry) return null;
  if (!guides.has(key)) guides.set(key, createGuide(entry, diamond));
  return guides.get(key)!;
}
export function referencePart(
  char: string,
  stroke: Stroke,
  settings?: ReferenceSettings,
): Part | null {
  const guide = referenceGuide(char, settings);
  if (!guide) return null;
  const votes = [0, 0, 0];
  const vote = (x: number, y: number, weight: number) => {
    const col = Math.max(
        0,
        Math.min(
          guide.resolution - 1,
          Math.round(
            ((x - guide.x) / guide.width) * (guide.resolution - 3) + 1,
          ),
        ),
      ),
      row = Math.max(
        0,
        Math.min(
          guide.resolution - 1,
          Math.round(
            ((y - guide.y) / guide.height) * (guide.resolution - 3) + 1,
          ),
        ),
      );
    votes[guide.pixels[row * guide.resolution + col] - 1] += weight;
  };
  for (let i = 0; i < stroke.points.length; i++) {
    const p = stroke.points[i],
      previous = stroke.points[Math.max(0, i - 1)],
      distance = Math.hypot(p.x - previous.x, p.y - previous.y);
    const count = Math.max(1, Math.ceil(distance / 8));
    for (let j = 1; j <= count; j++)
      vote(
        previous.x + ((p.x - previous.x) * j) / count,
        previous.y + ((p.y - previous.y) * j) / count,
        distance ? distance / count : i === 0 ? 1 : 0,
      );
  }
  return parts[votes.indexOf(Math.max(...votes))];
}
export function referenceUsesFallback(char: string, font = "sans") {
  return !fonts[font]?.[char] && !!fonts.fallback?.[char];
}
/** How snugly this glyph's ink fills the diamond (see sampleFontSize). */
export function referenceFit(char: string, font?: string) {
  return referenceEntry(char, font)?.fit ?? 1;
}
