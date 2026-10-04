"""Re-encode every finished/*.mp4 that isn't H.264.

Runs straight against the top-level finished/ folder (alongside work/) by
default -- no arguments needed. Historical cleanup: process_video() now
writes H.264 directly, so this is only needed for files anonymized before
that fix. Skips anything already H.264 unless --force.

    python scripts/fix_finished_codec.py [--finished-root finished] [--force]
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
    ap.add_argument("--finished-root", type=Path, default=Path("finished"),
                     help="centralized output folder, alongside work/ (default: finished)")
    ap.add_argument("--force", action="store_true",
                     help="re-encode even files that are already H.264")
    ap.add_argument("--pause-file", type=Path,
                    help="finish the current file, then stop before the next one")
    args = ap.parse_args(argv)

    if not args.finished_root.is_dir():
        print(f"FAIL: no such folder: {args.finished_root}")
        return 1

    should_pause = (lambda: args.pause_file.exists()) if args.pause_file else None
    fixed = anonymize.fix_finished_codec(
        args.finished_root, force=args.force, should_pause=should_pause)
    print(f"re-encoded {len(fixed)} file(s)")
    for f in fixed:
        print(f"  {f.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
