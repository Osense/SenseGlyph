import { openDB } from "idb";
import type { BrushParams, FontProject } from "./types";
import { CHARSET } from "../data/charset";
import { validPreparation } from "./font/validate";
import { REFERENCE_FONTS } from "./reference-fonts";
import { newProject } from "./defaults";
const database = () =>
  openDB("handwriting-studio", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("meta");
    },
  });
export async function loadProject(): Promise<FontProject | undefined> {
  const db = await database();
  const id = await db.get("meta", "active");
  return id ? db.get("projects", id) : undefined;
}
export async function saveProject(project: FontProject) {
  const db = await database();
  const tx = db.transaction(["projects", "meta"], "readwrite");
  await tx.objectStore("projects").put(project);
  await tx.objectStore("meta").put(project.id, "active");
  await tx.done;
}
export async function listProjects() {
  const db = await database();
  const projects = (await db.getAll("projects")) as FontProject[];
  return projects
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      count: Object.values(p.samples).filter((s) => s.strokes.length).length,
    }));
}
export async function startProject(current: FontProject, name: string) {
  const db = await database();
  const tx = db.transaction(["projects", "meta"], "readwrite");
  const projects = (await tx.objectStore("projects").getAll()) as FontProject[];
  const base = name.trim().slice(0, 72) || "새 손글씨";
  let unique = base,
    number = 2;
  while (current.name === unique || projects.some((p) => p.name === unique))
    unique = base + " (" + number++ + ")";
  const next = { ...newProject(), name: unique };
  await tx.objectStore("projects").put(current);
  await tx.objectStore("projects").put(next);
  await tx.objectStore("meta").put(next.id, "active");
  await tx.done;
  return next;
}
export async function switchProject(current: FontProject, id: string) {
  const db = await database();
  const tx = db.transaction(["projects", "meta"], "readwrite");
  const next = (await tx.objectStore("projects").get(id)) as
    FontProject | undefined;
  if (!next) {
    tx.abort();
    throw new Error("프로젝트를 찾을 수 없습니다.");
  }
  await tx.objectStore("projects").put(current);
  await tx.objectStore("meta").put(id, "active");
  await tx.done;
  return next;
}
export async function deleteProject(id: string) {
  const db = await database();
  const tx = db.transaction(["projects", "meta"], "readwrite");
  if ((await tx.objectStore("meta").get("active")) === id) {
    tx.abort();
    throw new Error("현재 작업은 다른 프로젝트를 연 다음 삭제할 수 있어요.");
  }
  await tx.objectStore("projects").delete(id);
  await tx.done;
}
const brushes = ["pen", "marker", "brush", "pencil", "nib"];
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function params(v: unknown, nib: boolean): v is BrushParams {
  return (
    record(v) &&
    finite(v.size) &&
    v.size >= 20 &&
    v.size <= 120 &&
    typeof v.usePressure === "boolean" &&
    (!nib || (finite(v.nibAngle) && v.nibAngle >= 0 && v.nibAngle <= 180))
  );
}
export function parseProject(text: string): FontProject {
  const p: unknown = JSON.parse(text);
  if (
    !record(p) ||
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    p.name.length > 80 ||
    !finite(p.createdAt) ||
    !finite(p.updatedAt) ||
    !record(p.settings) ||
    !record(p.samples)
  )
    throw new Error("지원하지 않는 프로젝트 형식입니다.");
  const s = p.settings;
  if (
    s.referenceFont !== undefined &&
    !REFERENCE_FONTS.some((font) => font.id === s.referenceFont)
  )
    throw new Error("견본 글꼴 설정 오류");
  if (p.fontPreparation !== undefined && !validPreparation(p.fontPreparation))
    throw new Error("폰트 제작 설정이 올바르지 않습니다.");
  if (
    !record(s.grid) ||
    !["inside-faint", "outside", "hidden"].includes(String(s.sampleMode)) ||
    !finite(s.sampleOpacity) ||
    s.sampleOpacity < 0.05 ||
    s.sampleOpacity > 0.4 ||
    !brushes.includes(String(s.activeBrush)) ||
    !finite(s.eraserSize) ||
    s.eraserSize < 20 ||
    s.eraserSize > 200 ||
    !["stroke", "partial"].includes(String(s.eraserMode)) ||
    typeof s.penOnly !== "boolean" ||
    typeof s.allowMouse !== "boolean" ||
    !record(s.brushParams)
  )
    throw new Error("설정 데이터가 올바르지 않습니다.");
  for (const key of ["halfVertical", "halfHorizontal", "diamond", "sizeGuide"])
    if (typeof s.grid[key] !== "boolean") throw new Error("격자 설정 오류");
  for (const b of brushes)
    if (!params(s.brushParams[b], b === "nib"))
      throw new Error("브러시 설정 오류");
  for (const [char, g] of Object.entries(p.samples)) {
    if (
      record(g) &&
      g.needsReview !== undefined &&
      typeof g.needsReview !== "boolean"
    )
      throw new Error("다시 확인 표시 데이터 오류");
    if (
      record(g) &&
      g.rewritePending !== undefined &&
      typeof g.rewritePending !== "boolean"
    )
      throw new Error("다시 작성 표시 데이터 오류");
    const entry = CHARSET.find((c) => c.char === char);
    if (
      !entry ||
      !record(g) ||
      g.char !== char ||
      g.category !== entry.category ||
      !finite(g.updatedAt) ||
      !["empty", "done", "skipped"].includes(String(g.status)) ||
      !Array.isArray(g.strokes)
    )
      throw new Error("글자 데이터 오류");
    const ids = new Set<string>();
    for (const stroke of g.strokes) {
      if (
        !record(stroke) ||
        typeof stroke.id !== "string" ||
        ids.has(stroke.id) ||
        !brushes.includes(String(stroke.brush)) ||
        !params(stroke.params, stroke.brush === "nib") ||
        !finite(stroke.createdAt) ||
        !finite(stroke.order) ||
        !Number.isInteger(stroke.order) ||
        stroke.order < 0 ||
        !Array.isArray(stroke.points) ||
        !stroke.points.length
      )
        throw new Error("획 데이터 오류");
      ids.add(stroke.id);
      let previousTime = -Infinity;
      for (const q of stroke.points) {
        if (
          !record(q) ||
          ![q.x, q.y, q.p, q.t].every(finite) ||
          !finite(q.p) ||
          q.p < 0 ||
          q.p > 1 ||
          !finite(q.t) ||
          q.t < 0 ||
          q.t < previousTime ||
          (q.tiltX !== undefined && !finite(q.tiltX)) ||
          (q.tiltY !== undefined && !finite(q.tiltY))
        )
          throw new Error("좌표 데이터 오류");
        previousTime = q.t;
      }
    }
  }
  // All fields consumed by rendering are validated above; retain future-compatible unknown metadata.
  return {
    ...p,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as unknown as FontProject;
}
