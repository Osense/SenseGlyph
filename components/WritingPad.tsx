"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type {
  ProjectSettings,
  Stroke,
  StrokePoint,
  CharCategory,
} from "../lib/types";
import { pixelToEm, hitsStroke, splitPoints } from "../lib/geometry";
import { paintStroke } from "../lib/brushes";
import { drawGrid, drawSample } from "../lib/drawing";
import { useStudio } from "../lib/store";
import { referenceUsesFallback } from "../lib/font/reference";
import { loadReferenceFont, referenceStack } from "../lib/reference-fonts";
import { strokesAreSafe } from "../lib/safety";
import CanvasStepButtons, { type CanvasNavigation } from "./CanvasStepButtons";
let penDetectedThisSession = false;
interface Props {
  char: string;
  category: CharCategory;
  strokes: Stroke[];
  settings: ProjectSettings;
  tool: "pen" | "eraser";
  dark: boolean;
  onBusy: (busy: boolean) => void;
  practice?: boolean;
  navigation?: CanvasNavigation;
}
export default function WritingPad({
  char,
  category,
  strokes,
  settings,
  tool,
  dark,
  onBusy,
  practice = false,
  navigation,
}: Props) {
  // SPEC 해석: 진행 중 획을 확정 잉크와 분리하기 위해 4개의 canvas를 쓴다.
  const wrap = useRef<HTMLDivElement>(null),
    grid = useRef<HTMLCanvasElement>(null),
    sample = useRef<HTMLCanvasElement>(null),
    ink = useRef<HTMLCanvasElement>(null),
    live = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(500),
    [sampleRail, setSampleRail] = useState(0),
    [fontReady, setFontReady] = useState(false),
    [warning, setWarning] = useState("");
  const committed = useRef(strokes),
    latestRender = useRef<() => void>(() => {});
  const active = useRef<{
    id: number;
    points: StrokePoint[];
    start: number;
    erase: boolean;
    working: Stroke[];
    base: Stroke[];
    brush: Stroke["brush"];
    params: Stroke["params"];
  } | null>(null);
  const frame = useRef(0);
  const saveStroke = useStudio((s) => s.commit),
    update = useStudio((s) => s.settings);
  const [practiceStrokes, setPracticeStrokes] = useState<Stroke[]>([]);
  if (practice) strokes = practiceStrokes;
  const commit = (letter: string, kind: CharCategory, value: Stroke[]) => {
    if (practice) setPracticeStrokes(value);
    else saveStroke(letter, kind, value);
  };
  const latin = !category.startsWith("hangul");
  const showOutside = !!navigation && settings.sampleMode === "outside";
  useEffect(() => {
    // The layout may hand the pad a non-square box (e.g. width-driven but
    // height-capped on landscape tablets). The sheet stays square inside it so
    // the em grid, sample and handwriting are never stretched.
    const ob = new ResizeObserver((es) => {
      const { width, height } = es[0].contentRect;
      const rail = showOutside ? Math.min(144, Math.max(76, width * 0.26)) : 0;
      setSampleRail(rail);
      const availableWidth = Math.max(
        1,
        width - (navigation ? 52 + (rail || 52) : 0),
      );
      setSize(
        Math.floor(
          height > 0 ? Math.min(availableWidth, height) : availableWidth,
        ),
      );
    });
    if (wrap.current) ob.observe(wrap.current);
    return () => ob.disconnect();
  }, [!!navigation, showOutside]);
  // iPad Safari: 쓰는 도중 손바닥·손가락·펜이 페이지를 끌어당기거나(스크롤·고무줄 효과),
  // 확대·돋보기·길게 누르기 메뉴가 뜨지 않도록 쓰기 영역의 기본 터치 동작을 막습니다.
  // 버튼(이전/다음)의 탭은 막지 않습니다.
  useEffect(() => {
    const area = wrap.current,
      canvas = live.current;
    if (!area || !canvas) return;
    const stop = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    const onCanvas = { passive: false } as AddEventListenerOptions;
    canvas.addEventListener("touchstart", stop, onCanvas);
    canvas.addEventListener("touchmove", stop, onCanvas);
    canvas.addEventListener("touchend", stop, onCanvas);
    area.addEventListener("touchmove", stop, onCanvas);
    area.addEventListener("gesturestart", stop, onCanvas);
    area.addEventListener("gesturechange", stop, onCanvas);
    area.addEventListener("contextmenu", stop);
    area.addEventListener("selectstart", stop);
    area.addEventListener("dblclick", stop);
    return () => {
      canvas.removeEventListener("touchstart", stop);
      canvas.removeEventListener("touchmove", stop);
      canvas.removeEventListener("touchend", stop);
      area.removeEventListener("touchmove", stop);
      area.removeEventListener("gesturestart", stop);
      area.removeEventListener("gesturechange", stop);
      area.removeEventListener("contextmenu", stop);
      area.removeEventListener("selectstart", stop);
      area.removeEventListener("dblclick", stop);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setFontReady(false);
    loadReferenceFont(settings.referenceFont, char)
      .then(() => {
        if (alive) setFontReady(true);
      })
      .catch(() => {
        if (alive)
          setWarning("견본 글꼴을 불러오지 못했습니다. 다시 선택해 주세요.");
      });
    return () => {
      alive = false;
    };
  }, [settings.referenceFont, char]);
  const context = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const pixels = Math.round(size * dpr);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(pixels / 1000, 0, 0, pixels / 1000, 0, 0);
    return ctx;
  };
  const render = () => {
    const ctx = context(ink.current);
    if (!ctx) return;
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.fillStyle = dark ? "#f1eadb" : "#263c33";
    for (const s of active.current?.working ?? committed.current)
      paintStroke(ctx, s);
    const l = context(live.current);
    if (!l) return;
    l.clearRect(0, 0, 1000, 1000);
    l.fillStyle = dark ? "#f1eadb" : "#263c33";
    const a = active.current;
    if (a && !a.erase)
      paintStroke(l, {
        id: "live",
        points: a.points,
        brush: a.brush,
        params: a.params,
        order: 0,
        createdAt: 0,
      });
  };
  const schedule = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      latestRender.current();
    });
  };
  useLayoutEffect(() => {
    // Cancel frames queued by earlier pointer handlers: they must never repaint old props
    // over a freshly committed/erased/undone canvas after React has already rendered it.
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    committed.current = strokes;
    setWarning(
      !practice && !strokesAreSafe(strokes, category)
        ? "점선 밖으로 나간 획이 있어요. 폰트에는 칸 안으로 줄여서 넣어요."
        : "",
    );
    latestRender.current = render;
    const ctx = context(grid.current);
    if (ctx) drawGrid(ctx, settings, category, dark);
    const c = context(sample.current);
    if (c) {
      c.clearRect(0, 0, 1000, 1000);
      if (fontReady && settings.sampleMode === "inside-faint")
        drawSample(c, char, latin, settings.sampleOpacity, dark, settings);
    }
    render();
  }, [size, settings, char, strokes, dark, fontReady]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      active.current = null;
    },
    [],
  );
  const add = (e: PointerEvent) => {
    const a = active.current;
    if (!a) return;
    const rect = live.current!.getBoundingClientRect();
    const p = {
      ...pixelToEm(e.clientX, e.clientY, rect),
      // A pen reports pressure 0 as it lifts; keep the last real pressure so the
      // stroke end does not suddenly swell. Mice have no pressure at all.
      p:
        e.pointerType === "mouse"
          ? 0.5
          : e.pressure === 0
            ? (a.points[a.points.length - 1]?.p ?? 0.5)
            : e.pressure,
      t: Math.max(0, e.timeStamp - a.start),
      tiltX: e.tiltX,
      tiltY: e.tiltY,
    };
    a.points.push(p);
    if (a.erase) {
      const radius = settings.eraserSize / 2;
      if (settings.eraserMode === "stroke")
        a.working = a.working.filter(
          (s) => !hitsStroke(p, s.points, radius, s.params.size),
        );
      else
        a.working = a.working.flatMap((s) => {
          const parts = splitPoints(s.points, p, radius);
          if (parts.length === 1 && parts[0].length === s.points.length)
            return [s];
          return parts.map((points) => ({
            ...s,
            id: crypto.randomUUID(),
            points,
          }));
        });
    }
    schedule();
  };
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (active.current) return;
    const pen = e.pointerType === "pen";
    if (settings.penOnly && !pen) return;
    if (e.pointerType === "mouse" && !settings.allowMouse) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pen && !practice && !penDetectedThisSession) {
      penDetectedThisSession = true;
      if (!settings.penOnly) update({ penOnly: true });
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = {
      id: e.pointerId,
      points: [],
      start: e.timeStamp,
      erase:
        tool === "eraser" || (pen && (!!(e.buttons & 32) || !!(e.buttons & 2))),
      working: committed.current,
      base: committed.current,
      brush: settings.activeBrush,
      params: { ...settings.brushParams[settings.activeBrush] },
    };
    onBusy(true);
    add(e.nativeEvent);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (active.current?.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const p of events.length ? events : [e.nativeEvent]) add(p);
  };
  const finish = (e: ReactPointerEvent<HTMLCanvasElement>, cancel = false) => {
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    let result = a.base;
    if (!cancel) {
      add(e.nativeEvent);
      result = a.erase
        ? a.working
        : [
            ...a.base,
            {
              id: crypto.randomUUID(),
              points: a.points,
              brush: a.brush,
              params: a.params,
              order: a.base.reduce((m, s) => Math.max(m, s.order + 1), 0),
              createdAt: Date.now(),
            },
          ];
      // 점선 밖으로 나간 획도 버리지 않습니다. 알림만 보여주고, 폰트에는 칸 안으로 줄여 넣습니다.
      if (!a.erase || result !== a.base) commit(char, category, result);
    }
    active.current = null;
    committed.current = result;
    onBusy(false);
    schedule();
  };
  return (
    <div
      className={showOutside ? "pad has-outside-sample" : "pad"}
      ref={wrap}
      aria-label={char + " 쓰기 칸"}
      style={
        showOutside
          ? ({ "--sample-rail": `${sampleRail || 76}px` } as CSSProperties)
          : undefined
      }
    >
      {showOutside && (
        <div className="writing-rail-sample">
          <span
            className="writing-rail-character"
            aria-label={"견본 " + char}
            style={{
              fontFamily: referenceUsesFallback(char, settings.referenceFont)
                ? '"Noto Sans KR"'
                : referenceStack(settings.referenceFont),
            }}
          >
            {char}
          </span>
          <small>위 글자를 써주세요.</small>
        </div>
      )}
      {navigation && (
        <CanvasStepButtons navigation={navigation} context="쓰기" />
      )}
      <div
        className="pad-sheet"
        style={size ? { width: size, height: size } : undefined}
      >
        <canvas ref={grid} data-layer="grid" />
        <canvas ref={sample} data-layer="sample" />
        <canvas ref={ink} data-layer="ink" />
        <canvas
          ref={live}
          className="input-canvas"
          data-layer="live"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onLostPointerCapture={(e) => finish(e, true)}
        />
      </div>
      {warning && (
        <div className="pad-warning" role="status">
          {warning}
          <button onClick={() => setWarning("")}>확인</button>
        </div>
      )}
    </div>
  );
}
