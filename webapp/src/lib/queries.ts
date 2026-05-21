import "server-only";
import { getDb } from "./db";
import type {
  Broadcast,
  Category,
  Channel,
  Comment,
  Product,
} from "./types";

export function listCategories(): Category[] {
  return getDb()
    .prepare(
      `SELECT category_id, name, nclick_code, thumbnail_url, icon_url
       FROM categories ORDER BY category_id`
    )
    .all() as Category[];
}

export function getCategory(id: string): Category | null {
  return (
    (getDb()
      .prepare(
        `SELECT category_id, name, nclick_code, thumbnail_url, icon_url
         FROM categories WHERE category_id = ?`
      )
      .get(id) as Category | undefined) ?? null
  );
}

export function getChannel(id: string): Channel | null {
  return (
    (getDb()
      .prepare(
        `SELECT broadcaster_id, name, account_no, profile_url, channel_url,
                grade, description
         FROM channels WHERE broadcaster_id = ?`
      )
      .get(id) as Channel | undefined) ?? null
  );
}

export function getBroadcast(id: string): Broadcast | null {
  return (
    (getDb()
      .prepare(
        `SELECT b.broadcast_id, b.category_id, b.broadcaster_id,
                ch.name AS broadcaster_name,
                cat.name AS category_name,
                b.title, b.description, b.status, b.start_date, b.end_date,
                b.viewer_url, b.thumbnail_url, b.product_count, b.is_shortclip,
                b.comment_count
         FROM broadcasts b
         LEFT JOIN channels ch  ON ch.broadcaster_id = b.broadcaster_id
         LEFT JOIN categories cat ON cat.category_id = b.category_id
         WHERE b.broadcast_id = ?`
      )
      .get(id) as Broadcast | undefined) ?? null
  );
}

export type BroadcastListSort = "comment_count" | "start_date";

export function listBroadcastsByCategory(args: {
  categoryId: string;
  sort?: BroadcastListSort;
  limit?: number;
  offset?: number;
  excludeShortclips?: boolean;
}): { items: Broadcast[]; total: number } {
  const sort = args.sort ?? "comment_count";
  const limit = Math.min(args.limit ?? 50, 200);
  const offset = args.offset ?? 0;
  const orderBy =
    sort === "start_date"
      ? "COALESCE(b.start_date, '') DESC"
      : "b.comment_count DESC";
  const where: string[] = ["b.category_id = ?"];
  const params: unknown[] = [args.categoryId];
  if (args.excludeShortclips) {
    where.push("(b.is_shortclip IS NULL OR b.is_shortclip = 0)");
  }
  const w = where.join(" AND ");
  const items = getDb()
    .prepare(
      `SELECT b.broadcast_id, b.category_id, b.broadcaster_id,
              ch.name AS broadcaster_name,
              b.title, b.status, b.start_date, b.end_date,
              b.viewer_url, b.thumbnail_url, b.product_count, b.is_shortclip,
              b.comment_count
       FROM broadcasts b
       LEFT JOIN channels ch ON ch.broadcaster_id = b.broadcaster_id
       WHERE ${w}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Broadcast[];
  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM broadcasts b WHERE ${w}`)
      .get(...params) as { n: number }
  ).n;
  return { items, total };
}

export function listBroadcastsByChannel(args: {
  broadcasterId: string;
  sort?: BroadcastListSort;
  limit?: number;
  offset?: number;
}): { items: Broadcast[]; total: number } {
  const sort = args.sort ?? "start_date";
  const limit = Math.min(args.limit ?? 50, 200);
  const offset = args.offset ?? 0;
  const orderBy =
    sort === "comment_count"
      ? "b.comment_count DESC"
      : "COALESCE(b.start_date, '') DESC";
  const items = getDb()
    .prepare(
      `SELECT b.broadcast_id, b.category_id, b.broadcaster_id,
              cat.name AS category_name,
              b.title, b.status, b.start_date, b.end_date,
              b.viewer_url, b.thumbnail_url, b.product_count, b.is_shortclip,
              b.comment_count
       FROM broadcasts b
       LEFT JOIN categories cat ON cat.category_id = b.category_id
       WHERE b.broadcaster_id = ?
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(args.broadcasterId, limit, offset) as Broadcast[];
  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM broadcasts WHERE broadcaster_id = ?`)
      .get(args.broadcasterId) as { n: number }
  ).n;
  return { items, total };
}

