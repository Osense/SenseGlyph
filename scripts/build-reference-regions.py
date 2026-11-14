"""Build local jamo guides from the actual bundled fonts (no runtime services).

Requires fonttools, pillow and numpy (bundled in .cache/reference-tools).

How a guide is made for one syllable in one reference font:
1. The real outline is rasterised with the non-zero winding rule, so
   overlapping contours of variable fonts stay solid.
2. Ink is split into connected components (separate pieces of the glyph).
3. Cut lines are searched so that whole components fall on one side of them.
   A cut is scored by how much ink it would have to slice through, how well the
   piece count matches the font's own standalone jamo (e.g. ㅎ = 3 pieces) and,
   only weakly, by the usual Hangul position. Cutting through a piece is allowed
   only when pieces really touch (common in handwriting fonts).
4. Every pixel of the em square is then given to the nearest part ink, which is
   what strokes are judged against at runtime.

Stored per character: tight glyph size, diamond fit (see diamond_fit), part boxes (glyph-relative) and an RLE
label map. Labels 1-3 = region of cho/jung/jong, 4-6 = the font's own ink of
cho/jung/jong (used to draw the reference silhouette).
"""
import sys, re, json
from pathlib import Path
from collections import deque
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, str(Path('.cache/reference-tools').resolve()))
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from PIL import Image, ImageFilter

FONTS = dict(re.findall(r'id:\s*"([^"]+)"[^}]*?file:\s*"([^"]+)"',
                        Path('lib/reference-fonts.ts').read_text(encoding='utf-8')))
CHARS = re.search(r'export const HANGUL\s*=\s*"([^"]+)"',
                  Path('data/charset.ts').read_text(encoding='utf-8')).group(1).split()
N = 96    # stored resolution (runtime contract)
R = 288   # analysis resolution: keeps thin gaps between jamo open
CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'


class OutlinePen(BasePen):
    def __init__(self, glyphs):
        super().__init__(glyphs); self.contours = []; self.current = []
    def _moveTo(self, p): self.current = [p]
    def _lineTo(self, p): self.current.append(p)
    def _qCurveToOne(self, a, b):
        p = self._getCurrentPoint()
        for t in np.linspace(0, 1, 9)[1:]:
            self.current.append(tuple((1-t)**2*p[i] + 2*(1-t)*t*a[i] + t*t*b[i] for i in range(2)))
    def _curveToOne(self, a, b, c):
        p = self._getCurrentPoint()
        for t in np.linspace(0, 1, 13)[1:]:
            self.current.append(tuple((1-t)**3*p[i] + 3*(1-t)**2*t*a[i] + 3*(1-t)*t*t*b[i] + t**3*c[i] for i in range(2)))
    def _closePath(self):
        if len(self.current) > 2: self.contours.append(self.current)
        self.current = []
    def _endPath(self): self._closePath()


def outline(glyphs, cmap, char):
    pen = OutlinePen(glyphs); glyphs[cmap[ord(char)]].draw(pen)
    return pen.contours


def rasterise(contours, size, frame=None):
    """Non-zero winding scanline fill. Returns mask and the glyph frame used."""
    pts = np.array([p for c in contours for p in c], dtype=float)
    if frame is None:
        x0, y0 = pts.min(axis=0); x1, y1 = pts.max(axis=0); frame = (x0, y0, x1, y1)
    x0, y0, x1, y1 = frame
    w = max(x1 - x0, 1e-6); h = max(y1 - y0, 1e-6)
    edges = []
    for c in contours:
        a = np.array(c, dtype=float)
        u = (a[:, 0] - x0) / w * (size - 3) + 1
        v = (y1 - a[:, 1]) / h * (size - 3) + 1
        b = np.stack([u, v], 1); e = np.concatenate([b, np.roll(b, -1, 0)], 1)
        edges.append(e)
    e = np.concatenate(edges); e = e[e[:, 1] != e[:, 3]]
    up = e[:, 3] > e[:, 1]
    ylo = np.where(up, e[:, 1], e[:, 3]); yhi = np.where(up, e[:, 3], e[:, 1])
    direction = np.where(up, 1, -1)
    mask = np.zeros((size, size), dtype=bool)
    centers = np.arange(size) + 0.5
    for row, yc in enumerate(centers):
        sel = (ylo <= yc) & (yhi > yc)
        if not sel.any(): continue
        s = e[sel]; t = (yc - s[:, 1]) / (s[:, 3] - s[:, 1])
        xs = s[:, 0] + t * (s[:, 2] - s[:, 0]); order = np.argsort(xs)
        xs = xs[order]; wind = np.cumsum(direction[sel][order])
        for i in range(len(xs) - 1):
            if wind[i] != 0:
                a = int(np.ceil(xs[i] - 0.5)); b = int(np.floor(xs[i + 1] - 0.5))
                if b >= a: mask[row, max(a, 0):min(b + 1, size)] = True
    return mask, frame


