"""Stage 2: collect broadcasts per category via Playwright response interception.

Strategy:
  - For each category in categories.csv, navigate to /categories/{id}?sort=LATEST
  - Capture every response that matches /v1/category/gathering
  - Scroll until no more `next` cursor in latest response (or safety cap reached)
  - Flatten and dedupe into broadcasts.csv / shortclips reuse same row with is_shortclip flag
  - Also accumulate broadcast_products.csv and channels.csv

Channels & exhibitions enrichment is in stage2_channels.py (run after).
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.async_api import Page, async_playwright

from config import (
    BROADCAST_PRODUCTS_CSV,
    BROADCASTS_CSV,
    CAPTURE_DIR,
    CHANNELS_CSV,
    HOME_HOST,
    USER_AGENT,
)
from utils.csv_io import append_rows, read_rows

GATHERING_MARK = "/v1/category/gathering"
DEFAULT_SORT = "LATEST"
MAX_SCROLLS_PER_CATEGORY = 200
SCROLL_PAUSE_MS = 800
NO_PROGRESS_PATIENCE = 3

BROADCAST_FIELDS = [
    "broadcast_id", "category_id", "title", "description", "status",
    "broadcaster_id", "broadcaster_name", "broadcaster_account_no",
    "start_date", "end_date", "expected_start_date",
    "viewer_url", "thumbnail_url", "video_id", "live_id",
    "product_count", "sub_product_count",
    "is_shortclip", "duration_ms", "service_id", "broadcast_type",
    "release_level", "display_type", "video_saved", "video_status",
    "crawled_at",
]
PRODUCT_FIELDS = [
    "broadcast_id", "product_no", "product_key", "name", "brand_name", "mall_name",
    "image_url", "price", "sale_price", "discount_rate", "status",
    "broadcast_product_status", "is_represent", "live_discount_active",
    "product_url", "crawled_at",
]
CHANNEL_FIELDS = [
    "broadcaster_id", "owner_id", "name", "account_no",
    "profile_url", "channel_url", "grade", "description", "crawled_at",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def flatten_broadcast(item: dict, category_id: str) -> tuple[dict | None, list[dict], dict | None]:
    """Return (broadcast_row, product_rows, channel_row) from one gathering list item."""
    now = _now()
    bc_outer = item.get("broadcast")
    sc = item.get("shortclip")

    if bc_outer:
        bc = bc_outer.get("broadcast") or {}
        owner = bc_outer.get("owner") or {}
        products = bc_outer.get("shoppingProducts") or []

        bid = bc.get("id")
        row = {
            "broadcast_id": bid,
            "category_id": category_id,
            "title": bc.get("title"),
            "description": bc.get("description"),
            "status": bc.get("status"),
            "broadcaster_id": owner.get("broadcasterId"),
            "broadcaster_name": owner.get("name"),
            "broadcaster_account_no": owner.get("accountNo"),
            "start_date": bc.get("startDate"),
            "end_date": bc.get("endDate"),
            "expected_start_date": bc.get("expectedStartDate"),
            "viewer_url": f"https://view.shoppinglive.naver.com/lives/{bid}" if bid else None,
            "thumbnail_url": bc.get("standByImage") or bc.get("previewImage"),
            "video_id": bc.get("vid"),
            "live_id": bc.get("liveId"),
            "product_count": bc.get("productCount"),
            "sub_product_count": bc.get("subProductCount"),
            "is_shortclip": False,
            "duration_ms": None,
            "service_id": bc.get("serviceId"),
            "broadcast_type": bc.get("type"),
            "release_level": bc.get("releaseLevel"),
            "display_type": bc.get("displayType"),
            "video_saved": bc.get("videoSaved"),
            "video_status": bc.get("videoStatus"),
            "crawled_at": now,
        }

        product_rows = []
        for p in products:
            product_rows.append({
                "broadcast_id": bid,
                "product_no": p.get("productNo") or p.get("originProductNo"),
                "product_key": p.get("key"),
                "name": p.get("name") or p.get("productName"),
                "brand_name": p.get("brandName"),
                "mall_name": p.get("mallName"),
                "image_url": p.get("image"),
                "price": p.get("price"),
                "sale_price": p.get("salePrice"),
                "discount_rate": p.get("discountRate"),
                "status": p.get("status"),
                "broadcast_product_status": p.get("broadcastProductStatus"),
                "is_represent": p.get("represent"),
                "live_discount_active": p.get("activeLiveDiscount"),
                "product_url": p.get("productEndUrl"),
                "crawled_at": now,
            })

        channel_row = None
        if owner.get("broadcasterId"):
            channel_row = {
                "broadcaster_id": owner.get("broadcasterId"),
                "owner_id": owner.get("id"),
                "name": owner.get("name"),
                "account_no": owner.get("accountNo"),
                "profile_url": owner.get("profileImageUrl"),
                "channel_url": owner.get("broadcasterEndUrl"),
                "grade": owner.get("grade"),
                "description": owner.get("description"),
                "crawled_at": now,
            }
        return row, product_rows, channel_row

    if sc:
        ch = sc.get("channel") or {}
        sid = sc.get("id")
        bid_link = sc.get("broadcastId")
        row = {
            "broadcast_id": f"sc:{sid}",
            "category_id": category_id,
            "title": sc.get("title"),
            "description": sc.get("description"),
            "status": sc.get("status"),
            "broadcaster_id": ch.get("broadcasterId") or ch.get("id"),
            "broadcaster_name": ch.get("name"),
            "broadcaster_account_no": ch.get("accountNo"),
            "start_date": sc.get("createdAt"),
            "end_date": None,
            "expected_start_date": sc.get("expectedExposeAt"),
            "viewer_url": sc.get("endUrl"),
            "thumbnail_url": sc.get("thumbnail") or sc.get("previewImage"),
            "video_id": sc.get("vid"),
            "live_id": bid_link,
            "product_count": sc.get("productCount"),
            "sub_product_count": sc.get("subProductCount"),
            "is_shortclip": True,
            "duration_ms": sc.get("durationMs"),
            "service_id": None,
            "broadcast_type": sc.get("type"),
            "release_level": None,
            "display_type": sc.get("exposeType"),
            "video_saved": None,
            "video_status": sc.get("videoStatus"),
            "crawled_at": now,
        }
        channel_row = None
        if ch.get("broadcasterId") or ch.get("id"):
            channel_row = {
                "broadcaster_id": ch.get("broadcasterId") or ch.get("id"),
                "owner_id": ch.get("id"),
                "name": ch.get("name"),
                "account_no": ch.get("accountNo"),
                "profile_url": ch.get("profileImageUrl"),
                "channel_url": ch.get("broadcasterEndUrl"),
                "grade": ch.get("grade"),
                "description": ch.get("description"),
                "crawled_at": now,
            }
        return row, [], channel_row

    return None, [], None


class CategoryHarvester:
    def __init__(self, category_id: str, category_name: str):
        self.category_id = category_id
        self.category_name = category_name
        self.responses: list[dict] = []
        self.last_next: str | None = None
        self.seen_broadcast_ids: set[str] = set()
        self.broadcast_rows: list[dict] = []
        self.product_rows: list[dict] = []
        self.channel_rows: list[dict] = []
        self._seen_channels: set[str] = set()

    async def attach(self, page: Page) -> None:
        async def on_response(resp):
            if GATHERING_MARK not in resp.url:
                return
            try:
                body = await resp.json()
            except Exception:
                return
            self.responses.append({"url": resp.url, "body": body})
            self.last_next = body.get("next")
            for item in body.get("list") or []:
                row, products, channel = flatten_broadcast(item, self.category_id)
                if not row:
                    continue
                key = str(row["broadcast_id"])
                if key in self.seen_broadcast_ids:
                    continue
                self.seen_broadcast_ids.add(key)
                self.broadcast_rows.append(row)
                self.product_rows.extend(products)
                if channel:
                    ch_key = str(channel["broadcaster_id"])
                    if ch_key not in self._seen_channels:
                        self._seen_channels.add(ch_key)
                        self.channel_rows.append(channel)

        page.on("response", on_response)


async def harvest_category(
    page: Page, category_id: str, category_name: str, max_scrolls: int = MAX_SCROLLS_PER_CATEGORY
) -> CategoryHarvester:
    harvester = CategoryHarvester(category_id, category_name)
    await harvester.attach(page)

    url = f"{HOME_HOST}/categories/{category_id}?sort={DEFAULT_SORT}"
    print(f"[stage2] {category_id} ({category_name}) -> {url}")
    await page.goto(url, wait_until="networkidle")
    await page.wait_for_timeout(1200)

    prev_count = -1
    no_progress = 0
    for i in range(max_scrolls):
        if not harvester.last_next and harvester.responses:
            print(f"[stage2]   [{category_id}] no more next cursor, stopping at {len(harvester.broadcast_rows)} items")
            break
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(SCROLL_PAUSE_MS)
        cur = len(harvester.broadcast_rows)
        if cur == prev_count:
            no_progress += 1
            if no_progress >= NO_PROGRESS_PATIENCE:
                print(f"[stage2]   [{category_id}] no new items after {NO_PROGRESS_PATIENCE} scrolls, stopping")
                break
        else:
            no_progress = 0
            prev_count = cur
            if (i + 1) % 5 == 0:
                print(f"[stage2]   [{category_id}] scroll {i+1}: {cur} items")

    return harvester


async def main(category_ids: list[str] | None = None, max_scrolls: int | None = None) -> None:
    cats = read_rows(Path(__file__).resolve().parent / "data" / "categories.csv")
    if category_ids:
        cats = [c for c in cats if c["category_id"] in category_ids]
    if not cats:
        raise SystemExit("[stage2] no categories to process. Run stage1 first.")

    cap = max_scrolls if max_scrolls is not None else MAX_SCROLLS_PER_CATEGORY

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            locale="ko-KR",
            viewport={"width": 1366, "height": 900},
        )
        page = await context.new_page()

        total_bc = 0
        total_pr = 0
        total_ch = 0
        for c in cats:
            h = await harvest_category(page, c["category_id"], c["name"], max_scrolls=cap)
            n_bc = append_rows(BROADCASTS_CSV, BROADCAST_FIELDS, h.broadcast_rows, dedupe_key="broadcast_id")
            n_pr = append_rows(BROADCAST_PRODUCTS_CSV, PRODUCT_FIELDS, h.product_rows)
            n_ch = append_rows(CHANNELS_CSV, CHANNEL_FIELDS, h.channel_rows, dedupe_key="broadcaster_id")
            total_bc += n_bc
            total_pr += n_pr
            total_ch += n_ch
            print(f"[stage2]   [{c['category_id']}] +{n_bc} broadcasts, +{n_pr} products, +{n_ch} channels")
            (CAPTURE_DIR / f"gathering_{c['category_id'].replace(':', '_')}.json").write_text(
                json.dumps(h.responses, ensure_ascii=False), encoding="utf-8"
            )

        await context.close()
        await browser.close()

    print(f"[stage2] DONE — total +{total_bc} broadcasts, +{total_pr} products, +{total_ch} channels")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--cats", nargs="*", help="restrict to these category ids (e.g. dc:1 dc:2)")
    ap.add_argument("--max-scrolls", type=int, default=None, help="cap scrolls per category")
    args = ap.parse_args()
    asyncio.run(main(args.cats, args.max_scrolls))
