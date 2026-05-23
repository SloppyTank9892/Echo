export type Severity = "low" | "medium" | "high" | "critical";
export type ServiceStatus = "healthy" | "degraded" | "down";

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: string;
  message: string;
}

export interface MetricPoint {
  timestamp: string;
  latency_ms: number;
  error_rate: number;
  throughput: number;
  uptime_percent: number;
}

export interface TimelineEvent {
  timestamp: string;
  description: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: string;
  root_cause?: string;
  affected_services: string[];
  timeline: TimelineEvent[];
  remediation: string[];
  related_logs: string[];
  created_at: string;
  anomaly_type?: string;
}

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latency_ms: number;
  error_rate: number;
  uptime_percent: number;
}

export interface SystemOverview {
  services: ServiceHealth[];
  active_incidents: number;
  avg_latency_ms: number;
  error_rate: number;
  throughput: number;
  uptime_percent: number;
}

export interface Alert {
  title: string;
  severity: Severity;
  incident_id: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  sources: string[];
  ai_powered: boolean;
  error_code?: string | null;
}

export interface ChatStatus {
  available: boolean;
  model: string | null;
  error: string | null;
}
