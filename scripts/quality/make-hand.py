"""손글씨 폰트를 '사람이 태블릿에 쓴 획'처럼 바꿔 시험용 프로젝트를 만든다.

python3 scripts/quality/make-hand.py <손글씨.ttf> <출력.json> [seed]

- 글자를 그려 뼈대(skeleton)를 뽑고, 갈래를 이어 획(폴리라인)으로 만든다.
- 사람이 매번 조금씩 다르게 쓰는 것처럼 글자마다 크기·위치·기울기·떨림을 준다.
- 앱의 쓰기 목록(data/charset.ts 의 HANGUL)만 '쓴 글자'로 넣는다. 나머지는 정답으로만 쓴다.
"""
import json
import math
import random
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from skimage.draw import polygon as draw_polygon
from skimage.measure import label
from skimage.morphology import skeletonize

FONT, OUT = sys.argv[1], sys.argv[2]
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 7
PX = 400  # 글자 크기(px)
CANVAS = 520


def charset():
    src = open("data/charset.ts", encoding="utf8").read()
    return re.search(r'HANGUL =\s*"([^"]+)"', src).group(1).split(" ")


def raster(font, ch):
    img = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(img).text((60, 60 + PX * 0.88), ch, font=font, fill=255, anchor="ls")
    return np.array(img) > 127


NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def trace(skel):
    """뼈대 → 갈래(노드 사이 경로)."""
    ys, xs = np.nonzero(skel)
    on = set(zip(ys.tolist(), xs.tolist()))
    nbrs = {p: [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in on] for p in on}
    nodes = {p for p, n in nbrs.items() if len(n) != 2}
    seen_edges = set()
    paths = []
    for start in nodes:
        for nxt in nbrs[start]:
            if (start, nxt) in seen_edges:
                continue
            path = [start, nxt]
            seen_edges.add((start, nxt))
            prev, cur = start, nxt
            while cur not in nodes:
                cand = [q for q in nbrs[cur] if q != prev and (cur, q) not in seen_edges]
                if not cand:
                    break
                prev, cur = cur, cand[0]
                seen_edges.add((prev, cur))
                path.append(cur)
            seen_edges.add((path[-1], path[-2]))
            paths.append(path)
    # 고리(노드 없는 원, 예: ㅇ)
    left = on - {p for path in paths for p in path}
    while left:
        start = next(iter(left))
        path = [start]
        prev, cur = None, start
        while True:
            cand = [q for q in nbrs[cur] if q != prev and q in left and q not in path]
            if not cand:
                break
            prev, cur = cur, cand[0]
            path.append(cur)
        path.append(start)
        left -= set(path)
        if len(path) > 6:
            paths.append(path)
    return paths


def direction(path, at_start, n=8):
    pts = path[: n + 1] if at_start else path[::-1][: n + 1]
    dy, dx = pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1]
    return math.atan2(dy, dx)


def node_clusters(paths):
    """서로 붙어 있는 갈림점 픽셀들을 하나의 갈림점으로 본다."""
    ends = {p[0] for p in paths} | {p[-1] for p in paths}
    cid = {}
    for e in ends:
        if e in cid:
            continue
        stack = [e]
        cid[e] = e
        while stack:
            q = stack.pop()
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    r = (q[0] + dy, q[1] + dx)
                    if r in ends and r not in cid:
                        cid[r] = e
                        stack.append(r)
    return cid


def merge(paths):
    """갈림점에서 거의 일직선으로 이어지는 두 갈래를 하나의 획으로 잇는다."""
    cid = node_clusters(paths)
    # 같은 갈림점 무리 안의 아주 짧은 연결은 버린다
    paths = [p for p in paths if not (cid.get(p[0]) == cid.get(p[-1]) and len(p) < 8 and p[0] != p[-1])]
    paths = [p for p in paths if len(p) >= 3 or p[0] == p[-1]]
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, p in enumerate(paths):
            if p[0] == p[-1]:
                continue
            ends.setdefault(cid.get(p[0], p[0]), []).append((i, True))
            ends.setdefault(cid.get(p[-1], p[-1]), []).append((i, False))
        best = None
        for node, items in ends.items():
            for a in range(len(items)):
                for b in range(a + 1, len(items)):
                    (i, si), (j, sj) = items[a], items[b]
                    if i == j:
                        continue
                    da = direction(paths[i], si)
                    db = direction(paths[j], sj)
                    diff = abs((da - db + math.pi) % (2 * math.pi) - math.pi)
                    straight = abs(diff - math.pi)
                    if straight < math.radians(35) and (best is None or straight < best[0]):
                        best = (straight, i, si, j, sj)
        if best:
            _, i, si, j, sj = best
            a = paths[i][::-1] if si else paths[i]
            b = paths[j] if sj else paths[j][::-1]
            joined = a + b
            paths = [p for k, p in enumerate(paths) if k not in (i, j)] + [joined]
            changed = True
    return [p for p in paths if len(p) >= 6]


