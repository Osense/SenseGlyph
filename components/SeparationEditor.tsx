"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CanvasStepButtons from "./CanvasStepButtons";
import type { PointerEvent as ReactPointerEvent } from "react";
import { outlines } from "../lib/brushes";
import { hitsStroke, pixelToEm } from "../lib/geometry";
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
import SeparationTutorial, { TUTORIAL_KEY } from "./SeparationTutorial";
import { referenceFont } from "../lib/reference-fonts";
import {
  guideTransform,
  referenceGuide,
  referenceUsesFallback,
} from "../lib/font/reference";
import type { SeparationStatus } from "../lib/font/separation-status";

const STATUS_LABEL: Record<SeparationStatus, string> = {
  check: "확인 필요",
  confirmed: "확인 완료",
  auto: "자동",
};

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
  onWrite: () => void;
  onChange: (prep: FontPreparation) => void;
  statuses?: Record<string, SeparationStatus>;
  /** 이미 살펴본 글자 */
  visited?: ReadonlySet<string>;
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
  onWrite,
  onChange,
  statuses = {},
  visited = new Set<string>(),
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
    [mode, setMode] = useState<"lasso" | "point">("lasso"),
    [radius, setRadius] = useState(100);
  const [draft, setDraft] = useState<Stroke[] | null>(null),
    [lasso, setLasso] = useState<LassoPoint[] | null>(null),
    [error, setError] = useState("");
  const [past, setPast] = useState<Separation[]>([]),
    [future, setFuture] = useState<Separation[]>([]);
  const svg = useRef<SVGSVGElement>(null),
    strip = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null);
  const displayed = draft ?? strokes;
  // 판정 범위는 견본 글자 모양 그대로, 쓴 글씨의 크기·위치에 맞춰 보여 준다.
  const placement = guide ? guideTransform(guide, displayed) : null;
  const regionRect = guide
    ? placement!.toWriting({
        x: guide.x - guide.width / (guide.resolution - 3),
        y: guide.y - guide.height / (guide.resolution - 3),
        width: (guide.width * guide.resolution) / (guide.resolution - 3),
        height: (guide.height * guide.resolution) / (guide.resolution - 3),
      })
    : null;
  const bounds = useMemo(
    () => strokeBounds(displayed, selection),
    [displayed, selection],
  );
  const currentIndex = chars.indexOf(char);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true);
    } catch {}
  }, []);
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
      const tapped =
        Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) < 12;
      // 획을 톡 누르면 선택에 더하거나 빼고, 빈 곳을 누르면 선택을 풀고,
      // 둘러싸면(올가미) 그 획들로 새로 선택합니다.
      // 손가락은 가는 획을 빗맞히기 쉬워서, 획 바로 옆을 눌러도 그 획을 고릅니다.
      const touched =
        g.hit ??
        g.base.find((stroke) =>
          hitsStroke(g.start, stroke.points, 28, stroke.params.size),
        )?.id;
      const next = tapped
        ? touched
          ? g.ids.includes(touched)
            ? g.ids.filter((id) => id !== touched)
            : [...g.ids, touched]
          : []
        : g.additive
          ? [...new Set([...g.ids, ...selectStrokesLasso(g.base, g.path)])]
          : selectStrokesLasso(g.base, g.path);
      setSelection((previous) =>
        previous.length === next.length &&
        previous.every((id, i) => id === next[i])
          ? previous
          : next,
      );
    }
    if (
      !cancel &&
      g.kind === "move" &&
      mode === "lasso" &&
      g.hit &&
      Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) < 8
    )
      // 선택된 획을 다시 톡 누르면 그 획만 선택에서 뺍니다.
      setSelection(g.ids.filter((id) => id !== g.hit));
    else if (
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
          "점선 밖으로 나가서 이동을 취소했어요. 점선 안쪽으로 옮겨 주세요.",
        );
      else
        update({
          ...separation,
          strokes: next,
          assignments: {
            ...Object.fromEntries(
              strokes.map((stroke) => [
                stroke.id,
                assignStroke(
                  char,
                  stroke,
                  separation,
                  project.settings,
                  strokes,
                ),
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

  const tutorial = (
    <SeparationTutorial
      onClose={() => {
        setShowTutorial(false);
        try {
          localStorage.setItem(TUTORIAL_KEY, "1");
        } catch {}
      }}
    />
  );
  return (
    <div className="separation-editor sg-sep">
      <div className="sg-sep-main">
        <div className="sg-sep-bar">
          <div className="sg-sep-char">
            <button
              className="sg-sep-step"
              aria-label="이전 보정 글자"
              disabled={currentIndex <= 0}
              onClick={() => changeChar(-1)}
            >
              ‹
            </button>
            <strong>{char}</strong>
            <span>
              {currentIndex + 1}/{chars.length}
              {statuses[char] && statuses[char] !== "auto" && (
                <em data-status={statuses[char]}>
                  {STATUS_LABEL[statuses[char]]}
                </em>
              )}
            </span>
            <button
              className="sg-sep-step"
              aria-label="다음 보정 글자"
              disabled={currentIndex >= chars.length - 1}
              onClick={() => changeChar(1)}
            >
              ›
            </button>
          </div>
          <div className="editor-modes" role="group" aria-label="편집 방식">
            <button
              className={mode === "lasso" ? "active" : ""}
              aria-pressed={mode === "lasso"}
              onClick={() => setMode("lasso")}
            >
              선택·이동
            </button>
            <button
              className={mode === "point" ? "active" : ""}
              aria-pressed={mode === "point"}
              onClick={() => setMode("point")}
            >
              부분 수정
            </button>
          </div>
          <div className="sg-sep-tools">
            <button
              disabled={!past.length}
              onClick={undo}
              aria-label="보정 실행 취소"
              title="실행 취소"
            >
              ↶
            </button>
            <button
              disabled={!future.length}
              onClick={redo}
              aria-label="보정 다시 실행"
              title="다시 실행"
            >
              ↷
            </button>
            <button
              className="sg-sep-text"
              onClick={() => update({ assignments: {} })}
              title="이 글자의 자모 배정을 처음 자동 결과로 되돌려요"
            >
              ↺ 되돌리기
            </button>
            <button className="sg-sep-text sg-sep-rewrite" onClick={onWrite}>
              ✎ 이 글자 다시 쓰기
            </button>
            <button
              className="sg-sep-help"
              aria-label="사용법 보기"
              onClick={() => setShowTutorial(true)}
            >
              ?
            </button>
          </div>
        </div>
        {(mode === "point" || error) && (
          <div className="sg-sep-sub">
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
          </div>
        )}
        <div className="sg-sep-canvas">
          <div className="separation-canvas-frame">
            {showTutorial && tutorial}
            {!selection.length && !showTutorial && (
              <p className="sg-sep-hint" aria-hidden="true">
                획을 둘러싸거나 눌러서 고른 뒤 초성·중성·종성을 눌러요
              </p>
            )}
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
                  x={regionRect!.x}
                  y={regionRect!.y}
                  width={regionRect!.width}
                  height={regionRect!.height}
                  preserveAspectRatio="none"
                  style={{ imageRendering: "pixelated" }}
                  pointerEvents="none"
                />
              )}
              <path
                className="separation-fixed-grid"
                d="M500 0V1000 M0 500H1000 M500 0L1000 500 500 1000 0 500Z"
              />
              {parts.map((part) => {
                const box = placement
                  ? placement.toWriting(boxes[part]!)
                  : boxes[part]!;
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
                    displayed,
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
        </div>
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
              {statuses[item] === "check" ? (
                <i data-status="check" aria-label="확인 필요">
                  !
                </i>
              ) : (
                visited.has(item) && (
                  <i data-status="visited" aria-label="살펴봄">
                    ✓
                  </i>
                )
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
