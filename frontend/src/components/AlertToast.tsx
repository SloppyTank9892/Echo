import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { Alert } from "@/types";
import { Badge } from "./ui/Badge";

export function AlertToast({
  alerts,
  onRemove,
}: {
  alerts: Alert[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed right-6 top-6 z-50 flex w-80 flex-col gap-2">
      <AnimatePresence>
        {alerts.map((a) => (
          <motion.div
            key={a.incident_id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="glass relative flex items-start gap-3 rounded-xl border-rose-500/40 p-4 shadow-lg shadow-rose-500/10"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <Badge label={a.severity} variant={a.severity} />
                <span className="text-xs text-slate-500">Incident detected</span>
              </div>
              <p className="text-sm font-medium text-slate-200 pr-5">{a.title}</p>
              <Link
                to={`/incidents/${a.incident_id}`}
                className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
              >
                Investigate →
              </Link>
            </div>
            <button
              onClick={() => onRemove(a.incident_id)}
              className="absolute right-3 top-3 rounded-md text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors"
              aria-label="Remove alert"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
