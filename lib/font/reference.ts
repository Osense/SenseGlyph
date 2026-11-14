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
function createGuide(entry: Entry) {
  const [w, h] = entry.size,
    scale = sampleFontSize(w, h, true, entry.fit),
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
    key = font + ":" + char;
  const entry = referenceEntry(char, font);
  if (!entry) return null;
  if (!guides.has(key)) guides.set(key, createGuide(entry));
  return guides.get(key)!;
}
/** 손글씨 전체(모든 획)의 중심선 범위. */
const frames = new WeakMap<Stroke[], Box | null>();
export function handwritingFrame(strokes?: Stroke[]): Box | null {
  if (!strokes?.length) return null;
  if (frames.has(strokes)) return frames.get(strokes)!;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const stroke of strokes)
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  const frame =
    minX === Infinity
      ? null
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  frames.set(strokes, frame);
  return frame;
}

/**
 * 쓴 글씨를 견본 글자 크기·위치에 맞춰 판정한다.
 * 견본보다 크거나 작게, 옆으로 비켜 써도 견본의 자모 비율대로 나뉘도록
 * 손글씨 범위를 견본 글자 범위(획 두께만큼 안쪽)로 옮겨 맞춘다.
 * 한쪽으로 너무 좁은 글씨(획이 몇 개 안 될 때)는 그 방향은 옮기지 않는다.
 */
export function guideTransform(
  guide: { x: number; y: number; width: number; height: number },
  context?: Stroke[],
) {
  const frame = handwritingFrame(context);
  const inset = 0.04;
  const target = {
    x: guide.x + guide.width * inset,
    y: guide.y + guide.height * inset,
    width: guide.width * (1 - inset * 2),
    height: guide.height * (1 - inset * 2),
  };
  const axis = (from: number, size: number, to: number, toSize: number) =>
    frame && size >= toSize * 0.3
      ? { scale: toSize / size, offset: to - from * (toSize / size) }
      : { scale: 1, offset: 0 };
  const ax = axis(frame?.x ?? 0, frame?.width ?? 0, target.x, target.width),
    ay = axis(frame?.y ?? 0, frame?.height ?? 0, target.y, target.height);
  return {
    /** 손글씨 좌표 → 견본 좌표 */
    toGuide: (x: number, y: number) => [
      x * ax.scale + ax.offset,
      y * ay.scale + ay.offset,
    ],
    /** 견본 좌표의 상자 → 손글씨 화면 좌표(판정 범위를 글씨 위에 그릴 때) */
    toWriting: (box: Box): Box => ({
      x: (box.x - ax.offset) / ax.scale,
      y: (box.y - ay.offset) / ay.scale,
      width: box.width / ax.scale,
      height: box.height / ay.scale,
    }),
  };
}

export function referencePart(
  char: string,
  stroke: Stroke,
  settings?: ReferenceSettings,
  context?: Stroke[],
): Part | null {
  return referenceVote(char, stroke, settings, context)?.part ?? null;
}
/** 견본 자모 영역 투표 결과. share는 가장 많이 겹친 자모의 비율(0~1)로, 낮을수록 애매한 획입니다. */
export function referenceVote(
  char: string,
  stroke: Stroke,
  settings?: ReferenceSettings,
  context?: Stroke[],
): { part: Part; share: number; shares: [number, number, number] } | null {
  const guide = referenceGuide(char, settings);
  if (!guide) return null;
  const votes = [0, 0, 0];
  const { toGuide } = guideTransform(guide, context);
  const vote = (wx: number, wy: number, weight: number) => {
    const [x, y] = toGuide(wx, wy);
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
  const best = Math.max(...votes),
    total = votes[0] + votes[1] + votes[2];
  return {
    part: parts[votes.indexOf(best)],
    share: total ? best / total : 1,
    shares: votes.map((v) => (total ? v / total : 1 / 3)) as [
      number,
      number,
      number,
    ],
  };
}
export function referenceUsesFallback(char: string, font = "sans") {
  return !fonts[font]?.[char] && !!fonts.fallback?.[char];
}
/** How snugly this glyph's ink fills the diamond (see sampleFontSize). */
export function referenceFit(char: string, font?: string) {
  return referenceEntry(char, font)?.fit ?? 1;
}
