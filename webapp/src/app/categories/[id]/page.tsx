import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, listBroadcastsByCategory } from "@/lib/queries";
import { fmtDateTime, fmtNumber, statusBadgeColor } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
    shortclips?: string;
  }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const sp = await searchParams;
  const cat = getCategory(id);
  if (!cat) {
    console.warn(`[categories/[id]] not found: rawId=${rawId} decoded=${id}`);
    notFound();
  }

  const sort = sp.sort === "start_date" ? "start_date" : "comment_count";
  const page = Math.max(1, Number(sp.page ?? 1));
  const excludeShortclips = sp.shortclips !== "include";
  const { items, total } = listBroadcastsByCategory({
    categoryId: id,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    excludeShortclips,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sortHref = (s: string) =>
    `?sort=${s}` +
    (sp.shortclips === "include" ? "&shortclips=include" : "");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/categories" className="text-sm text-slate-500 hover:underline">
            ← 카테고리
          </Link>
          <h1 className="text-2xl font-bold mt-1">{cat.name}</h1>
          <p className="text-sm text-slate-500">
            방송 {fmtNumber(total)}건 (정렬: {sort === "comment_count" ? "댓글 많은순" : "최신순"})
          </p>
          <a
            href={`/api/download/category/${encodeURIComponent(id)}.zip?with_comments=1`}
            className="inline-block mt-2 text-xs px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            ⬇ 이 카테고리의 댓글 보유 방송 일괄 다운로드 (xlsx zip)
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={sortHref("comment_count")}
            className={`px-3 py-1.5 rounded border ${sort === "comment_count" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
          >
            댓글 많은순
          </Link>
          <Link
            href={sortHref("start_date")}
            className={`px-3 py-1.5 rounded border ${sort === "start_date" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
          >
            최신순
          </Link>
          <Link
            href={`?sort=${sort}${excludeShortclips ? "&shortclips=include" : ""}`}
            className={`px-3 py-1.5 rounded border ${excludeShortclips ? "border-slate-200 hover:bg-slate-100" : "bg-slate-700 text-white border-slate-700"}`}
          >
            {excludeShortclips ? "숏클립 포함" : "숏클립 제외"}
          </Link>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 font-medium w-12">#</th>
              <th className="px-3 py-2 font-medium">방송</th>
              <th className="px-3 py-2 font-medium w-40">채널</th>
              <th className="px-3 py-2 font-medium w-32">시작</th>
              <th className="px-3 py-2 font-medium w-24">상태</th>
              <th className="px-3 py-2 font-medium w-24 text-right">댓글</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b, i) => (
              <tr
                key={b.broadcast_id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2 text-slate-400 tabular-nums">
                  {(page - 1) * PAGE_SIZE + i + 1}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/broadcasts/${encodeURIComponent(b.broadcast_id)}`}
                    className="text-blue-600 hover:underline line-clamp-1"
                    title={b.title ?? ""}
                  >
                    {b.is_shortclip ? "▶ " : ""}
                    {b.title || "(제목 없음)"}
                  </Link>
                </td>
                <td className="px-3 py-2 truncate">
                  {b.broadcaster_id ? (
                    <Link
                      href={`/channels/${encodeURIComponent(b.broadcaster_id)}`}
                      className="text-slate-700 hover:underline"
                    >
                      {b.broadcaster_name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">{b.broadcaster_name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  {fmtDateTime(b.start_date)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(b.status)}`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {fmtNumber(b.comment_count)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                  방송이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={totalPages} sort={sort} shortclips={!excludeShortclips} />
    </div>
  );
}

function Pager({
  page,
  totalPages,
  sort,
  shortclips,
}: {
  page: number;
  totalPages: number;
  sort: string;
  shortclips: boolean;
}) {
  const mk = (p: number) =>
    `?sort=${sort}&page=${p}${shortclips ? "&shortclips=include" : ""}`;
  const around = [page - 2, page - 1, page, page + 1, page + 2].filter(
    (p) => p >= 1 && p <= totalPages
  );
  return (
    <div className="flex items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link href={mk(page - 1)} className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100">
          ←
        </Link>
      )}
      {around[0] !== 1 && (
        <>
          <Link href={mk(1)} className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100">
            1
          </Link>
          {around[0] > 2 && <span className="text-slate-400">…</span>}
        </>
      )}
      {around.map((p) => (
        <Link
          key={p}
          href={mk(p)}
          className={`px-3 py-1.5 rounded border ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
        >
          {p}
        </Link>
      ))}
      {around[around.length - 1] !== totalPages && (
        <>
          {around[around.length - 1] < totalPages - 1 && (
            <span className="text-slate-400">…</span>
          )}
          <Link href={mk(totalPages)} className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100">
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link href={mk(page + 1)} className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100">
          →
        </Link>
      )}
    </div>
  );
}
