import { NextRequest } from "next/server";
import { searchBroadcasts, searchChannels } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const kind = sp.get("kind") ?? "all"; // broadcast | channel | all
  const limit = Math.min(Number(sp.get("limit") ?? 30), 100);
  if (!q) return Response.json({ broadcasts: [], channels: [] });
  const broadcasts = kind === "channel" ? [] : searchBroadcasts(q, limit);
  const channels = kind === "broadcast" ? [] : searchChannels(q, limit);
  return Response.json({ broadcasts, channels });
}
