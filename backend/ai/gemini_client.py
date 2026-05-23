from __future__ import annotations

import json
from typing import Any

from config import settings


class GeminiClient:
  def __init__(self) -> None:
    self._model = None
    if settings.gemini_api_key:
      try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        self._model = genai.GenerativeModel("gemini-2.0-flash")
      except Exception:
        self._model = None

  @property
  def available(self) -> bool:
    return self._model is not None

  async def generate(self, system: str, user: str) -> str:
    if not self._model:
      return ""
    prompt = f"{system}\n\n{user}"
    try:
      response = self._model.generate_content(prompt)
      return (response.text or "").strip()
    except Exception:
      return ""

  async def analyze_incident(self, context: dict[str, Any]) -> dict[str, Any]:
    system = (
      "You are ECHO, an expert SRE assistant. Analyze the incident context and respond "
      "ONLY with valid JSON containing keys: root_cause (string), severity (low|medium|high|critical), "
      "affected_services (array of strings), timeline (array of {timestamp, description}), "
      "remediation (array of actionable strings). Be specific and concise."
    )
    user = f"Incident context:\n{json.dumps(context, default=str, indent=2)}"
    raw = await self.generate(system, user)
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
