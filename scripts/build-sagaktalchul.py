"""WSNS 사각탈출 — 쎈스 글리프 견본용 탈사각(타자기식) 명조 한글.

명조 자모(고운바탕, OFL)를 떼어 내어 옛 세벌식 타자기처럼 정해진 자리에 찍는다.
- 초성 5벌: 세로 모음 옆(‘강’ 짜임) / ㅗ·ㅡ 위(‘긍’) / ㅜ·ㅠ 위(‘궁’) / ㅘ·ㅢ 왼쪽 위(‘긩’) / ㅝ·ㅟ 왼쪽 위(‘귕’)
- 중성 1벌(‘ㅇ+모음+ㅇ’ 짜임에서), 종성 1벌(‘아+받침’ 짜임에서). 받침은 모양을 바꾸지 않고 그 글자의
  초성·모음 바로 아래에 내려놓는다.
- 자모는 크기를 바꾸지 않고 떼어 온 자리 그대로 둔다. 받침이 없으면 아래가 비어 글자 아래 끝이
  들쭉날쭉한 탈사각이 되고, 모든 글자 너비가 같다.
- 음절 11,172자는 자모 글리프를 겹친 합성 글리프(TrueType composite)라 파일이 작다.

자모를 떼어 올 때는 서로 닿지 않는 짜임만 골라 쓰므로 윤곽(곡선)을 자르지 않고 그대로 옮긴다.

필요: fonttools, brotli
실행: python3 scripts/build-sagaktalchul.py  →  public/fonts/WSNS-Sagaktalchul.woff2
"""
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from shapely.geometry import Polygon, Point
from shapely.geometry.polygon import orient
from shapely import affinity

SOURCE = Path("public/fonts/GowunBatang-Regular.woff")
OUT = Path("public/fonts/WSNS-Sagaktalchul.woff2")
ADV = 1000

CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
        "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
VERTICAL = set("ㅏㅐㅑㅒㅓㅔㅕㅖㅣ")
HORIZONTAL = set("ㅗㅛㅜㅠㅡ")
IEUNG = CHO.index("ㅇ")

src = TTFont(SOURCE)
glyph_set = src.getGlyphSet()
cmap = src.getBestCmap()


def syllable(ci, vi, ti=0):
    return chr(0xAC00 + ci * 588 + vi * 28 + ti)


class Part:
    """바깥 윤곽 하나와 그 안의 구멍들(ㅇ의 고리처럼). 녹음된 그리기 명령을 그대로 들고 있다."""
    def __init__(self, outer):
        self.contours = [outer]

    @property
    def box(self):
        return self.contours[0]["box"]


def parts_of(char):
    pen = DecomposingRecordingPen(glyph_set)
    glyph_set[cmap[ord(char)]].draw(pen)
    contours, current = [], []
    for op, args in pen.value:
        current.append((op, args))
        if op in ("closePath", "endPath"):
            contours.append(current)
            current = []
    out = []
    for c in contours:
        bp = BoundsPen(glyph_set)
        for op, args in c:
            getattr(bp, op)(*args)
        out.append({"ops": c, "box": bp.bounds})
    def inside(a, b):
        ax0, ay0, ax1, ay1 = a["box"]; bx0, by0, bx1, by1 = b["box"]
        return bx0 <= ax0 and by0 <= ay0 and ax1 <= bx1 and ay1 <= by1 and a is not b
    parts = []
    for c in sorted(out, key=lambda c: -(c["box"][2] - c["box"][0]) * (c["box"][3] - c["box"][1])):
        host = next((p for p in parts if inside(c, p.contours[0])), None)
        if host: host.contours.append(c)
        else: parts.append(Part(c))
    return parts


def lowest(parts):
    return min(parts, key=lambda p: p.box[1])


def highest_ring(parts):
    rings = [p for p in parts if len(p.contours) > 1]
    return max(rings, key=lambda p: p.box[3])


def rightmost(parts):
    return max(parts, key=lambda p: p.box[2])


