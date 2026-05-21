import "server-only";
import ExcelJS from "exceljs";
import {
  getBroadcast,
  getProducts,
  iterateAllComments,
  listBroadcastsByCategory,
} from "./queries";
import type { Broadcast, Comment, Product } from "./types";

export function commentsToCsv(
  broadcast: Broadcast,
  iter: Iterable<Comment[]>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const BOM = "﻿";
  const header =
    "comment_no,broadcast_id,nickname,message,created_at,created_at_milli,comment_type\n";

  function esc(v: unknown): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(BOM + header));
    },
    async pull(controller) {
      for (const chunk of iter) {
        const lines: string[] = [];
        for (const c of chunk) {
          lines.push(
            [
              c.comment_no,
              esc(c.broadcast_id),
              esc(c.nickname),
              esc(c.message),
              esc(c.created_at),
              c.created_at_milli ?? "",
              esc(c.comment_type),
            ].join(","),
          );
        }
        controller.enqueue(encoder.encode(lines.join("\n") + "\n"));
      }
      controller.close();
    },
  });
}

/** Build an xlsx workbook for a single broadcast (meta + products + comments). */
export async function broadcastXlsxBuffer(
  broadcastId: string,
): Promise<Buffer> {
  const b = getBroadcast(broadcastId);
  if (!b) throw new Error(`broadcast ${broadcastId} not found`);
  const products = getProducts(broadcastId);

  const wb = new ExcelJS.Workbook();
  wb.creator = "prj-lc";
  wb.created = new Date();

  // Meta
  const meta = wb.addWorksheet("broadcast");
  meta.columns = [
    { header: "field", key: "f", width: 20 },
    { header: "value", key: "v", width: 80 },
  ];
  for (const [k, v] of Object.entries(b)) {
    meta.addRow({ f: k, v: v ?? "" });
  }

  // Products
  const ps = wb.addWorksheet("products");
  ps.columns = [
    { header: "product_no", key: "product_no", width: 15 },
    { header: "name", key: "name", width: 40 },
    { header: "brand_name", key: "brand_name", width: 20 },
    { header: "mall_name", key: "mall_name", width: 20 },
    { header: "price", key: "price", width: 12 },
    { header: "sale_price", key: "sale_price", width: 12 },
    { header: "discount_rate", key: "discount_rate", width: 12 },
    { header: "product_url", key: "product_url", width: 60 },
  ];
  products.forEach((p: Product) => ps.addRow(p));

  // Comments (streamed in memory; bounded by broadcast size — handled separately for huge ones)
  const cs = wb.addWorksheet("comments");
  cs.columns = [
    { header: "comment_no", key: "comment_no", width: 12 },
    { header: "nickname", key: "nickname", width: 16 },
    { header: "message", key: "message", width: 60 },
    { header: "created_at", key: "created_at", width: 22 },
    { header: "created_at_milli", key: "created_at_milli", width: 14 },
  ];
  for (const batch of iterateAllComments(broadcastId, 5000)) {
    for (const c of batch) cs.addRow(c);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type CategoryStream = {
  broadcasts: Broadcast[];
};

export function listCategoryBroadcastsAll(categoryId: string): Broadcast[] {
  // No limit; we'll iterate in chunks of 200 for memory friendliness.
  const out: Broadcast[] = [];
  let offset = 0;
  while (true) {
    const { items } = listBroadcastsByCategory({
      categoryId,
      sort: "start_date",
      limit: 200,
      offset,
    });
    if (items.length === 0) break;
    out.push(...items);
    if (items.length < 200) break;
    offset += 200;
  }
  return out;
}
