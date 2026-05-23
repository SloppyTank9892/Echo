import axios from "axios";
import type {
  ChatMessage,
  ChatResponse,
  ChatStatus,
  Incident,
  LogEntry,
  MetricPoint,
  SystemOverview,
} from "@/types";

const client = axios.create({ baseURL: "/api" });

export const api = {
  health: () => client.get("/health"),
  overview: () => client.get<SystemOverview>("/overview"),
  metrics: (limit = 60) => client.get<MetricPoint[]>(`/metrics?limit=${limit}`),
  logs: (limit = 80) => client.get<LogEntry[]>(`/logs?limit=${limit}`),
  incidents: () => client.get<Incident[]>("/incidents"),
  incident: (id: string) => client.get<Incident>(`/incidents/${id}`),
  resolveIncident: (id: string) => client.post(`/incidents/${id}/resolve`),
  simulate: (event_type: string) => client.post("/simulate", { event_type }),
  chatStatus: () => client.get<ChatStatus>("/chat/status"),
  chat: (message: string, history: ChatMessage[], incident_id?: string) =>
    client.post<ChatResponse>("/chat", { message, incident_id, history }),
};
