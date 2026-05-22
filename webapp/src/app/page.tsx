import Link from "next/link";
import { dashboardStats } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";
import { withBasePath } from "@/lib/paths";
import DailyChart from "@/components/charts/DailyChart";
import {
  loadOverview,
  loadTextStats,
  loadTimeSeries,
} from "@/lib/analytics";

export default async function Home() {
  const s = dashboardStats();
  const [overview, ts, text] = await Promise.all([
    loadOverview(),
    loadTimeSeries(),
    loadTextStats(),
  ]);
  const maxCatComments = Math.max(
    1,
    ...s.byCategory.map((c) => c.comment_count ?? 0),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-blue-900">
            전체 데이터 다운로드
          </div>
          <div className="text-xs text-blue-700 mt-0.5">
            방송별 .xlsx 파일을 카테고리 폴더로 묶은 ZIP을 스트리밍 받습니다. 댓글이 있는 방송만 포함.
          </div>
        </div>
        <a
          href={withBasePath("/api/download/all?with_comments=1")}
          className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
        >
          ⬇ 전체 ZIP
        </a>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="카테고리" value={fmtNumber(s.totals.categories)} />
        <Stat label="채널" value={fmtNumber(s.totals.channels)} />
        <Stat label="방송" value={fmtNumber(s.totals.broadcasts)} />
        <Stat label="댓글 보유 방송" value={fmtNumber(s.totals.broadcasts_with_comments)} />
        <Stat label="상품" value={fmtNumber(overview?.totals.products ?? 0)} />
        <Stat label="댓글" value={fmtNumber(s.totals.comments)} highlight />
      </section>

      {ts && (
        <section className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold">일별 댓글 추이</h2>
              <p className="text-xs text-slate-500">
                {ts.daily[0]?.day} ~ {ts.daily[ts.daily.length - 1]?.day} ({ts.daily.length}일)
              </p>
            </div>
            <Link
              href="/analytics?tab=timeseries"
              className="text-xs text-blue-600 hover:underline"
            >
              자세히 보기 →
            </Link>
          </div>
          <DailyChart data={ts.daily} height={220} />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">카테고리별 분포</h2>
          <Link
            href="/analytics?tab=overview"
            className="text-xs text-blue-600 hover:underline"
          >
            더 보기 →
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">카테고리</th>
                <th className="px-3 py-2 font-medium text-right">방송</th>
                <th className="px-3 py-2 font-medium text-right">댓글</th>
                <th className="px-3 py-2 font-medium">비중</th>
              </tr>
            </thead>
            <tbody>
              {s.byCategory.map((c) => (
                <tr
                  key={c.category_id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/categories/${encodeURIComponent(c.category_id)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.category_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNumber(c.broadcast_count)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtNumber(c.comment_count)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{
                          width: `${((c.comment_count ?? 0) / maxCatComments) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold mb-3">상위 채널 (댓글 합산)</h2>
          <ol className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {s.topChannels.map((c, i) => (
              <li
                key={c.broadcaster_id}
                className="flex items-center gap-3 px-3 py-2"
              >
                <span className="w-5 text-slate-400 tabular-nums text-sm">
                  {i + 1}
                </span>
                <Link
                  href={`/channels/${encodeURIComponent(c.broadcaster_id)}`}
                  className="flex-1 truncate text-blue-600 hover:underline"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-slate-500 tabular-nums">
                  방송 {fmtNumber(c.broadcast_count)}
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  💬 {fmtNumber(c.comment_count)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">상위 방송 (댓글 수)</h2>
          <ol className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {s.topBroadcasts.map((b, i) => (
              <li
                key={b.broadcast_id}
                className="flex items-center gap-3 px-3 py-2"
              >
                <span className="w-5 text-slate-400 tabular-nums text-sm">
                  {i + 1}
                </span>
                <Link
                  href={`/broadcasts/${encodeURIComponent(b.broadcast_id)}`}
                  className="flex-1 truncate text-blue-600 hover:underline"
                  title={b.title ?? ""}
                >
                  {b.title || "(제목 없음)"}
                </Link>
                <span className="text-xs text-slate-500 truncate max-w-[120px]">
                  {b.broadcaster_name}
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  💬 {fmtNumber(b.comment_count)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {text && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">상위 단어</h2>
              <Link
                href="/analytics?tab=text"
                className="text-xs text-blue-600 hover:underline"
              >
                자세히 →
              </Link>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-1.5">
              {text.top_words.slice(0, 30).map((w) => (
                <span
                  key={w.word}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800"
                  title={`${w.count.toLocaleString("ko-KR")}회`}
                >
                  {w.word}{" "}
                  <span className="text-blue-500 font-semibold">
                    {fmtNumber(w.count)}
                  </span>
                </span>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">상위 이모지</h2>
              <Link
                href="/analytics?tab=text"
                className="text-xs text-blue-600 hover:underline"
              >
                자세히 →
              </Link>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-1.5">
              {text.top_emojis.slice(0, 20).map((e) => (
                <span
                  key={e.emoji}
                  className="text-sm px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200"
                >
                  {e.emoji}{" "}
                  <span className="text-rose-600 text-xs font-semibold">
                    {fmtNumber(e.count)}
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "bg-blue-50 border-blue-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`text-2xl font-bold tabular-nums ${
          highlight ? "text-blue-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
