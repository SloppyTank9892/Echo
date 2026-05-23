import { Activity, AlertCircle, Clock, Server, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorRateChart, LatencyChart } from "@/charts/MetricsChart";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { LogEntry, SystemOverview } from "@/types";
import { cn } from "@/utils/cn";

function LogLine({ log }: { log: LogEntry }) {
  const levelColor = {
    INFO: "text-slate-400",
    WARN: "text-amber-400",
    ERROR: "text-rose-400",
  }[log.level] ?? "text-slate-400";

  return (
    <div className="font-mono text-xs leading-relaxed">
      <span className="text-slate-600">
        {new Date(log.timestamp).toLocaleTimeString()}{" "}
      </span>
      <span className="text-cyan-600">[{log.service}]</span>{" "}
      <span className={levelColor}>{log.level}</span>{" "}
      <span className="text-slate-300">{log.message}</span>
    </div>
  );
}

export function Dashboard({
  overview,
  metrics,
  logs,
  incidentCount,
}: {
  overview: SystemOverview | null;
  metrics: import("@/types").MetricPoint[];
  logs: LogEntry[];
  incidentCount: number;
}) {
  const alert = (overview?.error_rate ?? 0) > 3 || incidentCount > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
        <p className="text-sm text-slate-500">
          Real-time API health, metrics, and live incident feed
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Avg Latency"
          value={overview ? Math.round(overview.avg_latency_ms) : "—"}
          unit="ms"
          icon={Clock}
          trend={alert ? "up" : "neutral"}
          alert={alert}
        />
        <StatCard
          label="Error Rate"
          value={overview ? overview.error_rate.toFixed(1) : "—"}
          unit="%"
          icon={AlertCircle}
          trend={alert ? "up" : "neutral"}
          alert={alert}
        />
        <StatCard
          label="Throughput"
          value={overview?.throughput ?? "—"}
          unit="rps"
          icon={Activity}
        />
        <StatCard
          label="Active Incidents"
          value={incidentCount}
          icon={Zap}
          alert={incidentCount > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Response Latency">
          <LatencyChart data={metrics} />
        </Card>
        <Card title="Error Rate & Throughput">
          <ErrorRateChart data={metrics} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Service Health" className="lg:col-span-1">
          <div className="space-y-2">
            {overview?.services.map((s) => (
              <div
                key={s.name}
                className={cn(
                  "flex items-center justify-between rounded-lg border border-echo-border px-3 py-2",
                  s.status !== "healthy" && "border-rose-500/30 bg-rose-500/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-sm">{s.name}</span>
                </div>
                <Badge label={s.status} variant={s.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Live Logs"
          className="lg:col-span-2"
          action={<span className="text-xs text-emerald-400">● streaming</span>}
        >
          <div className="max-h-64 space-y-1 overflow-y-auto pr-2">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">Waiting for log stream…</p>
            ) : (
              logs.slice(0, 40).map((log) => <LogLine key={log.id + log.timestamp} log={log} />)
            )}
          </div>
        </Card>
      </div>

      {incidentCount > 0 && (
        <Card title="Active Incidents">
          <p className="text-sm text-slate-400">
            {incidentCount} incident(s) require attention.{" "}
            <Link to="/incidents" className="text-cyan-400 hover:underline">
              View all →
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
