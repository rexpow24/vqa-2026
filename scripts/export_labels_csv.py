"""Export the human difficulty / event_label of every approved shot to CSV.

    python -m scripts.export_labels_csv                 # -> labels.csv
    python -m scripts.export_labels_csv -o out.csv --all

Columns: video_id, difficulty, event_label. `video_id` is the shot file stem
(`<clip_id>_t01`), i.e. `videos.csv`'s `filename` without `.mp4`.

Labels come from `review_segments` (one per shot) and fall back to the clip-level
`reviews` row for clips decided before per-shot labels existed -- the same rule
the sidecar uses when it saves them. Shots missing either label are skipped
unless --all is given (then the blank cell is kept).
The DB is opened read-only.
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

QUERY = """
    SELECT c.clip_id, c.trim_segments,
           r.difficulty AS r_difficulty, r.event_label AS r_event
    FROM clips c JOIN reviews r ON r.clip_id = c.clip_id
    WHERE r.decision = 'APPROVED'
      AND c.trim_segments IS NOT NULL AND c.trim_segments NOT IN ('', '[]')
    ORDER BY c.clip_id
"""


def export_rows(conn: sqlite3.Connection) -> list[tuple[str, str | None, str | None]]:
    seg = {(r[0], r[1]): (r[2], r[3]) for r in conn.execute(
        "SELECT clip_id, segment_index, difficulty, event_label FROM review_segments")}
    out = []
    for r in conn.execute(QUERY):
        for i, _ in enumerate(json.loads(r["trim_segments"])):
            difficulty, event = seg.get((r["clip_id"], i), (None, None))
            out.append((f"{r['clip_id']}_t{i + 1:02d}",
                        difficulty or r["r_difficulty"], event or r["r_event"]))
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", type=Path, default=ROOT / "labels.csv")
    ap.add_argument("--db", type=Path, default=ROOT / "pipeline.db")
    ap.add_argument("--all", action="store_true",
                    help="keep shots that lack a difficulty or event_label")
    args = ap.parse_args(argv)

    conn = sqlite3.connect(f"file:{args.db.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = export_rows(conn)
    finally:
        conn.close()

    kept = rows if args.all else [r for r in rows if r[1] and r[2]]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["video_id", "difficulty", "event_label"])
        w.writerows((v, d or "", e or "") for v, d, e in kept)
    print(f"{len(kept)} rows -> {args.out} ({len(rows) - len(kept)} unlabeled skipped)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
