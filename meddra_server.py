#!/usr/bin/env python3
"""MedDRA 28.1 한국어 데이터용 로컬 조회 서버."""
from __future__ import annotations

import argparse
import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from meddra_lookup import MeddraData
from gemini_client import GeminiError, request_ranking, DEFAULT_MODEL as DEFAULT_GEMINI_MODEL


def build_dataset(data_root: Path) -> MeddraData:
    return MeddraData(data_root)


HTML_PAGE = """<!DOCTYPE html>
<html lang=\"ko\">
<head>
<meta charset=\"utf-8\" />
<title>MedDRA 28.1 한국어 증상 코드 조회</title>
</head>
<body>
<h1>MedDRA 28.1 한국어 증상 코드 조회</h1>
<p>UI 파일(기본: <code>index.html</code>)을 찾지 못해 기본 페이지를 표시합니다.</p>
</body>
</html>"""

DEFAULT_UI_NAME = "index.html"


class MeddraRequestHandler(BaseHTTPRequestHandler):
    dataset: MeddraData = None  # type: ignore
    default_limit: int = 10
    ui_body: bytes = HTML_PAGE.encode("utf-8")
    gemini_key: Optional[str] = None
    gemini_model: str = DEFAULT_GEMINI_MODEL

    def do_GET(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler requirement)
        parsed = urlparse(self.path)
        if parsed.path in {"/", "/index.html"}:
            self._send_html(self.ui_body)
            return
        if parsed.path == "/main.html":
            self._send_file("main.html", "text/html")
            return
        if parsed.path == "/search":
            self._handle_search(parsed.query)
            return
        # Serve script.js
        if parsed.path == "/script.js":
            self._send_file("script.js", "text/javascript")
            return
        # Serve .asc data files
        if parsed.path.startswith("/ascii-281/") and parsed.path.endswith(".asc"):
            file_path = parsed.path.lstrip("/")
            self._send_file(file_path, "text/plain")
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
        ai_enabled = (query_params.get("ai", ["0"])[0] == "1")
        fetch_limit = max(limit, 25) if ai_enabled else limit
        results = self.dataset.search_llt(query, limit=fetch_limit, include_inactive=include_inactive)
        approx_used = False
        if ai_enabled and not results:
            results = self.dataset.search_approximate_llt(query, limit=fetch_limit * 2, include_inactive=include_inactive)
            approx_used = bool(results)
        if ai_enabled and self.gemini_key and results:
            results = self._apply_ai_ranking(query, results, limit)
        else:
            results = results[:limit]
        payload = {
            "query": query,
            "count": len(results),
            "results": results,
            "ai": bool(ai_enabled and self.gemini_key),
            "approximate": approx_used,
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

    def _send_html(self, body: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = body if isinstance(body, (bytes, bytearray)) else str(body).encode("utf-8")
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

    def _send_file(self, file_path: str, content_type: str) -> None:
        try:
            with open(file_path, "rb") as fh:
                data = fh.read()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self._send_json({"error": "file not found"}, status=HTTPStatus.NOT_FOUND)

    def _apply_ai_ranking(self, query: str, results: list[Dict[str, Any]], limit: int) -> list[Dict[str, Any]]:
        if not results:
            return []
        try:
            ranking = request_ranking(query, results, api_key=self.gemini_key, model=self.gemini_model)
        except (GeminiError, Exception) as exc:  # pylint: disable=broad-except
            print(f"[AI] Gemini ranking failed: {exc}")
            return results[:limit]
        mapping = {item["llt_code"]: item for item in results}
        ranked: list[Dict[str, Any]] = []
        used = set()
        for code, score, reason in ranking:
            item = mapping.get(code)
            if not item:
                continue
            cloned = item.copy()
            cloned["score"] = float(score)
            if reason:
                cloned["ai_reason"] = reason
            ranked.append(cloned)
            used.add(code)
        for item in results:
            if item["llt_code"] not in used:
                ranked.append(item)
        return ranked[:limit]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            striped = line.strip()
            if not striped or striped.startswith("#"):
                continue
            if "=" not in striped:
                continue
            key, value = striped.split("=", 1)
            key = key.strip()
            value = value.strip()
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError as exc:
        print(f".env 파일 로드 실패: {exc}")


def parse_args() -> Tuple[str, int, Path, Optional[Path], Optional[str], str]:
    env_path = Path(__file__).resolve().with_name(".env")
    load_env_file(env_path)
    parser = argparse.ArgumentParser(description="MedDRA 증상 코드 조회용 로컬 서버")
    parser.add_argument("--host", default="127.0.0.1", help="바인딩할 호스트 주소")
    parser.add_argument("--port", type=int, default=8000, help="바인딩할 포트")
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="MedDRA 데이터 루트 (ascii-281 디렉터리 포함)",
    )
    parser.add_argument(
        "--ui",
        type=Path,
        default=None,
        help="서빙할 HTML UI 경로 (기본: index.html)",
    )
    parser.add_argument(
        "--gemini-key",
        default=os.getenv("GEMINI_API_KEY"),
        help="Gemini API key (기본: GEMINI_API_KEY 환경변수)",
    )
    parser.add_argument(
        "--gemini-model",
        default=DEFAULT_GEMINI_MODEL,
        help="Gemini 모델 이름 (기본: gemini-1.5-flash)",
    )
    args = parser.parse_args()
    return args.host, args.port, args.data_root, args.ui, args.gemini_key, args.gemini_model


def resolve_ui_path(data_root: Path, explicit_path: Optional[Path]) -> Path:
    if explicit_path:
        return explicit_path
    inferred = Path(__file__).resolve().with_name(DEFAULT_UI_NAME)
    if inferred.exists():
        return inferred
    fallback = data_root / DEFAULT_UI_NAME
    return fallback


def load_ui_body(ui_path: Path) -> bytes:
    try:
        return ui_path.read_bytes()
    except FileNotFoundError:
        return HTML_PAGE.encode("utf-8")
    except OSError as exc:
        return (
            f"<!DOCTYPE html><html lang=\"ko\"><body><h1>UI 로드 오류</h1><p>{exc}</p></body></html>".encode(
                "utf-8"
            )
        )


def run_server(host: str, port: int, data_root: Path, gemini_key: Optional[str], gemini_model: str) -> None:
    dataset = build_dataset(data_root)
    MeddraRequestHandler.dataset = dataset
    server = ThreadingHTTPServer((host, port), MeddraRequestHandler)
    MeddraRequestHandler.gemini_key = gemini_key
    MeddraRequestHandler.gemini_model = gemini_model
    print(f"MedDRA 서버 실행 중: http://{host}:{port} (데이터 루트: {data_root})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
    finally:
        server.server_close()


def main() -> None:
    host, port, data_root, ui_path_arg, gemini_key, gemini_model = parse_args()
    ui_path = resolve_ui_path(data_root, ui_path_arg)
    MeddraRequestHandler.ui_body = load_ui_body(ui_path)
    run_server(host, port, data_root, gemini_key, gemini_model)


if __name__ == "__main__":
    main()
