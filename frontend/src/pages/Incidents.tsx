import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Incident } from "@/types";

export function Incidents({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Incident Investigations</h1>
        <p className="text-sm text-slate-500">AI-analyzed root causes and remediation</p>
      </header>

      {incidents.length === 0 ? (
        <Card>
          <p className="text-slate-400">
            No incidents yet. Use the{" "}
            <Link to="/settings" className="text-cyan-400 hover:underline">
              Simulation panel
            </Link>{" "}
            to trigger a demo failure.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc, i) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/incidents/${inc.id}`}>
                <Card className="transition-colors hover:border-cyan-500/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge label={inc.severity} variant={inc.severity} />
                        <Badge label={inc.status} variant={inc.status === "active" ? "high" : "healthy"} />
                        <span className="text-xs text-slate-600">#{inc.id}</span>
                      </div>
                      <h3 className="font-medium text-slate-200">{inc.title}</h3>
                      {inc.root_cause && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{inc.root_cause}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-600">
                        {new Date(inc.created_at).toLocaleString()} ·{" "}
                        {inc.affected_services.join(", ")}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
