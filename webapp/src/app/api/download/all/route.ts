import { NextRequest } from "next/server";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { broadcastXlsxBuffer } from "@/lib/export";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function sanitize(name: string | null | undefined): string {
  return (name ?? "broadcast").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const onlyWithComments = url.searchParams.get("with_comments") !== "0";
  const limit = Number(url.searchParams.get("limit") ?? 0); // 0 = unlimited

  const where = onlyWithComments ? "WHERE comment_count > 0" : "";
  const lim = limit > 0 ? `LIMIT ${limit}` : "";
  const rows = getDb()
    .prepare(
      `SELECT broadcast_id, title, category_id, comment_count
       FROM broadcasts ${where}
       ORDER BY comment_count DESC ${lim}`,
    )
    .all() as Array<{
    broadcast_id: string;
    title: string | null;
    category_id: string | null;
    comment_count: number;
  }>;

  const pass = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 1 } });
  archive.on("error", (err: Error) => pass.destroy(err));
  archive.pipe(pass);

  (async () => {
    try {
      // README so the zip is self-describing
      archive.append(
        `prj-lc — Naver Shopping Live broadcast archive\n` +
          `Total broadcasts in this zip: ${rows.length}\n` +
          `Filter: onlyWithComments=${onlyWithComments}, limit=${limit || "none"}\n` +
          `Generated: ${new Date().toISOString()}\n`,
        { name: "README.txt" },
      );
      for (const r of rows) {
        try {
          const buf = await broadcastXlsxBuffer(r.broadcast_id);
          const folder = (r.category_id ?? "uncategorized").replace(":", "-");
          archive.append(buf, {
            name: `${folder}/${r.broadcast_id}_${sanitize(r.title)}.xlsx`,
          });
        } catch (e) {
          archive.append(
            `Error generating ${r.broadcast_id}: ${(e as Error).message}\n`,
            { name: `_errors/${r.broadcast_id}.txt` },
          );
        }
      }
      await archive.finalize();
    } catch (e) {
      pass.destroy(e as Error);
    }
  })();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      pass.on("data", (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      );
      pass.on("end", () => controller.close());
      pass.on("error", (e) => controller.error(e));
    },
    cancel() {
      pass.destroy();
    },
  });

  const filename = `prj-lc_all_${new Date().toISOString().slice(0, 10)}.zip`;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
