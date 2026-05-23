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

const client = axios.create({ baseURL: "/api", timeout: 30000 });
const chatClient = axios.create({ baseURL: "/api", timeout: 120000 });

export const api = {
  health: () => client.get("/health"),
  overview: () => client.get<SystemOverview>("/overview"),
  metrics: (limit = 60) => client.get<MetricPoint[]>(`/metrics?limit=${limit}`),
  logs: (limit = 80) => client.get<LogEntry[]>(`/logs?limit=${limit}`),
  incidents: () => client.get<Incident[]>("/incidents"),
  incident: (id: string) => client.get<Incident>(`/incidents/${id}`),
  resolveIncident: (id: string) => client.post(`/incidents/${id}/resolve`),
  simulateStatus: () =>
    client.get<{ active: boolean; event_type: string | null }>("/simulate/status"),
  simulate: (event_type: string) => client.post("/simulate", { event_type }),
  simulateStop: () =>
    client.post<{
      ok: boolean;
      active: boolean;
      message?: string;
      resolved_incidents?: number;
    }>("/simulate/stop"),
  chatStatus: () => client.get<ChatStatus>("/chat/status"),
  chat: (message: string, history: ChatMessage[], incident_id?: string) =>
    chatClient.post<ChatResponse>("/chat", { message, incident_id, history }),
};