def without(parts, *drop):
    return [p for p in parts if all(p is not d for d in drop)]


DOWN = set("ㅜㅠㅝㅞㅟ")  # 아래로 내려가는 기둥이 있는 모음: 초성을 조금 더 위에 둔다


def cho_form(v):
    if v in VERTICAL: return "side"
    if v in HORIZONTAL: return "topu" if v in DOWN else "top"
    return "mixu" if v in DOWN else "mix"


# 초성을 떼어 올 짜임(받침 ㅇ): 모음 모양별로 하나
CHO_SOURCE = {"side": "ㅏ", "top": "ㅡ", "topu": "ㅜ", "mix": "ㅢ", "mixu": "ㅟ"}


def cho_parts(ci, form):
    """초성: 받침 ㅇ이 있는 짜임에서 모음과 받침을 빼고 남은 것."""
    parts = parts_of(syllable(ci, JUNG.index(CHO_SOURCE[form]), 21))
    if form == "side":
        parts = without(parts, lowest(parts))
        return without(parts, rightmost(parts))
    # 가로줄(가장 넓은 조각) 위에 떠 있는 조각만 초성. 받침 ㅇ이나 세로 기둥이 줄에 붙어 있어도 상관없다.
    bar = max(parts, key=lambda p: p.box[2] - p.box[0])
    return [p for p in parts if p.box[1] > bar.box[3] - 12]


class FlatPen(BasePen):
    """곡선을 잘게 펴서 다각형 점 목록으로 (ㅇ과 붙은 모음을 잘라 낼 때만 쓴다)"""
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


def shape_of(char):
    pen = FlatPen()
    rec = DecomposingRecordingPen(glyph_set); glyph_set[cmap[ord(char)]].draw(rec); rec.replay(pen)
    geom = Polygon()
    for c in pen.contours:
        geom = geom.symmetric_difference(Polygon(c).buffer(0))  # 짝홀 규칙: 구멍은 빠진다
    return geom, pen.contours


def ring_thickness():
    """ㅇ 고리의 좌우·위아래 두께(‘응’의 받침 ㅇ: 다른 자모와 닿지 않는다)"""
    parts = parts_of(syllable(IEUNG, JUNG.index("ㅡ"), 21))
    ring = lowest(parts)
    ox0, oy0, ox1, oy1 = ring.contours[0]["box"]; hx0, hy0, hx1, hy1 = ring.contours[1]["box"]
    return ((hx0 - ox0) + (ox1 - hx1)) / 2, ((hy0 - oy0) + (oy1 - hy1)) / 2


RING_T = None
UPWARD = set("ㅗㅛㅘㅙㅚ")  # 위로 솟는 기둥이 초성 ㅇ에 붙어 버리는 모음


def upward_parts(vi):
    """ㅗ·ㅛ 계열: 기둥이 초성과 떨어진 짜임(‘농’·‘동’ …)에서 초성과 받침 ㅇ을 뺀다.
    가로줄(가장 넓은 조각)에 기둥이 붙어 있고, 초성 조각은 모두 그 위에 떠 있는 짜임만 쓴다."""
    for cho in "ㅅㅈㅊㄴㄷ":
        parts = parts_of(syllable(CHO.index(cho), vi, 21))
        parts = without(parts, lowest(parts))
        bar = max(parts, key=lambda p: p.box[2] - p.box[0])
        if bar.box[3] - bar.box[1] < 150:  # 기둥이 가로줄에 없다(초성에 붙어 버린 짜임)
            continue
        stems = [p for p in parts if p is not bar and p.box[0] > (bar.box[0] + bar.box[2]) / 2 and p.box[3] - p.box[1] > 350]
        vowel = [bar, *stems]
        rest = without(parts, *vowel)
        if not rest or any(p.box[1] < bar.box[1] for p in rest):  # 초성이 따로 떨어져 있어야
            continue
        return vowel
    raise ValueError("ㅗ 계열 모음을 떼어 낼 짜임이 없다: " + JUNG[vi])


