"""Query clip decisions and independent output-shot labels for one video."""

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
        query += """
          AND (
            (c.trim_segments IS NULL AND r.difficulty IS NOT NULL
             AND r.event_label IS NOT NULL)
            OR
            (c.trim_segments IS NOT NULL
             AND (SELECT COUNT(*) FROM review_segments rs
                  WHERE rs.clip_id = c.clip_id) = json_array_length(c.trim_segments)
             AND NOT EXISTS (
               SELECT 1 FROM review_segments missing
               WHERE missing.clip_id = c.clip_id
                 AND (missing.difficulty IS NULL OR missing.event_label IS NULL)
             ))
          )
        """
    query += " ORDER BY COALESCE(r.reviewed_at, '') DESC, c.start_ms LIMIT ?"

    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, (args.video_id, args.top)).fetchall()

    if not rows:
        print(f"No clips found for video_id={args.video_id}")
        return

    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        for row in rows:
            segments = conn.execute(
                "SELECT segment_index, start_ms, end_ms, difficulty, event_label, reviewed_at "
                "FROM review_segments WHERE clip_id=? ORDER BY segment_index",
                (row["clip_id"],),
            ).fetchall()
            result = dict(row)
            result["segment_labels"] = [dict(segment) for segment in segments]
            print(result)


if __name__ == "__main__":
    main()
