import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";
import { echoWs } from "@/websocket/client";
import type { Alert, Incident, LogEntry, MetricPoint, SystemOverview } from "@/types";

export function useEchoData() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const refresh = useCallback(async () => {
    const [ov, met, log, inc] = await Promise.all([
      api.overview(),
      api.metrics(),
      api.logs(),
      api.incidents(),
    ]);
    setOverview(ov.data);
    setMetrics(met.data);
    setLogs(log.data);
    setIncidents(inc.data);
  }, []);

  useEffect(() => {
    refresh();
    echoWs.connect();

    const unsubs = [
      echoWs.on("metric", (data) => {
        setMetrics((prev) => [...prev.slice(-59), data as MetricPoint]);
      }),
      echoWs.on("log", (data) => {
        setLogs((prev) => [data as LogEntry, ...prev.slice(0, 79)]);
      }),
      echoWs.on("incident", (data) => {
        const inc = data as Incident;
        setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
      }),
      echoWs.on("overview", (data) => {
        setOverview(data as SystemOverview);
      }),
      echoWs.on("alert", (data) => {
        const alert = data as Alert;
        setAlerts((prev) => [alert, ...prev.slice(0, 4)]);
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.incident_id !== alert.incident_id));
        }, 8000);
      }),
      echoWs.on("service_health", () => refresh()),
    ];

    const interval = setInterval(refresh, 15000);
    return () => {
      unsubs.forEach((u) => u());
      clearInterval(interval);
      echoWs.disconnect();
    };
  }, [refresh]);

  return { overview, metrics, logs, incidents, alerts, refresh };
}
