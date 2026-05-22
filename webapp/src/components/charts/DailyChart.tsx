"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DailyChart({
  data,
  height = 280,
}: {
  data: { day: string; count: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(d) =>
            typeof d === "string" ? d.slice(2, 7) : String(d ?? "")
          }
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(n) => {
            const num = typeof n === "number" ? n : Number(n);
            return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : String(num);
          }}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? value.toLocaleString("ko-KR")
              : String(value ?? "")
          }
          labelFormatter={(l) => String(l ?? "")}
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={1.5}
          fill="url(#gradComments)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
