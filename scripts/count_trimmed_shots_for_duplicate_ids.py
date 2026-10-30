"""Count reviewed trimmed shot files for duplicate video IDs."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def count_trimmed_shots(
    duplicates_csv: Path,
    work_root: Path,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    with duplicates_csv.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or "video_id" not in reader.fieldnames:
            raise ValueError(f"{duplicates_csv} must contain a video_id column")

        for row in reader:
            video_id = (row.get("video_id") or "").strip()
            if not video_id:
                continue
            trimmed_dirs = [
                work_root / video_id / "trimmed",
                work_root / "facebook" / video_id / "trimmed",
            ]
            shot_count = len({
                path
                for directory in trimmed_dirs
                if directory.is_dir()
                for path in directory.glob("*.mp4")
                if path.is_file()
            })
            results.append({
                "video_id": video_id,
                "trimmed_shot_count": shot_count,
            })
    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--duplicates-csv",
        type=Path,
        default=ROOT / "csvs" / "duplicate_video_ids.csv",
    )
    parser.add_argument("--work-root", type=Path, default=ROOT / "work")
    args = parser.parse_args(argv)

    if not args.duplicates_csv.is_file():
        parser.error(f"not a file: {args.duplicates_csv}")
    if not args.work_root.is_dir():
        parser.error(f"not a directory: {args.work_root}")

    try:
        results = count_trimmed_shots(args.duplicates_csv, args.work_root)
    except ValueError as exc:
        parser.error(str(exc))

    total_shots = sum(int(row["trimmed_shot_count"]) for row in results)
    for row in results:
        print(f"{row['video_id']}: {row['trimmed_shot_count']} shots")
    print(f"Total shots lost if deleted: {total_shots}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
