import { create } from "zustand";
import { defaultSettings } from "./defaults";
import type {
  Purchase,
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
  /** 결제 완료 표시(이후 글씨·정돈 수정 잠금) */
  markPurchased: (purchase: Purchase) => void;
}
/** 결제한 프로젝트에서 바꿀 수 없는 설정(폰트 모양에 영향) */
const LOCKED_SETTINGS = ["referenceFont", "script", "grid"] as const;
export const useStudio = create<State>((set, get) => ({
  project: null,
  histories: {},
  setProject: (project) =>
    set({
      project: {
        ...project,
        settings: {
          ...project.settings,
          sampleMode:
            project.settings.sampleMode === "hidden"
              ? "inside-faint"
              : project.settings.sampleMode,
          brushParams: {
            ...defaultSettings().brushParams,
            ...project.settings.brushParams,
          },
        },
      },
      histories: {},
    }),
  markReview: (char, category, needsReview) =>
    set((state) => {
      const project = state.project;
      if (!project || project.purchase) return {};
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
  markPurchased: (purchase) =>
    set((s) => ({
      project: s.project
        ? { ...s.project, purchase, updatedAt: Date.now() }
        : null,
    })),
  prepareFont: (fontPreparation) =>
    set((s) =>
      s.project?.purchase
        ? {}
        : {
            project: s.project
              ? { ...s.project, fontPreparation, updatedAt: Date.now() }
              : null,
          },
    ),
  rename: (name) =>
    set((s) => ({
      project: s.project ? { ...s.project, name, updatedAt: Date.now() } : null,
    })),
  settings: (settings) =>
    set((s) => {
      if (s.project?.purchase)
        settings = Object.fromEntries(
          Object.entries(settings).filter(
            ([key]) => !(LOCKED_SETTINGS as readonly string[]).includes(key),
          ),
        );
      return {
        project: s.project
          ? {
              ...s.project,
              settings: { ...s.project.settings, ...settings },
              updatedAt: Date.now(),
            }
          : null,
      };
    }),
  commit: (char, category, strokes, status) => {
    const p = get().project;
    if (!p || p.purchase) return;
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
    if (get().project?.purchase) return;
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
    if (get().project?.purchase) return;
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
