"""이미 있는 폰트 이름 목록(data/reserved-font-names.ts) 만들기.

출처
- 눈누(noonnu.cc) 목록 페이지: 한글 이름(img alt)과 글꼴 이름(font-family)
- Google Fonts 메타데이터(fonts.google.com/metadata/fonts): 전체 패밀리 이름
- data/system-font-names.txt: Windows·macOS·한컴·Adobe 등 시스템·상용 글꼴 이름(손으로 관리, | 로 구분)

정규화는 lib/font-name-registry.ts 의 normalizeFontName 과 같아야 한다.
사용: python3 scripts/build-reserved-font-names.py  (네트워크 필요, 몇 분 걸림)
"""
import html, json, re, subprocess, time, unicodedata
from pathlib import Path


def norm(s):
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r"[\s\-_.·'\"()\[\]/,&+:!?’‘“”`]", "", s)


WEIGHT = r'(\d*(thin|hairline|extralight|ultralight|light|regular|book|normal|medium|semibold|demibold|bold|extrabold|ultrabold|heavy|black|italic|oblique|ttf|otf|woff|bd|lt|rg|md|sb|xb|eb|el))+$'
out = set()


def add(name):
    n = norm(name.strip())
    for value in (n, re.sub(WEIGHT, '', n)):
        if len(value) < 2 or (re.fullmatch(r'[a-z0-9]+', value) and len(value) < 3):
            continue
        out.add(value)


def get(url):
    return subprocess.run(['curl', '-sS', '-m', '30', url], capture_output=True, text=True).stdout


for page in range(1, 300):
    text = get(f'https://noonnu.cc/index?page={page}')
    items = re.findall(r'href="/font_page/\d+">.*?alt="([^"]*)".*?font-family: &#39;([^&]*)&#39;', text, re.S)
    if not items:
        break
    for korean, family in items:
        korean, family = html.unescape(korean), html.unescape(family)
        add(korean); add(family)
        m = re.match(r'([^()]+)\(([^)]+)\)', korean)
        if m: add(m.group(1)); add(m.group(2))
    time.sleep(0.4)

for family in json.loads(get('https://fonts.google.com/metadata/fonts'))['familyMetadataList']:
    add(family['family'])

for line in Path('data/system-font-names.txt').read_text(encoding='utf-8').splitlines():
    for name in line.split('|'):
        add(name)

names = sorted(out)
Path('data/reserved-font-names.ts').write_text(
    '// 이미 있는 폰트 이름(쓰지 못하는 이름). scripts/build-reserved-font-names.py 로 만든다.\n'
    '// 정규화: NFKC → 소문자 → 공백·기호 제거(lib/font-name-registry.ts 의 normalizeFontName).\n'
    '// 출처: 눈누 무료 한글 폰트 목록, Google Fonts 전체, 시스템·상용 글꼴(data/system-font-names.txt). 굵기 꼬리를 뗀 이름도 포함.\n'
    f'// 만든 날: {time.strftime("%Y-%m-%d")} · {len(names)}개\n'
    'export const RESERVED_FONT_NAMES: readonly string[] = ' + json.dumps(names, ensure_ascii=False) + ';\n',
    encoding='utf-8')
print(len(names))
