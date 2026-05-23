from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone

from agents.investigator import investigation_agent
from analyzers.anomaly import anomaly_detector
from models.schemas import MetricPoint, ServiceStatus
from services.store import SERVICES, store
from websocket.manager import ws_manager


SIMULATION_PROFILES: dict[str, dict] = {
    "database_crash": {
        "logs": [
            ("payment-api", "ERROR", "FATAL: connection pool exhausted (max=20)"),
            ("checkout-service", "ERROR", "Database query timeout after 30000ms"),
            ("payment-api", "ERROR", "Unable to acquire connection from pool"),
            ("checkout-service", "WARN", "Retrying transaction (attempt 3/3)"),
        ],
        "metrics": {"latency_ms": 850, "error_rate": 12.5, "throughput": 120, "uptime_percent": 94.2},
        "services": {
            "payment-api": {"status": ServiceStatus.DOWN, "latency_ms": 920, "error_rate": 18.0},
            "checkout-service": {"status": ServiceStatus.DEGRADED, "latency_ms": 650, "error_rate": 11.0},
        },
        "anomaly_type": "database_timeout",
    },
    "api_timeout": {
        "logs": [
            ("checkout-service", "ERROR", "Upstream payment-api timeout after 5000ms"),
            ("payment-api", "WARN", "Request queue depth: 847"),
            ("checkout-service", "ERROR", "Circuit breaker OPEN for payment-api"),
        ],
        "metrics": {"latency_ms": 520, "error_rate": 8.2, "throughput": 200, "uptime_percent": 96.5},
        "services": {
            "payment-api": {"status": ServiceStatus.DEGRADED, "latency_ms": 510, "error_rate": 7.5},
            "checkout-service": {"status": ServiceStatus.DEGRADED, "latency_ms": 480, "error_rate": 9.0},
        },
        "anomaly_type": "latency_spike",
    },
    "auth_failure": {
        "logs": [
            ("auth-gateway", "ERROR", "JWT validation failed: token expired"),
            ("payment-api", "ERROR", "401 Unauthorized - invalid bearer token"),
            ("auth-gateway", "ERROR", "JWT validation failed: token expired"),
            ("payment-api", "ERROR", "401 Unauthorized - invalid bearer token"),
            ("auth-gateway", "ERROR", "JWT validation failed: signature mismatch"),
        ],
        "metrics": {"latency_ms": 95, "error_rate": 6.8, "throughput": 380, "uptime_percent": 98.0},
        "services": {
            "auth-gateway": {"status": ServiceStatus.DEGRADED, "latency_ms": 120, "error_rate": 15.0},
            "payment-api": {"status": ServiceStatus.DEGRADED, "latency_ms": 80, "error_rate": 8.0},
        },
        "anomaly_type": "auth_failures",
    },
    "memory_overload": {
        "logs": [
            ("inventory-api", "WARN", "Heap usage at 92% - triggering GC"),
            ("inventory-api", "ERROR", "OutOfMemoryError: Java heap space"),
            ("checkout-service", "WARN", "inventory-api health check failing"),
        ],
        "metrics": {"latency_ms": 380, "error_rate": 5.5, "throughput": 90, "uptime_percent": 95.0},
        "services": {
            "inventory-api": {"status": ServiceStatus.DOWN, "latency_ms": 1200, "error_rate": 22.0},
            "checkout-service": {"status": ServiceStatus.DEGRADED, "latency_ms": 300, "error_rate": 4.0},
        },
        "anomaly_type": "throughput_drop",
    },
    "traffic_spike": {
        "logs": [
            ("payment-api", "WARN", "Rate limit threshold approaching (8900/10000 rps)"),
            ("auth-gateway", "INFO", "Traffic spike detected: 3.2x baseline"),
            ("payment-api", "ERROR", "503 Service Unavailable - capacity exceeded"),
        ],
        "metrics": {"latency_ms": 620, "error_rate": 18.5, "throughput": 1450, "uptime_percent": 93.0},
        "services": {
            "payment-api": {"status": ServiceStatus.DEGRADED, "latency_ms": 750, "error_rate": 24.0},
            "auth-gateway": {"status": ServiceStatus.DEGRADED, "latency_ms": 580, "error_rate": 12.0},
        },
        "anomaly_type": "error_rate",
    },
}


