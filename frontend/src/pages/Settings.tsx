import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Key,
  MemoryStick,
  Octagon,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { api } from "@/services/api";
import { echoWs } from "@/websocket/client";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

const SIMULATIONS = [
  {
    id: "database_crash",
    label: "Database Crash",
    desc: "Connection pool exhaustion & query timeouts",
    icon: Database,
    color: "hover:border-rose-500/50 hover:bg-rose-500/5",
  },
  {
    id: "api_timeout",
    label: "API Timeout",
    desc: "Upstream cascade & circuit breaker open",
    icon: Timer,
    color: "hover:border-amber-500/50 hover:bg-amber-500/5",
  },
  {
    id: "auth_failure",
    label: "Auth Failure",
    desc: "JWT expiration & 401 errors",
    icon: Key,
    color: "hover:border-orange-500/50 hover:bg-orange-500/5",
  },
  {
    id: "memory_overload",
    label: "Memory Overload",
    desc: "Heap pressure & OOM on inventory-api",
    icon: MemoryStick,
    color: "hover:border-purple-500/50 hover:bg-purple-500/5",
  },
  {
    id: "traffic_spike",
    label: "Traffic Spike",
    desc: "Rate limiting & 503 capacity errors",
    icon: TrendingUp,
    color: "hover:border-cyan-500/50 hover:bg-cyan-500/5",
  },
];

const EVENT_LABELS: Record<string, string> = {
  database_crash: "Database Crash",
  api_timeout: "API Timeout",
  auth_failure: "Auth Failure",
  memory_overload: "Memory Overload",
  traffic_spike: "Traffic Spike",
};

export function Settings() {
  const [running, setRunning] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [simActive, setSimActive] = useState(false);
  const [simType, setSimType] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.simulateStatus();
      setSimActive(data.active);
      setSimType(data.event_type);
    } catch {
      /* backend offline */
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const unsub = echoWs.on("simulation", (payload) => {
      const p = payload as { active: boolean; event_type?: string | null };
      setSimActive(p.active);
      setSimType(p.event_type ?? null);
    });
    return unsub;
  }, [refreshStatus]);

  const trigger = async (eventType: string) => {
    setRunning(eventType);
    setLastResult(null);
    try {
      const { data } = await api.simulate(eventType);
      if (data.ok) {
        setSimActive(true);
        setSimType(eventType);
        setLastResult(`Incident created: #${data.incident_id}. Check Dashboard & Incidents.`);
      } else {
        setLastResult(data.error ?? "Simulation failed");
      }
    } catch {
      setLastResult("Backend unreachable. Start the API server first.");
    } finally {
      setRunning(null);
    }
  };

  const stopSimulation = async () => {
    setStopping(true);
    setLastResult(null);
    try {
      const { data } = await api.simulateStop();
      setSimActive(false);
      setSimType(null);
      setLastResult(
        data.message ??
          `Stopped. Resolved ${data.resolved_incidents ?? 0} incident(s).`
      );
    } catch {
      setLastResult("Could not stop simulation. Is the backend running?");
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Failure Simulation</h1>
          <p className="text-sm text-slate-500">
            Trigger controlled incidents for live hackathon demos
          </p>
        </div>
        {simActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={stopSimulation}
            disabled={stopping}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
          >
            <Octagon className="h-4 w-4" />
            {stopping ? "Stopping…" : "Stop Simulation"}
          </motion.button>
        )}
      </header>

      {simActive && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
          Simulation running:{" "}
          <strong>{EVENT_LABELS[simType ?? ""] ?? simType}</strong>
          <span className="text-rose-300/70">— press Stop to restore healthy state</span>
        </div>
      )}

      <Card title="Demo Flow">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Click a simulation below</li>
          <li>Watch real-time alerts on the Dashboard</li>
          <li>Open the generated incident for AI root cause & timeline</li>
          <li>Ask the AI Chat assistant to explain the failure</li>
          <li>Click <strong className="text-rose-300">Stop Simulation</strong> when done</li>
        </ol>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATIONS.map(({ id, label, desc, icon: Icon, color }) => (
          <motion.button
            key={id}
            whileHover={{ scale: simActive ? 1 : 1.02 }}
            whileTap={{ scale: simActive ? 1 : 0.98 }}
            disabled={!!running || stopping}
            onClick={() => trigger(id)}
            className={cn(
              "glass rounded-xl p-5 text-left transition-colors disabled:opacity-60",
              color,
              simActive && simType === id && "ring-2 ring-rose-500/50"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <Icon className="h-6 w-6 text-cyan-400" />
              {running === id && <Zap className="h-4 w-4 animate-pulse text-amber-400" />}
            </div>
            <h3 className="font-semibold text-slate-200">{label}</h3>
            <p className="mt-1 text-xs text-slate-500">{desc}</p>
          </motion.button>
        ))}
      </div>

      {lastResult && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300"
        >
          {lastResult}
        </motion.p>
      )}
    </div>
  );
}
