"""WSNS 사각탈출 — 쎈스 글리프 견본용 탈사각(세벌식 타자기식) 픽셀 명조 한글.

타자기 활자가 종이에 찍힌 느낌: 모든 자모를 한 픽셀 격자(PX)에 찍고, 글쇠(자모)마다 잉크 상태가 달라
어떤 글쇠는 진하게 번지고 어떤 글쇠는 흐리게 찍힌다(같은 글쇠는 어느 글자에서나 같다).

명조 자모(고운바탕, OFL)를 떼어 내어 조합 엔진의 자리 구분과 같은 규칙으로 놓는다.
- 초성 3벌(세로·가로·섞인 모음 짜임: 겅·공·궹에서), 모음 1벌(받침 글자의 짧은 모음), 받침 3벌(앙·응·읭에서).
  같은 짜임 안에서는 자모의 자리·모양이 모든 글자에서 같다(타자기). 받침이 없으면 아래가 비는 탈네모.
- 자리는 고운바탕이 받침 글자에 둔 자리 그대로. 닿으면 모음을 오른쪽으로·가지 끝을 줄이고,
  ㅗ·ㅛ 꼭지는 TICK_UP 까지만 남기며, 그래도 닿는 초성만 위로 올린다.
- 쓰기 칸 안내선용 매끈한 판(Guide)과 고르기 화면용 잉크 픽셀 판을 함께 만든다.
- 음절 11,172자는 자모 글리프를 겹친 합성 글리프(TrueType composite)라 파일이 작다.

필요: fonttools, shapely, brotli, numpy, pillow
실행: python3 scripts/build-sagaktalchul.py
  → public/fonts/WSNS-Sagaktalchul.woff2(픽셀)·WSNS-Sagaktalchul-Guide.woff2(매끈), lib/reference-fonts.ts 의 frame, data/reference-regions.json 의 squareout
"""
import json
import re
from collections import deque
from pathlib import Path

import numpy as np
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.basePen import BasePen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw
from shapely import affinity
from shapely.geometry import Point, Polygon, box as rect
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

SOURCE = Path("public/fonts/GowunBatang-Regular.woff")
OUT = Path("public/fonts/WSNS-Sagaktalchul.woff2")
OUT_GUIDE = Path("public/fonts/WSNS-Sagaktalchul-Guide.woff2")
ADV = 1000
GAP = 34          # 자모 사이 최소 틈(글꼴 단위)
JONG_GAP = 30     # 받침과 그 위 자모 사이
CHO_GAP = 16      # 초성과 모음 사이(고운바탕처럼 ㅓ 가지가 초성 밑으로 살짝 들어가도 되게)
TICK_UP = 105      # ㅗ·ㅛ 꼭지: 가로획 가운데에서 위로 이만큼까지
RIGHT_EDGE = 955  # 모음이 넘지 않을 오른쪽 끝(글자 너비 1000)

CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
        "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
VERTICAL = "ㅏㅐㅑㅒㅓㅔㅕㅖㅣ"
HORIZONTAL = "ㅗㅛㅜㅠㅡ"
MIXED = {"ㅘ": ("ㅗ", "ㅏ"), "ㅙ": ("ㅗ", "ㅐ"), "ㅚ": ("ㅗ", "ㅣ"), "ㅝ": ("ㅜ", "ㅓ"),
         "ㅞ": ("ㅜ", "ㅔ"), "ㅟ": ("ㅜ", "ㅣ"), "ㅢ": ("ㅡ", "ㅣ")}
SIOT, IEUNG = CHO.index("ㅅ"), CHO.index("ㅇ")

src = TTFont(SOURCE)
glyph_set = src.getGlyphSet()
cmap = src.getBestCmap()


def syllable(ci, vi, ti=0):
    return chr(0xAC00 + ci * 588 + vi * 28 + ti)


