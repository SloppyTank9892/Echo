from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from models.schemas import MetricPoint
from services.store import store


@dataclass
class AnomalyResult:
    detected: bool
    anomaly_type: str | None
    message: str
    severity_hint: str


class AnomalyDetector:
    LATENCY_THRESHOLD_MS = 200.0
    ERROR_RATE_THRESHOLD = 5.0
    THROUGHPUT_DROP_RATIO = 0.4

    def evaluate(self, point: MetricPoint) -> AnomalyResult:
        recent = list(store.metrics)[-10:]
        avg_latency = sum(m.latency_ms for m in recent) / max(len(recent), 1)

        if point.latency_ms >= self.LATENCY_THRESHOLD_MS:
            return AnomalyResult(
                detected=True,
                anomaly_type="latency_spike",
                message=f"Latency spike detected: {point.latency_ms:.0f}ms (threshold {self.LATENCY_THRESHOLD_MS}ms)",
                severity_hint="high",
            )

        if point.error_rate >= self.ERROR_RATE_THRESHOLD:
            return AnomalyResult(
                detected=True,
                anomaly_type="error_rate",
                message=f"Error rate exceeded: {point.error_rate:.1f}% (threshold {self.ERROR_RATE_THRESHOLD}%)",
                severity_hint="critical",
            )

        if len(recent) >= 3:
            baseline = sum(m.throughput for m in recent[:-1]) / max(len(recent) - 1, 1)
            if baseline > 0 and point.throughput < baseline * self.THROUGHPUT_DROP_RATIO:
                return AnomalyResult(
                    detected=True,
                    anomaly_type="throughput_drop",
                    message="Sudden throughput drop detected",
                    severity_hint="medium",
                )

        if point.latency_ms > avg_latency * 2.5 and avg_latency > 0:
            return AnomalyResult(
                detected=True,
                anomaly_type="frequency_deviation",
                message="Abnormal latency deviation from baseline",
                severity_hint="medium",
            )

        auth_failures = sum(
            1 for log in list(store.logs)[:30]
            if log.level == "ERROR" and "auth" in log.message.lower()
        )
        if auth_failures >= 3:
            return AnomalyResult(
                detected=True,
                anomaly_type="auth_failures",
                message="Repeated authentication failures detected",
                severity_hint="high",
            )

        db_timeouts = sum(
            1 for log in list(store.logs)[:30]
            if "timeout" in log.message.lower() or "connection pool" in log.message.lower()
        )
        if db_timeouts >= 2:
            return AnomalyResult(
                detected=True,
                anomaly_type="database_timeout",
                message="Database timeout pattern detected",
                severity_hint="critical",
            )

        return AnomalyResult(detected=False, anomaly_type=None, message="Normal", severity_hint="low")

    def snapshot_time(self) -> datetime:
        return datetime.now(timezone.utc)


anomaly_detector = AnomalyDetector()
