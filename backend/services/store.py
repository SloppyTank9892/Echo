"""In-memory store with optional persistence hooks for demo/hackathon."""

from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from models.schemas import Incident, LogEntry, MetricPoint, ServiceHealth, ServiceStatus

SERVICES = [
    "payment-api",
    "checkout-service",
    "auth-gateway",
    "inventory-api",
    "notification-service",
]


class DataStore:
    def __init__(self) -> None:
        self.logs: deque[LogEntry] = deque(maxlen=500)
        self.metrics: deque[MetricPoint] = deque(maxlen=120)
        self.incidents: dict[str, Incident] = {}
        self.service_health: dict[str, ServiceHealth] = {}
        self.simulation_active: bool = False
        self.simulation_type: str | None = None
        self._init_services()

    def _init_services(self) -> None:
        for name in SERVICES:
            self.service_health[name] = ServiceHealth(
                name=name,
                status=ServiceStatus.HEALTHY,
                latency_ms=45.0,
                error_rate=0.5,
                uptime_percent=99.9,
            )

    def add_log(self, service: str, level: str, message: str, metadata: dict | None = None) -> LogEntry:
        entry = LogEntry(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now(timezone.utc),
            service=service,
            level=level,
            message=message,
            metadata=metadata or {},
        )
        self.logs.appendleft(entry)
        return entry

    def add_metric(self, point: MetricPoint) -> None:
        self.metrics.append(point)

    def add_incident(self, incident: Incident) -> Incident:
        self.incidents[incident.id] = incident
        return incident

    def get_incident(self, incident_id: str) -> Optional[Incident]:
        return self.incidents.get(incident_id)

    def list_incidents(self, limit: int = 50) -> list[Incident]:
        items = sorted(self.incidents.values(), key=lambda i: i.created_at, reverse=True)
        return items[:limit]

    def active_incidents(self) -> list[Incident]:
        return [i for i in self.incidents.values() if i.status == "active"]

    def update_service(self, name: str, **kwargs) -> None:
        if name not in self.service_health:
            return
        current = self.service_health[name]
        self.service_health[name] = current.model_copy(update=kwargs)

    def reset_services_healthy(self) -> None:
        self._init_services()

    def resolve_all_active_incidents(self) -> int:
        now = datetime.now(timezone.utc)
        count = 0
        for inc_id, inc in list(self.incidents.items()):
            if inc.status == "active":
                self.incidents[inc_id] = inc.model_copy(
                    update={"status": "resolved", "resolved_at": now}
                )
                count += 1
        return count


store = DataStore()
