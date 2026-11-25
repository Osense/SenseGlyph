"""조합 폰트 품질 점수: 정답 손글씨 폰트와 비교한다.

python3 scripts/quality/evaluate.py <정답.ttf> <만든.ttf> [<쓴 글자 json>]

- 모양: 정답 글자와 뼈대가 얼마나 가까운지(평균 거리, em 1000 기준. 낮을수록 좋음)
- 고르기(본문 품질): 같은 짜임 글자끼리 크기·높낮이·폭이 얼마나 들쭉날쭉한지(표준편차, 낮을수록 좋음)
- 겹침: 자모끼리 닿아 뭉친 글자 비율은 만들 때 따로 본다.
쓴 글자는 빼고, 상용 한글 2,350자 중 조합으로 만든 글자만 잰다.
"""
import json
import sys

import numpy as np
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from scipy.ndimage import distance_transform_edt
from skimage.draw import polygon as draw_polygon
from skimage.morphology import skeletonize

N = 160  # 1em = N px


class Font:
    def __init__(self, path):
        self.tt = TTFont(path)
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.upm = self.tt["head"].unitsPerEm
        self.hmtx = self.tt["hmtx"]

    def has(self, ch):
        return ord(ch) in self.cmap

    def advance(self, ch):
        return self.hmtx[self.cmap[ord(ch)]][0] / self.upm

    def mask(self, ch):
        """em 정사각형(가로 0~1, 세로 기준선 위 1em~아래 0.25em)에 그린다."""
        pen = DecomposingRecordingPen(self.gs)
        self.gs[self.cmap[ord(ch)]].draw(pen)
        H = int(N * 1.3)
        m = np.zeros((H, int(N * 1.4)), bool)
        k = N / self.upm
        contour = []
        last = None

        def flush():
            if len(contour) >= 3:
                rr, cc = draw_polygon([N - y * k for _, y in contour], [x * k + N * 0.1 for x, _ in contour], m.shape)
                m[rr, cc] ^= True
            contour.clear()

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
                seq = [last]
                for i, q in enumerate(pts[:-1]):
                    seq.append(q)
                    if i < len(pts) - 2:
                        n = pts[i + 1]
                        seq.append(((q[0] + n[0]) / 2, (q[1] + n[1]) / 2))
                seq.append(pts[-1])
                for i in range(0, len(seq) - 2, 2):
                    a, c, b = seq[i], seq[i + 1], seq[i + 2]
                    for t in np.linspace(0.2, 1, 5):
                        contour.append(((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]))
                last = pts[-1]
            elif op == "curveTo":
                a = last
                c1, c2, b = args
                for t in np.linspace(0.2, 1, 5):
                    mt = 1 - t
                    contour.append((mt**3 * a[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t**3 * b[0], mt**3 * a[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t**3 * b[1]))
                last = b
            elif op in ("closePath", "endPath"):
                flush()
        flush()
        return m


def bbox(m):
    ys, xs = np.nonzero(m)
    if not len(xs):
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def layout_key(ch):
    s = ord(ch) - 0xAC00
    jung, jong = (s // 28) % 21, s % 28 > 0
    t = "V" if jung in (0, 1, 2, 3, 4, 5, 6, 7, 20) else "H" if jung in (8, 12, 13, 17, 18) else "C"
    return t + ("j" if jong else "")


def ks_chars():
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                out.append(bytes([hi, lo]).decode("cp949"))
            except UnicodeDecodeError:
                pass
    return [c for c in out if "가" <= c <= "힣"]


def stats(font, chars):
    rows = {}
    for ch in chars:
        m = font.mask(ch)
        b = bbox(m)
        if b is None:
            continue
        x0, y0, x1, y1 = b
        rows[ch] = dict(m=m, x0=x0, y0=y0, x1=x1, y1=y1, adv=font.advance(ch) * N)
    return rows


def consistency(rows):
    """같은 짜임끼리 높이·폭·위아래 위치의 흔들림(em 1000 기준)."""
    groups = {}
    for ch, r in rows.items():
        groups.setdefault(layout_key(ch), []).append(r)
    out = {"높이": [], "폭": [], "윗선": [], "아랫선": [], "가운데": [], "왼쪽여백": [], "오른쪽여백": []}
    for g in groups.values():
        if len(g) < 5:
            continue
        h = [r["y1"] - r["y0"] for r in g]
        w = [r["x1"] - r["x0"] for r in g]
        top = [r["y0"] for r in g]
        bot = [r["y1"] for r in g]
        mid = [(r["x0"] + r["x1"]) / 2 - r["adv"] / 2 for r in g]
        lsb = [r["x0"] - N * 0.1 for r in g]
        rsb = [r["adv"] + N * 0.1 - r["x1"] for r in g]
        for k, v in zip(out, (h, w, top, bot, mid, lsb, rsb)):
            out[k].append((np.std(v), len(v)))
    return {k: 1000 / N * sum(s * n for s, n in v) / max(1, sum(n for _, n in v)) for k, v in out.items()}


def fidelity(truth, made):
    """뼈대 사이 평균 거리. 전체 크기·위치는 한 번에 맞춘 뒤 잰다."""
    common = [c for c in truth if c in made]
    th = np.median([truth[c]["y1"] - truth[c]["y0"] for c in common])
    mh = np.median([made[c]["y1"] - made[c]["y0"] for c in common])
    s = th / mh
    tc = np.median([[(truth[c]["x0"] + truth[c]["x1"]) / 2, (truth[c]["y0"] + truth[c]["y1"]) / 2] for c in common], axis=0)
    mc = np.median([[(made[c]["x0"] + made[c]["x1"]) / 2, (made[c]["y0"] + made[c]["y1"]) / 2] for c in common], axis=0)
    dists = {}
    for c in common:
        ts = skeletonize(truth[c]["m"])
        ms = skeletonize(made[c]["m"])
        ty, tx = np.nonzero(ts)
        my, mx = np.nonzero(ms)
        if not len(tx) or not len(mx):
            continue
        # 만든 뼈대를 정답 틀로 옮긴다
        mx2 = ((mx - mc[0]) * s + tc[0]).round().astype(int)
        my2 = ((my - mc[1]) * s + tc[1]).round().astype(int)
        H, W = ts.shape
        ok = (mx2 >= 0) & (mx2 < W) & (my2 >= 0) & (my2 < H)
        mm = np.zeros_like(ts)
        mm[my2[ok], mx2[ok]] = True
        dt_t = distance_transform_edt(~ts)
        dt_m = distance_transform_edt(~mm)
        d = (dt_t[mm].mean() + dt_m[ts].mean()) / 2
        dists[c] = d * 1000 / N
    return dists


def main():
    truth_font, made_font = Font(sys.argv[1]), Font(sys.argv[2])
    written = set()
    if len(sys.argv) > 3:
        written = set(json.load(open(sys.argv[3]))["samples"])
    if __import__("os").environ.get("EVAL_WRITTEN"):
        chars = sorted(written)
    else:
        chars = [c for c in ks_chars() if c not in written and truth_font.has(c) and made_font.has(c)]
    n = int(__import__("os").environ.get("EVAL_N", "0"))
    if n:
        chars = chars[:: max(1, len(chars) // n)][:n]
    truth = stats(truth_font, chars)
    made = stats(made_font, chars)
    fid = fidelity(truth, made)
    ct, cm = consistency(truth), consistency(made)
    worst = sorted(fid, key=fid.get, reverse=True)[:24]
    result = {
        "글자수": len(fid),
        "모양거리": round(float(np.mean(list(fid.values()))), 1),
        "모양거리_상위10%": round(float(np.percentile(list(fid.values()), 90)), 1),
        "흔들림": {k: [round(ct[k], 1), round(cm[k], 1)] for k in ct},
        "나쁜글자": "".join(worst),
    }
    print(json.dumps(result, ensure_ascii=False))


main()
