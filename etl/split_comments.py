"""Split data/comments.csv into <100MB chunks for git-friendly storage.

Each chunk is a complete CSV with its own header so it can be inspected on its
own. Run `etl/merge_comments.py` afterwards (or run this script's `--merge`)
to reconstruct the single comments.csv.

Usage:
    python etl/split_comments.py
    python etl/split_comments.py --chunk-mb 95
    python etl/split_comments.py --merge
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "comments.csv"
PARTS_DIR = ROOT / "data" / "comments.parts"


def split(chunk_mb: int) -> None:
    if not SRC.exists():
        sys.exit(f"missing source: {SRC}")
    PARTS_DIR.mkdir(parents=True, exist_ok=True)
    for old in PARTS_DIR.glob("comments.part-*.csv"):
        old.unlink()

    budget = chunk_mb * 1024 * 1024
    print(f"[split] target chunk size: {chunk_mb} MB ({budget} bytes)")

    with SRC.open("rb") as src:
        header = src.readline()
        if not header:
            sys.exit("empty source file")
        size_of_header = len(header)

        idx = 0
        out = None
        written = 0
        total_lines = 0

        try:
            for line in src:
                if out is None:
                    path = PARTS_DIR / f"comments.part-{idx:03d}.csv"
                    out = path.open("wb")
                    out.write(header)
                    written = size_of_header
                    print(f"[split] -> {path.name}")
                out.write(line)
                written += len(line)
                total_lines += 1
                if written >= budget:
                    out.close()
                    print(f"[split]    closed at {written/1024/1024:.1f} MB ({total_lines:,} lines so far)")
                    idx += 1
                    out = None
        finally:
            if out is not None:
                out.close()
                print(f"[split]    final part closed at {written/1024/1024:.1f} MB")

    parts = sorted(PARTS_DIR.glob("comments.part-*.csv"))
    sum_mb = sum(p.stat().st_size for p in parts) / 1024 / 1024
    src_mb = SRC.stat().st_size / 1024 / 1024
    print(f"[split] {len(parts)} parts written ({sum_mb:.1f} MB total, source was {src_mb:.1f} MB)")


def merge() -> None:
    parts = sorted(PARTS_DIR.glob("comments.part-*.csv"))
    if not parts:
        sys.exit(f"no parts found in {PARTS_DIR}")
    print(f"[merge] reading {len(parts)} parts -> {SRC}")
    SRC.parent.mkdir(parents=True, exist_ok=True)
    with SRC.open("wb") as out:
        for i, p in enumerate(parts):
            with p.open("rb") as f:
                header = f.readline()
                if i == 0:
                    out.write(header)
                shutil.copyfileobj(f, out, length=1 << 20)
            print(f"[merge]    + {p.name}")
    print(f"[merge] done -> {SRC} ({SRC.stat().st_size/1024/1024:.1f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunk-mb", type=int, default=95, help="target chunk size (default 95)")
    ap.add_argument("--merge", action="store_true", help="merge parts back into comments.csv")
    args = ap.parse_args()
    if args.merge:
        merge()
    else:
        split(args.chunk_mb)


if __name__ == "__main__":
    main()
