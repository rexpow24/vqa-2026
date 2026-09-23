"""Blur faces and license plates in a single .mp4 file, or every .mp4 in a folder.

    python scripts/anonymize.py <video.mp4> [--output <file-or-folder>]
    python scripts/anonymize.py <input_folder> [--output <folder>] [--force]
    python scripts/anonymize.py work/AeseZkBqBf0/trimmed/shot_1.mp4
    python scripts/anonymize.py work/AeseZkBqBf0/trimmed --output work/AeseZkBqBf0/trimmed_anon

Folder mode skips a file whose output already exists, so re-running over a
growing trimmed/ folder only pays for what's new. Pass --force to redo
everything (e.g. after changing detection parameters).

Standalone: reads whatever file or folder it's pointed at, writes anonymized
copies next to it. Never touches pipeline.db, config.json, or the
reviewer's own state -- see vqa/anonymize.py for the detection/blur
pipeline itself.

First run downloads and caches two small ONNX models under models/ (see
vqa/anonymize.py for sources, licenses and sha256 pins).
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
    ap.add_argument("input_path", type=Path,
                    help="a single .mp4 file, or a folder of .mp4 files, to anonymize")
    ap.add_argument("--output", type=Path, default=None,
                    help="destination file or folder (default: alongside the input -- "
                         "<stem>_anonymized.mp4 for a single file, "
                         "<input>_anonymized/ for a folder)")
    ap.add_argument("--force", action="store_true",
                    help="reprocess even if output already exists (folder mode only)")
    args = ap.parse_args(argv)

    if args.input_path.is_file():
        if args.input_path.suffix.lower() != ".mp4":
            print(f"FAIL: not a .mp4 file: {args.input_path}")
            return 1
        try:
            dst = anonymize.anonymize_file(args.input_path, args.output)
        except anonymize.AnonymizeError as e:
            print(f"FAIL: {e}")
            return 1
        print(f"anonymized 1 file -> {dst}")
        return 0

    if args.input_path.is_dir():
        try:
            outputs = anonymize.anonymize_folder(args.input_path, args.output, force=args.force)
        except anonymize.AnonymizeError as e:
            print(f"FAIL: {e}")
            return 1

        if not outputs:
            print(f"no .mp4 files found in {args.input_path}")
            return 0

        print(f"anonymized {len(outputs)} file(s) -> {outputs[0].parent}")
        for p in outputs:
            print(f"  {p.name}")
        return 0

    print(f"FAIL: no such file or folder: {args.input_path}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
