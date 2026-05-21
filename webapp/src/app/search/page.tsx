import Link from "next/link";
import { searchBroadcasts, searchChannels } from "@/lib/queries";
import { fmtDateTime, fmtNumber } from "@/lib/format";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const broadcasts = q ? searchBroadcasts(q, 30) : [];
  const channels = q ? searchChannels(q, 30) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">검색</h1>
      <form className="flex gap-2" action="/search" method="get">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="방송 제목·설명 또는 채널명…"
          className="flex-1 px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 bg-white"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          검색
        </button>
      </form>

      {!q && (
        <p className="text-sm text-slate-500">
          ※ 3자 이상은 trigram 풀텍스트, 2자 이하는 LIKE 부분일치로 검색합니다.
        </p>
      )}

      {q && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section>
            <h2 className="font-bold mb-2">
              방송 ({fmtNumber(broadcasts.length)})
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {broadcasts.map((b) => (
                <Link
                  key={b.broadcast_id}
                  href={`/broadcasts/${encodeURIComponent(b.broadcast_id)}`}
                  className="block px-3 py-2 hover:bg-slate-50"
                >
                  <div className="font-medium line-clamp-1">{b.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{b.broadcaster_name}</span>
                    <span>·</span>
                    <span>{fmtDateTime(b.start_date)}</span>
                    <span className="ml-auto font-semibold text-slate-700 tabular-nums">
                      💬 {fmtNumber(b.comment_count)}
                    </span>
                  </div>
                </Link>
              ))}
              {broadcasts.length === 0 && (
                <div className="px-3 py-8 text-center text-slate-400 text-sm">
                  매칭된 방송이 없습니다.
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-bold mb-2">
              채널 ({fmtNumber(channels.length)})
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {channels.map((c) => (
                <Link
                  key={c.broadcaster_id}
                  href={`/channels/${encodeURIComponent(c.broadcaster_id)}`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                >
                  {c.profile_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.profile_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-slate-200"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.grade ?? ""}
                    </div>
                  </div>
                </Link>
              ))}
              {channels.length === 0 && (
                <div className="px-3 py-8 text-center text-slate-400 text-sm">
                  매칭된 채널이 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
