from fastapi import APIRouter

from ai.gemini_client import gemini_client
from models.schemas import (
    ChatRequest,
    ChatResponse,
    Incident,
    LogEntry,
    MetricPoint,
    SimulateRequest,
    SystemOverview,
)
from services.chat import chat_service
from services.store import store
from simulator.events import event_simulator

router = APIRouter(prefix="/api")


@router.get("/health")
async def health():
    return {"status": "ok", "service": "echo-backend"}


@router.get("/overview", response_model=SystemOverview)
async def overview():
    services = list(store.service_health.values())
    metrics = list(store.metrics)
    throughput = metrics[-1].throughput if metrics else 0
    return SystemOverview(
        services=services,
        active_incidents=len(store.active_incidents()),
        avg_latency_ms=sum(s.latency_ms for s in services) / max(len(services), 1),
        error_rate=sum(s.error_rate for s in services) / max(len(services), 1),
        throughput=throughput,
        uptime_percent=sum(s.uptime_percent for s in services) / max(len(services), 1),
    )


@router.get("/metrics", response_model=list[MetricPoint])
async def metrics(limit: int = 60):
    return list(store.metrics)[-limit:]


@router.get("/logs", response_model=list[LogEntry])
async def logs(limit: int = 80):
    return list(store.logs)[:limit]


@router.get("/incidents", response_model=list[Incident])
async def incidents(limit: int = 50):
    return store.list_incidents(limit)


@router.get("/incidents/{incident_id}", response_model=Incident)
async def incident_detail(incident_id: str):
    inc = store.get_incident(incident_id)
    if not inc:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    inc = store.get_incident(incident_id)
    if not inc:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Incident not found")
    from datetime import datetime, timezone

    updated = inc.model_copy(update={"status": "resolved", "resolved_at": datetime.now(timezone.utc)})
    store.incidents[incident_id] = updated
    return updated


@router.post("/simulate")
async def simulate(body: SimulateRequest):
    result = await event_simulator.run(body.event_type)
    return result


@router.get("/chat/status")
async def chat_status():
    status = chat_service.ai_status()
    if status.get("available"):
        ping = await gemini_client.ping()
        status["verified"] = bool(ping.text)
        status["model"] = ping.model_used or status.get("model")
        if not ping.text and ping.error_code:
            status["verified"] = False
            status["error"] = ping.user_message
    return status


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    return await chat_service.reply(body.message, body.incident_id, body.history)