def jung_glyph(vi):
    """중성: ‘ㅇ+모음+ㅇ’에서 위아래 ㅇ 고리를 고리 모양대로 도려낸 것. 모음 끝이 ㅇ에 닿아 있어도 깨끗이 떨어진다."""
    global RING_T
    if JUNG[vi] in UPWARD:
        return to_glyph(upward_parts(vi))
    if RING_T is None: RING_T = ring_thickness()
    tx, ty = RING_T
    geom, contours = shape_of(syllable(IEUNG, vi, 21))
    holes = []
    for c in contours:
        poly = Polygon(c)
        if any(Polygon(o).contains(poly) for o in contours if o is not c): holes.append(poly.bounds)
    holes.sort(key=lambda b: b[3])
    for x0, y0, x1, y1 in [holes[0], holes[-1]]:  # 받침 ㅇ(맨 아래), 초성 ㅇ(맨 위)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rx, ry = (x1 - x0) / 2 + tx + 7, (y1 - y0) / 2 + ty + 7
        geom = geom.difference(affinity.scale(Point(cx, cy).buffer(1, 48), rx, ry))
    pen = TTGlyphPen(None)
    for g in getattr(geom, "geoms", [geom]):
        if g.area < 400: continue  # 잘린 부스러기
        g = orient(g.simplify(0.6), sign=-1.0)
        for ring in [g.exterior, *g.interiors]:
            pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
            pts = [q for i, q in enumerate(pts) if q != pts[i - 1]]
            if len(pts) < 3: continue
            pen.moveTo(pts[0]); [pen.lineTo(q) for q in pts[1:]]; pen.closePath()
    return pen.glyph()


def jong_parts(ti):
    """종성: ‘아+받침’에서 초성 ㅇ과 ㅏ를 뺀 것."""
    parts = parts_of(syllable(IEUNG, 0, ti))
    parts = without(parts, highest_ring(parts))
    return without(parts, max(parts, key=lambda p: p.box[3]))


def to_glyph(parts):
    pen = TTGlyphPen(None)
    for p in parts:
        for c in p.contours:
            for op, args in c["ops"]:
                getattr(pen, op)(*args)
    return pen.glyph()


def composite(names, glyphs, offsets):
    pen = TTGlyphPen(glyphs)
    for n, dy in zip(names, offsets): pen.addComponent(n, (1, 0, 0, 1, 0, dy))
    return pen.glyph()


def outline_geom(glyph):
    """단순 글리프의 윤곽을 다각형(짝홀 규칙)으로. 곡선 조절점도 꼭짓점으로 보는 대략값이면 충분하다."""
    if glyph.numberOfContours <= 0: return Polygon()
    coords = list(glyph.coordinates); geom = Polygon(); start = 0
    for end in glyph.endPtsOfContours:
        ring = coords[start:end + 1]; start = end + 1
        if len(ring) >= 3: geom = geom.symmetric_difference(Polygon(ring).buffer(0))
    return geom


def bar_height(geom):
    """가로획이 가장 넓게 지나가는 높이(가로 모음의 줄기 자리)"""
    x0, y0, x1, y1 = geom.bounds
    best, best_y = -1, y0
    for y in range(int(y0), int(y1), 3):
        w = geom.intersection(Polygon([(x0 - 1, y), (x1 + 1, y), (x1 + 1, y + 3), (x0 - 1, y + 3)])).area
        if w > best: best, best_y = w, y
    return best_y + 1.5


GAP = 38  # 받침과 그 위 자모 사이의 틈


