"use client";

import TipDeck, { type Tip } from "./TipDeck";
import { PART_COLORS } from "../lib/font/composition";

export const TUTORIAL_KEY = "senseglyph-separation-tutorial-v2";

/** '한'을 그리는 획 — 모든 장면이 같은 글자를 씁니다. */
function Han({
  cho = "",
  jung = "",
  jong = "",
}: {
  cho?: string;
  jung?: string;
  jong?: string;
}) {
  return (
    <>
      <rect x="100" y="20" width="260" height="260" className="tip-sheet" />
      <g className={"sep-part " + cho}>
        <path d="M152 58 L190 70" />
        <path d="M126 96 L236 94" />
        <circle cx="181" cy="142" r="32" />
      </g>
      <g className={"sep-part " + jung}>
        <path d="M286 46 L284 192" />
      </g>
      <g className={"sep-part sep-jung-tick " + jung}>
        <path d="M286 120 L330 118" />
      </g>
      <g className={"sep-part " + jong}>
        <path d="M142 206 L144 254 L322 251" />
      </g>
    </>
  );
}
function Buttons({
  x,
  y,
  pick,
  className,
}: {
  x: number;
  y: number;
  pick: "cho" | "jung" | "jong";
  className: string;
}) {
  const cx = { cho: 34, jung: 92, jong: 150 }[pick];
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={"sep-buttons " + className}>
        <rect width="184" height="40" rx="10" className="sep-bar" />
        <rect x="6" y="6" width="54" height="28" rx="6" className="sep-b-cho" />
        <rect
          x="65"
          y="6"
          width="54"
          height="28"
          rx="6"
          className="sep-b-jung"
        />
        <rect
          x="124"
          y="6"
          width="54"
          height="28"
          rx="6"
          className="sep-b-jong"
        />
        <text x="33" y="26">
          초성
        </text>
        <text x="92" y="26">
          중성
        </text>
        <text x="151" y="26">
          종성
        </text>
        <circle cx={cx} cy="20" r="20" className="sep-tap" />
      </g>
    </g>
  );
}

