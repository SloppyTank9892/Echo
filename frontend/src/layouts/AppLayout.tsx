import { NavLink, Outlet } from "react-router-dom";
import { Activity, Bot, LayoutDashboard, Settings, Zap } from "lucide-react";
import { cn } from "@/utils/cn";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", icon: Zap },
  { to: "/chat", label: "AI Chat", icon: Bot },
  { to: "/settings", label: "Simulation", icon: Settings },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-echo-border bg-echo-card/50 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-echo-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20">
            <Activity className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <p className="font-bold tracking-tight text-white">ECHO</p>
            <p className="text-[10px] text-slate-500">AI SRE Assistant</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-echo-border p-4">
          <p className="text-xs text-slate-500">Real-time monitoring</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </p>
        </div>
      </aside>
      <main className="ml-56 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