class FlatPen(BasePen):
    """곡선을 잘게 펴서 다각형 점 목록으로"""
    def __init__(self):
        super().__init__(None); self.contours = []; self.cur = None
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _qCurveToOne(self, p1, p2):
        x0, y0 = self.cur[-1]
        for i in range(1, 9):
            t = i / 8; m = 1 - t
            self.cur.append((m * m * x0 + 2 * m * t * p1[0] + t * t * p2[0], m * m * y0 + 2 * m * t * p1[1] + t * t * p2[1]))
    def _curveToOne(self, p1, p2, p3):
        x0, y0 = self.cur[-1]
        for i in range(1, 11):
            t = i / 10; m = 1 - t
            self.cur.append((m ** 3 * x0 + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t ** 3 * p3[0],
                             m ** 3 * y0 + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t ** 3 * p3[1]))
    def _closePath(self):
        if self.cur and len(self.cur) > 2: self.contours.append(self.cur)
        self.cur = None
    _endPath = _closePath


def outline(char):
    pen = FlatPen()
    rec = DecomposingRecordingPen(glyph_set); glyph_set[cmap[ord(char)]].draw(rec); rec.replay(pen)
    geom = Polygon()
    for c in pen.contours:
        geom = geom.symmetric_difference(Polygon(c).buffer(0))  # 짝홀 규칙
    return geom, pen.contours


def pieces(char):
    """글자를 서로 떨어진 조각(구멍 포함 다각형)들로"""
    geom, _ = outline(char)
    return [g for g in getattr(geom, "geoms", [geom]) if g.area > 30]


def union(gs):
    return unary_union(gs) if gs else Polygon()


def widest(ps):
    return max(ps, key=lambda g: g.bounds[2] - g.bounds[0])


def above(ps, bar, slack=12):
    return [g for g in ps if g.bounds[1] > bar.bounds[3] - slack]


# ---------------------------------------------------------------- 자모 떼어 오기
def cho_geom(ci, form, vowel=None):
    """초성: 왼쪽(‘긩’ 짜임) / 위(‘긍’ 짜임). 받침 있는 짜임이라 아담하다. 가로줄 위에 떠 있는 조각.
    vowel 을 주면 그 모음 짜임(‘공’·‘곽’ 등)에서 뗀다. 모음 꼭지 자리를 비워 둔 초성이라 닿지 않는다."""
    v = vowel or ("ㅢ" if form == "left" else "ㅡ")
    ps = pieces(syllable(ci, JUNG.index(v), 21))
    bar = widest(ps)
    out = union(above(ps, bar))
    if out.area < cho_geom(ci, form).area * 0.75 if vowel else False:
        return cho_geom(ci, form)  # 모음과 붙어 못 떼면 기본 짜임에서
    return out


def ring_thickness():
    """ㅇ 고리의 좌우·위아래 두께(‘응’의 받침 ㅇ: 다른 자모와 닿지 않는다)"""
    ps = pieces(syllable(IEUNG, JUNG.index("ㅡ"), 21))
    ring = min(ps, key=lambda g: g.bounds[1])
    ox0, oy0, ox1, oy1 = ring.bounds; hx0, hy0, hx1, hy1 = Polygon(ring.interiors[0]).bounds
    return ((hx0 - ox0) + (ox1 - hx1)) / 2, ((hy0 - oy0) + (oy1 - hy1)) / 2


RING = ring_thickness()


def ring_cut(char, top=True, bottom=False):
    """ㅇ 고리를 고리 모양대로 도려낸다(모음 끝이 ㅇ에 닿아 있어도 깨끗이 떨어진다).
    top: 맨 위 ㅇ(초성), bottom: 맨 아래 ㅇ(받침)"""
    geom, contours = outline(char)
    holes = sorted((Polygon(c).bounds for c in contours
                    if any(Polygon(o).contains(Polygon(c)) for o in contours if o is not c)), key=lambda b: b[3])
    tx, ty = RING
    for hx0, hy0, hx1, hy1 in ([holes[-1]] if top else []) + ([holes[0]] if bottom else []):
        cx, cy = (hx0 + hx1) / 2, (hy0 + hy1) / 2
        geom = geom.difference(affinity.scale(Point(cx, cy).buffer(1, 64), (hx1 - hx0) / 2 + tx + 8, (hy1 - hy0) / 2 + ty + 8))
    return union([g for g in getattr(geom, "geoms", [geom]) if g.area > 400])


