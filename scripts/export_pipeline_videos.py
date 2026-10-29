"""Export video titles and IDs from pipeline.db to CSV."""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERY = """
    SELECT title, youtube_video_id
    FROM videos
"""


def export_rows(conn: sqlite3.Connection) -> list[tuple[str | None, str]]:
    rows = [(row[0], row[1]) for row in conn.execute(QUERY)]

    def sort_key(row: tuple[str | None, str]) -> tuple[int, int, int, str, str]:
        title, video_id = row
        match = re.search(r"\bP(\d+)\b", title or "", re.IGNORECASE)
        if match:
            return (0, int(match.group(1)), 0, title.casefold(), video_id)
        return (1, 0, int(title is None), (title or "").casefold(), video_id)

    return sorted(rows, key=sort_key)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=ROOT / "pipeline.db")
    parser.add_argument("-o", "--out", type=Path, default=ROOT / "pipeline_videos.csv")
    args = parser.parse_args(argv)

    conn = sqlite3.connect(f"{args.db.resolve().as_uri()}?mode=ro", uri=True)
    try:
        rows = export_rows(conn)
    finally:
        conn.close()

    with args.out.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["video_title", "video_id"])
        writer.writerows((title or "", video_id) for title, video_id in rows)

    print(f"{len(rows)} videos -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
