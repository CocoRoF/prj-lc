"""ETL: data/*.csv -> db/lc.sqlite

Schema:
    categories, channels, broadcasts, broadcast_products, comments
    + FTS5(trigram) for broadcasts and channels
    + denormalized comment_count on broadcasts

Run:
    python etl/build_db.py
"""
from __future__ import annotations

import csv
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB_PATH = ROOT / "db" / "lc.sqlite"

# raise CSV field-size limit (some descriptions are huge)
csv.field_size_limit(sys.maxsize if sys.platform != "win32" else (1 << 31) - 1)

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE categories (
    category_id    TEXT PRIMARY KEY,
    name           TEXT,
    nclick_code    TEXT,
    type           TEXT,
    icon_url       TEXT,
    thumbnail_url  TEXT,
    link_url       TEXT
);

CREATE TABLE channels (
    broadcaster_id TEXT PRIMARY KEY,
    owner_id       TEXT,
    name           TEXT,
    account_no     TEXT,
    profile_url    TEXT,
    channel_url    TEXT,
    grade          TEXT,
    description    TEXT
);

CREATE TABLE broadcasts (
    broadcast_id   TEXT PRIMARY KEY,
    category_id    TEXT,
    broadcaster_id TEXT,
    title          TEXT,
    description    TEXT,
    status         TEXT,
    start_date     TEXT,
    end_date       TEXT,
    expected_start_date TEXT,
    viewer_url     TEXT,
    thumbnail_url  TEXT,
    video_id       TEXT,
    live_id        TEXT,
    product_count  INTEGER,
    sub_product_count INTEGER,
    is_shortclip   INTEGER,
    duration_ms    INTEGER,
    service_id     TEXT,
    broadcast_type TEXT,
    release_level  TEXT,
    display_type   TEXT,
    video_saved    INTEGER,
    video_status   TEXT,
    comment_count  INTEGER DEFAULT 0
);

CREATE TABLE broadcast_products (
    broadcast_id   TEXT,
    product_no     TEXT,
    product_key    TEXT,
    name           TEXT,
    brand_name     TEXT,
    mall_name      TEXT,
    image_url      TEXT,
    price          INTEGER,
    sale_price     INTEGER,
    discount_rate  REAL,
    status         TEXT,
    broadcast_product_status TEXT,
    is_represent   INTEGER,
    live_discount_active INTEGER,
    product_url    TEXT,
    PRIMARY KEY (broadcast_id, product_no)
);

