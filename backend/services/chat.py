from __future__ import annotations

import json
from datetime import datetime, timezone

from ai.gemini_client import gemini_client
from models.schemas import ChatMessage, ChatResponse
from services.store import store

ECHO_SYSTEM_PROMPT = """You are ECHO, an expert SRE copilot on a live API monitoring dashboard.

RESPONSE STYLE:
- Give complete, helpful answers (roughly 120–250 words unless the user asks for a one-liner).
- Structure longer answers clearly:
  1) **What happened** — direct answer to the question
  2) **Evidence** — cite specific services, log lines, metrics, or incident fields from context
  3) **Impact** — which services/users are affected
  4) **What to do next** — 2–4 concrete remediation steps from context when available
- Use markdown: **bold** for services, bullet lists for steps, short paragraphs.
- No filler greetings. Do not repeat the user's question verbatim.
- Only use facts from LIVE CONTEXT. If something is missing, state what data you would need.
- On follow-ups, build on the conversation without re-explaining the entire platform from scratch."""


class ChatService:
    def _compact_context(self, incident_id: str | None = None) -> dict:
        active = store.active_incidents()
        incidents = store.list_incidents(5)
        logs = list(store.logs)[:25]
        metrics = list(store.metrics)[-10:]

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
                f"[{log.service}] {log.level}: {log.message[:200]}"
                for log in logs
            ],
            "metrics": metrics_summary,
            "metrics_history": [
                {
                    "latency_ms": round(m.latency_ms, 1),
                    "error_rate_pct": round(m.error_rate, 2),
                    "throughput": m.throughput,
                }
                for m in metrics[-6:]
            ],
            "simulation_active": store.simulation_active,
            "simulation_type": store.simulation_type,
        }

    @staticmethod
    def _incident_summary(inc: dict) -> dict:
        timeline = inc.get("timeline") or []
        return {
            "id": inc.get("id"),
            "severity": inc.get("severity"),
            "status": inc.get("status"),
            "title": inc.get("title") or "",
            "root_cause": inc.get("root_cause") or "",
            "affected_services": inc.get("affected_services", []),
            "remediation": inc.get("remediation", []),
            "timeline": [
                {"time": t.get("timestamp"), "event": t.get("description")}
                for t in timeline[:8]
            ],
            "related_logs": (inc.get("related_logs") or [])[:8],
        }

    def _local_context_answer(self, message: str, context: dict) -> str:
        """Concise fallback from live store when Gemini is unavailable."""
        inc = context.get("focused_incident")
        msg = message.lower()
        degraded = [s["name"] for s in context.get("services", []) if s.get("status") != "healthy"]

        if inc:
            services = ", ".join(inc.get("affected_services") or []) or "affected services"
            fixes = inc.get("remediation") or []
            fix_text = "\n".join(f"- {f}" for f in fixes[:4]) if fixes else "- See Incidents tab"
            timeline = inc.get("timeline") or []
            tl_text = "\n".join(
                f"- {t.get('event', '')}" for t in timeline[:5]
            ) if timeline else "- See incident timeline"
            return (
                f"**What happened:** {inc.get('root_cause', 'No root cause on file.')}\n\n"
                f"**Affected:** {services} (severity: {inc.get('severity')})\n\n"
                f"**Timeline:**\n{tl_text}\n\n"
                f"**Recommended actions:**\n{fix_text}"
            )

        if any(w in msg for w in ("unstable", "which service", "down", "degraded")):
            if degraded:
                return f"Unstable now: **{', '.join(degraded)}**. Active incidents: {context.get('active_incidents', 0)}."
            return "All monitored services report **healthy**."

        timeout_logs = [
            line for line in context.get("recent_logs", [])
            if "timeout" in line.lower() or "circuit" in line.lower()
        ]
        if timeout_logs and "timeout" in msg:
            return f"Latest signal: {timeout_logs[0]}\nCheck **Incidents** after running a simulation."

        if context.get("recent_incidents"):
            top = context["recent_incidents"][0]
            return (
                f"No active incident. Latest: **{top.get('title', 'n/a')}** — "
                f"{top.get('root_cause', 'Run Simulation to generate data.')}"
            )

        return (
            "No incident data yet. Use **Simulation** → API Timeout, then ask again."
        )

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
                error_code="not_configured",
            )

        context_json = json.dumps(context, separators=(",", ":"))
        system = f"{ECHO_SYSTEM_PROMPT}\n\nLIVE CONTEXT:\n{context_json}"
        history_payload = [{"role": m.role, "content": m.content} for m in (history or [])]

        result = await gemini_client.chat(
            system=system,
            history=history_payload,
            user_message=message.strip(),
            mode="chat",
        )

        if result.text:
            return ChatResponse(
                reply=result.text,
                sources=sources,
                ai_powered=True,
                error_code=None,
            )

        fallback = self._local_context_answer(message, context)
        prefix = ""
        if result.error_code == "quota_exceeded":
            prefix = "_Gemini quota reached — answer from live data:_\n\n"
        elif result.error_code not in ("api_error", "empty_response") and result.user_message:
            prefix = f"_{result.user_message}_\n\n"

        return ChatResponse(
            reply=fallback if result.error_code == "api_error" else f"{prefix}{fallback}".strip(),
            sources=sources + ["local_fallback"],
            ai_powered=False,
            error_code=result.error_code,
        )

    def ai_status(self) -> dict:
        return gemini_client.status


chat_service = ChatService()