# 모음 2벌(공병우 세벌식 타자기처럼): 받침 없는 글자에 쓰는 긴 모음 / 받침 있는 글자에 쓰는 짧은 모음
def vertical_vowel(v, final):
    """세로 모음: ‘아·어…’(받침 없음) 또는 ‘앙·엉…’(받침 있음)에서 ㅇ을 도려낸 것"""
    return ring_cut(syllable(IEUNG, JUNG.index(v), 21 if final else 0), top=True, bottom=final)


def trim_left(g, others, gap=GAP, limit=160):
    """왼쪽 가지(ㅓ·ㅔ의 가로획) 끝을 조금씩 잘라 others 와 gap 만큼 떨어지게. 기둥은 건드리지 않는다."""
    x0, y0, x1, y1 = g.bounds
    for cut in range(0, limit, 3):
        trimmed = g.difference(rect(x0 - 1, y0 - 1, x0 + cut, y1 + 1))
        if clearance(trimmed, others) >= gap: return trimmed
    return g.difference(rect(x0 - 1, y0 - 1, x0 + limit, y1 + 1))


def horizontal_vowel(v, final):
    """가로 모음: ‘공·궁…’(가로 모음 초성과 같은 짜임)의 가로줄 조각.
    붙어서 못 떼면 ‘봉·붕…’, ‘송·숭…’에서."""
    for c in "ㄱㅂㅅ":
        char = syllable(CHO.index(c), JUNG.index(v), 21 if final else 0)
        g = widest(pieces(char) if not final else
                   [g for g in getattr(ring_cut(char, top=False, bottom=True), "geoms", [ring_cut(char, top=False, bottom=True)])])
        if g.bounds[3] - g.bounds[1] < 260:
            return g
    return g


def short_bar(h, final):
    """섞인 모음의 왼쪽 짧은 가로 모음: ‘쇠·쉬·싀’(또는 받침 있는 ‘쇵…’)의 가로줄 조각"""
    char = syllable(SIOT, JUNG.index({"ㅗ": "ㅚ", "ㅜ": "ㅟ", "ㅡ": "ㅢ"}[h]), 21 if final else 0)
    ps = pieces(char) if not final else list(getattr(ring_cut(char, top=False, bottom=True), "geoms", [ring_cut(char, top=False, bottom=True)]))
    return widest(ps)


def main_stem_left(g):
    """세로 모음의 큰 기둥 왼쪽 가장자리(가장 길게 내려오는 세로획)"""
    x0, y0, x1, y1 = g.bounds
    best, best_x = -1, x0
    for x in range(int(x0), int(x1), 3):
        h = g.intersection(rect(x, y0 - 1, x + 3, y1 + 1)).area
        if h > best: best, best_x = h, x
    while best_x > x0 and g.intersection(rect(best_x - 3, y0 - 1, best_x, y1 + 1)).area > best * 0.6:
        best_x -= 3
    return best_x


def placed_bar(h, vertical_glyph, final):
    """짧은 가로 모음을 세로 기둥 바로 앞에(오른쪽 끝이 기둥에 살짝 닿게)"""
    bar = short_bar(h, final)
    return affinity.translate(bar, main_stem_left(vertical_glyph) + 4 - bar.bounds[2], 0)


# ---------------------------------------------------------------- 닿음 고치기
def clearance(g, others):
    return min((g.distance(o) for o in others if not o.is_empty), default=1e9)


def bar_middle(g):
    """가로획이 가장 넓게 지나가는 높이"""
    x0, y0, x1, y1 = g.bounds
    best, best_y = -1, y0
    for y in range(int(y0), int(y1), 3):
        a = g.intersection(rect(x0 - 1, y, x1 + 1, y + 3)).area
        if a > best: best, best_y = a, y
    return best_y + 1.5


def snug(g, others, axis, gap=GAP, lo=-260, hi=260):
    """g 를 axis 방향(x: 오른쪽이 +, y: 아래가 -)으로 옮겨 others 모두에 gap 만큼 떨어져 바짝 붙인다.
    x: 가장 왼쪽 자리, y: 가장 높은 자리. 옮긴 거리를 돌려준다."""
    rng = range(lo, hi + 1, 3) if axis == "x" else range(hi, lo - 1, -3)
    for d in rng:
        moved = affinity.translate(g, d if axis == "x" else 0, d if axis == "y" else 0)
        if clearance(moved, others) >= gap: return d
    return 0


