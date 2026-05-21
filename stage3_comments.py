"""Stage 3: collect comments for ENDED broadcasts.

Endpoint (discovered via Playwright probe — see stage3_endpoint_probe.py):
    GET https://apis.naver.com/live_commerce_web/viewer_api_web/v1/broadcast/{id}/replays/comments
        ?size=100
        &lastCommentNo={cursor}          # omit (or 0) to fetch from the start
        &slSessionId={uuid}              # any uuid v4 works
    Required header: x-external-service-id: shoppinglive

Pagination:
    - Default order is ascending commentNo (oldest first).
    - Use the response's `lastCommentNo` as the cursor for the next page.
    - Stop when `hasNext` is false OR no new commentNos appear.

Scope:
    Only broadcasts whose status indicates the broadcast has ended and a replay
    exists. Live (`IN_SERVICE`, `OPEN`, `STAND_BY`, `SCHEDULED`) broadcasts are skipped.
    Shortclips (broadcast_id starting with `sc:`) are skipped for now (cbox7 path differs).
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    BROADCASTS_CSV,
    COMMENTS_CSV,
    CSV_ENCODING,
    DATA_DIR,
    REQUEST_MAX_GAP,
    REQUEST_MIN_GAP,
    REQUEST_TIMEOUT,
    USER_AGENT,
)
from utils.csv_io import read_rows

DONE_MARKER = DATA_DIR / "_stage3_done.txt"

COMMENT_ENDPOINT = (
    "https://apis.naver.com/live_commerce_web/viewer_api_web/v1"
    "/broadcast/{broadcast_id}/replays/comments"
)
PAGE_SIZE = 100
MAX_PAGES_SAFETY = 2000

ENDED_STATUSES = {"END", "REPLAY", "BLOCK", "FINISHED", "CLOSE", "STOP"}
SKIP_PREFIX = "sc:"

COMMENT_FIELDS = [
    "broadcast_id", "comment_no", "comment_id", "user_id_no",
    "nickname", "message", "comment_type",
    "created_at", "created_at_milli", "has_answer",
    "record_started_at", "crawled_at",
]


def _sleep_polite() -> None:
    import random
    time.sleep(random.uniform(REQUEST_MIN_GAP, REQUEST_MAX_GAP))


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "x-external-service-id": "shoppinglive",
        "Origin": "https://view.shoppinglive.naver.com",
    })
    return s


def fetch_comments_for_broadcast(
    session: requests.Session, broadcast_id: int | str, sl_session_id: str
) -> list[dict]:
    """Iterate through all comment pages for an ended broadcast."""
    url = COMMENT_ENDPOINT.format(broadcast_id=broadcast_id)
    headers = {"Referer": f"https://view.shoppinglive.naver.com/replays/{broadcast_id}"}
    all_comments: dict[int, dict] = {}
    last_no = 0

    for page in range(MAX_PAGES_SAFETY):
        params = {"size": PAGE_SIZE, "slSessionId": sl_session_id}
        if last_no:
            params["lastCommentNo"] = str(last_no)
        try:
            r = session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as e:
            print(f"  ! request error on page {page+1}: {e}", flush=True)
            break
        if r.status_code != 200:
            if page == 0:
                print(f"  ! HTTP {r.status_code} on first page for {broadcast_id}", flush=True)
            break
        body = r.json()
        comments = body.get("comments") or []
        new = 0
        for c in comments:
            cn = c.get("commentNo")
            if cn is not None and cn not in all_comments:
                all_comments[cn] = c
                new += 1
        has_next = bool(body.get("hasNext"))
        new_last = body.get("lastCommentNo")
        if not has_next:
            break
        if new == 0 or new_last in (None, last_no):
            break
        last_no = new_last

    return list(all_comments.values())


_CTRL_TRANSLATE = {i: None for i in range(0, 32) if i not in (9,)}  # drop control chars except TAB


def _clean(s):
    if s is None:
        return None
    if not isinstance(s, str):
        return s
    return s.translate(_CTRL_TRANSLATE)


def to_csv_row(broadcast_id: int | str, c: dict) -> dict:
    return {
        "broadcast_id": broadcast_id,
        "comment_no": c.get("commentNo"),
        "comment_id": c.get("id"),
        "user_id_no": _clean(c.get("idNo")),
        "nickname": _clean(c.get("nickname")),
        "message": _clean(c.get("message")),
        "comment_type": c.get("commentType"),
        "created_at": c.get("createdAt"),
        "created_at_milli": c.get("createdAtMilli"),
        "has_answer": c.get("hasAnswer"),
        "record_started_at": c.get("recordStartedAt"),
        "crawled_at": datetime.now(timezone.utc).isoformat(),
    }


def select_ended_broadcasts(rows: Iterable[dict]) -> list[dict]:
    out = []
    for r in rows:
        bid = r.get("broadcast_id") or ""
        if bid.startswith(SKIP_PREFIX):
            continue
        status = (r.get("status") or "").upper()
        if status in ENDED_STATUSES:
            out.append(r)
    return out


def existing_comment_nos(path: Path) -> set[str]:
    """One-pass read of comment_no values already present."""
    if not path.exists():
        return set()
    cnos: set[str] = set()
    with path.open("r", encoding=CSV_ENCODING, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            v = row.get("comment_no")
            if v:
                cnos.add(v)
    return cnos


def load_done_marker(path: Path) -> set[str]:
    """Sidecar list of broadcasts that finished completely. Lines like 'bid'."""
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def append_done_marker(path: Path, bid: str | int) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(f"{bid}\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", action="append", help="restrict to specific broadcast id(s)")
    ap.add_argument("--limit", type=int, default=None, help="stop after N broadcasts")
    ap.add_argument("--statuses", nargs="*", default=None,
                    help="override ended-status whitelist (e.g. END BLOCK REPLAY)")
    ap.add_argument("--resume", action="store_true",
                    help="skip broadcast_ids already present in comments.csv")
    args = ap.parse_args()

    rows = read_rows(BROADCASTS_CSV)
    if not rows:
        raise SystemExit("[stage3] no broadcasts.csv — run stage2 first")

    if args.id:
        wanted = set(args.id)
        targets = [r for r in rows if str(r["broadcast_id"]) in wanted]
    else:
        global ENDED_STATUSES
        if args.statuses:
            ENDED_STATUSES = {s.upper() for s in args.statuses}
        targets = select_ended_broadcasts(rows)

    done_bids = load_done_marker(DONE_MARKER)
    done_cnos = existing_comment_nos(COMMENTS_CSV)
    if args.resume:
        before = len(targets)
        targets = [t for t in targets if str(t["broadcast_id"]) not in done_bids]
        print(f"[stage3] resume: skipping {before - len(targets)} broadcasts in done-marker "
              f"({len(done_cnos)} existing comments will be deduped)")

    if args.limit:
        targets = targets[: args.limit]

    print(f"[stage3] target broadcasts: {len(targets)}")

    session = _make_session()
    sl = str(uuid.uuid4())

    write_header = not COMMENTS_CSV.exists()
    total_comments = 0
    with COMMENTS_CSV.open("a", encoding=CSV_ENCODING, newline="") as fout:
        writer = csv.DictWriter(
            fout, fieldnames=COMMENT_FIELDS, extrasaction="ignore",
            quoting=csv.QUOTE_ALL, escapechar="\\",
        )
        if write_header:
            writer.writeheader()
        for i, r in enumerate(targets, 1):
            bid = r["broadcast_id"]
            title = (r.get("title") or "").strip()[:30]
            comments = fetch_comments_for_broadcast(session, bid, sl)
            n = 0
            for c in comments:
                cn = c.get("commentNo")
                if cn is None:
                    continue
                key = str(cn)
                if key in done_cnos:
                    continue
                done_cnos.add(key)
                writer.writerow(to_csv_row(bid, c))
                n += 1
            fout.flush()
            append_done_marker(DONE_MARKER, bid)
            total_comments += n
            print(f"[stage3] [{i:>5}/{len(targets)}] bid={bid} status={r.get('status')} +{n} comments  ({title})", flush=True)
            _sleep_polite()

    print(f"[stage3] DONE — +{total_comments} comments -> {COMMENTS_CSV}")


if __name__ == "__main__":
    main()
