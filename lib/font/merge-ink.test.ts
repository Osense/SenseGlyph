import { describe, expect, it } from "vitest";
import { outlines } from "../brushes";
import { cleanRings, mergeInk } from "./layout";

describe("mergeInk", () => {
  it("1e-13 차이 나는 점이 섞여도 SweepLine 오류 없이 합친다", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 800; n++) {
      const rings: number[][][] = [];
      const s = 0.5 + rnd() * 0.8;
      for (let k = 0; k < 6; k++) {
        const x0 = Math.round(rnd() * 30) * 12 + 300,
          y0 = Math.round(rnd() * 30) * 12 + 300,
          ang = [0, Math.PI / 2, Math.PI / 4][k % 3];
        const pts = Array.from({ length: 10 }, (_, i) => ({
          x: x0 + Math.cos(ang) * i * 12,
          y: y0 + Math.sin(ang) * i * 12,
          p: 1,
          t: i,
        }));
        const a = rnd() * 500,
          b = rnd() * 300;
        for (const r of outlines(
          pts,
          "pixel",
          { size: 30 + rnd() * 30, usePressure: false, nibAngle: 30, pixelSize: 12 },
          "original",
        ))
          rings.push(
            r.flatMap(([x, y]) => {
              const X = (x - a) * s + a * s,
                Y = (y - b) * s + b * s;
              return rnd() < 0.3
                ? [
                    [X, Y],
                    [X + (rnd() - 0.5) * 4e-13, Y],
                  ]
                : [[X, Y]];
            }),
          );
      }
      expect(() => mergeInk(rings)).not.toThrow();
    }
  });

  it("오류 메시지에 나온 것과 같은 거의 0 길이 선분을 정리한다", () => {
    const ring = [
      [0, 0],
      [65.50000000000003, 720],
      [65.50000000000017, 720],
      [100, 720],
      [100, 0],
    ];
    expect(cleanRings([ring])[0]).toHaveLength(4);
    expect(mergeInk([ring, ring.map(([x, y]) => [x + 50, y])])).toHaveLength(1);
  });

  it("합친 뒤 생긴 구멍(ㅁ 안쪽)은 지우지 않는다", () => {
    const rect = (x1: number, y1: number, x2: number, y2: number) => [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ];
    const merged = mergeInk([
      rect(0, 0, 100, 20),
      rect(0, 80, 100, 100),
      rect(0, 0, 20, 100),
      rect(80, 0, 100, 100),
    ]);
    expect(merged).toHaveLength(2);
  });
});
