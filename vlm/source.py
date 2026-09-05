"""What the VLM is allowed to look at.

The only module here that touches the pipeline database, and it opens it
read-only: the runner and the reviewer already contend over that file, and a
third writer is how this repo's worst bugs have started.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import NamedTuple

from vqa import db


class ClipRef(NamedTuple):
    """One finished shot: the unit a QA item is written about.

    Identity is `clip_id` plus `shot`, never the path. The reviewer deletes and
    rewrites files under `trimmed/` as decisions change, so a stored path is a
    pointer that goes stale without saying so.
    """
    clip_id: str
    video_id: str
    shot: int
    path: Path
    sha256: str


class Sources(NamedTuple):
    clips: list[ClipRef]
    missing: list[str]          # approved, but the file is no longer on disk


def _ro():
    conn = sqlite3.connect(f"file:{Path(db.DB_PATH).as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def approved_clips() -> Sources:
    """Every approved shot file on disk, plus the ones whose file has gone.

    Reads `clips.trim_segments` -- the column `review.materialize` actually
    writes and `app.py` actually reads. The older-looking `trimmed_path` is a
    trap: the migration in `db.py` reads it once and never writes it again, so
    on this project's database it is NULL on every row while thirty files sit
    in `trimmed/`, and on a database created today the column does not exist
    at all. Either way, asking for it is wrong.
    """
    conn = _ro()
    try:
        rows = conn.execute(
            "SELECT c.clip_id, c.youtube_video_id, c.trim_segments"
            " FROM clips c JOIN reviews r ON r.clip_id = c.clip_id"
            " WHERE r.decision = 'APPROVED'"
            "   AND c.trim_segments IS NOT NULL"
            "   AND c.trim_segments NOT IN ('', '[]')"
            " ORDER BY c.clip_id"
        ).fetchall()
    finally:
        conn.close()

    clips: list[ClipRef] = []
    missing: list[str] = []
    for r in rows:
        for i, seg in enumerate(json.loads(r["trim_segments"]), 1):
            p = Path(seg["path"])
            if not p.exists():
                # Rejected or purged since the last run. A named state, not an
                # error: the reviewer is allowed to change their mind.
                missing.append(f"{r['clip_id']}_t{i:02d}")
                continue
            clips.append(ClipRef(
                clip_id=r["clip_id"], video_id=r["youtube_video_id"], shot=i,
                path=p, sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    return Sources(clips, missing)