# ---------------------------------------------------------------- 글꼴 만들기
def tt_glyph(geom):
    pen = TTGlyphPen(None)
    for g in getattr(geom, "geoms", [geom]):
        if g.is_empty: continue
        g = orient(g.simplify(0.1), sign=-1.0)  # 바깥 시계, 구멍 반시계(TrueType)
        for ring in [g.exterior, *g.interiors]:
            pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
            pts = [q for i, q in enumerate(pts) if q != pts[i - 1]]
            if len(pts) < 3: continue
            pen.moveTo(pts[0]); [pen.lineTo(q) for q in pts[1:]]; pen.closePath()
    return pen.glyph()


def stem_left(g):
    """세로 모음의 가장 왼쪽 큰 기둥의 왼쪽 가장자리(ㅐ·ㅔ는 기둥이 둘)"""
    x0, y0, x1, y1 = g.bounds
    cols = [(g.intersection(rect(x, y0 - 1, x + 3, y1 + 1)).area, x) for x in range(int(x0), int(x1), 3)]
    best = max(cols)[0]
    return min(x for a, x in cols if a > best * 0.6)


def set_stem_bottom(g, bottom):
    """세로 모음 기둥 끝을 bottom 까지 늘이거나 줄인다. 기둥 끝 모양(맺음)은 그대로 옮기고 사이는 기둥 단면으로 채운다."""
    x0, y0, x1, y1 = g.bounds
    delta = y0 - bottom  # + 면 늘이기
    cut = y0 + 70        # 이 아래로는 기둥(들)만 있다
    lower = affinity.translate(g.intersection(rect(x0 - 1, y0 - 1, x1 + 1, cut)), 0, -delta)
    new_cut = cut - delta
    upper = g.intersection(rect(x0 - 1, max(cut, new_cut), x1 + 1, y1 + 1))
    parts = [upper, lower]
    if delta > 0:  # 기둥 단면을 이어 붙인다
        section = g.intersection(rect(x0 - 1, cut, x1 + 1, cut + 2))
        for piece in getattr(section, "geoms", [section]):
            if piece.is_empty: continue
            a, _, b, _ = piece.bounds
            parts.append(rect(a, new_cut - 1, b, cut + 1))
    return union(parts)


TYPES = "VHC"


def vtype(v):
    return "V" if v in VERTICAL else "H" if v in HORIZONTAL else "C"


def cho_vertical(ci):
    """세로 모음 짜임 초성: ‘겅’(받침 ㅇ)에서 받침 고리와 ㅓ를 뺀 나머지. ㅓ 가지 자리를 비워 둔 모양이라
    ㅏ·ㅐ·ㅕ…와 모두 닿지 않는다."""
    want = cho_geom(ci, "left").area * 0.75
    for v in "ㅓㅏㅣ":  # 붙어 있어 못 떼면(ㅃ+ㅓ 등) 다른 모음 짜임에서
        geom = ring_cut(syllable(ci, JUNG.index(v), 21), top=False, bottom=True)
        stem = stem_left(vertical_vowel(v, True))
        ps = [g for g in getattr(geom, "geoms", [geom]) if g.area > 200 and g.bounds[2] < stem - 4]
        out = union(ps)
        if out.area > want:
            return out
    return out


def stem_right_left(g):
    """가장 오른쪽 큰 기둥의 왼쪽 가장자리(섞인 모음의 ㅏ·ㅓ·ㅣ)"""
    x0, y0, x1, y1 = g.bounds
    cols = [(g.intersection(rect(x, y0 - 1, x + 3, y1 + 1)).area, x) for x in range(int(x0), int(x1), 3)]
    best = max(cols)[0]
    tall = [x for a, x in cols if a > best * 0.6]
    right = max(tall)
    while right - 3 in tall: right -= 3
    return right


