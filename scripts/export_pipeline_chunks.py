"""Export pipeline clips and their clip-level labels from pipeline.db to CSV."""

from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERY = """
    SELECT v.title, c.youtube_video_id, c.clip_id, r.difficulty, r.event_label
    FROM clips AS c
    LEFT JOIN videos AS v ON v.youtube_video_id = c.youtube_video_id
    LEFT JOIN reviews AS r ON r.clip_id = c.clip_id
    ORDER BY c.youtube_video_id, c.seq, c.start_ms, c.clip_id
"""


def export_rows(
    conn: sqlite3.Connection,
) -> list[tuple[str | None, str, str, str | None, str | None]]:
    return [tuple(row) for row in conn.execute(QUERY)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=ROOT / "pipeline.db")
    parser.add_argument("-o", "--out", type=Path, default=ROOT / "pipeline_chunks.csv")
    args = parser.parse_args(argv)

    conn = sqlite3.connect(f"{args.db.resolve().as_uri()}?mode=ro", uri=True)
    try:
        rows = export_rows(conn)
    finally:
        conn.close()

    with args.out.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["video_title", "video_id", "chunk_id", "difficulty", "event_label"])
        writer.writerows(
            (title or "", video_id, chunk_id, difficulty or "", event_label or "")
            for title, video_id, chunk_id, difficulty, event_label in rows
        )

    print(f"{len(rows)} chunks -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
