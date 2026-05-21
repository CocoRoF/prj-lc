"""Print a short summary of all collected CSVs."""
from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    BROADCAST_PRODUCTS_CSV,
    BROADCASTS_CSV,
    CATEGORIES_CSV,
    CHANNELS_CSV,
    COMMENTS_CSV,
    CSV_ENCODING,
    EXHIBITIONS_CSV,
)


def _count_and_load(path: Path) -> tuple[int, list[dict]]:
    if not path.exists():
        return 0, []
    with path.open("r", encoding=CSV_ENCODING, newline="") as f:
        rows = list(csv.DictReader(f))
    return len(rows), rows


def main() -> None:
    print("=== prj-lc collected data summary ===\n")
    for name, path in [
        ("categories", CATEGORIES_CSV),
        ("exhibitions", EXHIBITIONS_CSV),
        ("broadcasts", BROADCASTS_CSV),
        ("broadcast_products", BROADCAST_PRODUCTS_CSV),
        ("channels", CHANNELS_CSV),
        ("comments", COMMENTS_CSV),
    ]:
        n, _ = _count_and_load(path)
        marker = "" if path.exists() else "  (file missing)"
        print(f"  {name:<22} {n:>7} rows{marker}")

    n, bcs = _count_and_load(BROADCASTS_CSV)
    if n:
        print()
        print("--- broadcasts breakdown ---")
        print("  by category:")
        for cid, c in Counter(b["category_id"] for b in bcs).most_common():
            print(f"    {cid:<6} {c:>6}")
        print("  by status:")
        for s, c in Counter(b.get("status") or "" for b in bcs).most_common():
            print(f"    {s:<12} {c:>6}")
        print("  by kind:")
        print(f"    shortclip   {sum(1 for b in bcs if b.get('is_shortclip')=='True'):>6}")
        print(f"    broadcast   {sum(1 for b in bcs if b.get('is_shortclip')!='True'):>6}")

    n, comments = _count_and_load(COMMENTS_CSV)
    if n:
        print()
        print("--- comments breakdown ---")
        by_bc = Counter(c["broadcast_id"] for c in comments)
        print(f"  unique broadcasts with comments: {len(by_bc)}")
        if by_bc:
            top = by_bc.most_common(5)
            print("  top-5 broadcasts by comment count:")
            for bid, c in top:
                print(f"    bid={bid:<10}  {c:>5} comments")


if __name__ == "__main__":
    main()