def jong_from(ti, t):
    """받침: 고운바탕의 받침 글자에서 그 짜임 그대로 떼어 온다(앙·응·읭 + 받침)."""
    if t == "V":
        ps = pieces(syllable(IEUNG, 0, ti))
        top_ring = max((g for g in ps if g.interiors), key=lambda g: g.bounds[3])
        rest = [g for g in ps if g is not top_ring]
        stem = max(rest, key=lambda g: g.bounds[3])
        return union([g for g in rest if g is not stem])
    ps = pieces(syllable(IEUNG, JUNG.index("ㅡ" if t == "H" else "ㅢ"), ti))
    bar = widest(ps)
    return union([g for g in ps if g.bounds[3] < bar.bounds[1] + 6 and g is not bar])


def make_jamo():
    """세벌식 타자기 + 조합 엔진의 자리 구분에 맞춘 배치.
    - 모음 1벌(받침 유무와 상관없이 받침 글자의 짧은 모음). 받침 없는 글자는 아래가 비는 탈네모.
    - 초성은 모음 모양(세로·가로·섞임)마다 1벌씩 3벌. 같은 모양 안에서는 자리·모양이 모두 같다.
    - 받침도 모음 모양마다 1벌씩 3벌. 같은 모양 안에서는 모두 같은 줄.
    - 자리는 고운바탕이 받침 글자(겅·긍·긩·앙·응·읭)에 둔 자리를 그대로 쓰고, 같은 모양끼리 한 줄로만 맞춘다."""
    cho = {}
    for ci in range(len(CHO)):
        cho[(ci, "V")] = cho_vertical(ci)
        cho[(ci, "H")] = cho_geom(ci, "top", "ㅗ")
        cho[(ci, "C")] = cho_geom(ci, "left", "ㅞ")  # 가장 붐비는 ㅞ 짜임: 모든 섞인 모음과 맞는다

    # 모음은 모음마다 1벌(엔진도 모음마다 따로 잰다). 자리는 고운바탕이 받침 글자에 둔 그대로.
    jung = {}
    for v in JUNG:
        jung[v] = horizontal_vowel(v, True) if vtype(v) == "H" else vertical_vowel(v, True)

    # ㅗ·ㅛ(·ㅘ·ㅙ·ㅚ) 꼭지: 고운바탕은 자음마다 꼭지 길이를 바꾸지만 여기는 모음이 1벌이라,
    # 가로획 위로 TICK_UP 까지만 남긴다(고·구가 또렷이 구별되는 길이). 나머지는 초성을 올려 비킨다.
    for v in JUNG:
        if v not in "ㅗㅛㅘㅙㅚ": continue
        g = jung[v]
        x0, y0, x1, y1 = g.bounds
        right = x1 + 1 if vtype(v) == "H" else stem_right_left(g) - 20
        left_part = g.intersection(rect(x0 - 1, y0 - 1, right, y1 + 1))
        bar = widest([p for p in getattr(left_part, "geoms", [left_part])])
        top = bar_middle(bar) + TICK_UP
        jung[v] = g.difference(rect(x0 - 1, top, right, y1 + 1))

    # 초성과 모음이 닿으면: 세로·섞인 모음은 오른쪽으로(글자 너비 안에서), 그래도 닿으면 왼쪽 가지 끝을 줄인다.
    # 가로 모음과 닿으면 그 모양의 초성을 모두 위로.
    for t in TYPES:
        vs = [v for v in JUNG if vtype(v) == t]
        chos = lambda: [cho[(ci, t)] for ci in range(len(CHO))]
        # 세로·섞인 모음: 오른쪽으로(글자 너비 안에서), 그래도 닿으면 왼쪽 가지 끝을 줄인다
        if t != "H":
            for v in vs:
                g = jung[v]
                room = max(0, int(RIGHT_EDGE - g.bounds[2]))
                for dx in range(0, room + 1, 3):
                    if clearance(affinity.translate(g, dx, 0), chos()) >= CHO_GAP: break
                g = affinity.translate(g, dx, 0)
                if clearance(g, chos()) < CHO_GAP and t == "V":
                    g = trim_left(g, chos(), gap=CHO_GAP, limit=70)
                jung[v] = g
        # 가로·섞인 모음과 아직 닿으면 그 초성을 위로(닿지 않을 때까지). 엔진도 초성마다 자리를 따로 재므로
        # 자음마다 따로 올린다(ㅎ처럼 원래 높은 자음만 더 올라간다).
        if t != "V":
            for ci in range(len(CHO)):
                c = cho[(ci, t)]
                for lift in range(0, 240, 3):
                    if clearance(affinity.translate(c, 0, lift), [jung[v] for v in vs]) >= CHO_GAP: break
                cho[(ci, t)] = affinity.translate(c, 0, lift)
                if lift > 40: print(t, CHO[ci], "lift", lift)

    # 받침: 모양마다 한 줄. 윗선을 맞춘 뒤, 그 모양의 모든 초성·모음과 JONG_GAP 만큼 떨어진 가장 높은 자리
    jong = {}
    for t in TYPES:
        group = {ti: jong_from(ti, t) for ti in range(1, len(JONG))}
        top = float(np.median([g.bounds[3] for g in group.values()]))
        group = {ti: affinity.translate(g, 0, top - g.bounds[3]) for ti, g in group.items()}
        upper = [jung[v] for v in JUNG if vtype(v) == t] + [cho[(ci, t)] for ci in range(len(CHO))]
        allj = union(list(group.values()))
        dy = snug(allj, upper, "y", gap=JONG_GAP, lo=-400, hi=200)
        for ti, g in group.items():
            jong[(ti, t)] = affinity.translate(g, 0, dy)
        print(t, "jong dy", dy)
    return cho, jung, jong


