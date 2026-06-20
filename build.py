#!/usr/bin/env python3
"""데모 빌드 — 소스(src/)를 단일 자체완결 HTML(index.html)로 인라인한다.

  src/template.html  : 뼈대. /*__CSS__*/, /*__DATA__*/[], /*__APP__*/ 마커 포함
  src/style.css      : 스타일 → <style>에 인라인
  src/data.json      : 더미 참여자 300명 → DATA에 인라인
  src/app.js         : 모든 로직 → <script>에 인라인

실행:  python3 build.py   →  index.html (더블클릭/​GitHub Pages 모두 동작)
"""
import pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'

tpl  = (SRC / 'template.html').read_text(encoding='utf-8')
css  = (SRC / 'style.css').read_text(encoding='utf-8')
app  = (SRC / 'app.js').read_text(encoding='utf-8')
data = (SRC / 'data.json').read_text(encoding='utf-8')

html = (tpl
        .replace('/*__CSS__*/', css)
        .replace('/*__DATA__*/[]', data)
        .replace('/*__APP__*/', app))

out = ROOT / 'index.html'
out.write_text(html, encoding='utf-8')
print(f'✅ 빌드 완료 · {out.name} ({len(html)//1024} KB)')
