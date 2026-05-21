import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannel, listBroadcastsByChannel } from "@/lib/queries";
import { fmtDateTime, fmtNumber, statusBadgeColor } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function ChannelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const sp = await searchParams;
  const channel = getChannel(id);
  if (!channel) notFound();

  const sort = sp.sort === "comment_count" ? "comment_count" : "start_date";
  const page = Math.max(1, Number(sp.page ?? 1));
  const { items, total } = listBroadcastsByChannel({
    broadcasterId: id,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalComments = items.reduce((a, b) => a + (b.comment_count ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-start gap-4">
        {channel.profile_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.profile_url}
            alt=""
            className="w-20 h-20 rounded-full object-cover bg-slate-200"
          />
        )}
        <div className="flex-1">
          <Link href="/channels" className="text-sm text-slate-500 hover:underline">
            ← 채널 목록
          </Link>
          <h1 className="text-2xl font-bold mt-1">{channel.name}</h1>
          <div className="text-sm text-slate-500 space-x-3">
            <span>등급: {channel.grade ?? "-"}</span>
            {channel.channel_url && (
              <a
                href={channel.channel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                원본 채널 →
              </a>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 max-w-md">
            <Stat label="방송" value={fmtNumber(total)} />
            <Stat label="이 페이지 댓글" value={fmtNumber(totalComments)} />
            <Stat label="ID" value={channel.broadcaster_id} small />
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`?sort=start_date`}
          className={`px-3 py-1.5 rounded border ${sort === "start_date" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
        >
          최신순
        </Link>
        <Link
          href={`?sort=comment_count`}
          className={`px-3 py-1.5 rounded border ${sort === "comment_count" ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
        >
          댓글 많은순
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">방송</th>
              <th className="px-3 py-2 font-medium w-32">카테고리</th>
              <th className="px-3 py-2 font-medium w-32">시작</th>
              <th className="px-3 py-2 font-medium w-24">상태</th>
              <th className="px-3 py-2 font-medium w-24 text-right">댓글</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr
                key={b.broadcast_id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
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
                <td className="px-3 py-2 text-slate-600">
                  {b.category_name}
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
                <td colSpan={5} className="px-3 py-12 text-center text-slate-400">
                  방송이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={small ? "text-sm font-semibold" : "text-lg font-bold tabular-nums"}>
        {value}
      </div>
    </div>
  );
}