# ---------------------------------------------------------------- 픽셀 + 잉크(타자기 활자 느낌)
PX = 25            # 픽셀 한 칸(글꼴 단위). 모든 자모가 같은 격자에 찍힌다
FILL = 0.42        # 칸이 이만큼 덮이면 찍는다
import random


def pixelize(geom, seed):
    """자모를 픽셀 격자에 찍는다. 글쇠마다 잉크 상태가 달라 진하게 번지거나 흐리게 찍힌다.
    같은 글쇠는 어느 글자에서나 똑같이 찍힌다(seed 고정)."""
    if geom.is_empty: return geom
    x0, y0, x1, y1 = geom.bounds
    c0, r0 = int(x0 // PX) - 1, int(y0 // PX) - 1
    c1, r1 = int(x1 // PX) + 2, int(y1 // PX) + 2
    S = 4  # 칸마다 4×4 표본
    W, H = (c1 - c0) * S, (r1 - r0) * S
    img = Image.new("L", (W, H), 0); d = ImageDraw.Draw(img)
    tp = lambda x, y: ((x / PX - c0) * S, (r1 - y / PX) * S)
    for g in getattr(geom, "geoms", [geom]):
        d.polygon([tp(x, y) for x, y in g.exterior.coords], fill=255)
        for h in g.interiors: d.polygon([tp(x, y) for x, y in h.coords], fill=0)
    a = (np.asarray(img) > 127).reshape(r1 - r0, S, c1 - c0, S).mean(axis=(1, 3))
    on = a >= FILL
    seed = sum((i + 1) * ord(ch) for i, ch in enumerate(str(seed)))
    rnd = random.Random(seed)
    ink = rnd.random()
    rows, cols = on.shape
    def edge(r, c):
        return any(not (0 <= r + dr < rows and 0 <= c + dc < cols and on[r + dr, c + dc])
                   for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)))
    if ink < 0.22:    # 진하게: 덜 덮인 칸까지 번진다
        on |= (a >= 0.18) & (np.random.default_rng(seed).random(a.shape) < 0.55)
    elif ink > 0.80:  # 흐리게: 가장자리 칸이 조금 빠진다
        drop = [(r, c) for r in range(rows) for c in range(cols) if on[r, c] and edge(r, c) and a[r, c] < 0.8]
        for r, c in drop:
            if rnd.random() < 0.35: on[r, c] = False
    cells = [rect((c0 + c) * PX, (r1 - r - 1) * PX, (c0 + c + 1) * PX, (r1 - r) * PX)
             for r in range(rows) for c in range(cols) if on[r, c]]
    return unary_union(cells).buffer(0)


def pixel_jamo(cho, jung, jong):
    cho = {k: pixelize(g, f"cho{k}") for k, g in cho.items()}
    jung = {k: pixelize(g, f"jung{k}") for k, g in jung.items()}
    jong = {k: pixelize(g, f"jong{k}") for k, g in jong.items()}
    return cho, jung, jong


