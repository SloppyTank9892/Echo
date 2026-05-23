from __future__ import annotations

import json
from datetime import datetime, timezone

from ai.gemini_client import gemini_client
from models.schemas import ChatMessage, ChatResponse
from services.store import store

ECHO_SYSTEM_PROMPT = """You are ECHO, an expert Site Reliability Engineering (SRE) copilot embedded in a real-time API observability platform.

Your job:
- Answer the engineer's questions using ONLY the live platform context provided below.
- Explain failures, root causes, timelines, and remediation in clear, direct language.
- Reference specific services, log lines, incidents, and metrics when relevant.
- If data is missing, say what you would check next — do not invent outages that are not in the context.
- Keep answers focused (2–5 short paragraphs or bullet lists). Use markdown sparingly (**bold**, lists).
- You are having a real conversation; refer to earlier turns when the user follows up.

Do NOT use generic boilerplate. Every answer must reflect the current system state in the context block."""


class ChatService:
    def _build_live_context(self, incident_id: str | None = None) -> dict:
        incidents = store.list_incidents(10)
        active = store.active_incidents()
        logs = list(store.logs)[:25]
        metrics = list(store.metrics)[-15:]

        focused_incident = None
        if incident_id:
            inc = store.get_incident(incident_id)
            if inc:
                focused_incident = inc.model_dump()
        elif active:
            focused_incident = active[0].model_dump()

        return {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "services": [s.model_dump() for s in store.service_health.values()],
            "active_incident_count": len(active),
            "incidents": [i.model_dump() for i in incidents],
            "focused_incident": focused_incident,
            "recent_logs": [log.model_dump() for log in logs],
            "recent_metrics": [m.model_dump() for m in metrics],
        }

    def _format_context_block(self, context: dict) -> str:
        return f"LIVE PLATFORM CONTEXT (JSON):\n{json.dumps(context, default=str, indent=2)}"

    async def reply(
        self,
        message: str,
        incident_id: str | None = None,
        history: list[ChatMessage] | None = None,
    ) -> ChatResponse:
        context = self._build_live_context(incident_id)
        sources = ["system_snapshot"]
        if context.get("focused_incident"):
            sources.append(f"incident:{context['focused_incident'].get('id', 'unknown')}")

        if not gemini_client.available:
            return ChatResponse(
                reply=(
                    "**AI chat is not configured.** Add your Google Gemini API key to "
                    "`backend/.env` as `GEMINI_API_KEY=your_key_here`, then restart the backend.\n\n"
                    "Get a key at https://aistudio.google.com/apikey"
                ),
                sources=[],
                ai_powered=False,
            )

        system = f"{ECHO_SYSTEM_PROMPT}\n\n{self._format_context_block(context)}"
        history_payload = [{"role": m.role, "content": m.content} for m in (history or [])]

        text, error = await gemini_client.chat(
            system=system,
            history=history_payload,
            user_message=message.strip(),
        )

        if text:
            return ChatResponse(reply=text, sources=sources, ai_powered=True)

        return ChatResponse(
            reply=(
                f"I couldn't reach Gemini right now: {error or 'unknown error'}\n\n"
                "Check that `GEMINI_API_KEY` is valid and restart the backend."
            ),
            sources=sources,
            ai_powered=False,
        )

    def ai_status(self) -> dict:
        return gemini_client.status


chat_service = ChatService()
