import Link from "next/link";
import DailyChart from "@/components/charts/DailyChart";
import Heatmap from "@/components/charts/Heatmap";
import HBarChart from "@/components/charts/HBarChart";
import VBarChart from "@/components/charts/VBarChart";
import {
  loadCategoryStats,
  loadChannelStats,
  loadOverview,
  loadProductStats,
  loadStatusDist,
  loadTextStats,
  loadTimeSeries,
  loadTopUsers,
} from "@/lib/analytics";
import { fmtNumber } from "@/lib/format";
import { withBasePath } from "@/lib/paths";

type Tab = "overview" | "timeseries" | "text" | "reports";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "timeseries", label: "시계열" },
  { key: "text", label: "텍스트 분석" },
  { key: "reports", label: "f2a 리포트" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ??
    "overview") as Tab;

  const [overview, cats, chans, statusDist, prods, users, ts, text] =
    await Promise.all([
      loadOverview(),
      loadCategoryStats(),
      loadChannelStats(),
      loadStatusDist(),
      loadProductStats(),
      loadTopUsers(),
      loadTimeSeries(),
      loadTextStats(),
    ]);

  if (!overview) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">분석 데이터가 없습니다</h1>
        <p className="text-sm text-slate-500 mt-2">
          <code>python etl/analytics.py</code> 를 먼저 실행하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">분석</h1>
        <p className="text-xs text-slate-500 mt-1">
          생성 시각 {overview.generated_at} · 텍스트 분석은 댓글 {fmtNumber(text?.sampled ?? 0)}건 샘플
        </p>
      </header>

      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            className={`px-4 py-2 text-sm rounded-t -mb-px border-b-2 ${
              t.key === tab
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <OverviewTab
          overview={overview}
          cats={cats ?? []}
          chans={chans ?? []}
          statusDist={statusDist ?? []}
          prods={prods}
          users={users ?? []}
        />
      )}
      {tab === "timeseries" && ts && <TimeseriesTab ts={ts} />}
      {tab === "text" && text && <TextTab text={text} />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}

function OverviewTab({
  overview,
  cats,
  chans,
  statusDist,
  prods,
  users,
}: {
  overview: NonNullable<Awaited<ReturnType<typeof loadOverview>>>;
  cats: NonNullable<Awaited<ReturnType<typeof loadCategoryStats>>>;
  chans: NonNullable<Awaited<ReturnType<typeof loadChannelStats>>>;
  statusDist: NonNullable<Awaited<ReturnType<typeof loadStatusDist>>>;
  prods: Awaited<ReturnType<typeof loadProductStats>>;
  users: NonNullable<Awaited<ReturnType<typeof loadTopUsers>>>;
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="카테고리" value={fmtNumber(overview.totals.categories)} />
        <Kpi label="채널" value={fmtNumber(overview.totals.channels)} />
        <Kpi label="방송" value={fmtNumber(overview.totals.broadcasts)} />
        <Kpi label="숏클립" value={fmtNumber(overview.totals.shortclips)} />
        <Kpi label="상품" value={fmtNumber(overview.totals.products)} />
        <Kpi
          label="댓글"
          value={fmtNumber(overview.totals.comments)}
          highlight
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="방송당 댓글 평균" value={fmtNumber(overview.comment_count_dist.avg)} />
        <Stat
          label="방송당 댓글 중앙값"
          value={fmtNumber(overview.comment_count_dist.median)}
        />
        <Stat label="최다 댓글 방송" value={fmtNumber(overview.comment_count_dist.max)} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="카테고리별 댓글 분포">
          <HBarChart
            data={cats.map((c) => ({ label: c.name, value: c.comments }))}
            height={320}
            color="#3b82f6"
          />
        </Card>
        <Card title="카테고리별 방송 수 (숏클립 vs 일반)">
          <div className="space-y-2 text-sm">
            {cats.map((c) => {
              const total = c.broadcasts || 1;
              const sc = (c.shortclips / total) * 100;
              return (
                <div key={c.category_id} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-500">
                      방송 {fmtNumber(c.broadcasts_only)} · 숏클립 {fmtNumber(c.shortclips)}
                    </span>
                  </div>
                  <div className="flex w-full h-3 rounded overflow-hidden bg-slate-100">
                    <div className="bg-blue-500" style={{ width: `${100 - sc}%` }} />
                    <div className="bg-purple-400" style={{ width: `${sc}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="상위 채널 (댓글 합산)">
          <HBarChart
            data={chans
              .slice(0, 15)
              .map((c) => ({ label: c.name, value: c.comments }))}
            height={420}
            color="#10b981"
          />
        </Card>
        <Card title="상위 활동 시청자 (댓글 작성 수)">
          <HBarChart
            data={users
              .slice(0, 15)
              .map((u) => ({ label: u.nickname, value: u.count }))}
            height={420}
            color="#f59e0b"
          />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="카테고리 × 상태 분포">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">카테고리</th>
                  {Array.from(
                    new Set(
                      statusDist.flatMap((c) => Object.keys(c.statuses)),
                    ),
                  )
                    .sort()
                    .map((s) => (
                      <th key={s} className="text-right px-2 py-1">
                        {s}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {statusDist.map((c) => {
                  const allKeys = Array.from(
                    new Set(statusDist.flatMap((x) => Object.keys(x.statuses))),
                  ).sort();
                  return (
                    <tr key={c.category_id} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-medium">{c.name}</td>
                      {allKeys.map((s) => (
                        <td
                          key={s}
                          className="px-2 py-1 text-right tabular-nums text-slate-700"
                        >
                          {fmtNumber(c.statuses[s] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="상품 통계">
          {prods ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="전체 상품" value={fmtNumber(prods.total)} />
                <MiniStat
                  label="상품 보유 방송"
                  value={fmtNumber(prods.broadcasts_with_products)}
                />
                <MiniStat
                  label="평균 정가"
                  value={`${fmtNumber(prods.avg_price)}원`}
                />
                <MiniStat
                  label="평균 할인가"
                  value={`${fmtNumber(prods.avg_sale_price)}원`}
                />
                <MiniStat
                  label="평균 할인율"
                  value={`${prods.avg_discount_rate.toFixed(1)}%`}
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">상위 브랜드</div>
                <div className="flex flex-wrap gap-1.5">
                  {prods.top_brands.slice(0, 20).map((b) => (
                    <span
                      key={b.name}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200"
                    >
                      {b.name} <span className="text-slate-500">×{b.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">데이터 없음</div>
          )}
        </Card>
      </section>
    </div>
  );
}

function TimeseriesTab({
  ts,
}: {
  ts: NonNullable<Awaited<ReturnType<typeof loadTimeSeries>>>;
}) {
  return (
    <div className="space-y-4">
      <Card title="일별 댓글 추이">
        <p className="text-xs text-slate-500 mb-2">
          {ts.daily[0]?.day} – {ts.daily[ts.daily.length - 1]?.day} ({ts.daily.length}일)
        </p>
        <DailyChart data={ts.daily} height={320} />
      </Card>
      <Card title="요일 × 시간대 히트맵 (KST)">
        <p className="text-xs text-slate-500 mb-2">댓글 작성 시각 분포</p>
        <Heatmap matrix={ts.heatmap} />
      </Card>
    </div>
  );
}

function TextTab({
  text,
}: {
  text: NonNullable<Awaited<ReturnType<typeof loadTextStats>>>;
}) {
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="상위 단어 (TOP 30)">
          <HBarChart
            data={text.top_words
              .slice(0, 30)
              .map((w) => ({ label: w.word, value: w.count }))}
            height={620}
            color="#0ea5e9"
          />
        </Card>
        <Card title="상위 이모지 (TOP 30)">
          <HBarChart
            data={text.top_emojis
              .slice(0, 30)
              .map((e) => ({ label: e.emoji, value: e.count }))}
            height={620}
            color="#ef4444"
          />
        </Card>
      </section>
      <Card title="댓글 길이 분포 (문자 수)">
        <VBarChart
          data={text.length_histogram.map((h) => ({
            label: h.range,
            value: h.count,
          }))}
          height={280}
          color="#6366f1"
        />
      </Card>
    </div>
  );
}

function ReportsTab() {
  const reports = [
    {
      key: "broadcasts",
      label: "broadcasts",
      desc: "방송 메타: 카테고리·상태·상품 수와의 상관 관계, PCA, 클러스터링",
    },
    {
      key: "channels",
      label: "channels",
      desc: "채널: 등급 분포 + 이름·계정 텍스트 특성",
    },
    {
      key: "broadcast_products",
      label: "broadcast_products",
      desc: "상품: 가격·할인율·브랜드·몰 분포와 상관",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {reports.map((r) => (
        <a
          key={r.key}
          href={withBasePath(`/analytics/reports/${r.key}/index.html`)}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold">{r.label}</span>
            <span className="text-xs text-slate-400">f2a HTML ↗</span>
          </div>
          <p className="text-xs text-slate-600">{r.desc}</p>
        </a>
      ))}
    </div>
  );
}

function Kpi({
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
        className={`text-xl font-bold tabular-nums ${
          highlight ? "text-blue-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="font-bold mb-3">{title}</h3>
      {children}
    </div>
  );
}
