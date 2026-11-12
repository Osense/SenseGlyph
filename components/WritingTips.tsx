"use client";

import TipDeck from "./TipDeck";

export const WRITING_TIPS_KEY = "senseglyph-writing-tips-v1";

const TIPS = [
  {
    title: "견본의 비율에 맞춰 써요",
    body: "연하게 보이는 견본 글자의 크기·위치·자모 비율을 따라 쓰면, 자모를 떼어 다른 글자를 조합할 때 자연스럽게 맞물려요.",
    art: "fit",
  },
  {
    title: "모든 글자를 같은 크기로",
    body: "글자마다 크기와 높이가 다르면 문장이 들쭉날쭉해 보여요. 다이아몬드 점선에 닿을 만큼, 매번 비슷한 크기로 써 주세요.",
    art: "size",
  },
  {
    title: "가로는 반듯, 기울기는 한결같이",
    body: "가로획은 수평에 가깝게, 세로획은 곧게 써요. 기울여 쓰는 습관이 있다면 모든 글자를 같은 각도로 기울이면 오히려 멋이 돼요.",
    art: "level",
  },
  {
    title: "점선 안쪽에, 같은 펜으로 끝까지",
    body: "점선 밖으로 나간 글자는 폰트에서 작게 줄어들어요. 처음 고른 도구와 굵기를 끝까지 바꾸지 않아야 획 굵기가 고르게 나와요.",
    art: "inside",
  },
  {
    title: "한 글자가 수백 글자가 돼요",
    body: "쓴 138자에서 자모를 떼어 11,172자를 만들어요. 한 글자를 대충 쓰면 그 자모가 들어간 수많은 글자에 똑같이 나타나요. 천천히, 또박또박!",
    art: "spread",
  },
] as const;

function Art({ kind }: { kind: (typeof TIPS)[number]["art"] }) {
  if (kind === "fit")
    return (
      <svg viewBox="0 0 400 300" aria-hidden="true" className="tip-art tip-fit">
        <rect x="100" y="20" width="260" height="260" className="tip-sheet" />
        <path d="M230 20 L360 150 L230 280 L100 150 Z" className="tip-guide" />
        <g className="tip-sample">
          <path d="M140 92 L235 92 L215 222" />
          <path d="M292 62 L292 248" />
          <path d="M292 150 L335 150" />
        </g>
        <g className="tip-ink">
          <path d="M140 94 L234 90 L216 222" pathLength={1} />
          <path d="M291 62 L293 248" pathLength={1} />
          <path d="M292 151 L334 149" pathLength={1} />
        </g>
        <g className="tip-ink-bad">
          <path d="M150 140 L195 138 L188 196" pathLength={1} />
          <path d="M228 118 L230 205" pathLength={1} />
        </g>
        <text x="18" y="70" className="tip-label tip-label-bad">
          ✗ 너무 작게
        </text>
        <text x="18" y="70" className="tip-label tip-label-good">
          ✓ 견본만큼
        </text>
      </svg>
    );
  if (kind === "size")
    return (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art tip-size"
      >
        <text x="14" y="88" className="tip-label tip-label-bad-static">
          ✗
        </text>
        <g className="tip-row tip-row-bad">
          <text x="60" y="100" fontSize="70">
            가
          </text>
          <text x="140" y="86" fontSize="44">
            나
          </text>
          <text x="198" y="110" fontSize="86">
            다
          </text>
          <text x="300" y="80" fontSize="52">
            라
          </text>
        </g>
        <line x1="50" y1="240" x2="390" y2="240" className="tip-line" />
        <line x1="50" y1="178" x2="390" y2="178" className="tip-line" />
        <text x="14" y="228" className="tip-label tip-label-good-static">
          ✓
        </text>
        <g className="tip-row tip-row-good">
          <text x="60" y="236" fontSize="62">
            가
          </text>
          <text x="142" y="236" fontSize="62">
            나
          </text>
          <text x="224" y="236" fontSize="62">
            다
          </text>
          <text x="306" y="236" fontSize="62">
            라
          </text>
        </g>
      </svg>
    );
  if (kind === "level")
    return (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art tip-level"
      >
        <line x1="40" y1="150" x2="360" y2="150" className="tip-line" />
        <g className="tip-tilt">
          <path d="M80 120 L320 120" />
          <path d="M200 60 L200 250" />
        </g>
        <text x="40" y="285" className="tip-label tip-label-swap">
          비뚤 → 반듯
        </text>
      </svg>
    );
  if (kind === "inside")
    return (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art tip-inside"
      >
        <rect x="90" y="20" width="260" height="260" className="tip-sheet" />
        <rect x="104" y="34" width="232" height="232" className="tip-safe" />
        <path className="tip-out" d="M150 80 L180 290" pathLength={1} />
        <path className="tip-in" d="M150 80 L172 250" pathLength={1} />
        <text x="10" y="150" className="tip-label tip-out-label">
          ✗ 밖으로
        </text>
        <text x="10" y="150" className="tip-label tip-in-label">
          ✓ 안쪽에
        </text>
      </svg>
    );
  return (
    <svg
      viewBox="0 0 400 300"
      aria-hidden="true"
      className="tip-art tip-spread"
    >
      <text x="40" y="170" fontSize="96" className="tip-source">
        각
      </text>
      {[
        "갈",
        "감",
        "갑",
        "강",
        "갓",
        "갖",
        "갔",
        "같",
        "개",
        "거",
        "고",
        "구",
      ].map((char, i) => (
        <text
          key={char}
          x={180 + (i % 4) * 54}
          y={90 + Math.floor(i / 4) * 70}
          fontSize="44"
          className="tip-target"
          style={{ animationDelay: `${0.25 * i}s` }}
        >
          {char}
        </text>
      ))}
    </svg>
  );
}

/** 글자 쓰기 단계에 들어올 때 보여 주는 '예쁜 폰트를 위한 쓰기 팁' 슬라이드 */
export default function WritingTips({ onClose }: { onClose: () => void }) {
  return (
    <TipDeck
      kicker="예쁜 폰트를 위한 쓰기 팁"
      tips={TIPS.map((tip) => ({
        id: tip.art,
        title: tip.title,
        body: tip.body,
        art: <Art kind={tip.art} />,
      }))}
      doneLabel="이제 써 볼게요 ✎"
      skipLabel="건너뛰고 바로 쓰기"
      onClose={onClose}
    />
  );
}
