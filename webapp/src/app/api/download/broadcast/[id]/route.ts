import { NextRequest } from "next/server";
import { broadcastXlsxBuffer, commentsToCsv } from "@/lib/export";
import { getBroadcast, iterateAllComments } from "@/lib/queries";

export const runtime = "nodejs";

function sanitize(name: string | null | undefined): string {
  return (name ?? "broadcast").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const decoded = decodeURIComponent(raw);
  const m = /^(.+?)\.(csv|xlsx)$/i.exec(decoded);
  if (!m) return new Response("expected .csv or .xlsx suffix", { status: 400 });
  const broadcastId = m[1];
  const ext = m[2].toLowerCase();
  const b = getBroadcast(broadcastId);
  if (!b) return new Response("broadcast not found", { status: 404 });

  const safe = `${broadcastId}_${sanitize(b.title)}`;

  if (ext === "csv") {
    const stream = commentsToCsv(b, iterateAllComments(broadcastId, 5000));
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe)}.csv`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buf = await broadcastXlsxBuffer(broadcastId);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe)}.xlsx`,
      "Cache-Control": "no-store",
    },
  });
}
