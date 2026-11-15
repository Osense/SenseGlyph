"""data/i18n-source.tsv(한국어 원문 · 일본어 · 영어, 탭 구분) → lib/i18n-messages.ts"""
import json
from pathlib import Path
ja, en = {}, {}
for line in Path('data/i18n-source.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip():
        continue
    k, j, e = [v.replace('\\n', '\n') for v in line.split('\t')]
    ja[k] = j; en[k] = e
Path('lib/i18n-messages.ts').write_text(
    '// 화면 문구 번역표(한국어 원문 → 일본어·영어). data/i18n-source.tsv 에서 scripts/build-i18n.py 로 만든다.\n'
    'export const JA: Record<string, string> = ' + json.dumps(ja, ensure_ascii=False, indent=1) + ';\n'
    'export const EN: Record<string, string> = ' + json.dumps(en, ensure_ascii=False, indent=1) + ';\n',
    encoding='utf-8')
print(len(ja))