export function listChannels(args: {
  sort?: "comment_count" | "broadcast_count" | "name";
  limit?: number;
  offset?: number;
}): { items: Channel[]; total: number } {
  const sort = args.sort ?? "comment_count";
  const limit = Math.min(args.limit ?? 50, 200);
  const offset = args.offset ?? 0;
  const orderBy =
    sort === "name"
      ? "ch.name COLLATE NOCASE ASC"
      : sort === "broadcast_count"
        ? "broadcast_count DESC"
        : "comment_count DESC";
  const items = getDb()
    .prepare(
      `SELECT ch.broadcaster_id, ch.name, ch.account_no, ch.profile_url,
              ch.channel_url, ch.grade, ch.description,
              COALESCE(s.broadcast_count, 0) AS broadcast_count,
              COALESCE(s.comment_count, 0)   AS comment_count
       FROM channels ch
       LEFT JOIN (
         SELECT broadcaster_id, COUNT(*) AS broadcast_count,
                SUM(comment_count) AS comment_count
         FROM broadcasts GROUP BY broadcaster_id
       ) s ON s.broadcaster_id = ch.broadcaster_id
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Channel[];
  const total = (
    getDb().prepare("SELECT COUNT(*) AS n FROM channels").get() as { n: number }
  ).n;
  return { items, total };
}

export function getProducts(broadcastId: string): Product[] {
  return getDb()
    .prepare(
      `SELECT broadcast_id, product_no, name, brand_name, mall_name,
              image_url, price, sale_price, discount_rate, product_url
       FROM broadcast_products WHERE broadcast_id = ?
       ORDER BY is_represent DESC, product_no`
    )
    .all(broadcastId) as Product[];
}

export function getCommentsPage(args: {
  broadcastId: string;
  cursor?: number; // commentNo cursor; rows returned have comment_no > cursor
  limit?: number;
}): { items: Comment[]; nextCursor: number | null; total: number } {
  const limit = Math.min(args.limit ?? 200, 1000);
  const items = getDb()
    .prepare(
      `SELECT comment_no, broadcast_id, nickname, message, created_at,
              created_at_milli, comment_type
       FROM comments
       WHERE broadcast_id = ? AND comment_no > ?
       ORDER BY comment_no ASC
       LIMIT ?`
    )
    .all(args.broadcastId, args.cursor ?? 0, limit) as Comment[];
  const total = (
    getDb()
      .prepare(`SELECT comment_count FROM broadcasts WHERE broadcast_id = ?`)
      .get(args.broadcastId) as { comment_count: number } | undefined
  )?.comment_count ?? 0;
  const nextCursor =
    items.length === limit ? items[items.length - 1].comment_no : null;
  return { items, nextCursor, total };
}

export function* iterateAllComments(
  broadcastId: string,
  chunk = 5000
): Generator<Comment[]> {
  let cursor = 0;
  const stmt = getDb().prepare(
    `SELECT comment_no, broadcast_id, nickname, message, created_at,
            created_at_milli, comment_type
     FROM comments
     WHERE broadcast_id = ? AND comment_no > ?
     ORDER BY comment_no ASC
     LIMIT ?`
  );
  while (true) {
    const rows = stmt.all(broadcastId, cursor, chunk) as Comment[];
    if (rows.length === 0) return;
    yield rows;
    cursor = rows[rows.length - 1].comment_no;
    if (rows.length < chunk) return;
  }
}

export type SearchResult =
  | { kind: "broadcast"; broadcast: Broadcast }
  | { kind: "channel"; channel: Channel };

export function searchBroadcasts(q: string, limit = 30): Broadcast[] {
  const t = q.trim();
  if (!t) return [];
  if (t.length >= 3) {
    // FTS5 trigram match; quote to escape special chars
    const safe = t.replace(/"/g, '""');
    return getDb()
      .prepare(
        `SELECT b.broadcast_id, b.category_id, b.broadcaster_id,
                ch.name AS broadcaster_name,
                b.title, b.status, b.start_date, b.comment_count,
                b.is_shortclip, b.thumbnail_url
         FROM broadcasts_fts f
         JOIN broadcasts b ON b.rowid = f.rowid
         LEFT JOIN channels ch ON ch.broadcaster_id = b.broadcaster_id
         WHERE broadcasts_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(`"${safe}"`, limit) as Broadcast[];
  }
  // Short query (<3 chars): LIKE fallback
  const like = `%${t}%`;
  return getDb()
    .prepare(
      `SELECT b.broadcast_id, b.category_id, b.broadcaster_id,
              ch.name AS broadcaster_name,
              b.title, b.status, b.start_date, b.comment_count,
              b.is_shortclip, b.thumbnail_url
       FROM broadcasts b
       LEFT JOIN channels ch ON ch.broadcaster_id = b.broadcaster_id
       WHERE b.title LIKE ? OR b.description LIKE ?
       ORDER BY b.comment_count DESC
       LIMIT ?`
    )
    .all(like, like, limit) as Broadcast[];
}

