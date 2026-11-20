"""WSNS 사각탈출 — 쎈스 글리프 견본용 탈네모꼴(타자기식) 한글 글꼴을 만든다.

짜임 원리만 옛 세벌식 타자기에서 가져오고(자모가 짝에 따라 크기를 바꾸지 않고
정해진 자리에 찍힌다), 자모의 획 모양은 이 파일에서 새로 그린다.

- 획: 자모마다 중심선(뼈대)을 그리고 같은 두께의 둥근 획으로 감싼다(모노라인).
- 초성 3벌: 세로 모음 옆 / 가로 모음 위 / 섞인 모음 왼쪽 위
- 중성 1벌, 종성 1벌: 늘 같은 모양·같은 자리. 받침이 있으면 아래로 내려온다(탈네모).
- 음절 11,172자는 자모 글리프를 겹쳐 놓은 합성 글리프(TrueType composite)라 파일이 작다.

필요: fonttools, shapely, brotli
실행: python3 scripts/build-sagaktalchul.py  →  public/fonts/WSNS-Sagaktalchul.woff2
"""
import math
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely import affinity

OUT = Path("public/fonts/WSNS-Sagaktalchul.woff2")
UPM = 1000
ADV = 1000
W = 68  # 획 두께
R = W / 2

CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
        "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
VERTICAL = set("ㅏㅐㅑㅒㅓㅔㅕㅖㅣ")
HORIZONTAL = set("ㅗㅛㅜㅠㅡ")

# ---------------------------------------------------------------- 자음 뼈대
# 상자 [0,1]×[0,1] 안의 좌표(x 오른쪽, y 아래쪽). 획은 선(점 목록) 또는 ("o", cx, cy, rx, ry) 고리.
def C(*pts):
    return [tuple(p) for p in pts]

CONSONANT = {
    "ㄱ": [C((0.04, 0.07), (0.9, 0.07), (0.9, 0.38), (0.74, 1.0))],
    "ㄴ": [C((0.08, 0.0), (0.08, 0.93), (1.0, 0.93))],
    "ㄷ": [C((0.06, 0.07), (0.96, 0.07)), C((0.08, 0.07), (0.08, 0.93), (1.0, 0.93))],
    "ㄹ": [C((0.04, 0.06), (0.9, 0.06), (0.9, 0.47), (0.1, 0.47), (0.1, 0.93), (1.0, 0.93))],
    "ㅁ": [C((0.08, 0.08), (0.92, 0.08), (0.92, 0.93), (0.08, 0.93), (0.08, 0.08))],
    "ㅂ": [C((0.1, 0.0), (0.1, 0.93), (0.9, 0.93), (0.9, 0.0)), C((0.1, 0.46), (0.9, 0.46))],
    "ㅅ": [C((0.52, 0.0), (0.04, 0.98)), C((0.55, 0.42), (0.98, 0.98))],
    "ㅇ": [("o", 0.5, 0.52, 0.44, 0.44)],
    "ㅈ": [C((0.06, 0.07), (0.92, 0.07), (0.04, 0.98)), C((0.55, 0.46), (0.98, 0.98))],
    "ㅊ": [C((0.5, -0.06), (0.5, 0.1)), C((0.06, 0.24), (0.92, 0.24), (0.04, 0.98)), C((0.56, 0.58), (0.98, 0.98))],
    "ㅋ": [C((0.04, 0.07), (0.9, 0.07), (0.9, 0.38), (0.74, 1.0)), C((0.1, 0.47), (0.86, 0.47))],
    "ㅌ": [C((0.06, 0.06), (0.96, 0.06)), C((0.08, 0.06), (0.08, 0.93), (1.0, 0.93)), C((0.08, 0.48), (0.88, 0.48))],
    "ㅍ": [C((0.02, 0.08), (0.98, 0.08)), C((0.02, 0.93), (0.98, 0.93)), C((0.33, 0.08), (0.3, 0.93)), C((0.67, 0.08), (0.7, 0.93))],
    "ㅎ": [C((0.5, -0.06), (0.5, 0.1)), C((0.1, 0.25), (0.9, 0.25)), ("o", 0.5, 0.66, 0.34, 0.3)],
}
DOUBLE = {"ㄲ": "ㄱㄱ", "ㄸ": "ㄷㄷ", "ㅃ": "ㅂㅂ", "ㅆ": "ㅅㅅ", "ㅉ": "ㅈㅈ",
          "ㄳ": "ㄱㅅ", "ㄵ": "ㄴㅈ", "ㄶ": "ㄴㅎ", "ㄺ": "ㄹㄱ", "ㄻ": "ㄹㅁ", "ㄼ": "ㄹㅂ",
          "ㄽ": "ㄹㅅ", "ㄾ": "ㄹㅌ", "ㄿ": "ㄹㅍ", "ㅀ": "ㄹㅎ", "ㅄ": "ㅂㅅ"}


