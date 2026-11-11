"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import CanvasStepButtons from "./CanvasStepButtons";
import type { PointerEvent as ReactPointerEvent } from "react";
import { outlines } from "../lib/brushes";
import { pixelToEm } from "../lib/geometry";
import {
  assignStroke,
  boxesFor,
  PART_COLORS,
  PART_LABELS,
} from "../lib/font/composition";
import {
  activeSeparation,
  deformStroke,
  effectiveStrokes,
  moveStrokes,
  selectStrokesLasso,
  type LassoPoint,
  strokeBounds,
} from "../lib/font/editing";
import { SAFE_INSET, strokesAreSafe } from "../lib/safety";
import type { FontProject, Stroke } from "../lib/types";
import type { FontPreparation, Part, Separation } from "../lib/font/types";
import { Thumbnail } from "./Preview";
import { referenceFont } from "../lib/reference-fonts";
import { referenceGuide, referenceUsesFallback } from "../lib/font/reference";

/** Paints the reference font's real jamo regions: faint area = where a stroke
 * counts as that part, stronger tone = the font's own ink of that part. */
function useRegionImage(guide: ReturnType<typeof referenceGuide>) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!guide) return setUrl("");
    const n = guide.resolution,
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = n;
    const context = canvas.getContext("2d");
    if (!context) return setUrl("");
    const image = context.createImageData(n, n);
    const colors = (["cho", "jung", "jong"] as Part[]).map((part) => {
      const hex = PART_COLORS[part];
      return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    });
    guide.pixels.forEach((label, i) => {
      const [r, g, b] = colors[label - 1];
      image.data.set([r, g, b, guide.ink[i] ? 92 : 20], i * 4);
    });
    context.putImageData(image, 0, 0);
    setUrl(canvas.toDataURL());
  }, [guide]);
  return url;
}