class EventSimulator:
    async def run(self, event_type: str) -> dict:
        profile = SIMULATION_PROFILES.get(event_type)
        if not profile:
            return {"ok": False, "error": f"Unknown event type: {event_type}"}

        for service, level, message in profile["logs"]:
            entry = store.add_log(service, level, message)
            await ws_manager.broadcast("log", entry.model_dump())

        for name, updates in profile.get("services", {}).items():
            store.update_service(name, **updates)
            await ws_manager.broadcast("service_health", store.service_health[name].model_dump())

        m = profile["metrics"]
        point = MetricPoint(
            timestamp=datetime.now(timezone.utc),
            latency_ms=m["latency_ms"],
            error_rate=m["error_rate"],
            throughput=m["throughput"],
            uptime_percent=m["uptime_percent"],
        )
        store.add_metric(point)
        await ws_manager.broadcast("metric", point.model_dump())

        anomaly = anomaly_detector.evaluate(point)
        if not anomaly.detected:
            from analyzers.anomaly import AnomalyResult

            anomaly = AnomalyResult(
                detected=True,
                anomaly_type=profile.get("anomaly_type"),
                message=f"Simulated failure: {event_type.replace('_', ' ')}",
                severity_hint="critical",
            )

        logs = [f"[{l.service}] {l.level}: {l.message}" for l in list(store.logs)[:20]]
        incident = await investigation_agent.investigate(anomaly, logs)
        await ws_manager.broadcast("incident", incident.model_dump())
        await ws_manager.broadcast("alert", {
            "title": incident.title,
            "severity": incident.severity.value,
            "incident_id": incident.id,
        })

        store.simulation_active = True
        store.simulation_type = event_type
        await ws_manager.broadcast(
            "simulation",
            {"active": True, "event_type": event_type, "incident_id": incident.id},
        )

        return {"ok": True, "incident_id": incident.id, "event_type": event_type}

    async def stop(self) -> dict:
        if not store.simulation_active:
            return {"ok": True, "message": "No simulation is running", "active": False}

        event_type = store.simulation_type
        resolved = store.resolve_all_active_incidents()
        store.reset_services_healthy()

        recovery = store.add_log(
            "notification-service",
            "INFO",
            f"Simulation stopped ({event_type or 'unknown'}). All services restored to healthy baseline.",
        )
        await ws_manager.broadcast("log", recovery.model_dump())

        now = datetime.now(timezone.utc)
        point = MetricPoint(
            timestamp=now,
            latency_ms=52.0,
            error_rate=0.4,
            throughput=580,
            uptime_percent=99.95,
        )
        store.add_metric(point)
        await ws_manager.broadcast("metric", point.model_dump())

        for s in store.service_health.values():
            await ws_manager.broadcast("service_health", s.model_dump())

        store.simulation_active = False
        store.simulation_type = None
        await ws_manager.broadcast("overview", self._overview_dict())
        await ws_manager.broadcast("simulation", {"active": False, "event_type": None})

        return {
            "ok": True,
            "active": False,
            "resolved_incidents": resolved,
            "message": "Simulation stopped. Services and metrics restored.",
        }

    def status(self) -> dict:
        return {
            "active": store.simulation_active,
            "event_type": store.simulation_type,
        }

    async def tick_baseline(self) -> None:
        """Emit healthy baseline metrics/logs for live dashboard."""
        now = datetime.now(timezone.utc)
        point = MetricPoint(
            timestamp=now,
            latency_ms=random.uniform(40, 90),
            error_rate=random.uniform(0.2, 1.5),
            throughput=random.randint(400, 650),
            uptime_percent=random.uniform(99.5, 99.99),
        )
        store.add_metric(point)

        if random.random() < 0.35:
            service = random.choice(SERVICES)
            level = random.choices(["INFO", "WARN", "ERROR"], weights=[70, 20, 10])[0]
            messages = {
                "INFO": [
                    f"Request processed in {random.randint(20, 80)}ms",
                    "Health check passed",
                    "Cache hit ratio: 94%",
                ],
                "WARN": ["Elevated response time on /api/v1/orders", "Retry succeeded after 1 attempt"],
                "ERROR": ["Transient 502 from upstream (recovered)"],
            }
            entry = store.add_log(service, level, random.choice(messages[level]))
            await ws_manager.broadcast("log", entry.model_dump())

        await ws_manager.broadcast("metric", point.model_dump())
        await ws_manager.broadcast("overview", self._overview_dict())



    def _overview_dict(self) -> dict:
        services = list(store.service_health.values())
        return {
            "services": [s.model_dump() for s in services],
            "active_incidents": len(store.active_incidents()),
            "avg_latency_ms": sum(s.latency_ms for s in services) / len(services),
            "error_rate": sum(s.error_rate for s in services) / len(services),
            "throughput": store.metrics[-1].throughput if store.metrics else 0,
            "uptime_percent": sum(s.uptime_percent for s in services) / len(services),
        }


event_simulator = EventSimulator()