CREATE TABLE comments (
    comment_no       INTEGER PRIMARY KEY,
    broadcast_id     TEXT NOT NULL,
    comment_id       TEXT,
    user_id_no       TEXT,
    nickname         TEXT,
    message          TEXT,
    comment_type     TEXT,
    created_at       TEXT,
    created_at_milli INTEGER,
    has_answer       INTEGER,
    record_started_at TEXT
);
"""

INDEXES = """
CREATE INDEX idx_comments_bid_milli  ON comments (broadcast_id, created_at_milli);
CREATE INDEX idx_comments_bid_no     ON comments (broadcast_id, comment_no);
CREATE INDEX idx_broadcasts_cat_cc   ON broadcasts (category_id, comment_count DESC);
CREATE INDEX idx_broadcasts_channel  ON broadcasts (broadcaster_id, start_date DESC);
CREATE INDEX idx_broadcasts_status   ON broadcasts (status);
CREATE INDEX idx_products_bid        ON broadcast_products (broadcast_id);
"""

FTS = """
CREATE VIRTUAL TABLE broadcasts_fts USING fts5(
    title, description,
    content='broadcasts', content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO broadcasts_fts(rowid, title, description)
SELECT rowid, title, description FROM broadcasts;

CREATE VIRTUAL TABLE channels_fts USING fts5(
    name,
    content='channels', content_rowid='rowid',
    tokenize='trigram'
);
INSERT INTO channels_fts(rowid, name) SELECT rowid, name FROM channels;
"""


def _to_int(s):
    if s is None or s == "":
        return None
    try:
        return int(s)
    except (TypeError, ValueError):
        try:
            return int(float(s))
        except (TypeError, ValueError):
            return None


def _to_float(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def _to_bool(s):
    if s in (None, "", "None"):
        return None
    return 1 if str(s).lower() == "true" else 0


def load_categories(con: sqlite3.Connection) -> int:
    rows = []
    with (DATA / "categories.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            rows.append((
                r["category_id"], r["name"], r["nclick_code"], r["type"],
                r["icon_url"], r["thumbnail_url"], r["link_url"],
            ))
    con.executemany(
        "INSERT INTO categories(category_id,name,nclick_code,type,icon_url,thumbnail_url,link_url) "
        "VALUES (?,?,?,?,?,?,?)", rows,
    )
    return len(rows)


def load_channels(con: sqlite3.Connection) -> int:
    seen = set()
    rows = []
    with (DATA / "channels.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            bid = r["broadcaster_id"]
            if not bid or bid in seen:
                continue
            seen.add(bid)
            rows.append((
                bid, r["owner_id"], r["name"], r["account_no"],
                r["profile_url"], r["channel_url"], r["grade"], r["description"],
            ))
    con.executemany(
        "INSERT INTO channels(broadcaster_id,owner_id,name,account_no,profile_url,channel_url,grade,description) "
        "VALUES (?,?,?,?,?,?,?,?)", rows,
    )
    return len(rows)


def load_broadcasts(con: sqlite3.Connection) -> int:
    seen = set()
    rows = []
    with (DATA / "broadcasts.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            bid = r["broadcast_id"]
            if not bid or bid in seen:
                continue
            seen.add(bid)
            rows.append((
                bid, r["category_id"], r["broadcaster_id"],
                r["title"], r["description"], r["status"],
                r["start_date"], r["end_date"], r["expected_start_date"],
                r["viewer_url"], r["thumbnail_url"], r["video_id"], r["live_id"],
                _to_int(r["product_count"]), _to_int(r["sub_product_count"]),
                _to_bool(r["is_shortclip"]),
                _to_int(r["duration_ms"]),
                r["service_id"], r["broadcast_type"], r["release_level"],
                r["display_type"],
                _to_bool(r["video_saved"]), r["video_status"],
            ))
    con.executemany("""
        INSERT INTO broadcasts(
            broadcast_id,category_id,broadcaster_id,title,description,status,
            start_date,end_date,expected_start_date,viewer_url,thumbnail_url,
            video_id,live_id,product_count,sub_product_count,is_shortclip,
            duration_ms,service_id,broadcast_type,release_level,display_type,
            video_saved,video_status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    return len(rows)


def load_products(con: sqlite3.Connection) -> int:
    seen = set()
    rows = []
    with (DATA / "broadcast_products.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            key = (r["broadcast_id"], r["product_no"])
            if not r["broadcast_id"] or not r["product_no"] or key in seen:
                continue
            seen.add(key)
            rows.append((
                r["broadcast_id"], r["product_no"], r["product_key"],
                r["name"], r["brand_name"], r["mall_name"], r["image_url"],
                _to_int(r["price"]), _to_int(r["sale_price"]), _to_float(r["discount_rate"]),
                r["status"], r["broadcast_product_status"],
                _to_bool(r["is_represent"]), _to_bool(r["live_discount_active"]),
                r["product_url"],
            ))
    con.executemany("""
        INSERT INTO broadcast_products(
            broadcast_id,product_no,product_key,name,brand_name,mall_name,image_url,
            price,sale_price,discount_rate,status,broadcast_product_status,
            is_represent,live_discount_active,product_url
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    return len(rows)


def load_comments(con: sqlite3.Connection, batch: int = 50_000) -> int:
    total = 0
    buf: list[tuple] = []

    def flush():
        nonlocal buf
        if buf:
            con.executemany("""
                INSERT OR IGNORE INTO comments(
                    comment_no,broadcast_id,comment_id,user_id_no,nickname,message,
                    comment_type,created_at,created_at_milli,has_answer,record_started_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, buf)
            buf = []

    t0 = time.time()
    with (DATA / "comments.csv").open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            cn = _to_int(r["comment_no"])
            if cn is None or not r["broadcast_id"]:
                continue
            buf.append((
                cn, r["broadcast_id"], r["comment_id"], r["user_id_no"],
                r["nickname"], r["message"], r["comment_type"],
                r["created_at"], _to_int(r["created_at_milli"]),
                _to_bool(r["has_answer"]), r["record_started_at"],
            ))
            if len(buf) >= batch:
                flush()
                total += batch
                if total % 500_000 == 0:
                    print(f"    loaded {total:>9,} comments  ({total/(time.time()-t0):,.0f}/s)", flush=True)
    flush()
    # Recount precisely
    total = con.execute("SELECT COUNT(*) FROM comments").fetchone()[0]
    return total


def compute_comment_counts(con: sqlite3.Connection) -> None:
    """Single GROUP BY pass over comments, then UPDATE join via a temp table."""
    con.execute("CREATE TEMP TABLE cc(broadcast_id TEXT PRIMARY KEY, n INTEGER)")
    con.execute("INSERT INTO cc(broadcast_id, n) SELECT broadcast_id, COUNT(*) FROM comments GROUP BY broadcast_id")
    con.execute("""
        UPDATE broadcasts
        SET comment_count = COALESCE((SELECT n FROM cc WHERE cc.broadcast_id = broadcasts.broadcast_id), 0)
    """)
    con.execute("DROP TABLE cc")


def main() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    print(f"[etl] target: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA synchronous = OFF")
    con.execute("PRAGMA temp_store = MEMORY")
    con.execute("PRAGMA cache_size = -200000")  # 200MB cache

    print("[etl] creating schema")
    con.executescript(SCHEMA)

    t = time.time()
    print("[etl] loading categories")
    n_cat = load_categories(con); con.commit()
    print(f"      categories:        {n_cat:>8,}   ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] loading channels")
    n_ch = load_channels(con); con.commit()
    print(f"      channels:          {n_ch:>8,}   ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] loading broadcasts")
    n_bc = load_broadcasts(con); con.commit()
    print(f"      broadcasts:        {n_bc:>8,}   ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] loading broadcast_products")
    n_pr = load_products(con); con.commit()
    print(f"      products:          {n_pr:>8,}   ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] loading comments (this takes a few minutes)")
    n_cm = load_comments(con); con.commit()
    print(f"      comments:          {n_cm:>8,}   ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] computing comment_count per broadcast")
    compute_comment_counts(con); con.commit()
    print(f"      done               ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] creating indexes")
    con.executescript(INDEXES); con.commit()
    print(f"      done               ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] building FTS5 (broadcasts, channels)")
    con.executescript(FTS); con.commit()
    print(f"      done               ({time.time()-t:.1f}s)")

    t = time.time(); print("[etl] ANALYZE")
    con.execute("ANALYZE"); con.commit()
    print(f"      done               ({time.time()-t:.1f}s)")

    print("\n[etl] sanity checks:")
    checks = [
        ("categories",           "SELECT COUNT(*) FROM categories"),
        ("channels",             "SELECT COUNT(*) FROM channels"),
        ("broadcasts",           "SELECT COUNT(*) FROM broadcasts"),
        ("broadcast_products",   "SELECT COUNT(*) FROM broadcast_products"),
        ("comments",             "SELECT COUNT(*) FROM comments"),
        ("broadcasts with cc>0", "SELECT COUNT(*) FROM broadcasts WHERE comment_count > 0"),
        ("sum(comment_count)",   "SELECT SUM(comment_count) FROM broadcasts"),
        ("FTS broadcasts",       "SELECT COUNT(*) FROM broadcasts_fts"),
        ("FTS channels",         "SELECT COUNT(*) FROM channels_fts"),
    ]
    for label, q in checks:
        v = con.execute(q).fetchone()[0]
        print(f"  {label:<24} {v:>10}" if v is not None else f"  {label:<24} <null>")

    print("\n[etl] top-5 broadcasts by comment_count:")
    for row in con.execute("""
        SELECT b.broadcast_id, b.title, b.comment_count, ch.name
        FROM broadcasts b LEFT JOIN channels ch ON ch.broadcaster_id = b.broadcaster_id
        ORDER BY b.comment_count DESC LIMIT 5
    """):
        bid, title, cc, ch = row
        print(f"  bid={bid:<10} cc={cc:>7,}  ch={ch!s:<20.20}  title={title!s:<40.40}")

    print(f"\n[etl] FTS search check (\"패션\"):")
    for row in con.execute(
        "SELECT b.broadcast_id, b.title FROM broadcasts_fts f JOIN broadcasts b ON b.rowid=f.rowid "
        "WHERE broadcasts_fts MATCH '패션' ORDER BY rank LIMIT 3"
    ):
        print(f"  bid={row[0]}  title={row[1]}")

    con.close()
    size_mb = DB_PATH.stat().st_size / 1024 / 1024
    print(f"\n[etl] DB built: {DB_PATH}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
