"""One-off probe: open one category, capture the gathering API response, save to data/_capture/."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.async_api import async_playwright

from config import CAPTURE_DIR, HOME_HOST, USER_AGENT

PROBE_CATEGORY_ID = "dc:1"
GATHERING_MARK = "/v1/category/gathering"


async def main() -> None:
    captured: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=USER_AGENT,
            locale="ko-KR",
            viewport={"width": 1366, "height": 900},
        )
        page = await context.new_page()

        async def on_response(resp):
            if GATHERING_MARK in resp.url:
                try:
                    body = await resp.json()
                except Exception:
                    body = {"_text": (await resp.text())[:500]}
                captured.append({
                    "url": resp.url,
                    "status": resp.status,
                    "headers": dict(resp.request.headers),
                    "body": body,
                })

        page.on("response", on_response)
        await page.goto(f"{HOME_HOST}/categories/{PROBE_CATEGORY_ID}", wait_until="networkidle")
        await page.wait_for_timeout(3000)

        await context.close()
        await browser.close()

    out = CAPTURE_DIR / "gathering_probe.json"
    out.write_text(json.dumps(captured, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[probe] captured {len(captured)} responses -> {out}")
    if captured:
        body = captured[0]["body"]
        print(f"[probe] first response url: {captured[0]['url']}")
        print(f"[probe] body top keys: {list(body.keys()) if isinstance(body, dict) else type(body).__name__}")
        if isinstance(body, dict) and "list" in body:
            print(f"[probe] list len: {len(body['list'])}")
            if body["list"]:
                first = body["list"][0]
                print(f"[probe] first item top keys: {list(first.keys())}")
                for k in ("broadcast", "shortclip"):
                    if k in first and first[k]:
                        print(f"[probe] {k} keys: {list(first[k].keys())[:25]}")


if __name__ == "__main__":
    asyncio.run(main())
