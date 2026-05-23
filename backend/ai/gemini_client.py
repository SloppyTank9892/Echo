from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Literal

from config import settings

logger = logging.getLogger(__name__)

MODEL_CANDIDATES = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
)

Mode = Literal["chat", "analysis"]


class GeminiClient:
    def __init__(self) -> None:
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
                    genai.GenerativeModel(name)
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
        return self._model_name is not None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model": self._model_name,
            "error": self._init_error,
        }

    def _generation_config(self, mode: Mode):
        import google.generativeai as genai

        max_tokens = (
            settings.gemini_analysis_max_tokens
            if mode == "analysis"
            else settings.gemini_chat_max_tokens
        )
        return genai.types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=settings.gemini_temperature,
            top_p=0.9,
        )

    def _create_model(self, system: str):
        import google.generativeai as genai

        return genai.GenerativeModel(
            self._model_name or MODEL_CANDIDATES[0],
            system_instruction=system,
        )

    async def generate(self, system: str, user: str, mode: Mode = "chat") -> str:
        text, _ = await self.chat(system=system, history=[], user_message=user, mode=mode)
        return text

    async def chat(
        self,
        system: str,
        history: list[dict[str, str]],
        user_message: str,
        mode: Mode = "chat",
    ) -> tuple[str, str | None]:
        if not self.available:
            return "", self._init_error or "Gemini is not configured"

        contents: list[dict[str, Any]] = []
        for turn in history[-8:]:
            role = "user" if turn.get("role") == "user" else "model"
            text = (turn.get("content") or "").strip()
            if not text:
                continue
            if role == "model" and len(text) > 400:
                text = text[:400] + "…"
            contents.append({"role": role, "parts": [text]})
        contents.append({"role": "user", "parts": [user_message]})

        try:
            model = self._create_model(system)
            config = self._generation_config(mode)
            fn = getattr(model, "generate_content_async", None)
            if fn:
                response = await fn(contents, generation_config=config)
            else:
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: model.generate_content(contents, generation_config=config),
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
            "ECHO SRE analyst. Return ONLY compact JSON: "
            "root_cause (max 2 sentences), severity (low|medium|high|critical), "
            "affected_services (string array), timeline (max 5 items with timestamp, description), "
            "remediation (max 4 short action strings). No markdown, no prose outside JSON."
        )
        user = f"Context:\n{json.dumps(context, default=str, separators=(',', ':'))}"
        raw, _ = await self.chat(system=system, history=[], user_message=user, mode="analysis")
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
            return {"root_cause": raw[:280]}


gemini_client = GeminiClient()
