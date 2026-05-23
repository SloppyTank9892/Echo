from __future__ import annotations

from ai.gemini_client import gemini_client
from models.schemas import ChatResponse
from services.store import store


class ChatService:
    async def reply(self, message: str, incident_id: str | None = None) -> ChatResponse:
        msg = message.lower()
        sources: list[str] = []

        if incident_id:
            incident = store.get_incident(incident_id)
            if incident:
                context = incident.model_dump()
                sources.append(f"incident:{incident_id}")
                ai = await gemini_client.generate(
                    "You are ECHO SRE assistant. Answer based on incident context. Be concise.",
                    f"Context: {context}\n\nUser: {message}",
                )
                if ai:
                    return ChatResponse(reply=ai, sources=sources)

        if "unstable" in msg or "which service" in msg:
            degraded = [
                s.name for s in store.service_health.values()
                if s.status.value != "healthy"
            ]
            if degraded:
                return ChatResponse(
                    reply=f"Currently unstable services: {', '.join(degraded)}. "
                    f"Active incidents: {len(store.active_incidents())}.",
                    sources=["service_health"],
                )
            return ChatResponse(
                reply="All monitored services are reporting healthy status.",
                sources=["service_health"],
            )

        if "last" in msg and ("minute" in msg or "incident" in msg):
            incidents = store.list_incidents(5)
            if not incidents:
                return ChatResponse(reply="No incidents recorded in the recent window.", sources=[])
            lines = [f"- [{i.severity.value}] {i.title} ({i.created_at})" for i in incidents]
            return ChatResponse(
                reply="Recent incidents:\n" + "\n".join(lines),
                sources=["incidents"],
            )

        if "payment" in msg or "fail" in msg or "why" in msg:
            active = store.active_incidents()
            if active:
                inc = active[0]
                sources.append(f"incident:{inc.id}")
                return ChatResponse(
                    reply=f"**{inc.title}**\n\nRoot cause: {inc.root_cause}\n\n"
                    f"Affected: {', '.join(inc.affected_services)}\n\n"
                    f"Recommended: {inc.remediation[0] if inc.remediation else 'Investigate logs'}",
                    sources=sources,
                )

        context = {
            "active_incidents": len(store.active_incidents()),
            "recent_logs": [l.model_dump() for l in list(store.logs)[:10]],
            "services": [s.model_dump() for s in store.service_health.values()],
        }
        sources.append("system_snapshot")
        ai = await gemini_client.generate(
            "You are ECHO, an SRE copilot. Answer operational questions clearly.",
            f"System state: {context}\n\nUser question: {message}",
        )
        if ai:
            return ChatResponse(reply=ai, sources=sources)

        return ChatResponse(
            reply="I'm monitoring the platform. Try asking about unstable services, recent incidents, "
            "or trigger a simulation from Settings to demo investigation.",
            sources=[],
        )


chat_service = ChatService()
