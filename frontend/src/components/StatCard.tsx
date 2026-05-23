import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  alert,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  alert?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("glass rounded-xl p-4", alert && "ring-1 ring-rose-500/50")}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {value}
            {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg p-2",
            alert ? "bg-rose-500/10 text-rose-400" : "bg-cyan-500/10 text-cyan-400"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <p
          className={cn(
            "mt-2 text-xs",
            trend === "up" ? "text-rose-400" : trend === "down" ? "text-emerald-400" : "text-slate-500"
          )}
        >
          {trend === "up" ? "↑ Elevated" : trend === "down" ? "↓ Improving" : "— Stable"}
        </p>
      )}
    </motion.div>
  );
}
