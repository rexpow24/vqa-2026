"""Anonymize Dedup-allowed trimmed clips under work/, writing to finished/
-- one flat, centralized folder alongside work/, not nested inside each
video's own work dir and not split into per-video subfolders (clip
filenames already start with their video_id, so they stay unique). Skips
clips already done unless --force. The project work/ folder requires a fresh
Dedup index by default. This is what the sidecar's
/anonymize/start endpoint spawns as a subprocess.

    python scripts/anonymize_all.py [--work-root work] [--finished-root finished] [--force]
    python scripts/anonymize_all.py --video-id 0aD5Bbh_GgU --video-id AeseZkBqBf0 --force
    python scripts/anonymize_all.py --limit 5 --force
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vqa import anonymize  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work-root", type=Path, default=Path("work"),
                     help="folder containing per-video work dirs (default: work)")
    ap.add_argument("--finished-root", type=Path, default=Path("finished"),
                     help="centralized output folder, alongside work/ (default: finished)")
    ap.add_argument("--force", action="store_true",
                     help="reprocess even where a finished/ file already exists")
    ap.add_argument("--video-id", action="append", dest="video_ids", metavar="ID",
                     help="only this video's trimmed/ folder; repeatable. "
                          "An unknown id is an error, not an empty run.")
    ap.add_argument("--limit", type=int, metavar="N",
                     help="stop after N clips are actually encoded. Clips skipped "
                          "because finished/ already has them do not count.")
    ap.add_argument("--pause-file", type=Path,
                    help="finish the current clip, then stop before the next one")
    ap.add_argument("--require-dedup", action="store_true",
                    help="only anonymize clips allowed by a fresh, fully reviewed dedup index")
    ap.add_argument("--skip-dedup", action="store_true",
                    help="explicit maintenance bypass for the project's work/ folder")
    args = ap.parse_args(argv)

    if not args.work_root.is_dir():
        print(f"FAIL: no such folder: {args.work_root}")
        return 1

    if args.limit is not None and args.limit <= 0:
        print("FAIL: --limit needs a positive number")
        return 1

    should_pause = (lambda: args.pause_file.exists()) if args.pause_file else None
    should_include = None
    from vqa import db, dedup
    project_work = args.work_root.resolve() == (dedup.ROOT / "work").resolve()
    require_dedup = args.require_dedup or (project_work and not args.skip_dedup)
    if args.require_dedup and args.skip_dedup:
        print("FAIL: --require-dedup and --skip-dedup cannot be combined")
        return 1
    if require_dedup:
        if not project_work:
            print("FAIL: dedup gate requires the project's work/ folder")
            return 1
        db.init()
        try:
            allowed = dedup.allowed_sources()
        except ValueError as e:
            print(f"FAIL: {e}")
            return 1
        index, _ = dedup.read_index()
        assert index is not None
        signatures = {source["path"]: source["signature"] for source in index["sources"]}

        def should_include(src: Path) -> bool:
            absolute = src.resolve()
            relative = absolute.relative_to(dedup.ROOT).as_posix()
            if relative not in allowed:
                return False
            if dedup.source_signature(absolute) != signatures[relative]:
                raise anonymize.AnonymizeError(
                    f"trimmed clip changed during anonymize: {relative}; run Dedup again")
            return True

    counter: dict[str, int] = {"encoded": 0, "skipped": 0}
    try:
        results = anonymize.anonymize_all_trimmed(
            args.work_root, args.finished_root, force=args.force,
            should_pause=should_pause, video_ids=args.video_ids, limit=args.limit,
            counter=counter, should_include=should_include)
    except anonymize.AnonymizeError as e:
        print(f"FAIL: {e}")
        return 1

    # Encoded and skipped are reported apart on purpose. They used to be added
    # together, so a resumed run claimed to have anonymized clips it had only
    # found already done -- `--limit 10` printed 12.
    encoded, skipped = counter["encoded"], counter["skipped"]
    print(f"encoded {encoded} clip(s); skipped {skipped} already in "
          f"{args.finished_root}/ ({len(results)} video folder(s) visited)")
    if skipped and not args.force:
        print("  (skipped clips are never re-checked for staleness -- "
              "use --force to redo them)")
    if args.limit is not None and encoded >= args.limit:
        print(f"  (stopped at --limit {args.limit}; more clips remain)")
    for video_id, outputs in results.items():
        print(f"  {video_id}: {len(outputs)} file(s) in {args.finished_root}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
