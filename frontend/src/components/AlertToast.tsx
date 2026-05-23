import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { Alert } from "@/types";
import { Badge } from "./ui/Badge";
import { cn } from "@/utils/cn";

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);

    setTimeout(() => {
      try {
        const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, ctx2.currentTime);
        gain2.gain.setValueAtTime(0.08, ctx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.start();
        osc2.stop(ctx2.currentTime + 0.2);
      } catch (e) {}
    }, 180);
  } catch (e) {}
}

function ToastItem({ alert, onRemove }: { alert: Alert; onRemove: (id: string) => void }) {
  useEffect(() => {
    if (alert.severity === "critical") {
      playAlertSound();
    }
  }, [alert.incident_id]);

  const isCritical = alert.severity === "critical";

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.9 }}
      animate={
        isCritical
          ? {
              opacity: 1,
              x: [0, -8, 8, -6, 6, -3, 3, 0],
              scale: 1,
              boxShadow: [
                "0 0 0px rgba(239, 68, 68, 0)",
                "0 0 15px rgba(239, 68, 68, 0.4)",
                "0 0 0px rgba(239, 68, 68, 0)",
              ],
              borderColor: [
                "rgba(244, 63, 94, 0.4)",
                "rgba(239, 68, 68, 0.8)",
                "rgba(244, 63, 94, 0.4)",
              ],
            }
          : { opacity: 1, x: 0, scale: 1 }
      }
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={
        isCritical
          ? {
              x: { duration: 0.45, ease: "easeOut" },
              scale: { duration: 0.2 },
              boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              borderColor: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }
          : { duration: 0.3 }
      }
      className={cn(
        "glass relative flex items-start gap-3 rounded-xl p-4 shadow-lg border",
        isCritical
          ? "border-rose-500 bg-rose-950/20 shadow-rose-500/10"
          : "border-rose-500/40 shadow-rose-500/5 bg-slate-900/60"
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          isCritical ? "text-rose-500 animate-bounce" : "text-rose-400"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Badge label={alert.severity} variant={alert.severity} />
          <span className="text-xs text-slate-500">Incident detected</span>
        </div>
        <p className="text-sm font-medium text-slate-200 pr-5">{alert.title}</p>
        <Link
          to={`/incidents/${alert.incident_id}`}
          className="mt-2 inline-block text-xs text-cyan-400 hover:underline font-semibold"
        >
          Investigate →
        </Link>
      </div>
      <button
        onClick={() => onRemove(alert.incident_id)}
        className="absolute right-3 top-3 rounded-md text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors"
        aria-label="Remove alert"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

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
          <ToastItem key={a.incident_id} alert={a} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}