interface Props {
  project: FontProject;
  preparation: FontPreparation;
  char: string;
  chars: string[];
  onSelect: (char: string) => void;
  onChange: (prep: FontPreparation) => void;
}
type Gesture = {
  id: number;
  start: { x: number; y: number };
  kind: "lasso" | "move" | "point";
  path: LassoPoint[];
  hit?: string;
  base: Stroke[];
  ids: string[];
  additive: boolean;
  point?: { id: string; index: number };
  current: { x: number; y: number };
};
export default function SeparationEditor({
  project,
  preparation: prep,
  char,
  chars,
  onSelect,
  onChange,
}: Props) {
  const sample = project.samples[char];
  const separation = activeSeparation(sample, prep.separations[char]) ?? {
    assignments: {},
  };
  const strokes = effectiveStrokes(sample, separation);
  const boxes = boxesFor(char, separation, project.settings),
    parts = Object.keys(boxes) as Part[];
  const guide = separation.boxes
    ? null
    : referenceGuide(char, project.settings);
  const regionImage = useRegionImage(guide);
  const [selection, setSelection] = useState<string[]>([]),
    [mode, setMode] = useState<"select" | "lasso" | "point">("lasso"),
    [radius, setRadius] = useState(100);
  const [draft, setDraft] = useState<Stroke[] | null>(null),
    [lasso, setLasso] = useState<LassoPoint[] | null>(null),
    [error, setError] = useState("");
  const [past, setPast] = useState<Separation[]>([]),
    [future, setFuture] = useState<Separation[]>([]);
  const svg = useRef<SVGSVGElement>(null),
    strip = useRef<HTMLDivElement>(null),
    assignments = useRef<HTMLDivElement>(null),
    rowPositions = useRef(new Map<string, number>()),
    gesture = useRef<Gesture | null>(null);
  const displayed = draft ?? strokes,
    bounds = useMemo(
      () => strokeBounds(displayed, selection),
      [displayed, selection],
    );
  const currentIndex = chars.indexOf(char);
  const rankedStrokes = useMemo(
    () =>
      [...strokes].sort(
        (a, b) =>
          Number(selection.includes(b.id)) - Number(selection.includes(a.id)),
      ),
    [strokes, selection],
  );
  useLayoutEffect(() => {
    const container = assignments.current;
    if (!container) return;
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>("[data-assignment-id]"),
    );
    const next = new Map(
      rows.map((row) => [row.dataset.assignmentId!, row.offsetTop]),
    );
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const context = gsap.context(() => {
      rows.forEach((row) => {
        const previous = rowPositions.current.get(row.dataset.assignmentId!);
        if (previous !== undefined && !reduced)
          gsap.fromTo(
            row,
            { y: previous - row.offsetTop },
            {
              y: 0,
              duration: 0.32,
              ease: "power2.out",
              clearProps: "transform",
            },
          );
      });
      if (selection.length && container.scrollTop > 0) {
        if (reduced) container.scrollTop = 0;
        else
          gsap.to(container, {
            scrollTop: 0,
            duration: 0.3,
            ease: "power2.out",
          });
      }
    }, container);
    rowPositions.current = next;
    return () => context.revert();
  }, [selection, rankedStrokes]);
  const update = (next: Separation, remember = true) => {
    if (remember) {
      setPast((history) => [...history.slice(-79), separation]);
      setFuture([]);
    }
    onChange({
      ...prep,
      separations: {
        ...prep.separations,
        [char]: { ...next, sourceUpdatedAt: sample.updatedAt },
      },
    });
    setError("");
  };
  const undo = () => {
    if (!past.length) return;
    const next = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([separation, ...future]);
    update(next, false);
    setDraft(null);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast([...past, separation]);
    setFuture(future.slice(1));
    update(next, false);
    setDraft(null);
  };
  const changeChar = (delta: number) => {
    if (!gesture.current)
      onSelect(
        chars[Math.max(0, Math.min(chars.length - 1, currentIndex + delta))],
      );
  };
  useEffect(() => {
    setSelection([]);
    setDraft(null);
    setLasso(null);
    setError("");
    setPast([]);
    setFuture([]);
    gesture.current = null;
    const selected = strip.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    if (selected && strip.current)
      strip.current.scrollTo({
        left:
          selected.offsetLeft -
          strip.current.offsetLeft -
          strip.current.clientWidth / 2 +
          selected.offsetWidth / 2,
        behavior: "smooth",
      });
  }, [char]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        gesture.current ||
        (target instanceof HTMLElement &&
          ["TEXTAREA", "SELECT"].includes(target.tagName)) ||
        (target instanceof HTMLInputElement &&
          !["checkbox", "radio", "button"].includes(target.type))
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        changeChar(event.key === "ArrowLeft" ? -1 : 1);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(strokes.map((stroke) => stroke.id));
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  const toggle = (id: string) =>
    setSelection((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  const assign = (id: string, part: Part) => {
    const ids = selection.includes(id) ? selection : [id];
    update({
      ...separation,
      assignments: {
        ...separation.assignments,
        ...Object.fromEntries(ids.map((item) => [item, part])),
      },
    });
  };
  const point = (event: ReactPointerEvent<SVGSVGElement>) =>
    pixelToEm(
      event.clientX,
      event.clientY,
      svg.current!.getBoundingClientRect(),
    );
  const preview = (g: Gesture, end: { x: number; y: number }) =>
    g.kind === "move"
      ? moveStrokes(g.base, g.ids, end.x - g.start.x, end.y - g.start.y)
      : deformStroke(
          g.base,
          g.point!.id,
          g.point!.index,
          end.x - g.start.x,
          end.y - g.start.y,
          radius,
        );
  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (
      gesture.current ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const start = point(event),
      target = event.target as Element,
      id = target.closest("[data-stroke-id]")?.getAttribute("data-stroke-id");
    let index = target.getAttribute("data-point-index");
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    let ids = selection,
      kind: Gesture["kind"] = "lasso";
    if (id && (mode !== "lasso" || selection.includes(id))) {
      if (additive && index === null) {
        toggle(id);
        return;
      }
      if (mode === "point" && index === null) {
        const stroke = strokes.find((stroke) => stroke.id === id)!;
        let distance = Infinity,
          nearest = 0;
        stroke.points.forEach((p, i) => {
          const d = Math.hypot(p.x - start.x, p.y - start.y);
          if (d < distance) {
            distance = d;
            nearest = i;
          }
        });
        index = String(nearest);
      }
      ids = mode === "point" || !selection.includes(id) ? [id] : selection;
      setSelection(ids);
      kind = mode === "point" && index !== null ? "point" : "move";
    } else if (!additive) setSelection([]);
    gesture.current = {
      id: event.pointerId,
      start,
      current: start,
      kind,
      path: [start],
      hit: id ?? undefined,
      base: strokes,
      ids,
      additive,
      ...(id && index !== null ? { point: { id, index: +index } } : {}),
    };
    svg.current!.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    g.current = point(event);
    if (g.kind === "lasso") {
      if (
        Math.hypot(
          g.current.x - g.path[g.path.length - 1].x,
          g.current.y - g.path[g.path.length - 1].y,
        ) > 2
      )
        g.path.push(g.current);
      setLasso([...g.path]);
      const hits = selectStrokesLasso(g.base, g.path);
      const next = g.additive ? [...new Set([...g.ids, ...hits])] : hits;
      setSelection((previous) =>
        previous.length === next.length &&
        previous.every((id, i) => id === next[i])
          ? previous
          : next,
      );
    } else setDraft(preview(g, g.current));
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>, cancel = false) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (!cancel) g.current = point(event);
    else setSelection(g.ids);
    if (!cancel && g.kind === "lasso") {
      g.path.push(g.current);
      const hits =
        g.path.length < 4 && g.hit
          ? [g.hit]
          : selectStrokesLasso(g.base, g.path);
      const next = g.additive ? [...new Set([...g.ids, ...hits])] : hits;
      setSelection((previous) =>
        previous.length === next.length &&
        previous.every((id, i) => id === next[i])
          ? previous
          : next,
      );
    }
    if (
      !cancel &&
      g.kind !== "lasso" &&
      Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) > 0.5
    ) {
      const next = preview(g, g.current);
      if (
        !strokesAreSafe(
          next.filter((stroke) => g.ids.includes(stroke.id)),
          sample.category,
        )
      )
        setError(
          "안전영역을 벗어났어요. 이동을 취소했습니다. 점선 안쪽으로 옮겨주세요.",
        );
      else
        update({
          ...separation,
          strokes: next,
          assignments: {
            ...Object.fromEntries(
              strokes.map((stroke) => [
                stroke.id,
                assignStroke(char, stroke, separation, project.settings),
              ]),
            ),
            ...separation.assignments,
          },
        });
    }
    setDraft(null);
    setLasso(null);
  };
  const anchorStroke = displayed.find((stroke) =>
    selection.includes(stroke.id),
  );
  const anchors = anchorStroke
    ? [
        ...new Set([
          ...Array.from(
            { length: Math.min(64, anchorStroke.points.length) },
            (_, i) =>
              Math.floor(
                (i * (anchorStroke.points.length - 1)) /
                  Math.max(1, Math.min(64, anchorStroke.points.length) - 1),
              ),
          ),
          anchorStroke.points.length - 1,
        ]),
      ]
    : [];

  return (
    <div className="separation-editor">
      <div className="character-navigation">
        <button
          aria-label="이전 보정 글자"
          disabled={currentIndex <= 0}
          onClick={() => changeChar(-1)}
        >
          ← 이전
        </button>
        <div>
          <strong>{char}</strong>
          <span>
            {currentIndex + 1} / {chars.length} · ← → 키로 이동
          </span>
        </div>
        <button
          aria-label="다음 보정 글자"
          disabled={currentIndex >= chars.length - 1}
          onClick={() => changeChar(1)}
        >
          다음 →
        </button>
      </div>
      <div className="editor-toolbar">
        <div className="editor-modes">
          <button
            className={mode === "lasso" ? "active" : ""}
            onClick={() => setMode("lasso")}
          >
            올가미 선택
          </button>
          <button
            className={mode === "select" ? "active" : ""}
            onClick={() => setMode("select")}
          >
            선택·이동
          </button>
          <button
            className={mode === "point" ? "active" : ""}
            onClick={() => setMode("point")}
          >
            부분 수정
          </button>
        </div>
        <button
          disabled={!past.length}
          onClick={undo}
          aria-label="보정 실행 취소"
        >
          ↶ 취소
        </button>
        <button
          disabled={!future.length}
          onClick={redo}
          aria-label="보정 다시 실행"
        >
          ↷ 다시
        </button>
        <button
          onClick={() => setSelection(strokes.map((stroke) => stroke.id))}
        >
          전체 선택
        </button>
        <button disabled={!selection.length} onClick={() => setSelection([])}>
          선택 해제
        </button>
      </div>
      <p className="font-help">
        올가미로 원하는 획을 둘러싸세요. 선택한 획은 오른쪽 목록 맨 위로
        모입니다. 초·중·종성 버튼을 누르면 한 번에 배정돼요. 선택된 획을 끌면
        함께 이동합니다.{" "}
        {mode === "point"
          ? "점을 드래그하면 주변 획 모양만 부드럽게 수정됩니다."
          : "Shift를 누르거나 행의 체크박스를 누르면 선택을 더하거나 뺄 수 있어요."}
      </p>
      {mode === "point" && (
        <label className="point-radius">
          부분 수정 범위 {radius} em
          <input
            aria-label="부분 수정 범위"
            type="range"
            min="25"
            max="250"
            value={radius}
            onChange={(e) => setRadius(+e.target.value)}
          />
        </label>
      )}
      {error && (
        <p className="font-error" role="alert">
          {error}
        </p>
      )}
      <p
        className="reference-region-note"
        data-reference-font={project.settings.referenceFont ?? "sans"}
      >
        {separation.boxes
          ? "직접 조절한 자모 영역"
          : guide
            ? `${referenceUsesFallback(char, project.settings.referenceFont) ? "대체 견본(Noto Sans KR)" : referenceFont(project.settings.referenceFont).name}의 ‘${char}’ 자모 판정 범위. 진한 색은 견본의 획, 옅은 색은 판정되는 영역입니다.`
            : `‘${char}’의 자모 배치를 기준으로 나눈 판정 범위입니다.`}
      </p>
      <div className="separation-layout">
        <div>
          <div className="separation-canvas-frame">
            <CanvasStepButtons
              context="자모"
              navigation={{
                previousDisabled: currentIndex <= 0,
                nextDisabled: currentIndex >= chars.length - 1,
                onPrevious: () => changeChar(-1),
                onNext: () => changeChar(1),
              }}
            />
            <svg
              ref={svg}
              viewBox="0 0 1000 1000"
              className="separation-svg editable"
              aria-label={char + " 자모 분리 화면"}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={(event) => finish(event)}
              onPointerCancel={(event) => finish(event, true)}
              onLostPointerCapture={(event) => finish(event, true)}
            >
              <rect width="1000" height="1000" fill="transparent" />
              {guide && regionImage && (
                <image
                  data-reference-regions="true"
                  href={regionImage}
                  x={guide.x - guide.width / (guide.resolution - 3)}
                  y={guide.y - guide.height / (guide.resolution - 3)}
                  width={
                    (guide.width * guide.resolution) / (guide.resolution - 3)
                  }
                  height={
                    (guide.height * guide.resolution) / (guide.resolution - 3)
                  }
                  preserveAspectRatio="none"
                  style={{ imageRendering: "pixelated" }}
                  pointerEvents="none"
                />
              )}
              {parts.map((part) => {
                const box = boxes[part]!;
                if (guide)
                  return (
                    <text
                      key={part}
                      x={box.x + 6}
                      y={box.y - 8}
                      fill={PART_COLORS[part]}
                      fontSize="23"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {PART_LABELS[part]}
                    </text>
                  );
                return (
                  <g key={part} pointerEvents="none">
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      fill={PART_COLORS[part]}
                      fillOpacity=".045"
                      stroke={PART_COLORS[part]}
                      strokeDasharray="10 10"
                      strokeWidth="2"
                    />
                    <text
                      x={box.x + 12}
                      y={box.y + 30}
                      fill={PART_COLORS[part]}
                      fontSize="23"
                    >
                      {PART_LABELS[part]}
                    </text>
                  </g>
                );
              })}
              <rect
                x={SAFE_INSET}
                y={SAFE_INSET}
                width={1000 - SAFE_INSET * 2}
                height={1000 - SAFE_INSET * 2}
                fill="none"
                stroke="#b99d72"
                strokeDasharray="7 5"
                strokeWidth="2"
                pointerEvents="none"
              />
              {displayed.map((stroke, i) => {
                const part = assignStroke(
                    char,
                    stroke,
                    separation,
                    project.settings,
                  ),
                  polygons = outlines(
                    stroke.points,
                    stroke.brush,
                    stroke.params,
                  );
                return (
                  <path
                    key={stroke.id}
                    data-stroke-id={stroke.id}
                    d={polygons
                      .map(
                        (poly) =>
                          "M" + poly.map((p) => p.join(",")).join("L") + "Z",
                      )
                      .join(" ")}
                    fillRule="nonzero"
                    fill={PART_COLORS[part]}
                    stroke={selection.includes(stroke.id) ? "#dca829" : "none"}
                    strokeWidth="6"
                    role="button"
                    tabIndex={0}
                    aria-label={i + 1 + "번 획 " + PART_LABELS[part]}
                    aria-pressed={selection.includes(stroke.id)}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        toggle(stroke.id);
                      }
                    }}
                  />
                );
              })}
              {bounds && (
                <rect
                  x={bounds.x - 10}
                  y={bounds.y - 10}
                  width={bounds.width + 20}
                  height={bounds.height + 20}
                  fill="none"
                  stroke="#d5a228"
                  strokeWidth="3"
                  strokeDasharray="8 5"
                  pointerEvents="none"
                />
              )}
              {lasso && (
                <path
                  data-lasso="true"
                  d={"M" + lasso.map((p) => `${p.x},${p.y}`).join("L") + "Z"}
                  fill="#497fba25"
                  stroke="#497fba"
                  strokeWidth="3"
                  pointerEvents="none"
                />
              )}
              {mode === "point" &&
                anchorStroke &&
                anchors.map((index) => {
                  const p = anchorStroke.points[index];
                  return (
                    <circle
                      key={index}
                      data-stroke-id={anchorStroke.id}
                      data-point-index={index}
                      cx={p.x}
                      cy={p.y}
                      r="8"
                      fill="#fffdf1"
                      stroke="#456d98"
                      strokeWidth="3"
                      className="point-handle"
                    />
                  );
                })}
            </svg>
            {bounds && !lasso && !draft && (
              <div className="separation-assignment-overlay">
                <div
                  className="quick-assign"
                  role="group"
                  aria-label={`선택한 획 한 번에 배정 (${selection.length}획)`}
                  style={
                    {
                      "--selection-center": `${(bounds.x + bounds.width / 2) / 10}%`,
                      "--selection-top": `${(bounds.y - 10) / 10}%`,
                    } as React.CSSProperties
                  }
                >
                  {(["cho", "jung", "jong"] as Part[]).map((part) => (
                    <button
                      type="button"
                      key={part}
                      disabled={!parts.includes(part)}
                      style={
                        {
                          "--part-color": PART_COLORS[part],
                        } as React.CSSProperties
                      }
                      onClick={() => assign(selection[0], part)}
                    >
                      {PART_LABELS[part]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="part-legend">
            {parts.map((part) => (
              <span key={part} style={{ color: PART_COLORS[part] }}>
                ● {PART_LABELS[part]}
              </span>
            ))}
          </div>
        </div>
        <div className="stroke-assignments" ref={assignments}>
          <div className="assignment-heading">
            <h3>획별 자모 배정</h3>
            <span role="status">{selection.length}개 선택</span>
          </div>
          {rankedStrokes.map((stroke) => {
            const i = strokes.findIndex((item) => item.id === stroke.id);
            return (
              <div
                className={
                  "assignment-row " +
                  (selection.includes(stroke.id) ? "chosen" : "")
                }
                key={stroke.id}
                data-assignment-id={stroke.id}
              >
                <label className="stroke-check">
                  <input
                    type="checkbox"
                    aria-label={i + 1 + "번 획 선택"}
                    checked={selection.includes(stroke.id)}
                    onChange={() => toggle(stroke.id)}
                  />
                  {i + 1}번
                </label>
                <div
                  className="part-buttons"
                  role="group"
                  aria-label={i + 1 + "번 획 자모"}
                >
                  {(["cho", "jung", "jong"] as Part[]).map((part) => (
                    <button
                      key={part}
                      disabled={!parts.includes(part)}
                      aria-label={
                        i + 1 + "번 획 " + PART_LABELS[part] + " 지정"
                      }
                      aria-pressed={
                        assignStroke(
                          char,
                          stroke,
                          separation,
                          project.settings,
                        ) === part
                      }
                      className={
                        assignStroke(
                          char,
                          stroke,
                          separation,
                          project.settings,
                        ) === part
                          ? "active"
                          : ""
                      }
                      style={
                        {
                          "--part-color": PART_COLORS[part],
                        } as React.CSSProperties
                      }
                      onClick={() => assign(stroke.id, part)}
                    >
                      {PART_LABELS[part]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="font-help">
            여러 행이 선택된 상태에서는 선택된 행의 자모 버튼이 전체 선택에
            적용됩니다.
          </p>
          <button
            className="font-secondary"
            onClick={() => update({ assignments: {} })}
          >
            이 글자 보정 초기화
          </button>
        </div>
      </div>
      <details className="box-settings">
        <summary>자모 위치 상자 조절</summary>
        {parts.map((part) => (
          <fieldset key={part}>
            <legend>{PART_LABELS[part]}</legend>
            {(["x", "y", "width", "height"] as const).map((key) => (
              <label key={key}>
                {{ x: "왼쪽", y: "위쪽", width: "너비", height: "높이" }[key]}
                <input
                  aria-label={PART_LABELS[part] + " 상자 " + key}
                  type="number"
                  min={key === "width" || key === "height" ? 50 : 0}
                  max="1000"
                  value={Math.round(boxes[part]![key])}
                  onChange={(event) => {
                    const value = +event.target.value;
                    if (
                      !Number.isFinite(value) ||
                      value < (key === "width" || key === "height" ? 50 : 0) ||
                      value > 1000
                    )
                      return;
                    update({
                      ...separation,
                      boxes: {
                        ...separation.boxes,
                        [part]: { ...boxes[part]!, [key]: value },
                      },
                    });
                  }}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </details>
      <div
        className="character-slider"
        ref={strip}
        role="listbox"
        aria-label="보정할 글자 슬라이드"
      >
        {chars.map((item) => (
          <button
            key={item}
            role="option"
            aria-label={item + " 보정"}
            aria-selected={item === char}
            aria-current={item === char ? "true" : undefined}
            onClick={() => onSelect(item)}
          >
            <Thumbnail
              strokes={effectiveStrokes(
                project.samples[item],
                prep.separations[item],
              )}
            />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
