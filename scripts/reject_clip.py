"""Reject one reviewed clip and remove its materialized trimmed files."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from vqa import db, review  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Reject one APPROVED clip, delete only its trimmed output files, "
            "and clear its trim metadata and per-shot labels."
        )
    )
    parser.add_argument("clip_id", help="clip ID to reject")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="skip the confirmation prompt",
    )
    args = parser.parse_args()

    with db.tx() as conn:
        clip = conn.execute(
            "SELECT c.*, r.decision FROM clips c "
            "LEFT JOIN reviews r ON r.clip_id=c.clip_id WHERE c.clip_id=?",
            (args.clip_id,),
        ).fetchone()

    if clip is None:
        print(f"Error: clip not found: {args.clip_id}", file=sys.stderr)
        return 1

    segments = db.trim_segments(clip)
    if clip["decision"] == db.REJECTED and not segments:
        print(f"Already rejected; no trim files recorded: {args.clip_id}")
        return 0
    if clip["decision"] != db.APPROVED:
        print(
            f"Error: expected decision APPROVED, found {clip['decision']!r}; "
            "nothing changed.",
            file=sys.stderr,
        )
        return 1
    if not segments:
        print(
            "Error: clip is APPROVED but has no trim metadata; nothing changed.",
            file=sys.stderr,
        )
        return 1

    expected_dir = review.trimmed_dir(clip).resolve()
    paths = [Path(segment["path"]).resolve() for segment in segments]
    if any(
        path.parent != expected_dir
        or not path.name.startswith(f"{args.clip_id}_t")
        for path in paths
    ):
        print(
            "Error: trim metadata contains a path outside this clip's trimmed folder; "
            "nothing changed.",
            file=sys.stderr,
        )
        return 1

    print(f"clip_id: {args.clip_id}")
    print(f"decision: {clip['decision']} -> {db.REJECTED}")
    print(f"trim_files: {len(paths)}")
    for path in paths:
        print(f"  {path} ({'exists' if path.exists() else 'already missing'})")

    if not args.yes:
        if not sys.stdin.isatty():
            print("Error: confirmation required; rerun with --yes.", file=sys.stderr)
            return 2
        try:
            confirmation = input(f"Type {args.clip_id} to confirm: ").strip()
        except EOFError:
            print("Error: confirmation was not provided; nothing changed.", file=sys.stderr)
            return 2
        if confirmation != args.clip_id:
            print("Cancelled; nothing changed.")
            return 0

    removed = review.discard(clip)
    db.set_decision(args.clip_id, db.REJECTED)
    print(f"result: REJECTED, removed_files={removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
