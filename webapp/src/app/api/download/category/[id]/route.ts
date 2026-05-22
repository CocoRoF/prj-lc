import { NextRequest } from "next/server";
import { PassThrough } from "node:stream";
import { broadcastXlsxBuffer, listCategoryBroadcastsAll } from "@/lib/export";
import { getCategory } from "@/lib/queries";

export const runtime = "nodejs";

// archiver v8 ESM exports ZipArchive as a class; @types/archiver v7 lags
// behind. Pull the real runtime class via dynamic import + cast. See
// app/api/download/all/route.ts for the full rationale.
interface ArchiverLike {
  on(event: "error", cb: (err: Error) => void): this;
  pipe<T extends NodeJS.WritableStream>(dest: T): T;
  append(
    source: Buffer | string | NodeJS.ReadableStream,
    data: { name: string },
  ): this;
  finalize(): Promise<void>;
}
type ZipArchiveCtor = new (options?: {
  zlib?: { level?: number };
}) => ArchiverLike;

function sanitize(name: string | null | undefined): string {
  return (name ?? "category").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await ctx.params;
  const decoded = decodeURIComponent(raw);
  const m = /^(.+?)\.zip$/i.exec(decoded);
  if (!m) return new Response("expected .zip suffix", { status: 400 });
  const categoryId = m[1];
  const cat = getCategory(categoryId);
  if (!cat) return new Response("category not found", { status: 404 });

  const url = new URL(req.url);
  const onlyWithComments = url.searchParams.get("with_comments") === "1";
  const limit = Number(url.searchParams.get("limit") ?? 0);

  let broadcasts = listCategoryBroadcastsAll(categoryId);
  if (onlyWithComments) {
    broadcasts = broadcasts.filter((b) => (b.comment_count ?? 0) > 0);
  }
  // Order by comment_count desc so 'limit' yields the most interesting subset
  broadcasts.sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0));
  if (limit > 0) broadcasts = broadcasts.slice(0, limit);

  const safe = sanitize(cat.name) + "_" + categoryId.replace(":", "-");

  const { ZipArchive } = (await import("archiver")) as unknown as {
    ZipArchive: ZipArchiveCtor;
  };

  const pass = new PassThrough();
  const archive = new ZipArchive({ zlib: { level: 1 } });
  archive.on("error", (err: Error) => pass.destroy(err));
  archive.pipe(pass);

  // Build the archive in the background — each broadcast's xlsx is appended as it's built.
  (async () => {
    try {
      for (const b of broadcasts) {
        try {
          const buf = await broadcastXlsxBuffer(b.broadcast_id);
          const fname = `${b.broadcast_id}_${sanitize(b.title)}.xlsx`;
          archive.append(buf, { name: fname });
        } catch (e) {
          archive.append(
            `Error generating ${b.broadcast_id}: ${(e as Error).message}\n`,
            { name: `_error_${b.broadcast_id}.txt` },
          );
        }
      }
      await archive.finalize();
    } catch (e) {
      pass.destroy(e as Error);
    }
  })();

  const stream = nodeStreamToWeb(pass);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safe)}.zip`,
      "Cache-Control": "no-store",
    },
  });
}

function nodeStreamToWeb(s: PassThrough): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      s.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      s.on("end", () => controller.close());
      s.on("error", (e) => controller.error(e));
    },
    cancel() {
      s.destroy();
    },
  });
}