export function searchChannels(q: string, limit = 30): Channel[] {
  const t = q.trim();
  if (!t) return [];
  if (t.length >= 3) {
    const safe = t.replace(/"/g, '""');
    return getDb()
      .prepare(
        `SELECT ch.broadcaster_id, ch.name, ch.account_no, ch.profile_url,
                ch.channel_url, ch.grade
         FROM channels_fts f
         JOIN channels ch ON ch.rowid = f.rowid
         WHERE channels_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(`"${safe}"`, limit) as Channel[];
  }
  const like = `%${t}%`;
  return getDb()
    .prepare(
      `SELECT broadcaster_id, name, account_no, profile_url, channel_url, grade
       FROM channels WHERE name LIKE ?
       LIMIT ?`
    )
    .all(like, limit) as Channel[];
}

export function dashboardStats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM channels)   AS channels,
        (SELECT COUNT(*) FROM broadcasts) AS broadcasts,
        (SELECT COUNT(*) FROM broadcasts WHERE comment_count > 0) AS broadcasts_with_comments,
        (SELECT COUNT(*) FROM comments)   AS comments`
    )
    .get() as {
    categories: number;
    channels: number;
    broadcasts: number;
    broadcasts_with_comments: number;
    comments: number;
  };
  const byCategory = db
    .prepare(
      `SELECT b.category_id, c.name AS category_name,
              COUNT(*) AS broadcast_count,
              SUM(b.comment_count) AS comment_count
       FROM broadcasts b
       LEFT JOIN categories c ON c.category_id = b.category_id
       WHERE b.category_id IS NOT NULL
       GROUP BY b.category_id
       ORDER BY comment_count DESC`
    )
    .all() as Array<{
    category_id: string;
    category_name: string;
    broadcast_count: number;
    comment_count: number;
  }>;
  const topChannels = db
    .prepare(
      `SELECT ch.broadcaster_id, ch.name, ch.profile_url,
              COUNT(b.broadcast_id) AS broadcast_count,
              SUM(b.comment_count)  AS comment_count
       FROM channels ch
       JOIN broadcasts b ON b.broadcaster_id = ch.broadcaster_id
       GROUP BY ch.broadcaster_id
       ORDER BY comment_count DESC
       LIMIT 10`
    )
    .all() as Array<{
    broadcaster_id: string;
    name: string;
    profile_url: string | null;
    broadcast_count: number;
    comment_count: number;
  }>;
  const topBroadcasts = db
    .prepare(
      `SELECT b.broadcast_id, b.title, b.comment_count, b.category_id,
              ch.name AS broadcaster_name, c.name AS category_name,
              b.thumbnail_url
       FROM broadcasts b
       LEFT JOIN channels ch ON ch.broadcaster_id = b.broadcaster_id
       LEFT JOIN categories c ON c.category_id = b.category_id
       ORDER BY b.comment_count DESC
       LIMIT 10`
    )
    .all() as Array<{
    broadcast_id: string;
    title: string;
    comment_count: number;
    category_id: string;
    broadcaster_name: string;
    category_name: string;
    thumbnail_url: string | null;
  }>;
  return { totals, byCategory, topChannels, topBroadcasts };
}
