"""Query review labels for one video from pipeline.db."""

import argparse
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("video_id")
    parser.add_argument("--top", type=int, default=5)
    parser.add_argument("--labeled-only", action="store_true")
    parser.add_argument("--db", type=Path, default=Path("pipeline.db"))
    args = parser.parse_args()

    query = """
        SELECT c.youtube_video_id, c.clip_id, c.start_ms, c.end_ms,
               r.decision, r.difficulty, r.event_label, r.reviewed_at,
               c.trim_segments
        FROM clips c
        LEFT JOIN reviews r ON r.clip_id = c.clip_id
        WHERE c.youtube_video_id = ?
    """
    if args.labeled_only:
        query += " AND r.difficulty IS NOT NULL AND r.event_label IS NOT NULL"
    query += " ORDER BY COALESCE(r.reviewed_at, '') DESC, c.start_ms LIMIT ?"

    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, (args.video_id, args.top)).fetchall()

    if not rows:
        print(f"No clips found for video_id={args.video_id}")
        return

    for row in rows:
        print(dict(row))


if __name__ == "__main__":
    main()
