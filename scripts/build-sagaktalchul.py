"""WSNS 사각탈출 — 쎈스 글리프 견본용 탈사각(세벌식 타자기식) 명조 한글.

명조 자모(고운바탕, OFL)를 떼어 내어 옛 세벌식 타자기의 규칙대로 찍는다.
- 초성 2벌: 왼쪽(세로·섞인 모음과 함께, ‘긩’ 짜임) / 위(가로 모음과 함께, ‘긍’ 짜임). 같은 벌 안에서는
  어느 모음과 만나도 모양·자리가 같다.
- 중성 2벌(공병우 세벌식 타자기처럼): 받침 없는 글자의 긴 모음 / 받침 있는 글자의 짧은 모음.
  세로 모음(ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅣ)과 가로 모음(ㅗ ㅛ ㅜ ㅠ ㅡ)은 ‘아·소’(긴)·‘앙·송’(짧은) 짜임에서 떼어 온다.
  섞인 모음은 타자기처럼 ‘짧은 가로 모음 + 세로 모음’을 겹쳐 만든다: ㅘ의 ㅏ는 ㅏ와 똑같다.
- 종성 1벌(‘아+받침’ 짜임). 받침은 모양을 그대로 두고 그 글자의 초성·중성 바로 아래에 놓는다.
  받침이 없으면 아래가 비어 글자 아래 끝이 들쭉날쭉한 탈사각이 된다. 모든 글자 너비가 같다.
- 닿음 고치기: 자모 모양은 바꾸지 않고, 모음을 그 벌의 모든 초성에서 GAP 만큼 떨어진 자리에 바짝 붙인다.
- 음절 11,172자는 자모 글리프를 겹친 합성 글리프(TrueType composite)라 파일이 작다.

필요: fonttools, shapely, brotli, numpy, pillow
실행: python3 scripts/build-sagaktalchul.py
  → public/fonts/WSNS-Sagaktalchul.woff2, lib/reference-fonts.ts 의 frame, data/reference-regions.json 의 squareout
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
ADV = 1000
GAP = 34          # 자모 사이 최소 틈(글꼴 단위)
JONG_GAP = 40     # 받침과 그 위 자모 사이
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
def cho_geom(ci, form):
    """초성: 왼쪽(‘긩’ 짜임) / 위(‘긍’ 짜임). 받침 있는 짜임이라 아담하다. 가로줄 위에 떠 있는 조각."""
    ps = pieces(syllable(ci, JUNG.index("ㅢ" if form == "left" else "ㅡ"), 21))
    return union(above(ps, widest(ps)))


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
    """가로 모음: ‘소·수…’ 또는 ‘송·숭…’의 가로줄 조각. ㅅ은 줄에서 떨어져 있어 기둥이 온전히 남는다."""
    char = syllable(SIOT, JUNG.index(v), 21 if final else 0)
    return widest(pieces(char) if not final else
                  [g for g in getattr(ring_cut(char, top=False, bottom=True), "geoms", [ring_cut(char, top=False, bottom=True)])])


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
        g = orient(g.simplify(0.5), sign=-1.0)  # 바깥 시계, 구멍 반시계(TrueType)
        for ring in [g.exterior, *g.interiors]:
            pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
            pts = [q for i, q in enumerate(pts) if q != pts[i - 1]]
            if len(pts) < 3: continue
            pen.moveTo(pts[0]); [pen.lineTo(q) for q in pts[1:]]; pen.closePath()
    return pen.glyph()


def make_jamo():
    cho = {(i, f): cho_geom(i, f) for i in range(len(CHO)) for f in ("left", "top")}
    left_all = [cho[(i, "left")] for i in range(len(CHO))]
    top_all = [cho[(i, "top")] for i in range(len(CHO))]

    jung = {}
    for final in (False, True):
        vertical = {}
        for v in VERTICAL:  # 왼쪽 초성 어느 것과도 닿지 않게 오른쪽으로
            g = vertical_vowel(v, final)
            dx = min(snug(g, left_all, "x"), RIGHT_EDGE - g.bounds[2])  # 글자 너비를 넘지 않게
            g = affinity.translate(g, dx, 0)
            if clearance(g, left_all) < GAP:  # 너비 안에서 안 떨어지면 왼쪽 가지 끝만 줄인다(넓은 겹자음 옆 ㅓ·ㅔ)
                g = trim_left(g, left_all)
            vertical[v] = g
            jung[(v, final)] = vertical[v]
        for v in HORIZONTAL:  # 위 초성 어느 것과도 닿지 않게 아래로
            g = horizontal_vowel(v, final)
            jung[(v, final)] = affinity.translate(g, 0, snug(g, top_all, "y"))
        for v, (h, vv) in MIXED.items():  # 섞인 모음: 세로 모음은 그대로, 짧은 가로 모음만 왼쪽 초성 아래로
            stem = vertical[vv]
            bar = placed_bar(h, stem, final)
            bar = affinity.translate(bar, 0, snug(bar, left_all, "y"))
            if final and stem.bounds[1] > bar.bounds[1] + 10:
                stem = jung[(vv, False)]  # 짧은 기둥이 가로 모음까지 내려오지 않으면 긴 기둥을 쓴다
            jung[(v, final)] = union([bar, stem])
    jong = {}
    for ti in range(1, len(JONG)):
        ps = pieces(syllable(IEUNG, 0, ti))
        top_ring = max((g for g in ps if g.interiors), key=lambda g: g.bounds[3])
        rest = [g for g in ps if g is not top_ring]
        stem = max(rest, key=lambda g: g.bounds[3])  # ㅏ
        jong[ti] = union([g for g in rest if g is not stem])
    return cho, jung, jong


def build():
    cho, jung, jong = make_jamo()
    jx0 = min(g.bounds[0] for g in jong.values()) - 20; jx1 = max(g.bounds[2] for g in jong.values()) + 20
    band = rect(jx0, -3000, jx1, 3000)
    def low(g):  # 받침이 놓이는 가로 범위 안에서 가장 낮은 곳
        c = g.intersection(band)
        return c.bounds[1] if not c.is_empty else 10_000
    lows_cho = {k: low(g) for k, g in cho.items()}
    lows_jung = {k: low(g) for k, g in jung.items()}

    notdef = TTGlyphPen(None)
    for b in [((100, -60), (100, 800), (900, 800), (900, -60)), ((170, 10), (830, 10), (830, 730), (170, 730))]:
        notdef.moveTo(b[0]); [notdef.lineTo(p) for p in b[1:]]; notdef.closePath()
    glyphs = {".notdef": notdef.glyph(), "space": TTGlyphPen(None).glyph()}
    cmap_out = {0x20: "space", 0x3000: "space"}
    for (i, f), g in cho.items(): glyphs[f"cho{i}.{f}"] = tt_glyph(g)
    for i, v in enumerate(JUNG):
        glyphs[f"jung{i}"] = tt_glyph(jung[(v, False)])
        glyphs[f"jung{i}.j"] = tt_glyph(jung[(v, True)])
    for ti, g in jong.items(): glyphs[f"jong{ti}"] = tt_glyph(g)

    parts_of_char = {}
    for code in range(0xAC00, 0xD7A4):
        n = code - 0xAC00
        ci, vi, ti = n // 588, (n // 28) % 21, n % 28
        v = JUNG[vi]
        form = "top" if v in HORIZONTAL else "left"
        comps = [(f"cho{ci}.{form}", 0), (f"jung{vi}" + (".j" if ti else ""), 0)]
        geoms = [cho[(ci, form)], jung[(v, bool(ti))]]
        if ti:
            dy = round(min(lows_cho[(ci, form)], lows_jung[(v, True)]) - JONG_GAP - jong[ti].bounds[3])
            comps.append((f"jong{ti}", dy)); geoms.append(affinity.translate(jong[ti], 0, dy))
        pen = TTGlyphPen(glyphs)
        for name, dy in comps: pen.addComponent(name, (1, 0, 0, 1, 0, dy))
        glyphs[f"uni{code:04X}"] = pen.glyph()
        cmap_out[code] = f"uni{code:04X}"
        parts_of_char[chr(code)] = geoms
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
        "familyName": {"en": "WSNS Sagaktalchul", "ko": "WSNS 사각탈출"},
        "styleName": "Regular",
        "uniqueFontIdentifier": "WSNS studio: WSNS Sagaktalchul Regular 3",
        "fullName": "WSNS Sagaktalchul Regular",
        "psName": "WSNSSagaktalchul-Regular",
        "version": "Version 3.000",
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
    fb.save(str(OUT))
    print(OUT, OUT.stat().st_size, "bytes,", len(order), "glyphs; frame", frame)
    write_frame(frame)
    write_regions(parts_of_char, frame)
    return parts_of_char


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
