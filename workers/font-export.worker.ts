import {
  convertFont,
  type ConversionReply,
  type ConversionRequest,
} from "../lib/font/export-formats";

self.onmessage = async (event: MessageEvent<ConversionRequest>) => {
  try {
    const buffer = await convertFont(event.data);
    const reply: ConversionReply = { buffer };
    self.postMessage(reply, { transfer: [buffer] });
  } catch {
    const reply: ConversionReply = {
      error: "파일 변환에 실패했습니다. 다시 시도해 주세요.",
    };
    self.postMessage(reply);
  }
};
