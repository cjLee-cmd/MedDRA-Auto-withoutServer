"""Helper utilities to request relevance re-ranking from Gemini."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Iterable, List, Tuple

API_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={api_key}"
)
DEFAULT_MODEL = "gemini-2.5-flash"


class GeminiError(RuntimeError):
    """Wraps remote API failures."""


def request_ranking(
    query: str,
    candidates: Iterable[dict],
    api_key: str | None = None,
    model: str = DEFAULT_MODEL,
) -> List[Tuple[str, float, str]]:
    """Use Gemini to re-rank LLT candidates.

    Returns a list of tuples ``(llt_code, score, reason)`` ordered by relevance.
    If the API fails, an empty list is returned.
    """

    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise GeminiError("Gemini API key is not configured")

    candidate_lines = []
    for item in candidates:
        candidate_lines.append(
            f"LLT {item['llt_code']} | 이름: {item['llt_name']}"
            f" | 점수: {item.get('score', 0)} | 활성: {item.get('active')}"
        )

    prompt = (
        "당신은 의학 용어 정렬 전문가입니다. 사용자가 입력한 증상과 가장 "
        "관련 있는 MedDRA LLT 용어를 순서대로 제시하세요.\n"
        "반드시 JSON 배열만 출력하고, 다른 설명 텍스트를 포함하지 마십시오.\n"
        "각 항목은 {\\\"llt_code\\\": \\\"코드\\\", \\\"score\\\": 정수(0-100), \\\"reason\\\": \\\"설명\\\"} 형식이어야 합니다.\n"
        "가장 관련성이 높은 항목이 배열의 첫 번째 요소가 되도록 하세요.\n"
        "JSON 외의 텍스트를 절대 작성하지 마십시오.\n"
        "사용자 입력: "
        f"{query}\n"
        "후보 목록:\n"
        + "\n".join(candidate_lines)
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    data = json.dumps(payload).encode("utf-8")
    url = API_URL_TEMPLATE.format(model=model, api_key=key)
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            response_data = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        raise GeminiError(f"HTTP {exc.code} {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise GeminiError(f"네트워크 오류: {exc.reason}") from exc
    except TimeoutError as exc:
        raise GeminiError("Gemini 응답 시간 초과") from exc

    try:
        payload = json.loads(response_data)
    except json.JSONDecodeError as exc:
        raise GeminiError("응답 JSON 파싱 실패") from exc

    candidates_data = payload.get("candidates") or []
    if not candidates_data:
        raise GeminiError("Gemini 응답에 candidates 가 없습니다")

    text = ""
    for part in candidates_data[0].get("content", {}).get("parts", []):
        if "text" in part:
            text += part["text"]
    if not text:
        raise GeminiError("Gemini 응답에 텍스트가 없습니다")

    try:
        ranked = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError("Gemini 결과 형식이 JSON이 아닙니다") from exc

    parsed: List[Tuple[str, float, str]] = []
    for entry in ranked:
        code = entry.get("llt_code")
        score = entry.get("score")
        reason = entry.get("reason", "")
        if not code:
            continue
        try:
            score_value = float(score)
        except (TypeError, ValueError):
            score_value = 0.0
        parsed.append((code, score_value, reason))
    return parsed


__all__ = ["request_ranking", "GeminiError", "DEFAULT_MODEL"]
