import { expect, it } from "vitest";
import {
  grammarCost,
  jamoGrammar,
  strokeShape,
  syllableGrammar,
  vowelRoles,
} from "./primitives";
import { judgeStrokes } from "./judge";
import type { Stroke } from "../types";

let order = 0;
const path = (id: string, pts: [number, number][]): Stroke => {
  // 꼭짓점 사이를 촘촘히 채운 획
  const points: Stroke["points"] = [];
  for (let k = 0; k < pts.length - 1; k++)
    for (let i = 0; i < 10; i++) {
      const [x0, y0] = pts[k],
        [x1, y1] = pts[k + 1];
      points.push({
        x: x0 + ((x1 - x0) * i) / 10,
        y: y0 + ((y1 - y0) * i) / 10,
        p: 1,
        t: points.length,
      });
    }
  points.push({ x: pts.at(-1)![0], y: pts.at(-1)![1], p: 1, t: points.length });
  return {
    id,
    order: order++,
    createdAt: order,
    brush: "pen",
    params: { size: 30, usePressure: false },
    points,
  };
};
const circle = (id: string, cx: number, cy: number, r: number): Stroke =>
  path(
    id,
    Array.from(
      { length: 25 },
      (_, i) =>
        [
          cx + r * Math.sin((i / 24) * 2 * Math.PI),
          cy - r * Math.cos((i / 24) * 2 * Math.PI),
        ] as [number, number],
    ),
  );

it("reads basic strokes: 가로, 세로, 꺾임, 삐침, 점, 동그라미", () => {
  expect(
    strokeShape(
      path("h", [
        [200, 300],
        [600, 290],
      ]),
    ).prims,
  ).toEqual(["H"]);
  expect(
    strokeShape(
      path("v", [
        [500, 100],
        [505, 700],
      ]),
    ).prims,
  ).toEqual(["V"]);
  expect(
    strokeShape(
      path("ㄱ", [
        [200, 200],
        [500, 200],
        [480, 520],
      ]),
    ).prims,
  ).toEqual(["H", "V"]);
  expect(
    strokeShape(
      path("ㄴ", [
        [250, 150],
        [250, 450],
        [600, 450],
      ]),
    ).prims,
  ).toEqual(["V", "H"]);
  expect(
    strokeShape(
      path("삐침", [
        [500, 200],
        [300, 500],
      ]),
    ).prims,
  ).toEqual(["L"]);
  expect(
    strokeShape(
      path("점", [
        [500, 200],
        [520, 230],
      ]),
    ).prims,
  ).toEqual(["D"]);
  expect(strokeShape(circle("ㅇ", 500, 750, 110)).prims).toEqual(["O"]);
});

it("knows jamo grammar and measures how close writing is", () => {
  expect(jamoGrammar("ㄱ")).toBe("HV");
  expect(jamoGrammar("ㄲ")).toBe("HVHV");
  expect(syllableGrammar("강")).toEqual(["HV", "VH", "O"]);
  expect(grammarCost(["H", "V"], "HV")).toBe(0);
  expect(grammarCost(["H", "L"], "HV")).toBeLessThan(0.5); // ㄱ의 내리긋기가 비스듬해도 거의 같다
  expect(grammarCost(["O"], "HV")).toBeGreaterThan(1.4);
});

it("uses the stroke grammar to split 강 written as ㄱ(꺾임) + ㅏ + ㅇ", () => {
  order = 0;
  const strokes = [
    path("ㄱ", [
      [220, 220],
      [470, 220],
      [430, 560],
    ]),
    path("ㅏ1", [
      [640, 120],
      [640, 640],
    ]),
    path("ㅏ2", [
      [640, 380],
      [770, 380],
    ]),
    circle("ㅇ", 500, 790, 100),
  ];
  const judged = judgeStrokes("강", strokes, {
    referenceFont: "sans",
    grid: { diamond: true },
  } as never)!;
  expect([...judged.parts.values()]).toEqual(["cho", "jung", "jung", "jong"]);
});

it("tells the pillar of ㅏ from its branch, and the beam of ㅗ", () => {
  const roles = vowelRoles([
    path("p", [
      [640, 120],
      [640, 640],
    ]),
    path("b", [
      [640, 380],
      [770, 380],
    ]),
  ]);
  expect(roles.get("p")).toBe("pillar");
  expect(roles.get("b")).toBe("branch");
  const o = vowelRoles([
    path("s", [
      [500, 520],
      [500, 600],
    ]),
    path("beam", [
      [200, 610],
      [800, 600],
    ]),
  ]);
  expect(o.get("beam")).toBe("beam");
  expect(o.get("s")).toBe("branch");
});
