"use client";

import { useMemo, useState } from "react";
import { HANGUL } from "../data/charset";
import {
  assignStroke,
  componentLibrary,
  PART_COLORS,
  PART_LABELS,
} from "../lib/font/composition";
import { activeSeparation, effectiveStrokes } from "../lib/font/editing";
import type { FontPreparation, Part } from "../lib/font/types";
import { decompose, JAMO, jamoFilterIndex } from "../lib/hangul";
import type { FontProject } from "../lib/types";
import { Thumbnail } from "./Preview";

const parts = ["cho", "jung", "jong"] as const;

export default function HandwritingSearch({
  project,
  preparation,
  onSeparate,
  onWrite,
}: {
  project: FontProject;
  preparation: FontPreparation;
  onSeparate: (char: string) => void;
  onWrite: (char: string) => void;
}) {
  const [query, setQuery] = useState<Record<Part, string>>({
    cho: "",
    jung: "",
    jong: "",
  });
  const [selected, setSelected] = useState("");
  const filters = parts.map((part) => ({
    part,
    value: jamoFilterIndex(query[part], part),
  }));
  const invalid = filters.some(({ value }) => value === -1);
  const hasFilter = filters.some(({ value }) => value !== null);
  const matching =
    !invalid && hasFilter
      ? HANGUL.flatMap((char) => {
          if (!project.samples[char]?.strokes.length) return [];
          const jamo = decompose(char)!;
          const matched = filters.filter(
            ({ part, value }) => value !== null && jamo[part] === value,
          );
          return matched.length ? [{ char, jamo, matched }] : [];
        })
      : [];
  const exact = matching.filter(
    ({ matched }) =>
      matched.length === filters.filter(({ value }) => value !== null).length,
  );
  const results = exact.length ? exact : matching;
  const library = useMemo(
    () => componentLibrary(project, preparation),
    [project, preparation],
  );
  const sourceParts = new Map<string, Set<Part>>();
  for (const { char, part } of library.values()) {
    if (!sourceParts.has(char)) sourceParts.set(char, new Set());
    sourceParts.get(char)!.add(part);
  }

  return (
    <section className="handwriting-search" aria-label="원본 손글씨 검색">
      <div className="source-search-heading">
        <h3>원본 손글씨 찾기</h3>
        <details>
          <summary>사용 방법</summary>
          <p>
            찾고 싶은 자모를 초성·중성·종성 칸에 하나씩 입력하세요. 빈 칸은 검색
            조건에서 제외돼요. 겹받침은 ㄺ 또는 ㄹㄱ으로 입력할 수 있어요.
          </p>
          <p>
            검색 결과에서 글자를 선택하면 자모 배정을 고치거나 글자를 다시 쓸 수
            있어요.
          </p>
        </details>
      </div>
      <div className="handwriting-filters">
        {filters.map(({ part, value }) => (
          <label className="font-field" key={part}>
            {PART_LABELS[part]}
            <input
              aria-invalid={value === -1 || undefined}
              autoComplete="off"
              value={query[part]}
              onChange={(event) => {
                setQuery({ ...query, [part]: event.target.value });
                setSelected("");
              }}
            />
          </label>
        ))}
      </div>
      <p className="font-help" role="status">
        {invalid
          ? "각 칸에는 해당하는 한글 자모를 하나씩 입력하세요."
          : !hasFilter
            ? ""
            : exact.length
              ? `일치하는 원본 ${exact.length}개`
              : results.length
                ? "모든 조건이 일치하는 원본은 없어요. 자모별로 일치하는 원본을 보여드려요."
                : "조건에 맞는 손글씨가 없습니다."}
      </p>
      {results.length > 0 && (
        <p className="handwriting-legend" aria-label="색 구분">
          {parts.map((part) => (
            <span key={part} style={{ color: PART_COLORS[part] }}>
              ● {PART_LABELS[part]}
            </span>
          ))}
          <small>찾은 자모는 진하게, 나머지는 연하게 보여요.</small>
        </p>
      )}
      <div className="handwriting-results">
        {results.map(({ char, jamo, matched }) => {
          const open = selected === char;
          return (
            <div className="handwriting-result" key={char}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setSelected(open ? "" : char)}
              >
                <PartThumbnail
                  project={project}
                  preparation={preparation}
                  char={char}
                  focus={
                    new Set(
                      (exact.length ? filters : matched)
                        .filter(({ value }) => value !== null)
                        .map(({ part }) => part),
                    )
                  }
                />
                <strong>{char}</strong>
                <span className="handwriting-jamo">
                  {parts
                    .filter((part) => JAMO[part][jamo[part]].trim())
                    .map((part) => (
                      <em
                        key={part}
                        style={{ color: PART_COLORS[part] }}
                        title={PART_LABELS[part]}
                      >
                        {JAMO[part][jamo[part]].trim()}
                      </em>
                    ))}
                </span>
                {!exact.length && (
                  <small>
                    {matched.map(({ part }) => PART_LABELS[part]).join(" · ")}{" "}
                    일치
                  </small>
                )}
              </button>
              {open && (
                <div className="handwriting-result-actions">
                  {!!sourceParts.get(char)?.size && (
                    <small>
                      조합의 대표 원본으로 사용되는 자모{" "}
                      {parts
                        .filter((part) => sourceParts.get(char)?.has(part))
                        .map((part) => PART_LABELS[part])
                        .join(" · ")}
                    </small>
                  )}
                  <button
                    className="font-secondary"
                    onClick={() => onSeparate(char)}
                  >
                    자모 나누기
                  </button>
                  <button
                    className="font-secondary"
                    onClick={() => onWrite(char)}
                  >
                    글자 다시 쓰기
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 쓴 글자를 초성·중성·종성 색으로 칠한 미리보기. 찾은 자모(focus)는 진하게, 나머지는 연하게. */
function PartThumbnail({
  project,
  preparation,
  char,
  focus,
}: {
  project: FontProject;
  preparation: FontPreparation;
  char: string;
  focus: Set<Part>;
}) {
  const sample = project.samples[char];
  const separation = preparation.separations[char];
  const strokes = effectiveStrokes(sample, separation);
  const active = activeSeparation(sample, separation);
  const key = [...focus].sort().join(",");
  const colorOf = useMemo(() => {
    const colors = new Map(
      strokes.map((stroke) => {
        const part = assignStroke(char, stroke, active, project.settings);
        const color = PART_COLORS[part];
        return [
          stroke.id,
          focus.size && !focus.has(part) ? color + "55" : color,
        ];
      }),
    );
    return (stroke: { id: string }) => colors.get(stroke.id) ?? "#456957";
  }, [strokes, active, project.settings, key]);
  return <Thumbnail strokes={strokes} colorOf={colorOf} size={120} />;
}
