"""Find duplicate video_id values across CSV files in a directory."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def find_duplicates(directory: Path, output: Path) -> list[dict[str, object]]:
    occurrences: dict[str, list[tuple[str, str]]] = defaultdict(list)
    output_resolved = output.resolve()

    for path in sorted(directory.glob("*.csv")):
        if path.resolve() == output_resolved:
            continue
        with path.open(newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if not reader.fieldnames:
                continue
            id_column = next(
                (name for name in reader.fieldnames
                 if name.strip().casefold() == "video_id"),
                None,
            )
            title_column = next(
                (name for name in reader.fieldnames
                 if name.strip().casefold() in {"title", "video_title"}),
                None,
            )
            if id_column is None:
                continue

            for row in reader:
                video_id = (row.get(id_column) or "").strip()
                if video_id:
                    title = (row.get(title_column) or "").strip() if title_column else ""
                    occurrences[video_id].append(
                        (title, f"{path.name}:{reader.line_num}")
                    )

    return [
        {
            "video_id": video_id,
            "title": "; ".join(dict.fromkeys(
                title for title, _ in entries if title
            )),
            "occurrence_count": len(entries),
            "locations": "; ".join(location for _, location in entries),
        }
        for video_id, entries in sorted(occurrences.items())
        if len(entries) > 1
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=ROOT / "csvs")
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "csvs" / "duplicate_video_ids.csv",
    )
    args = parser.parse_args(argv)

    if not args.directory.is_dir():
        parser.error(f"not a directory: {args.directory}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    duplicates = find_duplicates(args.directory, args.out)

    with args.out.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(
            file, fieldnames=["video_id", "title", "occurrence_count", "locations"]
        )
        writer.writeheader()
        writer.writerows(duplicates)

    print(f"{len(duplicates)} duplicate video_id(s) -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