def typewriter_shifts(glyphs):
    """타자기처럼 자모마다 하나의 고정 높이를 준다.
    - 가로·섞인 모음: 줄기를 ‘ㅡ’·‘ㅢ’의 줄기 높이에 맞춘다(떼어 온 짜임마다 달랐던 높이를 하나로).
    - 받침: 모든 초성·모음보다 아래, 한 줄에 놓는다(어느 글자에서도 위 자모와 닿지 않게)."""
    geoms = {n: outline_geom(g) for n, g in glyphs.items() if n.startswith(("cho", "jung", "jong"))}
    shifts = {}
    targets = {form: bar_height(geoms[f"jung{JUNG.index(v)}"]) for form, v in CHO_SOURCE.items() if form != "side"}
    for i, v in enumerate(JUNG):
        if v in VERTICAL: continue
        shifts[f"jung{i}"] = round(targets[cho_form(v)] - bar_height(geoms[f"jung{i}"]))
    # 받침: 자모 모양은 그대로 두고, 그 글자의 초성·모음 바로 아래(GAP)에 내려놓는다.
    # 받침이 놓이는 가로 범위 안에서만 본다(섞인 모음의 오른쪽 기둥은 받침 옆으로 내려가도 닿지 않는다).
    jong = [geoms[n] for n in geoms if n.startswith("jong")]
    jx0 = min(g.bounds[0] for g in jong) - 25; jx1 = max(g.bounds[2] for g in jong) + 25
    band = Polygon([(jx0, -2000), (jx1, -2000), (jx1, 2000), (jx0, 2000)])
    lows = {}
    for n, g in geoms.items():
        if n.startswith("jong"): continue
        clip = g.intersection(band)
        lows[n] = clip.bounds[1] + shifts.get(n, 0) if not clip.is_empty else 10_000
    tops = {n: g.bounds[3] for n, g in geoms.items() if n.startswith("jong")}
    def jong_shift(cho_name, jung_name, jong_name):
        return round(min(lows[cho_name], lows[jung_name]) - GAP - tops[jong_name])
    shifts["jong"] = jong_shift
    return shifts, geoms


