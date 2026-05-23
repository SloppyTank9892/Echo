import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Key, MemoryStick, Timer, TrendingUp, Zap } from "lucide-react";
import { api } from "@/services/api";
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

export function Settings() {
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const trigger = async (eventType: string) => {
    setRunning(eventType);
    setLastResult(null);
    try {
      const { data } = await api.simulate(eventType);
      if (data.ok) {
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Failure Simulation</h1>
        <p className="text-sm text-slate-500">
          Trigger controlled incidents for live hackathon demos
        </p>
      </header>

      <Card title="Demo Flow">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-400">
          <li>Click a simulation below</li>
          <li>Watch real-time alerts on the Dashboard</li>
          <li>Open the generated incident for AI root cause & timeline</li>
          <li>Ask the AI Chat assistant to explain the failure</li>
        </ol>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATIONS.map(({ id, label, desc, icon: Icon, color }) => (
          <motion.button
            key={id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!!running}
            onClick={() => trigger(id)}
            className={cn(
              "glass rounded-xl p-5 text-left transition-colors disabled:opacity-60",
              color
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
