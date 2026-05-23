import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("glass rounded-xl p-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
