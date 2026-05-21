"""Orchestrate the full 3-stage pipeline.

Usage:
    python run_all.py                  # stage1 + stage2 + stage3 (all categories, ENDED broadcasts)
    python run_all.py --skip-stage1    # skip categories step
    python run_all.py --skip-stage2    # use existing broadcasts.csv
    python run_all.py --cats dc:1 dc:2 # restrict stage 2 categories
    python run_all.py --comment-limit 100   # only fetch comments for 100 broadcasts
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import stage1_categories
import stage2_broadcasts
import stage3_comments


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-stage1", action="store_true")
    ap.add_argument("--skip-stage2", action="store_true")
    ap.add_argument("--skip-stage3", action="store_true")
    ap.add_argument("--cats", nargs="*", default=None, help="restrict stage 2 to these category ids")
    ap.add_argument("--max-scrolls", type=int, default=None, help="cap scrolls per category (default 200)")
    ap.add_argument("--comment-limit", type=int, default=None, help="cap stage 3 broadcasts processed")
    ap.add_argument("--resume", action="store_true", help="skip stage 3 broadcasts already in comments.csv")
    args = ap.parse_args()

    if not args.skip_stage1:
        print("\n===== STAGE 1 =====")
        stage1_categories.main()

    if not args.skip_stage2:
        print("\n===== STAGE 2 =====")
        asyncio.run(stage2_broadcasts.main(args.cats, args.max_scrolls))

    if not args.skip_stage3:
        print("\n===== STAGE 3 =====")
        sys.argv = ["stage3_comments.py"]
        if args.comment_limit:
            sys.argv += ["--limit", str(args.comment_limit)]
        if args.resume:
            sys.argv += ["--resume"]
        stage3_comments.main()


if __name__ == "__main__":
    main()
