"""Analytics ETL.

Reads db/lc.sqlite and writes:
  - Custom KPIs as JSON   -> webapp/public/analytics/data/*.json
  - f2a HTML reports      -> webapp/public/analytics/reports/*.html

Run:
    python etl/analytics.py [--skip-f2a] [--skip-custom]
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "db" / "lc.sqlite"
OUT_BASE = ROOT / "webapp" / "public" / "analytics"
OUT_DATA = OUT_BASE / "data"
OUT_REPORTS = OUT_BASE / "reports"
OUT_DATA.mkdir(parents=True, exist_ok=True)
OUT_REPORTS.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def write_json(path: Path, payload: dict | list) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(str(DB))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA cache_size = -200000")
    con.execute("PRAGMA temp_store = MEMORY")
    return con


# ----------------------------------------------------------------------------
# Custom analytics
# ----------------------------------------------------------------------------

_HANGUL_RE = re.compile(r"[가-힣]{2,}")
_LATIN_RE = re.compile(r"[A-Za-z]{2,}")
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F6FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "]"
)
_STOPWORDS = {
    "있어요", "있어", "있는", "있고", "그리고", "근데", "그런데", "이거", "그거",
    "저거", "이게", "그게", "저게", "여기", "거기", "저기", "정말", "진짜",
    "너무", "그냥", "혹시", "감사", "감사합니다", "안녕", "안녕하세요", "네네",
    "네요", "에요", "해요", "그래요", "그래", "근데요", "그러면", "그래서",
    "어떻", "이쁜", "이뻐", "이뻐요", "예쁜", "예뻐", "예뻐요",
}


def compute_text_stats(con: sqlite3.Connection, sample_limit: int = 1_000_000) -> dict:
    """Sample comments for token/emoji frequencies. Caps at sample_limit."""
    print(f"  sampling up to {sample_limit:,} comments for text stats")
    t0 = time.time()
    rows = con.execute(
        f"SELECT message FROM comments WHERE message IS NOT NULL AND message <> '' LIMIT {sample_limit}"
    )
    word_counter: Counter[str] = Counter()
    emoji_counter: Counter[str] = Counter()
    length_buckets = [0] * 10  # 0-4, 5-9, 10-19, 20-29, ..., 80+
    n = 0
    for (msg,) in rows:
        n += 1
        for tok in _HANGUL_RE.findall(msg):
            if tok in _STOPWORDS or len(tok) < 2:
                continue
            word_counter[tok] += 1
        for tok in _LATIN_RE.findall(msg):
            t = tok.lower()
            if len(t) < 3:
                continue
            word_counter[t] += 1
        for e in _EMOJI_RE.findall(msg):
            emoji_counter[e] += 1
        L = len(msg)
        if L < 5:
            length_buckets[0] += 1
        elif L < 10:
            length_buckets[1] += 1
        elif L < 20:
            length_buckets[2] += 1
        elif L < 30:
            length_buckets[3] += 1
        elif L < 50:
            length_buckets[4] += 1
        elif L < 80:
            length_buckets[5] += 1
        elif L < 120:
            length_buckets[6] += 1
        elif L < 200:
            length_buckets[7] += 1
        else:
            length_buckets[8] += 1
    elapsed = time.time() - t0
    print(f"  text scan done: {n:,} rows, {elapsed:.1f}s")
    return {
        "sampled": n,
        "top_words": [
            {"word": w, "count": c} for w, c in word_counter.most_common(100)
        ],
        "top_emojis": [
            {"emoji": e, "count": c} for e, c in emoji_counter.most_common(50)
        ],
        "length_histogram": [
            {"range": "0-4",   "count": length_buckets[0]},
            {"range": "5-9",   "count": length_buckets[1]},
            {"range": "10-19", "count": length_buckets[2]},
            {"range": "20-29", "count": length_buckets[3]},
            {"range": "30-49", "count": length_buckets[4]},
            {"range": "50-79", "count": length_buckets[5]},
            {"range": "80-119","count": length_buckets[6]},
            {"range": "120-199","count": length_buckets[7]},
            {"range": "200+",  "count": length_buckets[8]},
        ],
    }


def compute_timeseries(con: sqlite3.Connection) -> dict:
    """Per-day comment volume + hour × weekday heatmap from created_at."""
    print("  computing time series + heatmap")
    by_day = con.execute(
        """
        SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
        FROM comments
        WHERE created_at IS NOT NULL AND created_at <> ''
        GROUP BY day ORDER BY day
        """
    ).fetchall()
    # Heatmap via SQLite strftime — created_at is stored as ISO string
    heatmap_rows = con.execute(
        """
        SELECT
            CAST(strftime('%w', created_at) AS INTEGER) AS weekday,
            CAST(strftime('%H', created_at) AS INTEGER) AS hour,
            COUNT(*) AS n
        FROM comments
        WHERE created_at IS NOT NULL AND created_at <> ''
        GROUP BY weekday, hour
        """
    ).fetchall()
    matrix = [[0] * 24 for _ in range(7)]
    for r in heatmap_rows:
        w, h, n = r["weekday"], r["hour"], r["n"]
        if w is not None and h is not None:
            matrix[w][h] = n
    return {
        "daily": [{"day": r["day"], "count": r["n"]} for r in by_day],
        "heatmap": matrix,  # matrix[weekday(0=Sun)][hour]
    }


def compute_top_users(con: sqlite3.Connection, k: int = 50) -> list[dict]:
    print(f"  computing top {k} commenters")
    rows = con.execute(
        """
        SELECT nickname, COUNT(*) AS n, COUNT(DISTINCT broadcast_id) AS broadcasts
        FROM comments
        WHERE nickname IS NOT NULL AND nickname <> ''
        GROUP BY nickname
        ORDER BY n DESC
        LIMIT ?
        """,
        (k,),
    ).fetchall()
    return [
        {"nickname": r["nickname"], "count": r["n"], "broadcasts": r["broadcasts"]}
        for r in rows
    ]


def compute_category_stats(con: sqlite3.Connection) -> list[dict]:
    rows = con.execute(
        """
        SELECT c.category_id, c.name,
               COUNT(b.broadcast_id) AS broadcasts,
               COALESCE(SUM(b.comment_count), 0) AS comments,
               COALESCE(AVG(b.comment_count), 0) AS avg_comments,
               SUM(CASE WHEN b.is_shortclip = 1 THEN 1 ELSE 0 END) AS shortclips,
               SUM(CASE WHEN b.is_shortclip IS NOT 1 THEN 1 ELSE 0 END) AS broadcasts_only
        FROM categories c
        LEFT JOIN broadcasts b ON b.category_id = c.category_id
        GROUP BY c.category_id, c.name
        ORDER BY comments DESC
        """
    ).fetchall()
    return [
        {
            "category_id": r["category_id"],
            "name": r["name"],
            "broadcasts": r["broadcasts"],
            "shortclips": r["shortclips"],
            "broadcasts_only": r["broadcasts_only"],
            "comments": r["comments"],
            "avg_comments": round(r["avg_comments"] or 0, 1),
        }
        for r in rows
    ]


def compute_channel_stats(con: sqlite3.Connection, k: int = 100) -> list[dict]:
    rows = con.execute(
        """
        SELECT ch.broadcaster_id, ch.name, ch.profile_url, ch.grade,
               COUNT(b.broadcast_id) AS broadcasts,
               COALESCE(SUM(b.comment_count), 0) AS comments,
               COALESCE(AVG(b.comment_count), 0) AS avg_comments,
               MAX(b.comment_count) AS max_comments
        FROM channels ch
        JOIN broadcasts b ON b.broadcaster_id = ch.broadcaster_id
        GROUP BY ch.broadcaster_id
        HAVING broadcasts > 0
        ORDER BY comments DESC
        LIMIT ?
        """,
        (k,),
    ).fetchall()
    return [
        {
            "broadcaster_id": r["broadcaster_id"],
            "name": r["name"],
            "profile_url": r["profile_url"],
            "grade": r["grade"],
            "broadcasts": r["broadcasts"],
            "comments": r["comments"],
            "avg_comments": round(r["avg_comments"] or 0, 1),
            "max_comments": r["max_comments"],
        }
        for r in rows
    ]


def compute_status_distribution(con: sqlite3.Connection) -> list[dict]:
    rows = con.execute(
        """
        SELECT category_id, status, COUNT(*) AS n
        FROM broadcasts
        WHERE category_id IS NOT NULL
        GROUP BY category_id, status
        ORDER BY category_id, n DESC
        """
    ).fetchall()
    cats = con.execute(
        "SELECT category_id, name FROM categories"
    ).fetchall()
    name_by_id = {r["category_id"]: r["name"] for r in cats}
    by_cat: dict[str, dict] = {}
    for r in rows:
        c = by_cat.setdefault(
            r["category_id"],
            {
                "category_id": r["category_id"],
                "name": name_by_id.get(r["category_id"], r["category_id"]),
                "statuses": {},
            },
        )
        c["statuses"][r["status"] or "UNKNOWN"] = r["n"]
    return list(by_cat.values())


def compute_product_stats(con: sqlite3.Connection) -> dict:
    summary = con.execute(
        """
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT broadcast_id) AS broadcasts_with_products,
          AVG(price)        AS avg_price,
          AVG(sale_price)   AS avg_sale_price,
          AVG(discount_rate) AS avg_discount_rate
        FROM broadcast_products
        WHERE price > 0
        """
    ).fetchone()
    top_brands = con.execute(
        """
        SELECT brand_name AS name, COUNT(*) AS n
        FROM broadcast_products
        WHERE brand_name IS NOT NULL AND brand_name <> ''
        GROUP BY brand_name ORDER BY n DESC LIMIT 30
        """
    ).fetchall()
    return {
        "total": summary["total"],
        "broadcasts_with_products": summary["broadcasts_with_products"],
        "avg_price": round(summary["avg_price"] or 0, 0),
        "avg_sale_price": round(summary["avg_sale_price"] or 0, 0),
        "avg_discount_rate": round(summary["avg_discount_rate"] or 0, 1),
        "top_brands": [{"name": r["name"], "count": r["n"]} for r in top_brands],
    }


def compute_overview(con: sqlite3.Connection) -> dict:
    totals = con.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM categories) AS categories,
          (SELECT COUNT(*) FROM channels) AS channels,
          (SELECT COUNT(*) FROM broadcasts) AS broadcasts,
          (SELECT COUNT(*) FROM broadcasts WHERE is_shortclip = 1) AS shortclips,
          (SELECT COUNT(*) FROM broadcasts WHERE comment_count > 0) AS broadcasts_with_comments,
          (SELECT COUNT(*) FROM comments) AS comments,
          (SELECT COUNT(*) FROM broadcast_products) AS products
        """
    ).fetchone()
    dist = con.execute(
        """
        SELECT
          MIN(comment_count) AS min_cc,
          MAX(comment_count) AS max_cc,
          AVG(comment_count) AS avg_cc,
          (SELECT comment_count FROM broadcasts WHERE comment_count > 0
            ORDER BY comment_count LIMIT 1 OFFSET
              (SELECT COUNT(*) FROM broadcasts WHERE comment_count > 0)/2) AS median_cc
        FROM broadcasts WHERE comment_count > 0
        """
    ).fetchone()
    return {
        "generated_at": now_iso(),
        "totals": dict(totals),
        "comment_count_dist": {
            "min": dist["min_cc"],
            "max": dist["max_cc"],
            "avg": round(dist["avg_cc"] or 0, 1),
            "median": dist["median_cc"],
        },
    }