def consonant_geom(name, box):
    """상자(x0, y0_top, x1, y1_bottom; 폰트 좌표 y 위쪽)에 자음 뼈대를 펼쳐 획으로 만든다."""
    x0, top, x1, bottom = box
    if name in DOUBLE:
        a, b = DOUBLE[name]
        gap = 0.08 * (x1 - x0)
        mid = (x0 + x1) / 2
        return unary_union([consonant_geom(a, (x0, top, mid - gap / 2, bottom)),
                            consonant_geom(b, (mid + gap / 2, top, x1, bottom))])
    w, h = x1 - x0, top - bottom
    to = lambda p: (x0 + p[0] * w, top - p[1] * h)
    parts = []
    for stroke in CONSONANT[name]:
        if stroke[0] == "o":
            _, cx, cy, rx, ry = stroke
            c = to((cx, cy))
            ring = affinity.scale(Point(c).buffer(1, 64).exterior, rx * w, ry * h, origin=c)
            parts.append(Polygon(ring).buffer(R, 16).difference(Polygon(ring).buffer(-R, 16)))
        else:
            parts.append(LineString([to(p) for p in stroke]).buffer(R, 12, cap_style="round", join_style="round"))
    return unary_union(parts)


def lines(*segments):
    return unary_union([LineString(s).buffer(R, 12, cap_style="round", join_style="round") for s in segments])

# ---------------------------------------------------------------- 자리(폰트 좌표, y 위쪽)
TOP = 800
CHO_SIDE = (70, TOP, 500, 410)      # 세로 모음 옆
CHO_TOP = (210, TOP, 790, 568)      # 가로 모음 위
CHO_MIX = (70, TOP, 470, 568)       # 섞인 모음 왼쪽 위
JONG_BOX = (170, 190, 810, -70)     # 받침: 늘 같은 자리
BAR_Y = 420                         # 가로 모음 줄기
V_BOTTOM = 300                      # 세로 모음 끝(받침 유무와 상관없이 같은 길이)


def vowel_geom(v):
    segs = []
    def stem(x, bottom=V_BOTTOM):
        segs.append([(x, TOP), (x, bottom)])
    def right(x, y, length=125):
        segs.append([(x, y), (x + length, y)])
    def left(x, y, length=125):
        segs.append([(x - length, y), (x, y)])
    if v in VERTICAL:
        if v == "ㅣ": stem(700)
        elif v == "ㅏ": stem(680); right(680, 560)
        elif v == "ㅑ": stem(680); right(680, 625); right(680, 490)
        elif v == "ㅓ": stem(720); left(720, 560, 150)
        elif v == "ㅕ": stem(720); left(720, 625, 150); left(720, 490, 150)
        elif v == "ㅐ": stem(630); right(630, 560, 110); stem(860)
        elif v == "ㅒ": stem(630); right(630, 625, 110); right(630, 490, 110); stem(860)
        elif v == "ㅔ": stem(690); left(690, 560, 140); stem(870)
        elif v == "ㅖ": stem(690); left(690, 625, 140); left(690, 490, 140); stem(870)
        return lines(*segs)
    # 가로 줄기 + 짧은 기둥
    def bar(x0, x1, kind):
        segs.append([(x0, BAR_Y), (x1, BAR_Y)])
        mid = (x0 + x1) / 2
        if kind == "ㅗ": segs.append([(mid, BAR_Y), (mid, 485)])
        if kind == "ㅛ": segs.extend([[(mid - 105, BAR_Y), (mid - 105, 485)], [(mid + 105, BAR_Y), (mid + 105, 485)]])
        if kind == "ㅜ": segs.append([(mid, BAR_Y), (mid, 275)])
        if kind == "ㅠ": segs.extend([[(mid - 105, BAR_Y), (mid - 105, 275)], [(mid + 105, BAR_Y), (mid + 105, 275)]])
    if v in HORIZONTAL:
        bar(130, 870, v)
        return lines(*segs)
    # 섞인 모음: 왼쪽 가로 모음 + 오른쪽 세로 모음
    horizontal = {"ㅘ": "ㅗ", "ㅙ": "ㅗ", "ㅚ": "ㅗ", "ㅝ": "ㅜ", "ㅞ": "ㅜ", "ㅟ": "ㅜ", "ㅢ": "ㅡ"}[v]
    bar(70, 560, horizontal)
    low = 280
    if v in "ㅚㅟㅢ": stem(730, low)
    elif v == "ㅘ": stem(700, low); right(700, 560)
    elif v == "ㅝ": stem(740, low); left(740, 560, 140)
    elif v == "ㅙ": stem(650, low); right(650, 560, 100); stem(870, low)
    elif v == "ㅞ": stem(700, low); left(700, 560, 110); stem(880, low)
    return lines(*segs)

