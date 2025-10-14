#!/usr/bin/env python3
"""MedDRA 28.1 한국어 데이터용 로컬 조회 서버."""
from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Tuple
from urllib.parse import parse_qs, urlparse

from meddra_lookup import MeddraData


def build_dataset(data_root: Path) -> MeddraData:
    return MeddraData(data_root)


HTML_PAGE = """<!DOCTYPE html>
<html lang=\"ko\">
<head>
<meta charset=\"utf-8\" />
<title>MedDRA 28.1 한국어 증상 코드 조회</title>
<style>
:root {
  color-scheme: light;
  --blue-50: #f3f7ff;
  --blue-100: #d9e4ff;
  --blue-200: #b9ccff;
  --blue-500: #2563eb;
  --blue-600: #1d4ed8;
  --blue-700: #1e3a8a;
  --text-primary: #1b254b;
  --text-secondary: #4a5d8f;
}
body {
  font-family: 'Noto Sans KR', sans-serif;
  margin: 2rem;
  background: var(--blue-50);
  color: var(--text-primary);
}
h1 {
  margin-top: 0;
  font-weight: 600;
  color: var(--blue-700);
}
form {
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  background: #ffffff;
  padding: 1rem 1.25rem;
  border: 1px solid var(--blue-100);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}
label {
  font-weight: 500;
  color: var(--text-secondary);
}
input[type=text],
input[type=number] {
  width: 220px;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--blue-200);
  border-radius: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
}
input[type=text]:focus,
input[type=number]:focus {
  border-color: var(--blue-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  outline: none;
}
input[type=checkbox] {
  accent-color: var(--blue-500);
}
button {
  padding: 0.45rem 1.1rem;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);
}
button:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
}
.result {
  margin-bottom: 1.2rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--blue-100);
  border-radius: 10px;
  background: linear-gradient(135deg, #ffffff 0%, #f1f5ff 100%);
  box-shadow: 0 10px 25px rgba(30, 64, 175, 0.08);
}
.result h3 {
  margin: 0 0 0.4rem;
  color: var(--blue-600);
  font-weight: 600;
}
.meta {
  color: var(--text-secondary);
  font-size: 0.9rem;
}
#results > p {
  color: var(--text-secondary);
}
pre {
  white-space: pre-wrap;
  word-break: break-all;
  background: rgba(37, 99, 235, 0.06);
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(37, 99, 235, 0.12);
}
</style>
</head>
<body>
<h1>MedDRA 28.1 한국어 증상 코드 조회 (feat. Codex)</h1>
<form id=\"search-form\">
  <label for=\"q\">증상 또는 용어:</label>
  <input type=\"text\" id=\"q\" name=\"q\" placeholder=\"예: 빈혈\" required />
  <label for=\"limit\">결과 수:</label>
  <input type=\"number\" id=\"limit\" name=\"limit\" value=\"10\" min=\"1\" />
  <label><input type=\"checkbox\" id=\"inactive\" /> 비활성 용어 포함</label>
  <button type=\"submit\">검색</button>
</form>
<section id=\"results\"></section>
<script>
const form = document.getElementById('search-form');
const results = document.getElementById('results');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  const limit = document.getElementById('limit').value || '10';
  const includeInactive = document.getElementById('inactive').checked ? '1' : '0';
  results.innerHTML = '<p>검색 중...</p>';
  try {
    const params = new URLSearchParams({ q, limit, inactive: includeInactive });
    const response = await fetch('/search?' + params.toString(), { headers: { 'Accept': 'application/json' } });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    const data = await response.json();
    if (!data.results.length) {
      results.innerHTML = '<p>검색 결과가 없습니다.</p>';
      return;
    }
    results.innerHTML = data.results.map((item) => {
      return `<article class=\"result\">` +
        `<h3>LLT ${item.llt_code}: ${item.llt_name} (${item.active === 'Y' ? '활성' : '비활성'})</h3>` +
        `<div class=\"meta\">PT ${item.pt_code}: ${item.pt_name}</div>` +
        `<div class=\"meta\">SOC ${item.soc_code || '-'}: ${item.soc_name || '-'} / HLGT: ${item.hlgt_name || '-'} / HLT: ${item.hlt_name || '-'}</div>` +
        `<div class=\"meta\">Primary SOC: ${item.primary_soc || '-'}</div>` +
        `</article>`;
    }).join('');
  } catch (error) {
    results.innerHTML = '<p>오류: ' + error.message + '</p>';
  }
});
</script>
</body>
</html>"""


class MeddraRequestHandler(BaseHTTPRequestHandler):
    dataset: MeddraData = None  # type: ignore
    default_limit: int = 10

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler requirement)
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send_html(HTML_PAGE)
            return
        if parsed.path == "/search":
            self._handle_search(parsed.query)
            return
        self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        # Reduce console noise but keep ability to trace if needed.
        return

    def _handle_search(self, query_string: str) -> None:
        query_params = parse_qs(query_string)
        query = (query_params.get("q") or [""])[0].strip()
        if not query:
            self._send_json({"error": "q 파라미터가 필요합니다."}, status=HTTPStatus.BAD_REQUEST)
            return
        limit = self._parse_limit(query_params.get("limit", []))
        include_inactive = (query_params.get("inactive", ["0"])[0] == "1")
        results = self.dataset.search_llt(query, limit=limit, include_inactive=include_inactive)
        payload = {
            "query": query,
            "count": len(results),
            "results": results,
        }
        self._send_json(payload)

    def _parse_limit(self, values: list[str]) -> int:
        if not values:
            return self.default_limit
        try:
            value = int(values[0])
        except ValueError:
            return self.default_limit
        if value < 1:
            return self.default_limit
        return value

    def _send_html(self, body: str, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, payload: Dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def parse_args() -> Tuple[str, int, Path]:
    parser = argparse.ArgumentParser(description="MedDRA 증상 코드 조회용 로컬 서버")
    parser.add_argument("--host", default="127.0.0.1", help="바인딩할 호스트 주소")
    parser.add_argument("--port", type=int, default=8000, help="바인딩할 포트")
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="MedDRA 데이터 루트 (ascii-281 디렉터리 포함)",
    )
    args = parser.parse_args()
    return args.host, args.port, args.data_root


def run_server(host: str, port: int, data_root: Path) -> None:
    dataset = build_dataset(data_root)
    MeddraRequestHandler.dataset = dataset
    server = ThreadingHTTPServer((host, port), MeddraRequestHandler)
    print(f"MedDRA 서버 실행 중: http://{host}:{port} (데이터 루트: {data_root})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
    finally:
        server.server_close()


def main() -> None:
    host, port, data_root = parse_args()
    run_server(host, port, data_root)


if __name__ == "__main__":
    main()
