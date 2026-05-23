from __future__ import annotations

import json
import re
from typing import Any


def _try_parse_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if not cleaned:
        return None
    if "```" in cleaned:
        for part in cleaned.split("```"):
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                cleaned = part
                break
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    start = cleaned.find("{")
    if start >= 0:
        snippet = cleaned[start:]
        for end in range(len(snippet), start, -1):
            try:
                data = json.loads(snippet[:end])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue
    return None


def _regex_field(text: str, key: str) -> str | None:
    match = re.search(rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)"', text, re.DOTALL)
    if match:
        return match.group(1).replace('\\"', '"')
    match = re.search(rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)$', text, re.DOTALL)
    if match:
        return match.group(1).replace('\\"', '"')
    return None


def parse_investigation_response(raw: str) -> dict[str, Any]:
    """Turn Gemini output into a flat investigation dict."""
    if not raw or not raw.strip():
        return {}

    parsed = _try_parse_json(raw)
    if parsed:
        return flatten_investigation(parsed)

    root = _regex_field(raw, "root_cause")
    if root:
        result: dict[str, Any] = {"root_cause": root}
        sev = _regex_field(raw, "severity")
        if sev:
            result["severity"] = sev
        return result

    return {"root_cause": raw.strip()[:500]}


def flatten_investigation(data: dict[str, Any]) -> dict[str, Any]:
    """Unwrap nested or stringified JSON in root_cause."""
    out = dict(data)
    rc = out.get("root_cause")
    if isinstance(rc, str) and rc.strip().startswith("{"):
        nested = _try_parse_json(rc)
        if nested:
            out.update(nested)
    if isinstance(rc, dict):
        out.update(rc)
    return out
