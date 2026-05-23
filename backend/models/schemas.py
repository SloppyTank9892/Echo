from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ServiceStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"


class LogEntry(BaseModel):
    id: str
    timestamp: datetime
    service: str
    level: str
    message: str
    metadata: dict = Field(default_factory=dict)


class MetricPoint(BaseModel):
    timestamp: datetime
    latency_ms: float
    error_rate: float
    throughput: int
    uptime_percent: float


class TimelineEvent(BaseModel):
    timestamp: datetime
    description: str


class Incident(BaseModel):
    id: str
    title: str
    severity: Severity
    status: str = "active"
    root_cause: Optional[str] = None
    affected_services: list[str] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)
    remediation: list[str] = Field(default_factory=list)
    related_logs: list[str] = Field(default_factory=list)
    created_at: datetime
    resolved_at: Optional[datetime] = None
    anomaly_type: Optional[str] = None


class ServiceHealth(BaseModel):
    name: str
    status: ServiceStatus
    latency_ms: float
    error_rate: float
    uptime_percent: float


class SystemOverview(BaseModel):
    services: list[ServiceHealth]
    active_incidents: int
    avg_latency_ms: float
    error_rate: float
    throughput: int
    uptime_percent: float


class SimulateRequest(BaseModel):
    event_type: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    incident_id: Optional[str] = None
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    sources: list[str] = Field(default_factory=list)
    ai_powered: bool = True
