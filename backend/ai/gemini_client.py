from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Literal

from config import settings

logger = logging.getLogger(__name__)

# Verified via list_models() — 1.5-flash is no longer available on v1beta
MODEL_CANDIDATES = (
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
)

Mode = Literal["chat", "analysis"]


@dataclass
class GeminiResult:
    text: str = ""
    error_code: str | None = None
    user_message: str | None = None
    model_used: str | None = None


def _is_quota_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(
        token in msg
        for token in ("429", "quota", "resource_exhausted", "rate limit", "rate_limit")
    )


def _is_model_unavailable(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(token in msg for token in ("404", "not found", "not supported"))


def _should_try_next_model(exc: BaseException) -> bool:
    return _is_quota_error(exc) or _is_model_unavailable(exc)


def _friendly_error(exc: BaseException) -> tuple[str, str]:
    if _is_quota_error(exc):
        return (
            "quota_exceeded",
            "Gemini free-tier quota is used up for now. Try again in a few minutes. "
            "ECHO will answer from live incident data below.",
        )
    if "api key" in str(exc).lower() or "invalid" in str(exc).lower():
        return ("invalid_key", "Invalid API key. Check `GEMINI_API_KEY` in `backend/.env`.")
    return ("api_error", "AI is temporarily unavailable. Using live platform data instead.")


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
            self._init_error = None
            # Defer model pick to first successful generate; store preference only
            preferred = (settings.gemini_model or MODEL_CANDIDATES[0]).strip()
            self._model_name = preferred
            logger.info("Gemini configured; preferred model: %s", preferred)
        except Exception as exc:
            self._init_error = str(exc)

    @property
    def available(self) -> bool:
        return bool(settings.gemini_api_key) and self._init_error is None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model": self._model_name,
            "error": self._init_error,
        }

    def _models_to_try(self) -> list[str]:
        preferred = (settings.gemini_model or "").strip()
        ordered: list[str] = []
        if preferred:
            ordered.append(preferred)
        if self._model_name and self._model_name not in ordered:
            ordered.append(self._model_name)
        for m in MODEL_CANDIDATES:
            if m not in ordered:
                ordered.append(m)
        return ordered

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

    def _create_model(self, model_name: str, system: str):
        import google.generativeai as genai

        return genai.GenerativeModel(model_name, system_instruction=system)

    async def _generate_with_model(
        self,
        model_name: str,
        system: str,
        contents: list[dict[str, Any]],
        mode: Mode,
    ) -> str:
        model = self._create_model(model_name, system)
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
        if not response.candidates:
            raise ValueError("No candidates in Gemini response")
        return (response.text or "").strip()

    async def ping(self) -> GeminiResult:
        """Lightweight call to verify API + pick a working model."""
        return await self.chat(
            system="Reply with exactly: ok",
            history=[],
            user_message="ping",
            mode="chat",
        )

    async def generate(self, system: str, user: str, mode: Mode = "chat") -> str:
        result = await self.chat(system=system, history=[], user_message=user, mode=mode)
        return result.text

    async def chat(
        self,
        system: str,
        history: list[dict[str, str]],
        user_message: str,
        mode: Mode = "chat",
    ) -> GeminiResult:
        if not self.available:
            return GeminiResult(
                error_code="not_configured",
                user_message=self._init_error or "Gemini is not configured",
            )

        contents: list[dict[str, Any]] = []
        for turn in history[-8:]:
            role = "user" if turn.get("role") == "user" else "model"
            text = (turn.get("content") or "").strip()
            if not text:
                continue
            if role == "model" and len(text) > 1200:
                text = text[:1200] + "…"
            contents.append({"role": role, "parts": [text]})
        contents.append({"role": "user", "parts": [user_message]})

        last_quota = False
        last_error: BaseException | None = None

        for model_name in self._models_to_try():
            try:
                text = await self._generate_with_model(model_name, system, contents, mode)
                if text:
                    self._model_name = model_name
                    return GeminiResult(text=text, model_used=model_name)
            except Exception as exc:
                last_error = exc
                logger.warning("Gemini %s failed: %s", model_name, exc)
                if _should_try_next_model(exc):
                    if _is_quota_error(exc):
                        last_quota = True
                    continue
                code, msg = _friendly_error(exc)
                return GeminiResult(error_code=code, user_message=msg)

        if last_quota:
            code, msg = _friendly_error(Exception("429 quota"))
            return GeminiResult(error_code=code, user_message=msg)

        if last_error and _is_model_unavailable(last_error):
            return GeminiResult(
                error_code="model_unavailable",
                user_message="No Gemini model available. Update GEMINI_MODEL in backend/.env.",
            )

        return GeminiResult(
            error_code="empty_response",
            user_message="AI returned no content. Using live platform data instead.",
        )

    async def analyze_incident(self, context: dict[str, Any]) -> dict[str, Any]:
        system = (
            "ECHO SRE analyst. Return ONLY compact JSON: "
            "root_cause (max 2 sentences), severity (low|medium|high|critical), "
            "affected_services (string array), timeline (max 5 items with timestamp, description), "
            "remediation (max 4 short action strings). No markdown, no prose outside JSON."
        )
        user = f"Context:\n{json.dumps(context, default=str, separators=(',', ':'))}"
        result = await self.chat(system=system, history=[], user_message=user, mode="analysis")
        raw = result.text
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