def rdp(points, eps=1.2):
    if len(points) < 3:
        return points
    if points[0] == points[-1]:
        half = len(points) // 2
        return rdp(points[: half + 1], eps)[:-1] + rdp(points[half:], eps)
    a, b = np.array(points[0], float), np.array(points[-1], float)
    ab = b - a
    norm = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / norm for p in points[1:-1]]
    k = int(np.argmax(d)) + 1
    if d[k - 1] > eps:
        return rdp(points[: k + 1], eps)[:-1] + rdp(points[k:], eps)
    return [points[0], points[-1]]


def orient(path):
    """사람이 긋는 방향: 가로획은 왼→오, 세로획은 위→아래."""
    (y0, x0), (y1, x1) = path[0], path[-1]
    if abs(x1 - x0) >= abs(y1 - y0):
        return path if x0 <= x1 else path[::-1]
    return path if y0 <= y1 else path[::-1]


def vowel_type(ch):
    jung = ((ord(ch) - 0xAC00) // 28) % 21
    if jung in (0, 1, 2, 3, 4, 5, 6, 7, 20):
        return "V"
    return "H" if jung in (8, 12, 13, 17, 18) else "C"


def part_boxes(ch, bbox):
    """앱의 자모 자리(lib/font/composition.ts layoutBoxes)를 글자 범위에 맞춘 것."""
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    jong = (ord(ch) - 0xAC00) % 28 > 0
    t = vowel_type(ch)
    top = 0.68 if jong else 1.0
    r = lambda a, b, c, d: (x0 + a * w, y0 + b * h, x0 + c * w, y0 + d * h)
    boxes = {
        "V": {"cho": r(0, 0, 0.5, top), "jung": r(0.55, 0, 1, top)},
        "H": {"cho": r(0, 0, 1, top * 0.5), "jung": r(0, top * 0.58, 1, top)},
        "C": {"cho": r(0, 0, 0.55, top * 0.5), "jung": r(0, top * 0.58, 1, top)},
    }[t]
    if t == "C":
        boxes["jung2"] = r(0.62, 0, 1, top)
    if jong:
        boxes["jong"] = r(0, 0.72, 1, 1)
    return boxes


def box_distance(p, b):
    dx = max(b[0] - p[0], 0, p[0] - b[2])
    dy = max(b[1] - p[1], 0, p[1] - b[3])
    return math.hypot(dx, dy)


def assign_parts(ch, comps):
    """덩어리(이어진 잉크)마다 초성·중성·종성 정하기. 모든 자모에 덩어리가 하나 이상 가도록 고른다."""
    ys = [c[0] for comp in comps for c in comp]
    xs = [c[1] for comp in comps for c in comp]
    boxes = part_boxes(ch, (min(xs), min(ys), max(xs), max(ys)))
    parts = ["cho", "jung"] + (["jong"] if "jong" in boxes else [])
    cents = [(np.mean([c[1] for c in comp]), np.mean([c[0] for c in comp])) for comp in comps]
    def cost(i, part):
        d = box_distance(cents[i], boxes[part])
        if part == "jung" and "jung2" in boxes:
            d = min(d, box_distance(cents[i], boxes["jung2"]))
        return d
    best = None
    from itertools import product
    for combo in product(range(len(parts)), repeat=len(comps)):
        if len(set(combo)) < len(parts):
            continue
        c = sum(cost(i, parts[k]) for i, k in enumerate(combo))
        if best is None or c < best[0]:
            best = (c, combo)
    if best is None:
        return None
    return [parts[k] for k in best[1]]


TT = TTFont(FONT)
GLYPHS = TT.getGlyphSet()
CMAP = TT.getBestCmap()
UPM = TT["head"].unitsPerEm


def glyph_mask(name):
    """글리프 하나를 raster() 와 같은 자리·크기로 그린다(짝홀 규칙)."""
    pen = DecomposingRecordingPen(GLYPHS)
    GLYPHS[name].draw(pen)
    mask = np.zeros((CANVAS, CANVAS), bool)
    k = PX / UPM
    base = 60 + PX * 0.88
    contour = []
    def flush():
        if len(contour) >= 3:
            ys = [base - y * k for _, y in contour]
            xs = [60 + x * k for x, _ in contour]
            rr, cc = draw_polygon(ys, xs, mask.shape)
            mask[rr, cc] ^= True
        contour.clear()
    last = None
    for op, args in pen.value:
        if op == "moveTo":
            flush()
            last = args[0]
            contour.append(last)
        elif op == "lineTo":
            last = args[0]
            contour.append(last)
        elif op == "qCurveTo":
            pts = list(args)
            # 암묵적 중간점 풀기
            seq = [last]
            for i, q in enumerate(pts[:-1]):
                seq.append(q)
                if i < len(pts) - 2:
                    nxt = pts[i + 1]
                    seq.append(((q[0] + nxt[0]) / 2, (q[1] + nxt[1]) / 2))
            seq.append(pts[-1])
            # seq: on, off, on, off, ... on
            for i in range(0, len(seq) - 2, 2):
                a, c, b = seq[i], seq[i + 1], seq[i + 2]
                for t in np.linspace(0.125, 1, 8):
                    contour.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                                    (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]))
            last = pts[-1]
        elif op == "curveTo":
            a = last
            c1, c2, b = args
            for t in np.linspace(0.125, 1, 8):
                mt = 1 - t
                contour.append((mt**3 * a[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t**3 * b[0],
                                mt**3 * a[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t**3 * b[1]))
            last = b
        elif op in ("closePath", "endPath"):
            flush()
    flush()
    return mask


def stroke_order(paths, part, vtype):
    """한글 획순: 자음은 위→아래·왼→오, 세로 모음은 왼→오, 가로 모음은 위→아래,
    섞임 모음은 가로 모음(ㅗ·ㅜ·ㅡ) 다음 오른쪽 기둥."""
    def box(p):
        ys, xs = [q[0] for q in p], [q[1] for q in p]
        return min(xs), min(ys), max(xs), max(ys)
    if part != "jung":
        return sorted(paths, key=lambda p: (box(p)[1] // 40, box(p)[0]))
    if vtype == "V":
        return sorted(paths, key=lambda p: (box(p)[0] + box(p)[2]) / 2)
    if vtype == "H":
        return sorted(paths, key=lambda p: (box(p)[1] + box(p)[3]) / 2)
    xs = [b for p in paths for b in (box(p)[0], box(p)[2])]
    split = min(xs) + (max(xs) - min(xs)) * 0.62
    def is_stem(p):
        x0, y0, x1, y1 = box(p)
        return (x0 + x1) / 2 > split and (y1 - y0) > (x1 - x0) * 1.5
    stems = sorted([p for p in paths if is_stem(p)], key=lambda p: box(p)[0])
    rest = [p for p in paths if not is_stem(p)]
    # 오른쪽 기둥에 붙은 곁줄기(ㅘ·ㅝ의 ㅏ·ㅓ)는 기둥과 함께
    side = [p for p in rest if (box(p)[0] + box(p)[2]) / 2 > split - 10 and box(p)[3] - box(p)[1] < 30]
    rest = [p for p in rest if p not in side]
    rest.sort(key=lambda p: ((box(p)[1] + box(p)[3]) / 2) // 25)
    tail = sorted(stems + side, key=lambda p: (box(p)[0] + box(p)[2]) / 2)
    return rest + tail


def composite_strokes(ch):
    """조합형 글리프(초성·중성·종성 부품)면 부품마다 정답 자모로 나눈다."""
    glyph = TT["glyf"][CMAP[ord(ch)]] if "glyf" in TT else None
    jong = (ord(ch) - 0xAC00) % 28 > 0
    want = 3 if jong else 2
    if glyph is None or not glyph.isComposite() or len(glyph.components) != want:
        return None
    out = []
    cho_box = None
    for part, comp in zip(("cho", "jung", "jong"), glyph.components):
        if comp.x or comp.y:
            return None
        mask = glyph_mask(comp.glyphName)
        if part == "cho":
            ys, xs = np.nonzero(mask)
            cho_box = (xs.min(), ys.min(), xs.max(), ys.max())
        paths = [orient(p) for p in merge(trace(skeletonize(mask)))]
        if part == "jung":
            # 이 폰트의 장식(초성 위 하트 귀)은 사람 손글씨에 없으므로 뺀다
            def ear(p):
                ys, xs = [q[0] for q in p], [q[1] for q in p]
                small = max(xs) - min(xs) < PX * 0.12 and max(ys) - min(ys) < PX * 0.12
                high = (min(ys) + max(ys)) / 2 < cho_box[1] + (cho_box[3] - cho_box[1]) * 0.3
                return small and high
            paths = [p for p in paths if not ear(p)]
        out += [(part, [(x, y) for y, x in rdp(p)]) for p in stroke_order(paths, part, vowel_type(ch))]
    return out


def strokes_for(font, ch):
    exact = composite_strokes(ch)
    if exact:
        return exact
    img = raster(font, ch)
    lab = label(img, connectivity=2)
    comps = []
    for k in range(1, lab.max() + 1):
        mask = lab == k
        if mask.sum() < 30:
            continue
        comps.append(mask)
    coords = [list(zip(*np.nonzero(m))) for m in comps]
    if len(comps) > 9:
        return None
    labels = assign_parts(ch, coords)
    if labels is None:
        return None
    out = []
    for part in ("cho", "jung", "jong"):
        paths = []
        for mask, lab_ in zip(comps, labels):
            if lab_ != part:
                continue
            paths += [orient(p) for p in merge(trace(skeletonize(mask)))]
        # 자모 안의 획순: 위→아래, 왼→오
        paths.sort(key=lambda p: (min(q[0] for q in p) // 40, min(q[1] for q in p)))
        out += [(part, [(x, y) for y, x in rdp(p)]) for p in paths]
    return out


def to_canvas(points, frame):
    x0, y0, x1, y1 = frame
    s = 840 / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return [((x - cx) * s + 500, (y - cy) * s + 500) for x, y in points]


NOISE = float(__import__("os").environ.get("HAND_NOISE", "1"))


def humanize(strokes, rng):
    """글자마다: 크기 ±6%, 가로세로비 ±4%, 위치 ±25, 기울기 ±1.5도, 획 끝 떨림. HAND_NOISE 로 세기 조절."""
    s = 1 + rng.gauss(0, 0.06) * NOISE
    ax = 1 + rng.gauss(0, 0.04) * NOISE
    dx, dy = rng.gauss(0, 25) * NOISE, rng.gauss(0, 25) * NOISE
    rot = math.radians(rng.gauss(0, 1.5) * NOISE)
    c, si = math.cos(rot), math.sin(rot)
    out = []
    for stroke in strokes:
        wob = [rng.gauss(0, 5) * NOISE for _ in range(4)]
        pts = []
        n = len(stroke)
        for k, (x, y) in enumerate(stroke):
            t = k / max(1, n - 1)
            x += wob[0] * (1 - t) + wob[2] * t
            y += wob[1] * (1 - t) + wob[3] * t
            x, y = (x - 500) * s * ax, (y - 500) * s
            x, y = x * c - y * si, x * si + y * c
            pts.append((x + 500 + dx, y + 500 + dy))
        out.append(pts)
    return out


def densify(points, step=12):
    out = [points[0]]
    for a, b in zip(points, points[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        for k in range(1, max(1, int(d / step)) + 1):
            t = k / max(1, int(d / step))
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def main():
    rng = random.Random(SEED)
    font = ImageFont.truetype(FONT, PX)
    chars = charset()
    raw = {ch: strokes_for(font, ch) for ch in chars}
    bad = [ch for ch, v in raw.items() if not v]
    raw = {ch: v for ch, v in raw.items() if v}
    # 쓴 글자 전체를 하나의 틀로 쓰기 칸에 옮긴다(글자 사이 크기 차이는 그대로).
    allp = [p for s in raw.values() for _, st in s for p in st]
    xs, ys = [p[0] for p in allp], [p[1] for p in allp]
    frame = (np.percentile(xs, 1), np.percentile(ys, 1), np.percentile(xs, 99), np.percentile(ys, 99))
    samples = {}
    for ch in raw:
        parts = [p for p, _ in raw[ch]]
        strokes = humanize([to_canvas(st, frame) for _, st in raw[ch]], rng)
        samples[ch] = [
            {"part": part, "points": [[round(x, 1), round(y, 1)] for x, y in densify(st)]}
            for part, st in zip(parts, strokes)
            if len(st) >= 2
        ]
    json.dump({"font": FONT, "seed": SEED, "samples": samples}, open(OUT, "w"), ensure_ascii=False)
    print(len(samples), "글자,", sum(len(v) for v in samples.values()), "획, 나누지 못함:", "".join(bad))


main()