def run_custom() -> None:
    print(f"[analytics] custom KPIs -> {OUT_DATA}")
    con = connect()
    try:
        write_json(OUT_DATA / "overview.json", compute_overview(con))
        print("  ✓ overview.json")
        write_json(OUT_DATA / "category_stats.json", compute_category_stats(con))
        print("  ✓ category_stats.json")
        write_json(OUT_DATA / "channel_stats.json", compute_channel_stats(con))
        print("  ✓ channel_stats.json")
        write_json(OUT_DATA / "status_dist.json", compute_status_distribution(con))
        print("  ✓ status_dist.json")
        write_json(OUT_DATA / "product_stats.json", compute_product_stats(con))
        print("  ✓ product_stats.json")
        write_json(OUT_DATA / "top_users.json", compute_top_users(con))
        print("  ✓ top_users.json")
        write_json(OUT_DATA / "timeseries.json", compute_timeseries(con))
        print("  ✓ timeseries.json")
        write_json(OUT_DATA / "text_stats.json", compute_text_stats(con))
        print("  ✓ text_stats.json")
    finally:
        con.close()


# ----------------------------------------------------------------------------
# f2a reports
# ----------------------------------------------------------------------------


def run_f2a() -> None:
    print(f"[analytics] f2a HTML reports -> {OUT_REPORTS}")
    import f2a

    cfg = f2a.AnalysisConfig(
        # Heavy advanced analyses can be slow on big tables; trim a bit.
        advanced=True,
        pca=True,
        clustering=True,
        statistical_tests=True,
        feature_importance=True,
        max_categories=50,
        max_plot_columns=15,
        max_sample_for_advanced=5000,
    )

    # For very wide tables, exclude noisy columns by projecting via a query.
    targets = [
        ("broadcasts", """
            SELECT category_id, broadcaster_id, status, broadcast_type, release_level,
                   display_type, product_count, sub_product_count, is_shortclip,
                   duration_ms, comment_count, video_saved
            FROM broadcasts
        """),
        ("channels", "SELECT broadcaster_id, name, account_no, grade FROM channels"),
        ("broadcast_products", """
            SELECT broadcast_id, name, brand_name, mall_name, price, sale_price,
                   discount_rate, status, broadcast_product_status, is_represent,
                   live_discount_active
            FROM broadcast_products
        """),
    ]
    for table, query in targets:
        print(f"  analyzing table: {table}")
        t0 = time.time()
        try:
            report = f2a.analyze(str(DB), config=cfg, query=query)
            out_dir = OUT_REPORTS / table
            out_dir.mkdir(parents=True, exist_ok=True)
            produced = Path(report.to_html(str(out_dir)))
            canonical = out_dir / "index.html"
            if produced.resolve() != canonical.resolve():
                if canonical.exists():
                    canonical.unlink()
                produced.rename(canonical)
            print(f"  ✓ reports/{table}/index.html  ({time.time()-t0:.1f}s, {canonical.stat().st_size//1024} KB)")
        except Exception as e:
            print(f"  ! f2a failed on {table}: {e}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-custom", action="store_true")
    ap.add_argument("--skip-f2a", action="store_true")
    args = ap.parse_args()
    if not DB.exists():
        sys.exit(f"DB not found: {DB} — run etl/build_db.py first")
    if not args.skip_custom:
        run_custom()
    if not args.skip_f2a:
        run_f2a()
    print("[analytics] done")


if __name__ == "__main__":
    main()
