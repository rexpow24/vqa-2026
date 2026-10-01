"""Query clips that already have a decision but are missing difficulty/event_label.

Those two columns were added after some clips had already been reviewed, so
they exist with decision set but difficulty/event_label NULL. `/review/next`
only queues UNREVIEWED clips, so this backlog never resurfaces on its own --
this script (and the /relabel UI) is how it's found and cleared.
"""

import argparse
import sqlite3
from pathlib import Path

QUERY = """
    SELECT c.youtube_video_id, c.clip_id, r.decision, r.difficulty, r.event_label
    FROM clips c
    JOIN reviews r ON r.clip_id = c.clip_id
    WHERE r.decision != 'UNREVIEWED'
      AND (r.difficulty IS NULL OR r.event_label IS NULL)
      {trimmed_filter}
    ORDER BY c.youtube_video_id, c.start_ms
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("pipeline.db"))
    parser.add_argument("--by-video", action="store_true",
                         help="print one line per video with its missing-label count")
    parser.add_argument("--trimmed-only", action="store_true",
                         help="only clips materialized into trimmed/ (what the Relabel tab shows)")
    args = parser.parse_args()

    query = QUERY.format(
        trimmed_filter="AND c.trim_segments IS NOT NULL" if args.trimmed_only else "")
    with sqlite3.connect(args.db) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query).fetchall()

    if not rows:
        print("Nothing missing -- every decided clip has both labels.")
        return

    if args.by_video:
        counts: dict[str, int] = {}
        for row in rows:
            counts[row["youtube_video_id"]] = counts.get(row["youtube_video_id"], 0) + 1
        for video_id, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            print(f"{video_id}: {n} clip(s)")
        print(f"\n{len(counts)} video(s), {len(rows)} clip(s) total")
        return

    for row in rows:
        print(dict(row))
    print(f"\n{len(rows)} clip(s) total")


if __name__ == "__main__":
    main()
