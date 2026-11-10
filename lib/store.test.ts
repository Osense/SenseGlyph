import { beforeEach, it, expect } from "vitest";
import { useStudio } from "./store";
import { newProject } from "./defaults";
import type { Stroke } from "./types";
const stroke = (id: string): Stroke => ({
  id,
  brush: "pen",
  params: { size: 50, usePressure: true },
  points: [
    { x: 20, y: 30, p: 0.7, t: 0 },
    { x: 30, y: 50, p: 0.8, t: 10 },
  ],
  order: 0,
  createdAt: 1,
});
beforeEach(() => useStudio.getState().setProject(newProject()));
it("maintains separate character histories and clears redo after a new command", () => {
  const store = useStudio.getState();
  store.commit("겨", "hangul-syllable", [stroke("a")]);
  store.commit("구", "hangul-syllable", [stroke("b")]);
  store.undo("겨");
  expect(useStudio.getState().project?.samples["겨"].strokes).toEqual([]);
  expect(useStudio.getState().project?.samples["구"].strokes).toHaveLength(1);
  store.redo("겨");
  expect(useStudio.getState().project?.samples["겨"].strokes[0].id).toBe("a");
  store.undo("겨");
  store.commit("겨", "hangul-syllable", [stroke("c")]);
  store.redo("겨");
  expect(useStudio.getState().project?.samples["겨"].strokes[0].id).toBe("c");
});
it("restores all original vectors after reset and eraser splits", () => {
  const s = useStudio.getState(),
    original = stroke("original");
  s.commit("겨", "hangul-syllable", [original]);
  s.commit("겨", "hangul-syllable", []);
  s.undo("겨");
  expect(useStudio.getState().project?.samples["겨"].strokes).toEqual([
    original,
  ]);
  s.commit("겨", "hangul-syllable", [stroke("fragment1"), stroke("fragment2")]);
  s.undo("겨");
  expect(useStudio.getState().project?.samples["겨"].strokes).toEqual([
    original,
  ]);
});
