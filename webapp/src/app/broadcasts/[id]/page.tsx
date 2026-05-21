import Link from "next/link";
import { notFound } from "next/navigation";
import CommentTimeline from "@/components/CommentTimeline";
import {
  getBroadcast,
  getCommentsPage,
  getProducts,
} from "@/lib/queries";
import { fmtDateTime, fmtNumber, statusBadgeColor } from "@/lib/format";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const b = getBroadcast(id);
  if (!b) notFound();

  const firstPage = getCommentsPage({ broadcastId: id, cursor: 0, limit: 200 });
  const products = getProducts(id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4 min-w-0">
        <header className="space-y-2">
          <div className="text-sm text-slate-500 flex items-center gap-2">
            {b.category_id && (
              <Link
                href={`/categories/${encodeURIComponent(b.category_id)}`}
                className="hover:underline"
              >
                {b.category_name}
              </Link>
            )}
            {b.broadcaster_id && (
              <>
                <span>·</span>
                <Link
                  href={`/channels/${encodeURIComponent(b.broadcaster_id)}`}
                  className="hover:underline"
                >
                  {b.broadcaster_name}
                </Link>
              </>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded ${statusBadgeColor(b.status)}`}
            >
              {b.status}
            </span>
            {b.is_shortclip ? (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                shortclip
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold leading-snug">
            {b.title || "(제목 없음)"}
          </h1>
          {b.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {b.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>방송 ID {b.broadcast_id}</span>
            <span>시작 {fmtDateTime(b.start_date)}</span>
            <span>종료 {fmtDateTime(b.end_date)}</span>
            <span className="text-slate-900 font-semibold">
              💬 {fmtNumber(b.comment_count)}
            </span>
            {b.viewer_url && (
              <a
                href={b.viewer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-blue-600 hover:underline"
              >
                원본 방송 →
              </a>
            )}
          </div>
        </header>

        <DownloadBar broadcastId={b.broadcast_id} commentCount={b.comment_count} />

        <CommentTimeline
          broadcastId={b.broadcast_id}
          initialItems={firstPage.items}
          initialCursor={firstPage.nextCursor}
          total={firstPage.total}
        />
      </div>

      <aside className="space-y-4 min-w-0">
        {b.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.thumbnail_url}
            alt=""
            className="w-full aspect-video object-cover rounded-lg border border-slate-200 bg-slate-100"
          />
        )}
        <section>
          <h2 className="font-bold mb-2">상품 ({products.length})</h2>
          <ol className="space-y-2">
            {products.map((p) => (
              <li
                key={`${p.broadcast_id}-${p.product_no}`}
                className="flex gap-2 bg-white border border-slate-200 rounded p-2"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-14 h-14 object-cover rounded bg-slate-100 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={p.product_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium line-clamp-2 hover:underline"
                  >
                    {p.name}
                  </a>
                  <div className="text-xs text-slate-500">{p.brand_name}</div>
                  <div className="text-sm font-semibold tabular-nums">
                    {fmtNumber(p.sale_price ?? p.price)}원
                    {p.discount_rate && p.discount_rate > 0 && (
                      <span className="ml-2 text-xs text-red-500">
                        {Math.round(p.discount_rate)}%↓
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {products.length === 0 && (
              <li className="text-sm text-slate-400 px-2 py-4 text-center">
                연결된 상품이 없습니다.
              </li>
            )}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function DownloadBar({
  broadcastId,
  commentCount,
}: {
  broadcastId: string;
  commentCount: number;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between text-sm">
      <div className="text-blue-900">
        이 방송의 댓글 <strong>{fmtNumber(commentCount)}</strong>건 다운로드
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/api/download/broadcast/${encodeURIComponent(broadcastId)}.csv`}
          className="px-3 py-1.5 rounded bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          CSV
        </a>
        <a
          href={`/api/download/broadcast/${encodeURIComponent(broadcastId)}.xlsx`}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Excel (xlsx)
        </a>
      </div>
    </div>
  );
}
