import { cn } from "@/utils/cn";

const variants: Record<string, string> = {
  healthy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  down: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export function Badge({
  label,
  variant = "healthy",
  className,
}: {
  label: string;
  variant?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        variants[variant] ?? variants.healthy,
        className
      )}
    >
      {label}
    </span>
  );
}
