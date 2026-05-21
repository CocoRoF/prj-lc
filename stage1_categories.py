"""Stage 1: scrape category & exhibition list (static, ~5s)."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CATEGORIES_CSV, EXHIBITIONS_CSV, HOME_HOST
from utils.csv_io import write_rows
from utils.http import get_html, new_session
from utils.parse import parse_next_data

CATEGORY_FIELDS = [
    "category_id", "name", "type", "nclick_code",
    "link_url", "icon_url", "thumbnail_url", "crawled_at",
]
EXHIBITION_FIELDS = [
    "exhibition_id", "name", "link_url", "thumbnail_url", "crawled_at",
]


def fetch_menu() -> list[dict]:
    s = new_session()
    html = get_html(s, f"{HOME_HOST}/categories")
    data = parse_next_data(html)
    if not data:
        raise RuntimeError("__NEXT_DATA__ not found on /categories")
    menu = data["props"]["pageProps"]["initialRecoilState"]["menu"]
    return menu.get("currentList", [])


def split_categories_exhibitions(items: list[dict]) -> tuple[list[dict], list[dict]]:
    now = datetime.now(timezone.utc).isoformat()
    categories: list[dict] = []
    exhibitions: list[dict] = []
    for it in items:
        if it.get("type") == "CATEGORY":
            categories.append({
                "category_id": it.get("id"),
                "name": it.get("name"),
                "type": it.get("type"),
                "nclick_code": it.get("nclickCode"),
                "link_url": it.get("linkUrl"),
                "icon_url": it.get("iconUrl"),
                "thumbnail_url": it.get("thumbnailUrl"),
                "crawled_at": now,
            })
        elif it.get("type") == "QUICK":
            link = it.get("linkUrl") or ""
            ex_id = link.rstrip("/").rsplit("/", 1)[-1] if "/exhibition/" in link else it.get("id")
            exhibitions.append({
                "exhibition_id": ex_id,
                "name": it.get("name"),
                "link_url": link,
                "thumbnail_url": it.get("thumbnailUrl"),
                "crawled_at": now,
            })
    return categories, exhibitions


def main() -> None:
    items = fetch_menu()
    print(f"[stage1] fetched {len(items)} menu items")
    categories, exhibitions = split_categories_exhibitions(items)
    n_cat = write_rows(CATEGORIES_CSV, CATEGORY_FIELDS, categories)
    n_exh = write_rows(EXHIBITIONS_CSV, EXHIBITION_FIELDS, exhibitions)
    print(f"[stage1] wrote {n_cat} categories -> {CATEGORIES_CSV}")
    print(f"[stage1] wrote {n_exh} exhibitions -> {EXHIBITIONS_CSV}")
    print("[stage1] categories:")
    for c in categories:
        print(f"  {c['category_id']:>6}  {c['nclick_code']:<12}  {c['name']}")


if __name__ == "__main__":
    main()
