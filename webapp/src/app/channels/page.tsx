import Link from "next/link";
import { listChannels } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sort =
    sp.sort === "broadcast_count"
      ? "broadcast_count"
      : sp.sort === "name"
        ? "name"
        : "comment_count";
  const page = Math.max(1, Number(sp.page ?? 1));
  const { items, total } = listChannels({
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">채널</h1>
          <p className="text-sm text-slate-500">
            전체 {fmtNumber(total)}개
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {(
            [
              ["comment_count", "댓글 많은순"],
              ["broadcast_count", "방송 많은순"],
              ["name", "이름순"],
            ] as const
          ).map(([s, label]) => (
            <Link
              key={s}
              href={`?sort=${s}`}
              className={`px-3 py-1.5 rounded border ${sort === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-100"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </header>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-2 font-medium w-12">#</th>
              <th className="px-3 py-2 font-medium">채널</th>
              <th className="px-3 py-2 font-medium w-20 text-right">방송</th>
              <th className="px-3 py-2 font-medium w-28 text-right">댓글합</th>
              <th className="px-3 py-2 font-medium w-20">등급</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c, i) => (
              <tr
                key={c.broadcaster_id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-3 py-2 text-slate-400 tabular-nums">
                  {(page - 1) * PAGE_SIZE + i + 1}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/channels/${encodeURIComponent(c.broadcaster_id)}`}
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    {c.profile_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.profile_url}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover bg-slate-200"
                      />
                    )}
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNumber(c.broadcast_count ?? 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {fmtNumber(c.comment_count ?? 0)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{c.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} sort={sort} />
    </div>
  );
}

function Pager({
  page,
  totalPages,
  sort,
}: {
  page: number;
  totalPages: number;
  sort: string;
}) {
  const mk = (p: number) => `?sort=${sort}&page=${p}`;
  return (
    <div className="flex items-center justify-center gap-1 text-sm">
      {page > 1 && (
        <Link
          href={mk(page - 1)}
          className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100"
        >
          ←
        </Link>
      )}
      <span className="px-3 py-1.5 text-slate-600">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={mk(page + 1)}
          className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100"
        >
          →
        </Link>
      )}
    </div>
  );
}
