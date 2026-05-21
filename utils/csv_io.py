import csv
from pathlib import Path
from typing import Iterable, Mapping, Sequence

from config import CSV_ENCODING


def write_rows(path: Path, fieldnames: Sequence[str], rows: Iterable[Mapping]) -> int:
    """Overwrite-write a CSV. Returns row count."""
    rows = list(rows)
    with path.open("w", encoding=CSV_ENCODING, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    return len(rows)


def append_rows(
    path: Path, fieldnames: Sequence[str], rows: Iterable[Mapping], dedupe_key: str | None = None
) -> int:
    """Append rows; if dedupe_key is given, skip keys already present in file."""
    rows = list(rows)
    existing: set[str] = set()
    write_header = not path.exists()

    if dedupe_key and path.exists():
        with path.open("r", encoding=CSV_ENCODING, newline="") as f:
            reader = csv.DictReader(f)
            for r in reader:
                v = r.get(dedupe_key)
                if v is not None:
                    existing.add(str(v))

    written = 0
    with path.open("a", encoding=CSV_ENCODING, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        for r in rows:
            if dedupe_key:
                k = str(r.get(dedupe_key, ""))
                if k in existing:
                    continue
                existing.add(k)
            writer.writerow(r)
            written += 1
    return written


def read_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding=CSV_ENCODING, newline="") as f:
        return list(csv.DictReader(f))
