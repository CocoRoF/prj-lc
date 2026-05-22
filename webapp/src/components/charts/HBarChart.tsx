"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function HBarChart({
  data,
  height = 360,
  color = "#3b82f6",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(n) => {
            const num = typeof n === "number" ? n : Number(n);
            return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : String(num);
          }}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#334155", fontSize: 12 }}
          width={120}
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
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
