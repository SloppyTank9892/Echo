from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

MODEL_CANDIDATES = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
)


class GeminiClient:
    def __init__(self) -> None:
        self._model = None
        self._model_name: str | None = None
        self._init_error: str | None = None
        self._configure()

    def _configure(self) -> None:
        if not settings.gemini_api_key:
            self._init_error = "GEMINI_API_KEY is not set in backend/.env"
            return
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.gemini_api_key)
            for name in MODEL_CANDIDATES:
                try:
                    self._model = genai.GenerativeModel(name)
                    self._model_name = name
                    self._init_error = None
                    logger.info("Gemini model ready: %s", name)
                    return
                except Exception as exc:
                    logger.warning("Model %s unavailable: %s", name, exc)
            self._init_error = "No supported Gemini model could be initialized"
        except Exception as exc:
            self._init_error = str(exc)

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model": self._model_name,
            "error": self._init_error,
        }

    async def generate(self, system: str, user: str) -> str:
        text, _ = await self.chat(system=system, history=[], user_message=user)
        return text

    async def chat(
        self,
        system: str,
        history: list[dict[str, str]],
        user_message: str,
    ) -> tuple[str, str | None]:
        """Returns (reply_text, error_message). error_message is set on failure."""
        if not self._model:
            return "", self._init_error or "Gemini is not configured"

        contents: list[dict[str, Any]] = []
        for turn in history[-12:]:
            role = "user" if turn.get("role") == "user" else "model"
            text = (turn.get("content") or "").strip()
            if text:
                contents.append({"role": role, "parts": [text]})
        contents.append({"role": "user", "parts": [user_message]})

        try:
            import google.generativeai as genai

            model = genai.GenerativeModel(
                self._model_name or MODEL_CANDIDATES[0],
                system_instruction=system,
            )
            fn = getattr(model, "generate_content_async", None)
            if fn:
                response = await fn(contents)
            else:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, lambda: model.generate_content(contents)
                )
            text = (response.text or "").strip()
            if text:
                return text, None
            return "", "Gemini returned an empty response"
        except Exception as exc:
            logger.exception("Gemini chat failed")
            return "", str(exc)

    async def analyze_incident(self, context: dict[str, Any]) -> dict[str, Any]:
        system = (
            "You are ECHO, an expert SRE assistant. Analyze the incident context and respond "
            "ONLY with valid JSON containing keys: root_cause (string), severity (low|medium|high|critical), "
            "affected_services (array of strings), timeline (array of {timestamp, description}), "
            "remediation (array of actionable strings). Be specific and concise."
        )
        user = f"Incident context:\n{json.dumps(context, default=str, indent=2)}"
        raw, _ = await self.chat(system=system, history=[], user_message=user)
        if not raw:
            return {}
        try:
            cleaned = raw.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            return {"root_cause": raw[:500]}


gemini_client = GeminiClient()
