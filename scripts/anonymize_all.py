"""Anonymize every video's trimmed/ folder under work/, writing to a sibling
finished/ per video. Skips clips already done unless --force. This is what
the sidecar's /anonymize/start endpoint spawns as a subprocess.

    python scripts/anonymize_all.py [--work-root work] [--force]
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
    ap.add_argument("--force", action="store_true",
                     help="reprocess even where a finished/ file already exists")
    args = ap.parse_args(argv)

    if not args.work_root.is_dir():
        print(f"FAIL: no such folder: {args.work_root}")
        return 1

    results = anonymize.anonymize_all_trimmed(args.work_root, force=args.force)
    total = sum(len(v) for v in results.values())
    print(f"anonymized {total} file(s) across {len(results)} video folder(s)")
    for video_id, outputs in results.items():
        print(f"  {video_id}: {len(outputs)} file(s) -> work/{video_id}/finished/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