def write_font(cho, jung, jong, out, family, family_ko, ps):
    notdef = TTGlyphPen(None)
    for bx in [((100, -60), (100, 800), (900, 800), (900, -60)), ((170, 10), (830, 10), (830, 730), (170, 730))]:
        notdef.moveTo(bx[0]); [notdef.lineTo(p) for p in bx[1:]]; notdef.closePath()
    glyphs = {".notdef": notdef.glyph(), "space": TTGlyphPen(None).glyph()}
    cmap_out = {0x20: "space", 0x3000: "space"}
    for (i, t), g in cho.items(): glyphs[f"cho{i}{t}"] = tt_glyph(g)
    for i, v in enumerate(JUNG): glyphs[f"jung{i}"] = tt_glyph(jung[v])
    for (ti, t), g in jong.items(): glyphs[f"jong{ti}{t}"] = tt_glyph(g)

    parts_of_char = {}
    for code in range(0xAC00, 0xD7A4):
        n = code - 0xAC00
        ci, vi, ti = n // 588, (n // 28) % 21, n % 28
        t = vtype(JUNG[vi])
        names = [f"cho{ci}{t}", f"jung{vi}"] + ([f"jong{ti}{t}"] if ti else [])
        pen = TTGlyphPen(glyphs)
        for name in names: pen.addComponent(name, (1, 0, 0, 1, 0, 0))  # 모두 제자리 그대로(타자기)
        glyphs[f"uni{code:04X}"] = pen.glyph()
        cmap_out[code] = f"uni{code:04X}"
        parts_of_char[chr(code)] = [cho[(ci, t)], jung[JUNG[vi]]] + ([jong[(ti, t)]] if ti else [])
    for code in range(0x3131, 0x3164):  # 낱자(호환 자모)는 고운바탕의 낱자를 그대로
        if code not in cmap: continue
        pen = TTGlyphPen(None)
        rec = DecomposingRecordingPen(glyph_set); glyph_set[cmap[code]].draw(rec); rec.replay(pen)
        glyphs[f"uni{code:04X}"] = pen.glyph(); cmap_out[code] = f"uni{code:04X}"

    order = list(glyphs)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap_out)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    metrics = {}
    for n in order:
        g = glyf[n]; g.recalcBounds(glyf)
        metrics[n] = (500 if n == "space" else ADV, getattr(g, "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=880, descent=-120)
    fb.setupNameTable({
        "familyName": {"en": family, "ko": family_ko},
        "styleName": "Regular",
        "uniqueFontIdentifier": f"WSNS studio: {family} Regular 4",
        "fullName": f"{family} Regular",
        "psName": f"{ps}-Regular",
        "version": "Version 4.000",
        "copyright": "Copyright 2021 The Gowun Batang Project Authors; Copyright 2026 WSNS studio",
        "manufacturer": "WSNS studio",
        "description": "Gowun Batang jamo rearranged by Sebeolsik typewriter rules.",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
    })
    xs, ys = [], []
    for code in range(0xAC00, 0xD7A4):
        g = glyf[cmap_out[code]]; xs += [g.xMin, g.xMax]; ys += [g.yMin, g.yMax]
    frame = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, sTypoLineGap=0,
                usWinAscent=max(1000, frame[3] + 20), usWinDescent=max(250, -frame[1] + 20),
                achVendID="WSNS", fsType=0, usWeightClass=400,
                ulUnicodeRange1=1 << 0, ulUnicodeRange2=(1 << 24) | (1 << 20))
    fb.setupPost()
    fb.font.flavor = "woff2"
    fb.save(str(out))
    print(out, out.stat().st_size, "bytes,", len(order), "glyphs; frame", frame)
    return frame, parts_of_char


def build():
    """쓰기 칸 안내선·빈 글자 채우기·자모 판정에는 매끈한 판(Guide), 고르기 화면의 견본 문장에는 픽셀 판."""
    jamo = make_jamo()
    frame, parts = write_font(*jamo, OUT_GUIDE, "WSNS Sagaktalchul Guide", "WSNS 사각탈출 안내선", "WSNSSagaktalchulGuide")
    write_font(*pixel_jamo(*jamo), OUT, "WSNS Sagaktalchul", "WSNS 사각탈출", "WSNSSagaktalchul")
    write_frame(frame)
    write_regions(parts, frame)
    return parts


def write_frame(frame):
    """lib/reference-fonts.ts 의 frame 을 새 범위로"""
    p = Path("lib/reference-fonts.ts"); s = p.read_text(encoding="utf-8")
    s = re.sub(r'(file: "WSNS-Sagaktalchul.woff2",[^}]*?frame: )\[[^\]]*\]', lambda m: m.group(1) + str(frame), s, flags=re.S)
    p.write_text(s, encoding="utf-8")


def write_regions(parts_of_char, frame):
    """자모 판정 자료(data/reference-regions.json 의 squareout): 자모 조각을 알고 있으니 추측 없이 그대로 칠한다.
    형식은 scripts/build-reference-regions.py 와 같다(96칸, 공통 틀 기준)."""
    N, R = 96, 288
    fx0, fy0, fx1, fy1 = frame; fw, fh = fx1 - fx0, fy1 - fy0
    to_px = lambda x, y: ((x - fx0) / fw * (R - 3) + 1, (fy1 - y) / fh * (R - 3) + 1)
    chars = re.search(r'export const HANGUL\s*=\s*"([^"]+)"', Path("data/charset.ts").read_text(encoding="utf-8")).group(1).split()
    cx, cy = (fx0 + fx1) / 2, (fy0 + fy1) / 2
    fit = 0.0
    out = {}
    for char in chars:
        hi = np.zeros((R, R), dtype=np.uint8)
        boxes = {}
        for label, (name, geom) in enumerate(zip(("cho", "jung", "jong"), parts_of_char[char]), start=1):
            img = Image.new("L", (R, R), 0); d = ImageDraw.Draw(img)
            for g in getattr(geom, "geoms", [geom]):
                if g.is_empty: continue
                d.polygon([to_px(x, y) for x, y in g.exterior.coords], fill=255)
                for hole in g.interiors: d.polygon([to_px(x, y) for x, y in hole.coords], fill=0)
                for x, y in g.exterior.coords: fit = max(fit, (abs(x - cx) + abs(y - cy)) / ((fw + fh) / 2))
            mask = np.asarray(img) > 127
            hi[mask] = label
            py, px = np.where(mask)
            boxes[name] = [round(float(v), 5) for v in ((px.min() - 1) / (R - 3), (py.min() - 1) / (R - 3),
                                                       (px.max() - px.min() + 1) / (R - 3), (py.max() - py.min() + 1) / (R - 3))]
        labels = np.zeros((N, N), dtype=np.uint8); ink = np.zeros((N, N), dtype=bool)
        for r in range(N):
            for c in range(N):
                block = hi[r * 3:r * 3 + 3, c * 3:c * 3 + 3]; nz = block[block > 0]
                if nz.size: labels[r, c] = np.bincount(nz).argmax(); ink[r, c] = nz.size >= block.size * 0.35
        region = labels.copy(); queue = deque(zip(*np.where(region > 0)))
        while queue:
            y, x = queue.popleft()
            for dy, dx in ((-1, 0), (0, -1), (0, 1), (1, 0)):
                a, b = y + dy, x + dx
                if 0 <= a < N and 0 <= b < N and region[a, b] == 0:
                    region[a, b] = region[y, x]; queue.append((a, b))
        flat = np.where(ink, region + 3, region).ravel(); rle = []; last = int(flat[0]); count = 0
        for value in flat:
            if value == last: count += 1
            else: rle.extend([count, last]); last = int(value); count = 1
        rle.extend([count, last])
        out[char] = {"size": [fw, fh], "boxes": boxes, "regions": rle}
    out = {c: {"size": e["size"], "fit": round(fit, 5), "boxes": e["boxes"], "regions": e["regions"]} for c, e in out.items()}
    path = Path("data/reference-regions.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data["fonts"]["squareout"] = out
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("regions", len(out), "fit", round(fit, 4))


if __name__ == "__main__":
    build()