# ---------------------------------------------------------------- 글리프 만들기
def to_glyph(geom):
    pen = TTGlyphPen(None)
    geoms = getattr(geom, "geoms", [geom])
    for g in geoms:
        g = orient(g.simplify(1.2), sign=-1.0)  # 바깥 시계 방향, 구멍 반시계(TrueType)
        for ring in [g.exterior, *g.interiors]:
            pts = [(round(x), round(y)) for x, y in ring.coords[:-1]]
            clean = [p for i, p in enumerate(pts) if p != pts[i - 1]]
            if len(clean) < 3: continue
            pen.moveTo(clean[0])
            for p in clean[1:]: pen.lineTo(p)
            pen.closePath()
    return pen.glyph()


def composite(names, glyph_set):
    pen = TTGlyphPen(glyph_set)
    for n in names: pen.addComponent(n, (1, 0, 0, 1, 0, 0))
    return pen.glyph()


def build():
    glyphs = {".notdef": to_glyph(Polygon([(100, -60), (900, -60), (900, 800), (100, 800)]).difference(
        Polygon([(170, 10), (830, 10), (830, 730), (170, 730)]))), "space": TTGlyphPen(None).glyph()}
    cmap = {0x20: "space", 0x3000: "space"}
    for i, c in enumerate(CHO):
        glyphs[f"cho{i}.side"] = to_glyph(consonant_geom(c, CHO_SIDE))
        glyphs[f"cho{i}.top"] = to_glyph(consonant_geom(c, CHO_TOP))
        glyphs[f"cho{i}.mix"] = to_glyph(consonant_geom(c, CHO_MIX))
    for i, v in enumerate(JUNG):
        glyphs[f"jung{i}"] = to_glyph(vowel_geom(v))
    for i, t in enumerate(JONG):
        if t: glyphs[f"jong{i}"] = to_glyph(consonant_geom(t, JONG_BOX))
    for code in range(0xAC00, 0xD7A4):
        n = code - 0xAC00
        ci, vi, ti = n // 588, (n // 28) % 21, n % 28
        v = JUNG[vi]
        form = "side" if v in VERTICAL else "top" if v in HORIZONTAL else "mix"
        parts = [f"cho{ci}.{form}", f"jung{vi}"] + ([f"jong{ti}"] if ti else [])
        name = f"uni{code:04X}"
        glyphs[name] = composite(parts, glyphs)
        cmap[code] = name
    # 낱자(호환 자모): 자음은 가운데 큰 상자에, 모음은 그대로
    compat = "ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
    for j, c in enumerate(compat):
        code = 0x3131 + j
        glyphs[f"uni{code:04X}"] = to_glyph(consonant_geom(c, (170, 720, 830, 80)))
        cmap[code] = f"uni{code:04X}"
    for j, v in enumerate(JUNG):
        code = 0x314F + j
        glyphs[f"uni{code:04X}"] = composite([f"jung{j}"], glyphs)
        cmap[code] = f"uni{code:04X}"

    order = list(glyphs)
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (ADV if n != "space" else 500, 0) for n in order})
    for n in order:
        g = fb.font["glyf"][n]
        g.recalcBounds(fb.font["glyf"])
        fb.font["hmtx"][n] = (ADV if n != "space" else 500, getattr(g, "xMin", 0))
    fb.setupHorizontalHeader(ascent=880, descent=-120)
    fb.setupNameTable({
        "familyName": {"en": "WSNS Sagaktalchul", "ko": "WSNS 사각탈출"},
        "styleName": "Regular",
        "uniqueFontIdentifier": "WSNS studio: WSNS Sagaktalchul Regular",
        "fullName": "WSNS Sagaktalchul Regular",
        "psName": "WSNSSagaktalchul-Regular",
        "version": "Version 1.000",
        "copyright": "Copyright 2026 WSNS studio",
        "manufacturer": "WSNS studio",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
    })
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, sTypoLineGap=0, usWinAscent=900, usWinDescent=140,
                achVendID="WSNS", fsType=0, usWeightClass=400,
                ulUnicodeRange1=1 << 0, ulUnicodeRange2=(1 << 24) | (1 << 20))
    fb.setupPost()
    fb.font.flavor = "woff2"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fb.save(str(OUT))
    print(OUT, OUT.stat().st_size, "bytes,", len(order), "glyphs")


if __name__ == "__main__":
    build()
