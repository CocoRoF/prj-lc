"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { fmtNumber } from "@/lib/format";
import type { Comment } from "@/lib/types";

type Props = {
  broadcastId: string;
  initialItems: Comment[];
  initialCursor: number | null;
  total: number;
};

function fmtElapsed(ms: number | null | undefined): string {
  if (ms == null) return "";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CommentTimeline({
  broadcastId,
  initialItems,
  initialCursor,
  total,
}: Props) {
  const [items, setItems] = useState<Comment[]>(initialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialCursor === null);
  const virtuoso = useRef<VirtuosoHandle>(null);
  const inFlight = useRef(false);

  const loadMore = useCallback(async () => {
    if (done || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const url = `/api/comments?bid=${encodeURIComponent(broadcastId)}&cursor=${cursor ?? 0}&limit=500`;
      const r = await fetch(url);
      const j = (await r.json()) as {
        items: Comment[];
        nextCursor: number | null;
      };
      setItems((prev) => [...prev, ...j.items]);
      setCursor(j.nextCursor);
      if (j.nextCursor === null || j.items.length === 0) setDone(true);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [broadcastId, cursor, done]);

  // Auto-load until first viewport is comfortable
  useEffect(() => {
    if (items.length < 50 && !done) loadMore();
  }, [items.length, done, loadMore]);

  return (
    <div className="flex flex-col h-[70vh] bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 text-sm">
        <div>
          <span className="font-semibold">댓글 타임라인</span>
          <span className="ml-2 text-slate-500">
            로드 {fmtNumber(items.length)} / 전체 {fmtNumber(total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!done && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "로딩…" : "더 보기"}
            </button>
          )}
          <button
            type="button"
            onClick={() => virtuoso.current?.scrollToIndex({ index: 0 })}
            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100"
          >
            맨 처음
          </button>
          <button
            type="button"
            onClick={() =>
              virtuoso.current?.scrollToIndex({ index: items.length - 1 })
            }
            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100"
          >
            맨 끝
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          이 방송엔 댓글이 없습니다.
        </div>
      ) : (
        <Virtuoso
          ref={virtuoso}
          data={items}
          endReached={loadMore}
          increaseViewportBy={400}
          itemContent={(_, c) => (
            <Row
              key={c.comment_no}
              nickname={c.nickname}
              message={c.message}
              elapsed={c.created_at_milli}
            />
          )}
        />
      )}
    </div>
  );
}

function Row({
  nickname,
  message,
  elapsed,
}: {
  nickname: string | null;
  message: string | null;
  elapsed: number | null;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-slate-50 text-sm flex gap-3">
      <span className="text-xs tabular-nums text-slate-400 w-16 shrink-0 pt-0.5">
        {fmtElapsed(elapsed)}
      </span>
      <span className="font-semibold text-slate-700 w-28 truncate shrink-0">
        {nickname || "(익명)"}
      </span>
      <span className="flex-1 break-words whitespace-pre-wrap text-slate-800">
        {message}
      </span>
    </div>
  );
}