def components(mask):
    """8-connected run-based labelling. Returns label image and list of pixel index arrays."""
    h, w = mask.shape
    parent = []
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    runs = []; previous = []
    for y in range(h):
        row = mask[y]; current = []
        if row.any():
            d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
            starts = np.where(d == 1)[0]; ends = np.where(d == -1)[0]
            for s, t in zip(starts, ends):
                idx = len(parent); parent.append(idx)
                for ps, pt, pi in previous:
                    if ps <= t and pt >= s:  # 8-connected overlap (t, pt exclusive)
                        ra, rb = find(idx), find(pi)
                        if ra != rb: parent[max(ra, rb)] = min(ra, rb)
                current.append((s, t, idx)); runs.append((y, s, t, idx))
        previous = current
    groups = {}
    for y, s, t, idx in runs:
        groups.setdefault(find(idx), []).append((y, s, t))
    comps = []
    for rs in groups.values():
        ys = np.concatenate([np.full(t - s, y) for y, s, t in rs])
        xs = np.concatenate([np.arange(s, t) for y, s, t in rs])
        comps.append((ys, xs))
    comps.sort(key=lambda c: -len(c[0]))
    return comps


def signed_area(c):
    a = np.array(c, dtype=float)
    return 0.5 * float(np.sum(a[:, 0] * np.roll(a[:, 1], -1) - np.roll(a[:, 0], -1) * a[:, 1]))


def inside_polygon(point, c):
    a = np.array(c, dtype=float); x, y = point
    x0, y0 = a[:, 0], a[:, 1]; x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
    crosses = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / np.where(y1 == y0, 1e-9, y1 - y0) + x0)
    return bool(crosses.sum() % 2)


def contour_groups(contours):
    """Outer contours with their counters. Overlapping strokes of variable fonts
    stay separate pieces, which is exactly the stroke structure we want."""
    areas = [signed_area(c) for c in contours]
    outer_sign = np.sign(areas[int(np.argmax(np.abs(areas)))])
    outers = [i for i, a in enumerate(areas) if np.sign(a) == outer_sign]
    groups = {i: [contours[i]] for i in outers}
    for i, a in enumerate(areas):
        if i in groups: continue
        hosts = [o for o in outers if inside_polygon(contours[i][0], contours[o])]
        if hosts: groups[min(hosts, key=lambda o: abs(areas[o]))].append(contours[i])
        else: groups[i] = [contours[i]]
    return list(groups.values())


def pieces_of(contours, size, frame):
    """Connected ink of every contour group, as (ys, xs) pixel arrays."""
    out = []
    for group in contour_groups(contours):
        m, _ = rasterise(group, size, frame)
        for ys, xs in components(m): out.append((ys, xs))
    return out


def piece_count(contours):
    mask, frame = rasterise(contours, 160)
    pieces = pieces_of(contours, 160, frame); total = mask.sum()
    return max(1, sum(1 for c in pieces if len(c[0]) >= total * 0.015))


