from scripts.count_trimmed_shots_for_duplicate_ids import (
    count_trimmed_shots,
    main,
)


def test_counts_trimmed_mp4_files_for_duplicate_ids(tmp_path):
    duplicate_csv = tmp_path / "duplicate_video_ids.csv"
    duplicate_csv.write_text(
        "video_id,title,occurrence_count\n"
        "video-a,Traffic A,2\n"
        "video-b,Traffic B,2\n",
        encoding="utf-8",
    )
    work = tmp_path / "work"
    trimmed = work / "video-a" / "trimmed"
    trimmed.mkdir(parents=True)
    (trimmed / "video-a_t01.mp4").write_bytes(b"shot")
    (trimmed / "video-a_t02.mp4").write_bytes(b"shot")
    (trimmed / "notes.txt").write_text("not a shot", encoding="utf-8")

    result = count_trimmed_shots(duplicate_csv, work)

    assert result == [
        {
            "video_id": "video-a",
            "trimmed_shot_count": 2,
        },
        {
            "video_id": "video-b",
            "trimmed_shot_count": 0,
        },
    ]


def test_main_prints_per_video_counts_and_total(tmp_path, capsys):
    duplicate_csv = tmp_path / "duplicate_video_ids.csv"
    duplicate_csv.write_text(
        "video_id,title,occurrence_count\nvideo-a,Traffic A,2\n",
        encoding="utf-8",
    )
    work = tmp_path / "work"
    trimmed = work / "video-a" / "trimmed"
    trimmed.mkdir(parents=True)
    (trimmed / "shot.mp4").write_bytes(b"shot")

    assert main([
        "--duplicates-csv", str(duplicate_csv),
        "--work-root", str(work),
    ]) == 0

    assert capsys.readouterr().out.splitlines() == [
        "video-a: 1 shots",
        "Total shots lost if deleted: 1",
    ]
