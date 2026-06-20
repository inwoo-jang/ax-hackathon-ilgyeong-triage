#!/usr/bin/env python3
"""로컬 Claude 브리지 — API 키 없이 데모의 'AI 다시 생성'을 실제 Claude로 동작시킨다.

원리: 이미 설치·로그인된 Claude Code CLI(`claude`)를 그대로 호출한다.
      별도 API 키도, 추가 과금도 필요 없다(기존 Claude Code 인증 사용).

실행:  python3 bridge.py        →  http://localhost:8787
사용:  데모 우상단 '로컬 Claude 연결' 버튼 클릭 → 'AI 다시 생성'이 실시간 호출로 동작
종료:  Ctrl+C

데모를 위한 우회임을 명시: 실서비스에서는 이 브리지 대신 백엔드가
POST /api/ai/recommend 로 Anthropic API를 호출한다(키는 서버 보관).
"""
import http.server, json, subprocess, shutil, sys

PORT = 8787

class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):  # health check (연결 확인용)
        self.send_response(200); self._cors()
        self.send_header('content-type', 'application/json'); self.end_headers()
        self.wfile.write(b'{"ok":true,"engine":"claude-cli"}')

    def do_POST(self):
        n = int(self.headers.get('content-length', 0) or 0)
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            body = {}
        prompt = ((body.get('system', '') + "\n\n" + body.get('user', '')).strip()) or body.get('prompt', '')
        try:
            out = subprocess.run(['claude', '-p', prompt], capture_output=True, text=True, timeout=120)
            text = (out.stdout or out.stderr or '').strip()
        except Exception as e:
            text = json.dumps({'error': str(e)})
        self.send_response(200); self._cors()
        self.send_header('content-type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'text': text}).encode('utf-8'))

    def log_message(self, *a):  # 조용히
        pass

if __name__ == '__main__':
    if not shutil.which('claude'):
        print('⚠️  claude CLI를 찾을 수 없습니다. Claude Code 설치/로그인 후 다시 실행하세요.', file=sys.stderr)
    print(f'✅ 로컬 Claude 브리지 실행 중 · http://localhost:{PORT}  (Ctrl+C 종료)')
    print('   데모 우상단 "로컬 Claude 연결"을 누르면 실시간 생성이 켜집니다.')
    http.server.HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
