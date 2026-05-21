# prj-lc — Naver Shopping Live: Crawler · SQLite ETL · Next.js explorer

End-to-end pipeline for archiving and exploring [shoppinglive.naver.com](https://shoppinglive.naver.com/home).

## Layout

```
prj-lc/
├── stage1_categories.py    Stage 1 — categories + exhibitions (static)
├── stage2_broadcasts.py    Stage 2 — broadcasts per category (Playwright)
├── stage3_comments.py      Stage 3 — comments for ended broadcasts (direct API)
├── etl/
│   ├── build_db.py         CSV → db/lc.sqlite (+ FTS5 indexes)
│   ├── analytics.py        precompute KPIs + run f2a HTML reports
│   ├── split_comments.py   split / merge data/comments.csv (≤95 MB chunks for git)
│   └── ...
├── data/                   crawled CSVs
│   ├── categories.csv       (committed)
│   ├── broadcasts.csv       (committed)
│   ├── broadcast_products.csv (committed)
│   ├── channels.csv         (committed)
│   ├── comments.csv         (NOT committed — 855 MB, rebuilt from parts)
│   └── comments.parts/      comments.part-{000..009}.csv (≤95 MB each, committed)
├── db/lc.sqlite             (NOT committed — 837 MB, rebuilt via etl/build_db.py)
└── webapp/                  Next.js 16 — dashboard, browser, downloads, analytics
    ├── public/analytics/    precomputed JSON + f2a HTML reports (committed)
    └── ...
```

## Clone-and-go

```powershell
# 1) dependencies
pip install -r requirements.txt
python -m playwright install chromium       # only if you plan to re-crawl

# 2) reconstruct comments.csv from chunked parts
python etl/split_comments.py --merge

# 3) build the SQLite DB (~30 s)
python etl/build_db.py

# 4) (optional) refresh analytics outputs
python etl/analytics.py

# 5) run the webapp
cd webapp
npm install
npm run dev                                  # http://localhost:3000
```

## Re-crawl from scratch

```powershell
python stage1_categories.py
python stage2_broadcasts.py
python stage3_comments.py --resume
python etl/build_db.py
python etl/analytics.py
```

## What's collected (this snapshot)

| | count |
|---|---|
| categories | 9 |
| channels | 3,622 |
| broadcasts | 19,256 (14,145 shortclips + 5,094 ENDED + 14 ONAIR + 3 END) |
| broadcast_products | 4,316 |
| comments | 4,703,470 (from 4,219 ended broadcasts) |

Stage 3 only fetches ENDED broadcasts (`END / REPLAY / BLOCK / FINISHED / CLOSE / STOP`). Shortclips (`broadcast_id` prefix `sc:`) use a different comment system and are out of scope for now.

## Discovered endpoints

- **Stage 2** — `GET apis.naver.com/selectiveweb/live_commerce_web/v1/category/gathering?categoryId=...&sort=LATEST&size=10&next=...`
- **Stage 3** — `GET apis.naver.com/live_commerce_web/viewer_api_web/v1/broadcast/{id}/replays/comments?size=100&lastCommentNo=...`  (header: `x-external-service-id: shoppinglive`)

## Webapp features

- Dashboard with daily time series, top channels/broadcasts, top words & emojis
- `/categories`, `/channels` lists with sort & filter
- `/broadcasts/[id]` — react-virtuoso virtual-scroll comment timeline (handles 151K+ comments)
- `/analytics` — 4 tabs (overview, time series, text, f2a reports)
- `/search` — trigram FTS5 (≥3 char) + LIKE fallback
- Downloads: per-broadcast CSV/XLSX, per-category ZIP, full-archive streaming ZIP

See [webapp/README.md](webapp/README.md) for the API/page reference.

## Politeness / safety

- 0.5–1.5 s jittered sleep between Stage 3 requests
- Stage 2 stops a category after 3 consecutive no-progress scrolls or null `next` cursor
- Stage 3 has resume support via `data/_stage3_done.txt` sidecar + dedup against `comments.csv`
