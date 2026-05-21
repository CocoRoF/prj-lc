"""Stage 3 probe: open a viewer page for an ENDED broadcast and capture every XHR.
Saves output to data/_capture/viewer_probe.json so we can identify the comment polling URL.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.async_api import async_playwright

from config import CAPTURE_DIR, USER_AGENT, VIEW_HOST


async def probe(viewer_url: str, watch_seconds: int = 12) -> list[dict]:
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
            url = resp.url
            if any(s in url.lower() for s in ("comment", "cbox", "chat", "polling", "/v1/", "/v2/", "extra", "view-count")):
                rec = {"url": url, "status": resp.status, "method": resp.request.method}
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
                    try:
                        rec["body_preview"] = json.dumps(await resp.json(), ensure_ascii=False)[:2000]
                    except Exception:
                        rec["body_preview"] = (await resp.text())[:1500]
                else:
                    rec["body_preview"] = (await resp.text())[:300]
                captured.append(rec)

        page.on("response", on_response)
        print(f"[probe3] open {viewer_url}")
        await page.goto(viewer_url, wait_until="domcontentloaded")
        await page.wait_for_timeout(watch_seconds * 1000)

        await context.close()
        await browser.close()

    return captured


async def main(viewer_url: str | None = None) -> None:
    if not viewer_url:
        viewer_url = f"{VIEW_HOST}/replays/1925166"
    out_path = CAPTURE_DIR / "viewer_probe.json"
    captured = await probe(viewer_url, watch_seconds=12)
    out_path.write_text(json.dumps(captured, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[probe3] captured {len(captured)} entries -> {out_path}")
    seen = set()
    for c in captured:
        base = c["url"].split("?")[0]
        if base in seen:
            continue
        seen.add(base)
        print(f"  {c['method']} {c['status']} {base}")
        prev = c.get("body_preview", "")
        if prev:
            print(f"      preview: {prev[:240]}")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", help="viewer URL (defaults to a known ended broadcast)")
    args = ap.parse_args()
    asyncio.run(main(args.url))
