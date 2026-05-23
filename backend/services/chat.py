from __future__ import annotations

import json
from datetime import datetime, timezone

from ai.gemini_client import gemini_client
from models.schemas import ChatMessage, ChatResponse
from services.store import store

ECHO_SYSTEM_PROMPT = """You are ECHO, a concise SRE copilot on a live API monitoring dashboard.

STRICT OUTPUT RULES:
- Default: 2–4 short sentences OR up to 4 bullet points (pick one format).
- Hard cap: 80 words unless the user explicitly asks for detail.
- Lead with the direct answer, then one supporting fact from context (service, log, or metric).
- No greetings, no filler ("I'd be happy to…"), no repeating the question.
- Use **bold** only for service names or severity. No headers or long lists.
- Only use facts from LIVE CONTEXT below. If unknown, say what is missing in one line.

Follow-up questions: stay brief; do not re-summarize the whole system."""


class ChatService:
    def _compact_context(self, incident_id: str | None = None) -> dict:
        active = store.active_incidents()
        incidents = store.list_incidents(3)
        logs = list(store.logs)[:12]
        metrics = list(store.metrics)[-5:]

        focused = None
        if incident_id:
            inc = store.get_incident(incident_id)
            if inc:
                focused = self._incident_summary(inc.model_dump())
        elif active:
            focused = self._incident_summary(active[0].model_dump())

        metrics_summary = None
        if metrics:
            last = metrics[-1]
            metrics_summary = {
                "latency_ms": round(last.latency_ms, 1),
                "error_rate_pct": round(last.error_rate, 2),
                "throughput_rps": last.throughput,
            }

        return {
            "at": datetime.now(timezone.utc).strftime("%H:%M UTC"),
            "active_incidents": len(active),
            "services": [
                {
                    "name": s.name,
                    "status": s.status.value,
                    "latency_ms": round(s.latency_ms, 0),
                    "error_pct": round(s.error_rate, 1),
                }
                for s in store.service_health.values()
            ],
            "focused_incident": focused,
            "recent_incidents": [self._incident_summary(i.model_dump()) for i in incidents],
            "recent_logs": [
                f"[{log.service}] {log.level}: {log.message[:120]}"
                for log in logs
            ],
            "metrics": metrics_summary,
        }

    @staticmethod
    def _incident_summary(inc: dict) -> dict:
        return {
            "id": inc.get("id"),
            "severity": inc.get("severity"),
            "title": (inc.get("title") or "")[:100],
            "root_cause": (inc.get("root_cause") or "")[:200],
            "services": inc.get("affected_services", [])[:4],
            "fix": (inc.get("remediation") or ["Investigate logs"])[0],
        }

    async def reply(
        self,
        message: str,
        incident_id: str | None = None,
        history: list[ChatMessage] | None = None,
    ) -> ChatResponse:
        context = self._compact_context(incident_id)
        sources = ["system_snapshot"]
        if context.get("focused_incident"):
            sources.append(f"incident:{context['focused_incident'].get('id', '?')}")

        if not gemini_client.available:
            return ChatResponse(
                reply=(
                    "**AI not configured.** Set `GEMINI_API_KEY` in `backend/.env` and restart the API.\n"
                    "Key: https://aistudio.google.com/apikey"
                ),
                sources=[],
                ai_powered=False,
            )

        context_json = json.dumps(context, separators=(",", ":"))
        system = f"{ECHO_SYSTEM_PROMPT}\n\nLIVE CONTEXT:\n{context_json}"
        history_payload = [{"role": m.role, "content": m.content} for m in (history or [])]

        text, error = await gemini_client.chat(
            system=system,
            history=history_payload,
            user_message=message.strip(),
            mode="chat",
        )

        if text:
            return ChatResponse(reply=text, sources=sources, ai_powered=True)

        return ChatResponse(
            reply=f"Gemini error: {error or 'unknown'}. Check your API key and restart the backend.",
            sources=sources,
            ai_powered=False,
        )

    def ai_status(self) -> dict:
        return gemini_client.status


chat_service = ChatService()
