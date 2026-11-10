import { generateFont } from "../lib/font/generate";
import type { BuildRequest, WorkerReply } from "../lib/font/types";

const send = (message: WorkerReply, transfer: Transferable[] = []) =>
  self.postMessage(message, { transfer });
self.onmessage = (event: MessageEvent<BuildRequest>) => {
  try {
    const result = generateFont(event.data, (value, message) =>
      send({ type: "progress", value, message }),
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
