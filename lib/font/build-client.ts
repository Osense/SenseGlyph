import type { BuildRequest, FontStats, WorkerReply, WorkerRequest } from "./types";

export interface BuildResult {
  ttf: ArrayBuffer;
  otf: ArrayBuffer;
  stats: FontStats;
}
export interface BuildHandle {
  promise: Promise<BuildResult>;
  cancel: () => void;
}

/** 기기의 코어 수에 맞춰 작업자 수를 정한다(화면이 버벅이지 않게 하나는 남긴다). */
export function workerCount() {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, cores - 1));
}

/**
 * 1만 1천여 글자를 여러 작업자가 나눠 만들고, 0번 작업자가 모아 TTF·OTF 로 쓴다.
 * 진행률은 글자 만들기 0~90%, 파일 쓰기 90~100%.
 */
export function buildFontParallel(
  url: string,
  request: BuildRequest,
  onProgress: (value: number, message: string) => void,
): BuildHandle {
  const parts = workerCount();
  const workers: Worker[] = [];
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    workers.forEach((w) => w.terminate());
    workers.length = 0;
  };
  const promise = new Promise<BuildResult>((resolve, reject) => {
    const fail = (error: unknown) => {
      if (cancelled) return;
      cancel();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const done = new Array(parts).fill(0),
      totals = new Array(parts).fill(1);
    const chunks: (Int32Array | null)[] = new Array(parts).fill(null);
    const report = () => {
      const sum = done.reduce((a, b) => a + b, 0),
        total = totals.reduce((a, b) => a + b, 0);
      onProgress(
        Math.round((sum / total) * 90),
        `${sum.toLocaleString()} / ${total.toLocaleString()} 글자를 만들고 있어요`,
      );
    };
    for (let part = 0; part < parts; part++) {
      let worker: Worker;
      try {
        worker = new Worker(url);
      } catch (error) {
        fail(error);
        return;
      }
      workers.push(worker);
      worker.onerror = () =>
        fail(new Error("폰트를 만드는 중 문제가 생겼어요. 다시 시도해 주세요."));
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (cancelled) return;
        const reply = event.data;
        if (reply.type === "error") fail(new Error(reply.message));
        else if (reply.type === "chunk-progress") {
          done[part] = reply.done;
          totals[part] = Math.max(1, reply.total);
          report();
        } else if (reply.type === "chunk") {
          chunks[part] = reply.data;
          if (part !== 0) worker.terminate();
          if (chunks.every(Boolean)) {
            onProgress(90, "설치할 수 있는 폰트 파일로 묶고 있어요");
            const job: WorkerRequest = {
              type: "assemble",
              request,
              chunks: chunks as Int32Array[],
            };
            workers[0].postMessage(
              job,
              (chunks as Int32Array[]).map((c) => c.buffer),
            );
          }
        } else if (reply.type === "progress") {
          onProgress(Math.max(90, reply.value), reply.message);
        } else if (reply.type === "result") {
          cancel();
          cancelled = false;
          resolve({ ttf: reply.ttf, otf: reply.otf, stats: reply.stats });
        }
      };
      const job: WorkerRequest = { type: "chunk", request, part, parts };
      worker.postMessage(job);
    }
  });
  return { promise, cancel };
}
