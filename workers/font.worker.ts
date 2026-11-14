import opentype from "opentype.js";
import { decompress } from "woff2-encoder";
import { assembleFont, buildGlyphChunk } from "../lib/font/generate";
import type { FallbackSource } from "../lib/font/fallback";
import type {
  BuildRequest,
  WorkerReply,
  WorkerRequest,
} from "../lib/font/types";

const send = (message: WorkerReply, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });

/** 견본 글꼴 파일을 미리 받아 두고, 실제로 필요할 때만 파싱합니다(큰 글꼴은 파싱이 오래 걸림). */
async function fallbackSources(
  fonts: BuildRequest["fallbackFonts"] = [],
): Promise<FallbackSource[]> {
  const sources: FallbackSource[] = [];
  for (const { name, url } of fonts) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      let buffer = await response.arrayBuffer();
      const tag = new DataView(buffer).getUint32(0);
      // wOF2 → sfnt: opentype.js는 WOFF2를 직접 읽지 못합니다.
      if (tag === 0x774f4632) {
        const raw = await decompress(buffer);
        buffer = raw.buffer.slice(
          raw.byteOffset,
          raw.byteOffset + raw.byteLength,
        ) as ArrayBuffer;
      }
      const bytes = buffer;
      sources.push({ name, load: () => opentype.parse(bytes) });
    } catch {
      /* 견본을 못 받으면 그 견본만 건너뜁니다. */
    }
  }
  return sources;
}

let fallbackPromise: Promise<FallbackSource[]> | null = null;
const fallbacksFor = (request: BuildRequest) =>
  (fallbackPromise ??= fallbackSources(request.fallbackFonts));

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const job = event.data;
    if (job.type === "chunk") {
      // 모으는 일을 맡을 0번 작업자는 견본 글꼴을 미리 받아 둔다.
      if (job.part === 0) void fallbacksFor(job.request);
      const chunk = buildGlyphChunk(
        job.request,
        job.part,
        job.parts,
        (done, total) => send({ type: "chunk-progress", done, total }),
      );
      send({ type: "chunk", data: chunk.data }, [chunk.data.buffer]);
      return;
    }
    const sources = await fallbacksFor(job.request);
    const result = assembleFont(
      job.request,
      job.chunks.map((data) => ({ data })),
      (value, message) => send({ type: "progress", value, message }),
      sources,
    );
    send(
      { type: "result", ttf: result.ttf, otf: result.otf, stats: result.stats },
      [result.ttf, result.otf],
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    // 한글 안내(검증 오류)는 그대로, 라이브러리 내부 오류는 알아듣기 쉬운 말로 바꾼다.
    const message = /[가-힣]/.test(detail)
      ? detail
      : "폰트를 만드는 중 문제가 생겼어요. 다시 시도해 주세요." +
        (detail ? ` (오류 내용: ${detail.slice(0, 120)})` : "");
    send({ type: "error", message });
  }
};
