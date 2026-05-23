import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint } from "@/types";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LatencyChart({ data }: { data: MetricPoint[] }) {
  const chartData = data.map((d) => ({
    time: formatTime(d.timestamp),
    latency: Math.round(d.latency_ms),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} unit="ms" />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8 }}
        />
        <Area type="monotone" dataKey="latency" stroke="#22d3ee" fill="url(#latencyGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ErrorRateChart({ data }: { data: MetricPoint[] }) {
  const chartData = data.map((d) => ({
    time: formatTime(d.timestamp),
    errors: Number(d.error_rate.toFixed(2)),
    throughput: d.throughput,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8 }}
        />
        <Line yAxisId="left" type="monotone" dataKey="errors" stroke="#f43f5e" dot={false} name="Error %" />
        <Line yAxisId="right" type="monotone" dataKey="throughput" stroke="#34d399" dot={false} name="RPS" />
      </LineChart>
    </ResponsiveContainer>
  );
}
