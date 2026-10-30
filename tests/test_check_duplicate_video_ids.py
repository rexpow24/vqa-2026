import csv

from scripts.check_duplicate_video_ids import find_duplicates, main


def _write_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.writer(file)
        writer.writerow(["video_title", "video_id"])
        writer.writerows(rows)


def test_find_duplicates_reports_ids_and_locations_and_skips_output(tmp_path):
    directory = tmp_path / "csvs"
    directory.mkdir()
    _write_csv(directory / "a.csv", [("Title A", "shared"), ("Title B", "only-a")])
    _write_csv(directory / "b.csv", [("Title C", " shared "), ("Title D", "only-b")])
    _write_csv(directory / "duplicate_video_ids.csv", [("Stale result", "shared")])

    duplicates = find_duplicates(directory, directory / "duplicate_video_ids.csv")

    assert duplicates == [{
        "video_id": "shared",
        "title": "Title A; Title C",
        "occurrence_count": 2,
        "locations": "a.csv:2; b.csv:2",
    }]


def test_main_writes_csv_to_csvs_directory(tmp_path):
    directory = tmp_path / "csvs"
    directory.mkdir()
    _write_csv(directory / "quoc.csv", [("One", "duplicate"), ("Two", "unique")])
    _write_csv(directory / "quyen.csv", [("One", "duplicate")])
    output = directory / "duplicate_video_ids.csv"

    assert main(["--directory", str(directory), "--out", str(output)]) == 0

    with output.open(newline="", encoding="utf-8-sig") as file:
        rows = list(csv.DictReader(file))
    assert rows == [{
        "video_id": "duplicate",
        "title": "One",
        "occurrence_count": "2",
        "locations": "quoc.csv:2; quyen.csv:2",
    }]
