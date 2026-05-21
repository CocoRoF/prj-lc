"use client";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function Heatmap({ matrix }: { matrix: number[][] }) {
  // matrix[weekday(0=Sun)][hour]
  const max = matrix.reduce(
    (m, row) => Math.max(m, ...row),
    1,
  );
  return (
    <div className="w-full overflow-x-auto">
      <table className="border-separate text-[10px] text-slate-500" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-8" />
            {HOURS.map((h) => (
              <th key={h} className="w-6 text-center">
                {h % 3 === 0 ? `${h}` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((w, wi) => (
            <tr key={w}>
              <td className="text-right pr-1 text-slate-600 font-medium">{w}</td>
              {HOURS.map((h) => {
                const v = matrix[wi]?.[h] ?? 0;
                const intensity = v / max;
                const bg = `rgba(59, 130, 246, ${0.05 + intensity * 0.85})`;
                return (
                  <td
                    key={h}
                    title={`${w} ${h}시 — ${v.toLocaleString("ko-KR")}`}
                    className="w-6 h-6 rounded-sm"
                    style={{ background: bg }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