def build():
    notdef = TTGlyphPen(None)
    for box in [((100, -60), (100, 800), (900, 800), (900, -60)), ((170, 10), (830, 10), (830, 730), (170, 730))]:
        notdef.moveTo(box[0]); [notdef.lineTo(p) for p in box[1:]]; notdef.closePath()
    glyphs = {".notdef": notdef.glyph(), "space": TTGlyphPen(None).glyph()}
    cmap_out = {0x20: "space", 0x3000: "space"}
    for i in range(len(CHO)):
        for form in ("side", "top", "topu", "mix", "mixu"):
            glyphs[f"cho{i}.{form}"] = to_glyph(cho_parts(i, form))
    for i in range(len(JUNG)):
        glyphs[f"jung{i}"] = jung_glyph(i)
    for i in range(1, len(JONG)):
        glyphs[f"jong{i}"] = to_glyph(jong_parts(i))
    shifts, geoms = typewriter_shifts(glyphs)
    print("vowel shifts", {k: v for k, v in shifts.items() if k != "jong" and v})
    pieces = {}
    for code in range(0xAC00, 0xD7A4):
        n = code - 0xAC00
        ci, vi, ti = n // 588, (n // 28) % 21, n % 28
        v = JUNG[vi]
        form = cho_form(v)
        name = f"uni{code:04X}"
        names = [f"cho{ci}.{form}", f"jung{vi}"] + ([f"jong{ti}"] if ti else [])
        offsets = [0, shifts.get(names[1], 0)] + ([shifts["jong"](*names)] if ti else [])
        glyphs[name] = composite(names, glyphs, offsets)
        cmap_out[code] = name
        pieces[chr(code)] = [affinity.translate(geoms[n], 0, dy) for n, dy in zip(names, offsets)]
    # 낱자(호환 자모)는 고운바탕의 낱자를 그대로
    for code in range(0x3131, 0x3164):
        if code not in cmap: continue
        pen = TTGlyphPen(None)
        rec = DecomposingRecordingPen(glyph_set); glyph_set[cmap[code]].draw(rec); rec.replay(pen)
        glyphs[f"uni{code:04X}"] = pen.glyph()
        cmap_out[code] = f"uni{code:04X}"

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
        "uniqueFontIdentifier": "WSNS studio: WSNS Sagaktalchul Regular 2",
        "fullName": "WSNS Sagaktalchul Regular",
        "psName": "WSNSSagaktalchul-Regular",
        "version": "Version 2.000",
        "copyright": "Copyright 2021 The Gowun Batang Project Authors; Copyright 2026 WSNS studio",
        "manufacturer": "WSNS studio",
        "description": "Gowun Batang jamo rearranged in an out-of-square typewriter layout.",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
    })
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, sTypoLineGap=0, usWinAscent=1000, usWinDescent=250,
                achVendID="WSNS", fsType=0, usWeightClass=400,
                ulUnicodeRange1=1 << 0, ulUnicodeRange2=(1 << 24) | (1 << 20))
    fb.setupPost()
    xs, ys = [], []
    for code in range(0xAC00, 0xD7A4):
        g = glyf[cmap_out[code]]
        xs += [g.xMin, g.xMax]; ys += [g.yMin, g.yMax]
    fb.font.flavor = "woff2"
    fb.save(str(OUT))
    frame = [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
    print(OUT, OUT.stat().st_size, "bytes,", len(order), "glyphs; frame", frame)
    write_frame(frame)
    write_regions(pieces, frame)


def write_frame(frame):
    """lib/reference-fonts.ts 의 frame 을 새 범위로"""
    import re
    p = Path("lib/reference-fonts.ts"); s = p.read_text(encoding="utf-8")
    s = re.sub(r'(file: "WSNS-Sagaktalchul.woff2",[^}]*?frame: )\[[^\]]*\]', lambda m: m.group(1) + str(frame).replace("'", ""), s, flags=re.S)
    p.write_text(s, encoding="utf-8")


def write_regions(pieces, frame):
    """자모 판정 자료(data/reference-regions.json 의 squareout): 자모 조각을 알고 있으니 추측 없이 그대로 칠한다.
    형식은 scripts/build-reference-regions.py 와 같다(96칸, 공통 틀 기준)."""
    import json, re
    from collections import deque
    import numpy as np
    from PIL import Image, ImageDraw
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
        for label, (name, geom) in enumerate(zip(("cho", "jung", "jong"), pieces[char]), start=1):
            img = Image.new("L", (R, R), 0); d = ImageDraw.Draw(img)
            for g in getattr(geom, "geoms", [geom]):
                if g.is_empty: continue
                d.polygon([to_px(x, y) for x, y in g.exterior.coords], fill=255)
                for hole in g.interiors: d.polygon([to_px(x, y) for x, y in hole.coords], fill=0)
                for x, y in g.exterior.coords:
                    fit = max(fit, (abs(x - cx) + abs(y - cy)) / ((fw + fh) / 2))
            mask = np.asarray(img) > 127
            hi[mask] = label
            py, px = np.where(mask)
            boxes[name] = [round(float(v), 5) for v in ((px.min() - 1) / (R - 3), (py.min() - 1) / (R - 3),
                                                       (px.max() - px.min() + 1) / (R - 3), (py.max() - py.min() + 1) / (R - 3))]
        labels = np.zeros((N, N), dtype=np.uint8); ink = np.zeros((N, N), dtype=bool)
        for r in range(N):
            for c in range(N):
                block = hi[r * 3:r * 3 + 3, c * 3:c * 3 + 3]; nz = block[block > 0]
                if nz.size:
                    labels[r, c] = np.bincount(nz).argmax(); ink[r, c] = nz.size >= block.size * 0.35
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
    for e in out.values(): e["fit"] = round(fit, 5)
    out = {c: {"size": e["size"], "fit": e["fit"], "boxes": e["boxes"], "regions": e["regions"]} for c, e in out.items()}
    path = Path("data/reference-regions.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    data["fonts"]["squareout"] = out
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("regions", len(out), "fit", round(fit, 4))


if __name__ == "__main__":
    build()