const TIPS: Tip[] = [
  {
    id: "why",
    title: "자모를 나누면 11,172자가 돼요",
    body: (
      <>
        ‘한’을 <b>ㅎ(초성) + ㅏ(중성) + ㄴ(종성)</b>으로 나눠 두면, 이 자모들을
        다른 글자에 다시 조립해서 쓰지 않은 한글까지 내 글씨로 만들어요.
      </>
    ),
    art: (
      <svg viewBox="0 0 400 300" aria-hidden="true" className="tip-art sep-why">
        <Han
          cho="sep-c-cho sep-d1"
          jung="sep-c-jung sep-d2"
          jong="sep-c-jong sep-d3"
        />
        <text x="22" y="70" className="sep-label sep-l-cho sep-d1">
          초성 ㅎ
        </text>
        <text x="22" y="150" className="sep-label sep-l-jung sep-d2">
          중성 ㅏ
        </text>
        <text x="22" y="236" className="sep-label sep-l-jong sep-d3">
          종성 ㄴ
        </text>
      </svg>
    ),
  },
  {
    id: "lasso",
    title: "둘러싸서 한 번에 골라요",
    body: (
      <>
        손가락이나 펜으로 획들을 <b>빙 둘러싸면</b> 한꺼번에 선택돼요. 선택한 획
        위에 뜬 <b>초성·중성·종성</b> 버튼을 누르면 색이 바뀌어요.
      </>
    ),
    art: (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art sep-lasso"
      >
        <Han cho="sep-to-cho" jung="sep-c-jung" />
        <path
          className="sep-lasso-path"
          pathLength={1}
          d="M118 52 C 170 22, 262 40, 252 110 C 246 176, 172 196, 128 172 C 98 154, 92 82, 118 52 Z"
        />
        <rect
          x="116"
          y="46"
          width="132"
          height="140"
          rx="8"
          className="sep-pick sep-pick-a"
        />
        <Buttons x={90} y={0} pick="cho" className="sep-show-a" />
      </svg>
    ),
  },
  {
    id: "tap",
    title: "획을 톡 눌러도 돼요",
    body: (
      <>
        획을 <b>톡</b> 누르면 선택에 더해지고, 한 번 더 누르면 빠져요. 빈 곳을
        누르면 선택이 풀려요. 가는 획은 바로 옆을 눌러도 골라져요.
      </>
    ),
    art: (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art sep-tap-art"
      >
        <Han cho="sep-c-cho" jung="sep-c-jung" jong="sep-to-jong" />
        <circle cx="232" cy="252" r="16" className="sep-finger" />
        <rect
          x="128"
          y="196"
          width="208"
          height="70"
          rx="8"
          className="sep-pick sep-pick-a"
        />
        <Buttons x={140} y={148} pick="jong" className="sep-show-a" />
      </svg>
    ),
  },
  {
    id: "fix",
    title: "잘못 나뉜 획은 바로잡아요",
    body: (
      <>
        ㅏ의 짧은 획이 초성 색(파랑)이면 잘못 나뉜 거예요. 그 획만 눌러{" "}
        <b>중성</b>으로 바꿔 주세요. 이상해졌다면 <b>↺ 되돌리기</b>, 글자가
        마음에 안 들면 <b>✎ 이 글자 다시 쓰기</b>로 바로 다시 써요.
      </>
    ),
    art: (
      <svg viewBox="0 0 400 300" aria-hidden="true" className="tip-art sep-fix">
        <Han cho="sep-c-cho" jung="sep-c-jung" jong="sep-c-jong" />
        <g className="sep-part sep-wrong">
          <path d="M286 120 L330 118" />
        </g>
        <text x="338" y="108" className="sep-warn">
          !
        </text>
        <circle cx="314" cy="119" r="16" className="sep-finger" />
        <rect
          x="272"
          y="100"
          width="72"
          height="38"
          rx="8"
          className="sep-pick sep-pick-a"
        />
        <Buttons x={200} y={52} pick="jung" className="sep-show-a" />
      </svg>
    ),
  },
  {
    id: "review",
    title: "전체를 한 번씩 넘겨 봐요",
    body: (
      <>
        한 글자가 잘못 나뉘면 그 자모를 쓰는 다른 글자도 함께 어긋나요. 아래
        목록을 처음부터 끝까지 넘기며 살펴보세요. 빨간 <b>!</b>는 특히 의심되는
        글자예요. 괜찮으면 그냥 다음으로 넘어가면 돼요.
      </>
    ),
    art: (
      <svg
        viewBox="0 0 400 300"
        aria-hidden="true"
        className="tip-art sep-review"
      >
        {["겨", "구", "귀", "갛", "겪", "곧"].map((char, i) => (
          <g key={char} transform={`translate(${28 + i * 60} 104)`}>
            <rect width="50" height="62" rx="9" className="sep-cell" />
            <text x="25" y="42" className="sep-cell-char">
              {char}
            </text>
            {i === 3 ? (
              <g className="sep-cell-warn">
                <circle cx="44" cy="6" r="9" />
                <text x="44" y="10">
                  !
                </text>
              </g>
            ) : (
              <text
                x="44"
                y="12"
                className="sep-cell-ok"
                style={{ animationDelay: `${0.8 * i + 0.4}s` }}
              >
                ✓
              </text>
            )}
          </g>
        ))}
        <rect
          x="24"
          y="100"
          width="58"
          height="70"
          rx="11"
          className="sep-cursor"
        />
        <text x="200" y="230" className="sep-count">
          살펴본 글자에는 ✓가 붙어요
        </text>
      </svg>
    ),
  },
];

/** 자모 나누기 첫 진입 안내 — 쓰기 팁과 같은 슬라이드 형식 */
export default function SeparationTutorial({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      style={
        {
          "--cho": PART_COLORS.cho,
          "--jung": PART_COLORS.jung,
          "--jong": PART_COLORS.jong,
        } as React.CSSProperties
      }
    >
      <TipDeck
        kicker="자모 나누기 안내"
        tips={TIPS}
        doneLabel="이제 나눠 볼게요 ✓"
        skipLabel="건너뛰고 바로 시작"
        onClose={onClose}
      />
    </div>
  );
}
