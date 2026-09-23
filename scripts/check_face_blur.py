"""Check whether faces are still detectable in a video.

    python scripts/check_face_blur.py <video.mp4>

Run this against an *anonymized* output to verify blurring actually worked
-- a face still detected there means that frame wasn't blurred enough. Run
it against a *source* clip to find real face-containing footage for testing.
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
    ap.add_argument("video_path", type=Path, help="video to scan for detectable faces")
    args = ap.parse_args(argv)

    if not args.video_path.is_file():
        print(f"FAIL: no such file: {args.video_path}")
        return 1

    hits = 0
    try:
        for idx, t, box, score in anonymize.scan_faces(args.video_path):
            hits += 1
            print(f"frame {idx:>6}  t={t:6.2f}s  conf={score:.2f}  box={box}")
    except anonymize.AnonymizeError as e:
        print(f"FAIL: {e}")
        return 1

    if hits == 0:
        print("no face detected in any frame")
    else:
        print(f"\n{hits} face detection(s) across the video.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
