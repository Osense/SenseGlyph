import opentype from "opentype.js";
import { decompress } from "woff2-encoder";
import { generateFont } from "../lib/font/generate";
import type { FallbackSource } from "../lib/font/fallback";
import type { BuildRequest, WorkerReply } from "../lib/font/types";

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

self.onmessage = async (event: MessageEvent<BuildRequest>) => {
  try {
    const sources = await fallbackSources(event.data.fallbackFonts);
    const result = generateFont(
      event.data,
      (value, message) => send({ type: "progress", value, message }),
      sources,
    );
    send({ type: "result", ...result }, [result.buffer]);
  } catch (error) {
    send({
      type: "error",
      message:
        error instanceof Error ? error.message : "폰트 생성에 실패했습니다.",
    });
  }
};
