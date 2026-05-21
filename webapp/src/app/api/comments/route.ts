import { NextRequest } from "next/server";
import { getCommentsPage } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bid = sp.get("bid");
  if (!bid) return Response.json({ error: "missing bid" }, { status: 400 });
  const cursor = Number(sp.get("cursor") ?? 0);
  const limit = Number(sp.get("limit") ?? 200);
  const page = getCommentsPage({ broadcastId: bid, cursor, limit });
  return Response.json(page);
}
