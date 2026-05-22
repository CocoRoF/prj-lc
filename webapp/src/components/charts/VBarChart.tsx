"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function VBarChart({
  data,
  height = 280,
  color = "#6366f1",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
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
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
