import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, History, Lightbulb } from "lucide-react";
import { api } from "@/services/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Incident } from "@/types";

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.incident(id).then((r) => {
      setIncident(r.data);
      setLoading(false);
    });
  }, [id]);

  const resolve = async () => {
    if (!id) return;
    const { data } = await api.resolveIncident(id);
    setIncident(data);
  };

  if (loading) {
    return <p className="text-slate-500">Loading investigation…</p>;
  }

  if (!incident) {
    return (
      <div>
        <p className="text-slate-500">Incident not found.</p>
        <Link to="/incidents" className="mt-2 text-cyan-400 hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" /> All incidents
      </Link>

      <header>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge label={incident.severity} variant={incident.severity} />
          <Badge label={incident.status} variant={incident.status === "active" ? "critical" : "healthy"} />
        </div>
        <h1 className="text-2xl font-bold text-white">{incident.title}</h1>
        <p className="text-sm text-slate-500">Incident #{incident.id}</p>
      </header>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card title="AI Root Cause Analysis">
          <p className="text-slate-300 leading-relaxed">{incident.root_cause}</p>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Affected Services
            </p>
            <div className="flex flex-wrap gap-2">
              {incident.affected_services.map((s) => (
                <Badge key={s} label={s} variant="degraded" />
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <Card
        title="Event Timeline"
        action={<History className="h-4 w-4 text-cyan-400" />}
      >
        <ol className="relative border-l border-echo-border pl-6">
          {incident.timeline.map((ev, i) => (
            <li key={i} className="mb-6 last:mb-0">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-cyan-400 bg-echo-bg" />
              <time className="text-xs text-cyan-600">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </time>
              <p className="mt-0.5 text-sm text-slate-300">{ev.description}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Suggested Remediation" action={<Lightbulb className="h-4 w-4 text-amber-400" />}>
        <ul className="space-y-2">
          {incident.remediation.map((action, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="text-cyan-500">{i + 1}.</span>
              {action}
            </li>
          ))}
        </ul>
      </Card>

      {incident.related_logs.length > 0 && (
        <Card title="Related Logs">
          <div className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
            {incident.related_logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </Card>
      )}

      {incident.status === "active" && (
        <button
          onClick={resolve}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Resolved
        </button>
      )}
    </div>
  );
}
