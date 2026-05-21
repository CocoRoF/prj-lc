"""Stage 3 deep probe: capture FULL replays/comments response (not truncated) and inspect pagination."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.async_api import async_playwright

from config import CAPTURE_DIR, USER_AGENT, VIEW_HOST

COMMENT_MARK = "/replays/comments"
EXTRAS_MARK = "/replays/extras"


async def probe(broadcast_id: int, watch_seconds: int = 15) -> dict:
    bodies: list[dict] = []
    extras: list[dict] = []
    request_headers: dict | None = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            locale="ko-KR",
            viewport={"width": 1366, "height": 900},
        )
        page = await context.new_page()

        async def on_response(resp):
            nonlocal request_headers
            if COMMENT_MARK in resp.url:
                try:
                    body = await resp.json()
                    bodies.append({"url": resp.url, "body": body})
                    if request_headers is None:
                        request_headers = dict(resp.request.headers)
                except Exception:
                    pass
            elif EXTRAS_MARK in resp.url:
                try:
                    extras.append({"url": resp.url, "body": await resp.json()})
                except Exception:
                    pass

        page.on("response", on_response)
        url = f"{VIEW_HOST}/replays/{broadcast_id}"
        print(f"[probe3b] open {url}")
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(watch_seconds * 1000)

        await context.close()
        await browser.close()

    out = {"comments": bodies, "extras": extras, "request_headers": request_headers}
    (CAPTURE_DIR / "comments_probe.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return out


def summarize(out: dict) -> None:
    bodies = out["comments"]
    print(f"[probe3b] {len(bodies)} comment responses captured")
    for i, b in enumerate(bodies):
        body = b["body"]
        if not isinstance(body, dict):
            continue
        comments = body.get("comments") or []
        print(f"  resp {i}: url={b['url']}")
        print(f"    top keys: {list(body.keys())}")
        print(f"    comments: {len(comments)}")
        if comments:
            c0 = comments[0]
            cN = comments[-1]
            print(f"    comment keys: {list(c0.keys())}")
            print(f"    first comment: {json.dumps(c0, ensure_ascii=False)[:300]}")
            print(f"    last comment:  {json.dumps(cN, ensure_ascii=False)[:300]}")
        for k in ("before", "after", "next", "prev", "hasMore", "hasNext", "endOfList"):
            if k in body:
                print(f"    {k} = {body[k]}")
    if out["extras"]:
        e = out["extras"][-1]["body"]
        print(f"[probe3b] extras: commentCount={e.get('commentCount')}, likeTotalCount={e.get('likeTotalCount')}")


async def main() -> None:
    out = await probe(1925166, watch_seconds=15)
    summarize(out)
    if out["request_headers"]:
        rh = out["request_headers"]
        keep = {k: v for k, v in rh.items() if k.lower() not in ("cookie",)}
        print("\n[probe3b] non-cookie request headers:")
        for k, v in keep.items():
            print(f"  {k}: {v[:120]}")


if __name__ == "__main__":
    asyncio.run(main())