def best_cut(pieces, side, candidates, prior_a, prior_b, expected, total, count_w=1.0, knife_w=6.0, keep=1):
    """pieces: list of (ys, xs). side(ys, xs, t) -> bool array (True = side A).

    Two readings per cut position:
    * whole: every piece goes to the side of its centre; ink of a piece that
      reaches over the line costs a little (overlapping strokes are normal);
    * split: pieces that really straddle the line are cut (touching jamo in
      merged-outline fonts); the cost is the length of ink the knife crosses.
    Returns [(cost, per-piece result, cut position)] where a result item is
    True/False (whole piece) or a boolean pixel array (split piece)."""
    options = {}
    centres = [(np.array([ys.mean()]), np.array([xs.mean()])) for ys, xs in pieces]
    for t in candidates:
        loc = sum(abs(a - b) for a, b in zip(np.atleast_1d(t), expected)) / R * 1.2
        whole = []; split = []; minority = 0.0; cut_ink = 0.0
        for (ys, xs), (cy, cx) in zip(pieces, centres):
            inside = side(ys, xs, t); n_in = int(inside.sum()); n = len(ys)
            centre = bool(side(cy, cx, t)[0])
            whole.append(centre); minority += (n - n_in) if centre else n_in
            frac = n_in / n
            if frac >= 0.8: split.append(True)
            elif frac <= 0.2: split.append(False)
            else:
                split.append(inside)
                # Cost of a knife cut = ink cross-section along the cut line.
                cut_ink += int(((side(ys + 1, xs, t) != inside) | (side(ys, xs + 1, t) != inside)).sum())
        for result, cost in ((whole, minority / total * 8), (split, cut_ink / R * knife_w)):
            na = sum(1 for r in result if r is not False)
            nb = sum(1 for r in result if r is not True)
            if na == 0 or nb == 0: continue
            cost += (abs(na - prior_a) + abs(nb - prior_b)) * count_w + loc
            key = tuple(r if isinstance(r, bool) else 2 for r in result)
            entry = options.setdefault(key, [np.inf, None, []])
            if cost < entry[0]: entry[0], entry[1] = cost, result
            entry[2].append(t)
    # Best few distinct partitions, so a later cut can overrule an early choice.
    ranked = sorted(options.values(), key=lambda e: e[0])[:keep]
    return [(cost, result, ts[len(ts) // 2]) for cost, result, ts in ranked]


def horizontal_vowel_cut(top, vi):
    """가로 모음(ㅗㅛㅜㅠㅡ)은 글자 폭을 거의 다 차지하는 가로획이 있다.
    잉크가 붙어 있어 조각 수로는 나누기 어려운 글꼴(ㄴ·ㄷ 받침획이 모음 가로획에 닿는 경우)에서도
    초성의 아래 가로획을 모음에 넘기지 않도록, 그 가로획을 기준으로 자를 위치를 정한다.
    ㅜㅠㅡ: 가로획 바로 위. ㅗㅛ: 가로획 위의 짧은 기둥이 끝나는 곳(초성 아래 획 바로 밑)."""
    m = np.zeros((R, R), dtype=bool)
    for ys, xs in top: m[ys, xs] = True
    rows = np.nonzero(m.any(axis=1))[0]
    if len(rows) < 8: return None
    def longest(row):
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        return int((ends - starts).max()) if len(starts) else 0
    runs = np.array([longest(m[y]) for y in range(R)])
    widest = runs.max()
    if widest < 8: return None
    bar = [y for y in range(R) if runs[y] >= widest * 0.85]
    # 가장 아래쪽 넓은 가로획 묶음
    bottom = bar[-1]; top_row = bottom
    while top_row - 1 in bar: top_row -= 1
    if vi in (13, 17, 18):  # ㅜ ㅠ ㅡ
        return top_row
    # ㅗ ㅛ: 위로 올라가며 짧은 기둥을 지나 초성 아래 획이 나오는 곳을 찾는다.
    counts = m.sum(axis=1)
    limit = max(rows[0], top_row - int((rows[-1] - rows[0]) * 0.45))
    y = top_row - 1; skip = 0
    while y > limit and counts[y] > widest * 0.35 and skip < 4:  # 가로획 둥근 가장자리
        y -= 1; skip += 1
    while y > limit:
        if counts[y] == 0: return y + 1
        if counts[y] > widest * 0.35: return y + 1
        y -= 1
    return None


def jong_cut_hint(big, vi):
    """가로 모음(ㅗㅛㅜㅠㅡ) 글자에서 받침이 시작하는 줄을 어림한다.
    글자 폭을 거의 다 차지하는 모음 가로획을 찾고, ㅜㅠ는 아래 기둥이 끝나는 곳,
    ㅗㅛㅡ는 가로획 바로 아래를 받침 시작으로 본다."""
    m = np.zeros((R, R), dtype=bool)
    for ys, xs in big: m[ys, xs] = True
    rows = np.nonzero(m.any(axis=1))[0]
    if len(rows) < 10: return None
    y0, y1 = rows[0], rows[-1]
    def longest(row):
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        return int((ends - starts).max()) if len(starts) else 0
    runs = np.array([longest(m[y]) for y in range(R)])
    upper_end = int(y0 + (y1 - y0) * 0.72)
    widest = runs[y0:upper_end].max()
    if widest < 8: return None
    bar = [y for y in range(y0 + int((y1 - y0) * 0.15), upper_end) if runs[y] >= widest * 0.9]
    if not bar: return None
    counts = m.sum(axis=1)
    clusters = []
    for y in bar:
        if clusters and y == clusters[-1][1] + 1: clusters[-1][1] = y
        else: clusters.append([y, y])
    def narrow(rows_):
        good = [r for r in rows_ if 0 < counts[r] <= widest * 0.4]
        return len(good) >= 3
    def edge(y, step):  # 가로획 둥근 가장자리 몇 줄은 건너뛴다
        k = 0
        while 0 < y < R - 1 and counts[y] > widest * 0.4 and k < 4: y += step; k += 1
        return y
    # 모음 가로획: ㅜㅠ는 바로 아래, ㅗㅛ는 바로 위에 짧은 기둥이 있는 넓은 가로획
    # (굵은 글꼴은 ㄴ·ㄷ 아래 획도 글자 폭만큼 넓어서 폭만으로는 고를 수 없다)
    chosen = None
    for a, b in clusters:
        if vi in (13, 17):
            y = edge(b + 1, 1)
            if narrow(range(y, min(R, y + 6))): chosen = (a, b); break
        elif vi in (8, 12):
            y = edge(a - 1, -1)
            if narrow(range(max(0, y - 5), y + 1)): chosen = (a, b); break
    if chosen is None:
        middle = y0 + (y1 - y0) * 0.45
        chosen = tuple(min(clusters, key=lambda c: abs((c[0] + c[1]) / 2 - middle)))
    start, end = chosen
    y = end + 1; skip = 0
    while y < y1 and counts[y] > widest * 0.35 and skip < 4:
        y += 1; skip += 1
    if vi in (13, 17):  # ㅜ ㅠ: 짧은 기둥을 지나 받침이 나오는 곳
        limit = min(y1, int(y + (y1 - y0) * 0.35))
        for k in range(y, limit):
            if counts[k] == 0: return k
        while y < limit:
            if counts[y] > widest * 0.35: return y
            y += 1
        return None
    # ㅗ ㅛ ㅡ: 가로획 바로 아래(틈이 있으면 틈)
    for k in range(y, min(y1, y + 12)):
        if counts[k] == 0: return k
    return y


def take(pieces, result, flag):
    out = []
    for (ys, xs), r in zip(pieces, result):
        if isinstance(r, bool):
            if r == flag: out.append((ys, xs))
        else:
            m = r if flag else ~r
            if m.any(): out.append((ys[m], xs[m]))
    return out


T = 64  # template size for shape comparison


def shape(mask):
    """Tight-cropped, size-normalised and slightly thickened silhouette."""
    ys, xs = np.nonzero(mask)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray(crop.astype(np.uint8) * 255).resize((T, T), Image.BILINEAR)
    img = img.filter(ImageFilter.MaxFilter(5))
    return np.asarray(img) > 60


def similarity(a, b):
    return (a & b).sum() / max(1, (a | b).sum())


def diamond_fit(contours):
    """How far the ink reaches towards a diamond (|dx| + |dy|) around the box
    centre, relative to the box's own corner (1 = ink fills a corner). Hangul
    leaves corners empty, so a sample can be drawn larger and still touch the
    diamond guide instead of floating inside it."""
    pts = np.array([p for c in contours for p in c], dtype=float)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    centre, half = (lo + hi) / 2, (hi - lo) / 2
    return round(float(np.max(np.abs(pts - centre).sum(axis=1)) / half.sum()), 5)


def build(char, glyphs, cmap, priors):
    contours = outline(glyphs, cmap, char)
    if not contours:
        raise ValueError('empty glyph outline')
    mask, frame = rasterise(contours, R)
    total = mask.sum()
    code = ord(char) - 0xac00; ci = code // 588; vi = code // 28 % 21; ji = code % 28
    kind = 'V' if vi in [0, 1, 2, 3, 4, 5, 6, 7, 20] else 'H' if vi in [8, 12, 13, 17, 18] else 'C'
    pc, pv, pj = priors[CHO[ci]], priors[JUNG[vi]], priors[JONG[ji]] if ji else 0
    comps = sorted(pieces_of(contours, R, frame), key=lambda c: -len(c[0]))
    big = [c for c in comps if len(c[0]) >= total * 0.004]
    small = [c for c in comps if len(c[0]) < total * 0.004]
    def split_upper(top):
        ys_all = np.concatenate([c[0] for c in top]); xs_all = np.concatenate([c[1] for c in top])
        ty0, ty1 = ys_all.min(), ys_all.max(); tx0, tx1 = xs_all.min(), xs_all.max()
        if kind == 'V':
            cand = range(int(tx0 + (tx1 - tx0) * 0.2), int(tx0 + (tx1 - tx0) * 0.9))
            return best_cut(top, lambda ys, xs, t: xs < t, cand, pc, pv, (tx0 + (tx1 - tx0) * 0.56,), total)
        if kind == 'H':
            forced = horizontal_vowel_cut(top, vi)
            if forced is not None:
                found = best_cut(top, lambda ys, xs, t: ys < t, [forced], pc, pv, (forced,), total)
                if found: return found
            cand = range(int(ty0 + (ty1 - ty0) * 0.15), int(ty0 + (ty1 - ty0) * 0.88))
            return best_cut(top, lambda ys, xs, t: ys < t, cand, pc, pv, (ty0 + (ty1 - ty0) * 0.52,), total)
        xs_c = range(int(tx0 + (tx1 - tx0) * 0.3), int(tx0 + (tx1 - tx0) * 0.9), 3)
        ys_c = range(int(ty0 + (ty1 - ty0) * 0.2), int(ty0 + (ty1 - ty0) * 0.85), 3)
        cand = [(a, b) for a in xs_c for b in ys_c]
        return best_cut(top, lambda ys, xs, t: (xs < t[0]) & (ys < t[1]), cand, pc, pv,
                        (tx0 + (tx1 - tx0) * 0.62, ty0 + (ty1 - ty0) * 0.5), total)

    if ji:
        rows = range(int(R * 0.40), int(R * 0.96))
        # The final consonant sits below; piece counts of the upper half are only a hint.
        hint = jong_cut_hint(big, vi) if kind == 'H' else None
        lower = best_cut(big, lambda ys, xs, t: ys < t, rows, pc + pv, pj, (R * 0.66,), total, 0.4, 14.0, keep=6)
        if hint is not None:
            lower += best_cut(big, lambda ys, xs, t: ys < t, [hint], pc + pv, pj, (hint,), total, 0.4, 14.0, keep=2)
        # The same font's syllable without the final consonant (곤 -> 고) shows
        # what the upper part has to look like.
        open_syllable = chr(0xac00 + (ci * 21 + vi) * 28)
        template = shape(rasterise(outline(glyphs, cmap, open_syllable), 160)[0])
        plans = []
        for cost, result, cut_at in lower:
            if hint is not None:  # 가로 모음 아래에서 받침이 시작하는 곳에 가까울수록 우선
                cost += abs(float(np.atleast_1d(cut_at)[0]) - hint) / R * 30
            top = take(big, result, True)
            upper = split_upper(top)
            if not upper: continue
            m = np.zeros((R, R), dtype=bool)
            for ys, xs in top: m[ys, xs] = True
            mismatch = 1 - similarity(shape(m), template)
            plans.append((cost + upper[0][0] + mismatch * 6, top, upper[0][1], take(big, result, False)))
        if not plans: raise ValueError(f'{char}: no jong cut')
        _, top, result, jong = min(plans, key=lambda plan: plan[0])
        parts = {3: jong}
    else:
        upper = split_upper(big)
        if not upper: raise ValueError(f'{char}: no cho/jung cut')
        top, result, parts = big, upper[0][1], {}
    parts[1] = take(top, result, True); parts[2] = take(top, result, False)
    hi = np.zeros((R, R), dtype=np.uint8)
    for label, pieces in parts.items():
        for ys, xs in pieces: hi[ys, xs] = label
    for ys, xs in small:  # specks follow the nearest labelled ink
        cy, cx = ys.mean(), xs.mean(); ly, lx = np.nonzero(hi)
        k = np.argmin((ly - cy) ** 2 + (lx - cx) ** 2); hi[ys, xs] = hi[ly[k], lx[k]]
    # Down-sample to the stored grid with the same glyph-relative mapping.
    grid = (np.arange(N) + 0.5 - 1) / (N - 3) * (R - 3) + 1 - 0.5
    gi = np.clip(np.round(grid).astype(int), 0, R - 1)
    span = (R - 3) / (N - 3)
    labels = np.zeros((N, N), dtype=np.uint8); ink = np.zeros((N, N), dtype=bool)
    for r in range(N):
        a0 = int(max(0, np.floor(grid[r] - span / 2 + 0.5))); a1 = int(min(R, np.ceil(grid[r] + span / 2 + 0.5)))
        for c in range(N):
            b0 = int(max(0, np.floor(grid[c] - span / 2 + 0.5))); b1 = int(min(R, np.ceil(grid[c] + span / 2 + 0.5)))
            block = hi[a0:a1, b0:b1]; nz = block[block > 0]
            if nz.size:
                labels[r, c] = np.bincount(nz).argmax()
                ink[r, c] = nz.size >= block.size * 0.35
    boxes = {}
    for part, name in [(1, 'cho'), (2, 'jung'), (3, 'jong')]:
        if part == 3 and not ji: break
        py, px = np.where(hi == part)
        if len(px) == 0: raise ValueError(f'U+{ord(char):04X}: empty {name}')
        boxes[name] = [round(float(v), 5) for v in (
            (px.min() - 1) / (R - 3), (py.min() - 1) / (R - 3),
            (px.max() - px.min() + 1) / (R - 3), (py.max() - py.min() + 1) / (R - 3))]
    # Region = nearest part ink (breadth-first, 4-neighbour) over the em square.
    region = labels.copy(); queue = deque(zip(*np.where(region > 0)))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((-1, 0), (0, -1), (0, 1), (1, 0)):
            a, b = y + dy, x + dx
            if 0 <= a < N and 0 <= b < N and region[a, b] == 0:
                region[a, b] = region[y, x]; queue.append((a, b))
    out = np.where(ink, region + 3, region).ravel()
    rle = []; last = int(out[0]); count = 0
    for value in out:
        if value == last: count += 1
        else: rle.extend([count, last]); last = int(value); count = 1
    rle.extend([count, last])
    x0, y0, x1, y1 = frame
    return {'size': [round(x1 - x0, 4), round(y1 - y0, 4)], 'fit': diamond_fit(contours),
            'boxes': boxes, 'regions': rle}, hi


def jamo_priors(glyphs, cmap):
    priors = {}
    for ch in set(CHO + JUNG + JONG.strip()):
        try:
            priors[ch] = piece_count(outline(glyphs, cmap, ch))
        except Exception:
            priors[ch] = 1
    return priors


def build_font(job):
    key, file, chars, preview = job
    font = TTFont('public/fonts/' + file)
    glyphs = font.getGlyphSet(location={'wght': 400} if 'fvar' in font else None)
    cmap = font.getBestCmap(); priors = jamo_priors(glyphs, cmap)
    output = {}; previews = {}
    for char in chars:
        if ord(char) not in cmap:
            continue
        try:
            output[char], image = build(char, glyphs, cmap, priors)
        except ValueError as error:
            if key == 'fallback':
                raise ValueError(f'{key}: {char}: {error}') from error
            print(f'{key}: using fallback for {char} ({error})', file=sys.stderr)
            continue
        if preview:
            previews[char] = image
    print(key, len(output), flush=True)
    return key, output, previews


if __name__ == '__main__':
    only = sys.argv[1:]  # optional: chars to preview
    chars = only or CHARS
    with ProcessPoolExecutor(max_workers=4) as workers:
        results = list(workers.map(build_font, [
            (key, file, chars, bool(only)) for key, file in FONTS.items()
        ]))
    output = {key: entries for key, entries, _ in results}
    missing = [char for char in chars if any(char not in entries for entries in output.values())]
    if missing:
        key, entries, previews = build_font(('fallback', 'NotoSansKR.ttf', missing, bool(only)))
        output[key] = entries
        results.append((key, entries, previews))
    if only:
        Path('.cache').mkdir(exist_ok=True)
        np.save('.cache/region-preview.npy', {key: frames for key, _, frames in results}, allow_pickle=True)
    else:
        Path('data/reference-regions.json').write_text(
            json.dumps({'resolution': N, 'fonts': output}, ensure_ascii=False, separators=(',', ':')),
            encoding='utf-8')
