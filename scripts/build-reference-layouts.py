"""견본 글꼴의 글자별 자모 배치(상용 한글 2,350자)를 data/reference-layouts.json 으로 만든다.

조합 엔진은 자모 자리를 237가지(모음 모양 × 받침 유무)로만 나눠 보지만, 네모꼴 글꼴은 같은 자리 안에서도
글자마다 자모 크기·자리를 조금씩 바꾼다(ㅃ 옆의 ㅏ는 좁고, ㅗ 위의 ㄱ은 ㅜ 위의 ㄱ보다 낮다).
견본을 따라 쓴 사람의 글씨에 그 차이를 되살리려고, 견본의 글자별 자모 상자를 따로 담아 둔다.

- 자모를 나누는 방법은 scripts/build-reference-regions.py 와 같다(그 함수를 그대로 쓴다).
- WSNS 사각탈출은 자모 조각을 알고 있으니 scripts/build-sagaktalchul.py 의 조각에서 바로 잰다.
- 손글씨풍 견본(분필·붓펜)은 글자마다의 흔들림이 디자인이라 넣지 않는다.

형식: { chars: "가각간…", fonts: { 견본id: base64(글자마다 12바이트) } }
  12바이트 = 초성·중성·종성의 [x, y, 너비, 높이] (글자의 잉크 범위를 0~255 로 본 값, y 는 위에서부터).
  너비가 0 이면 그 자모(또는 그 글자) 자료가 없음.

실행: python3 scripts/build-reference-layouts.py   (약 10분)
"""
import base64
import importlib.util
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FONTS = ["sans", "serif", "poster", "round", "pixel"]


def ks_chars():
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode("cp949")
            except UnicodeDecodeError:
                continue
            if "가" <= ch <= "힣":
                out.append(ch)
    return out


def quantize(boxes):
    row = bytearray(12)
    for i, name in enumerate(("cho", "jung", "jong")):
        box = boxes.get(name)
        if not box:
            continue
        for k, v in enumerate(box):
            row[i * 4 + k] = max(0 if k < 2 else 1, min(255, round(v * 255)))
    return bytes(row)


def font_job(job):
    key, chars = job
    regions = load("scripts/build-reference-regions.py", "regions")
    from fontTools.ttLib import TTFont
    font = TTFont("public/fonts/" + regions.FONTS[key])
    glyphs = font.getGlyphSet(location={"wght": 400} if "fvar" in font else None)
    cmap = font.getBestCmap()
    priors = regions.jamo_priors(glyphs, cmap)
    data = bytearray()
    missing = 0
    for char in chars:
        try:
            if ord(char) not in cmap:
                raise ValueError("no glyph")
            entry, _ = regions.build(char, glyphs, cmap, priors)
            data += quantize(entry["boxes"])
        except Exception:
            data += bytes(12)
            missing += 1
    print(key, len(chars) - missing, "글자, 없음", missing, flush=True)
    return key, bytes(data)


def squareout(chars):
    build = load("scripts/build-sagaktalchul.py", "sagak")
    cho, jung, jong = build.make_jamo()
    data = bytearray()
    for char in chars:
        n = ord(char) - 0xAC00
        ci, vi, ti = n // 588, (n // 28) % 21, n % 28
        t = build.vtype(build.JUNG[vi])
        parts = {"cho": cho[(ci, t)], "jung": jung[build.JUNG[vi]]}
        if ti:
            parts["jong"] = jong[(ti, t)]
        bounds = [g.bounds for g in parts.values()]
        x0, y0 = min(b[0] for b in bounds), min(b[1] for b in bounds)
        x1, y1 = max(b[2] for b in bounds), max(b[3] for b in bounds)
        w, h = x1 - x0, y1 - y0
        data += quantize({
            name: [(g.bounds[0] - x0) / w, (y1 - g.bounds[3]) / h,
                   (g.bounds[2] - g.bounds[0]) / w, (g.bounds[3] - g.bounds[1]) / h]
            for name, g in parts.items()
        })
    print("squareout", len(chars), "글자", flush=True)
    return bytes(data)


if __name__ == "__main__":
    chars = ks_chars()
    only = sys.argv[1:]
    fonts = [f for f in FONTS if not only or f in only]
    with ProcessPoolExecutor(max_workers=2) as pool:
        results = dict(pool.map(font_job, [(key, chars) for key in fonts]))
    if not only or "squareout" in only:
        results["squareout"] = squareout(chars)
    path = Path("data/reference-layouts.json")
    previous = json.loads(path.read_text(encoding="utf-8"))["fonts"] if path.exists() else {}
    previous.update({key: base64.b64encode(value).decode("ascii") for key, value in results.items()})
    path.write_text(json.dumps({"chars": "".join(chars), "fonts": previous}, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(path, path.stat().st_size, "bytes")
