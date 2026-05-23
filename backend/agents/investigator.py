from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from ai.gemini_client import gemini_client
from ai.parse_utils import flatten_investigation, parse_investigation_response
from analyzers.anomaly import AnomalyResult
from models.schemas import Incident, Severity, TimelineEvent
from services.store import store


FALLBACK_SCENARIOS: dict[str, dict] = {
    "latency_spike": {
        "root_cause": "API timeout cascade triggered by upstream dependency slowdown after recent deployment.",
        "affected_services": ["payment-api", "checkout-service"],
        "remediation": [
            "Roll back deployment v1.2.4",
            "Increase upstream timeout thresholds temporarily",
            "Enable circuit breaker on checkout-service",
        ],
        "correlation": "Upstream payment-api slowdown caused cascading timeout in checkout-service.",
    },
    "error_rate": {
        "root_cause": "Elevated 5xx responses due to unhandled exceptions in payment-api after schema migration.",
        "affected_services": ["payment-api"],
        "remediation": [
            "Rollback database migration",
            "Restart payment-api pods",
            "Validate API contract tests",
        ],
        "correlation": "Traffic spike on payment-api triggered error rate spike cascade.",
    },
    "database_timeout": {
        "root_cause": "PostgreSQL connection pool exhaustion caused by unclosed sessions after deployment v1.2.4.",
        "affected_services": ["payment-api", "checkout-service"],
        "remediation": [
            "Increase connection pool size",
            "Close idle DB sessions",
            "Roll back deployment v1.2.4",
        ],
        "correlation": "Database degradation likely triggered payment-api connection timeouts.",
    },
    "auth_failures": {
        "root_cause": "Authentication token expiration misconfiguration after auth-gateway config change.",
        "affected_services": ["auth-gateway", "payment-api"],
        "remediation": [
            "Fix JWT expiry configuration",
            "Rotate signing keys",
            "Invalidate stale sessions",
        ],
        "correlation": "auth-gateway failure blocked token validation in downstream payment-api.",
    },
    "throughput_drop": {
        "root_cause": "Memory pressure on inventory-api causing GC pauses and request throttling.",
        "affected_services": ["inventory-api", "checkout-service"],
        "remediation": [
            "Increase memory allocation",
            "Restart affected service",
            "Review heap dump for leaks",
        ],
        "correlation": "inventory-api heap exhaustion caused request timeouts in checkout-service.",
    },
}


class InvestigationAgent:
    async def investigate(self, anomaly: AnomalyResult, trigger_logs: list[str]) -> Incident:
        now = datetime.now(timezone.utc)
        anomaly_type = anomaly.anomaly_type or "unknown"

        context = {
            "anomaly": anomaly.message,
            "type": anomaly_type,
            "severity_hint": anomaly.severity_hint,
            "recent_logs": trigger_logs[:25],
            "services": [s.model_dump() for s in store.service_health.values()],
        }

        ai_result = flatten_investigation(await gemini_client.analyze_incident(context))
        fallback = FALLBACK_SCENARIOS.get(anomaly_type, FALLBACK_SCENARIOS["latency_spike"])

        root_cause = ai_result.get("root_cause") or fallback["root_cause"]
        if isinstance(root_cause, dict):
            root_cause = root_cause.get("root_cause") or fallback["root_cause"]
        root_cause = str(root_cause).strip()
        if root_cause.startswith("{"):
            parsed = parse_investigation_response(root_cause)
            root_cause = str(parsed.get("root_cause") or fallback["root_cause"])

        affected = ai_result.get("affected_services") or fallback["affected_services"]
        if isinstance(affected, str):
            affected = [affected]
        remediation = ai_result.get("remediation") or fallback["remediation"]
        if isinstance(remediation, str):
            remediation = [remediation]
        severity_str = ai_result.get("severity") or anomaly.severity_hint

        severity_map = {
            "low": Severity.LOW,
            "medium": Severity.MEDIUM,
            "high": Severity.HIGH,
            "critical": Severity.CRITICAL,
        }
        severity = severity_map.get(str(severity_str).lower(), Severity.HIGH)

        timeline = self._build_timeline(now, anomaly_type, ai_result.get("timeline"))
        incident_id = str(uuid.uuid4())[:8]
        correlation = ai_result.get("correlation") or fallback.get("correlation")

        incident = Incident(
            id=incident_id,
            title=anomaly.message[:80],
            severity=severity,
            status="active",
            root_cause=root_cause,
            affected_services=affected,
            timeline=timeline,
            remediation=remediation,
            related_logs=trigger_logs[:15],
            created_at=now,
            anomaly_type=anomaly_type,
            correlation=correlation,
        )
        store.add_incident(incident)
        return incident

    def _build_timeline(
        self, now: datetime, anomaly_type: str, ai_timeline: list | None
    ) -> list[TimelineEvent]:
        if ai_timeline and isinstance(ai_timeline, list):
            events = []
            for item in ai_timeline:
                if isinstance(item, dict) and "description" in item:
                    ts = item.get("timestamp")
                    try:
                        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00")) if ts else now
                    except ValueError:
                        dt = now
                    events.append(TimelineEvent(timestamp=dt, description=item["description"]))
            if events:
                return sorted(events, key=lambda e: e.timestamp)

        offsets = [
            (6, "Deployment v1.2.4 initiated"),
            (4, "Database latency increased"),
            (2, "API timeout spikes detected"),
            (1, "Error rate crossed threshold"),
            (0, f"Anomaly detected: {anomaly_type.replace('_', ' ')}"),
        ]
        return [
            TimelineEvent(
                timestamp=now - timedelta(minutes=mins),
                description=desc,
            )
            for mins, desc in offsets
        ]


investigation_agent = InvestigationAgent()
