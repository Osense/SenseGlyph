import { create } from "zustand";
import type {
  FontProject,
  ProjectSettings,
  Stroke,
  GlyphSample,
  CharCategory,
} from "./types";
type History = { past: Stroke[][]; future: Stroke[][] };
interface State {
  project: FontProject | null;
  histories: Record<string, History>;
  setProject: (p: FontProject) => void;
  settings: (s: Partial<ProjectSettings>) => void;
  rename: (name: string) => void;
  markReview: (char: string, category: CharCategory, value: boolean) => void;
  prepareFont: (preparation: import("./font/types").FontPreparation) => void;
  commit: (
    char: string,
    category: CharCategory,
    strokes: Stroke[],
    status?: GlyphSample["status"],
  ) => void;
  undo: (char: string) => void;
  redo: (char: string) => void;
}
export const useStudio = create<State>((set, get) => ({
  project: null,
  histories: {},
  setProject: (project) => set({ project, histories: {} }),
  markReview: (char, category, needsReview) =>
    set((state) => {
      const project = state.project;
      if (!project) return {};
      const sample = project.samples[char] ?? {
        char,
        category,
        strokes: [],
        status: "empty" as const,
        updatedAt: Date.now(),
      };
      // A review note does not change source vectors or invalidate saved jamo corrections.
      return {
        project: {
          ...project,
          updatedAt: Date.now(),
          samples: { ...project.samples, [char]: { ...sample, needsReview } },
        },
      };
    }),
  prepareFont: (fontPreparation) =>
    set((s) => ({
      project: s.project
        ? { ...s.project, fontPreparation, updatedAt: Date.now() }
        : null,
    })),
  rename: (name) =>
    set((s) => ({
      project: s.project ? { ...s.project, name, updatedAt: Date.now() } : null,
    })),
  settings: (settings) =>
    set((s) => ({
      project: s.project
        ? {
            ...s.project,
            settings: { ...s.project.settings, ...settings },
            updatedAt: Date.now(),
          }
        : null,
    })),
  commit: (char, category, strokes, status) => {
    const p = get().project;
    if (!p) return;
    const prev = p.samples[char]?.strokes ?? [],
      h = get().histories[char] ?? { past: [], future: [] };
    set({
      project: {
        ...p,
        updatedAt: Date.now(),
        samples: {
          ...p.samples,
          [char]: {
            ...p.samples[char],
            char,
            category,
            strokes,
            rewritePending:
              !strokes.length &&
              (!!p.samples[char]?.strokes.length ||
                !!p.samples[char]?.rewritePending ||
                p.samples[char]?.status === "done"),
            updatedAt: Date.now(),
            status: status ?? (strokes.length ? "done" : "empty"),
          },
        },
      },
      histories: {
        ...get().histories,
        [char]: { past: [...h.past, prev], future: [] },
      },
    });
  },
  undo: (char) => {
    const { project: p, histories } = get(),
      h = histories[char];
    if (!p || !h?.past.length) return;
    const strokes = h.past[h.past.length - 1];
    set({
      project: {
        ...p,
        updatedAt: Date.now(),
        samples: {
          ...p.samples,
          [char]: {
            ...p.samples[char],
            strokes,
            rewritePending: !strokes.length,
            status: strokes.length ? "done" : "empty",
            updatedAt: Date.now(),
          },
        },
      },
      histories: {
        ...histories,
        [char]: {
          past: h.past.slice(0, -1),
          future: [p.samples[char].strokes, ...h.future],
        },
      },
    });
  },
  redo: (char) => {
    const { project: p, histories } = get(),
      h = histories[char];
    if (!p || !h?.future.length) return;
    const strokes = h.future[0];
    set({
      project: {
        ...p,
        updatedAt: Date.now(),
        samples: {
          ...p.samples,
          [char]: {
            ...p.samples[char],
            strokes,
            rewritePending: !strokes.length,
            status: strokes.length ? "done" : "empty",
            updatedAt: Date.now(),
          },
        },
      },
      histories: {
        ...histories,
        [char]: {
          past: [...h.past, p.samples[char].strokes],
          future: h.future.slice(1),
        },
      },
    });
  },
}));
