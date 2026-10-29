import csv
import sqlite3

from scripts.export_pipeline_chunks import main as export_chunks
from scripts.export_pipeline_videos import main as export_videos


def _create_db(path):
    with sqlite3.connect(path) as conn:
        conn.executescript(
            """
            CREATE TABLE videos (
                youtube_video_id TEXT PRIMARY KEY,
                title TEXT
            );
            CREATE TABLE clips (
                clip_id TEXT PRIMARY KEY,
                youtube_video_id TEXT NOT NULL,
                seq INTEGER,
                start_ms INTEGER
            );
            CREATE TABLE reviews (
                clip_id TEXT PRIMARY KEY,
                difficulty TEXT,
                event_label TEXT
            );
            INSERT INTO videos VALUES ('video-1', 'Traffic, morning');
            INSERT INTO videos VALUES ('video-2', 'Traffic [P100]');
            INSERT INTO videos VALUES ('video-3', 'Traffic [P9]');
            INSERT INTO videos VALUES ('video-4', 'Traffic - P20');
            INSERT INTO videos VALUES ('video-5', NULL);
            INSERT INTO clips VALUES ('chunk-1', 'video-1', 1, 1000);
            INSERT INTO clips VALUES ('chunk-2', 'video-1', 2, 2000);
            INSERT INTO reviews VALUES ('chunk-1', 'easy', 'accident');
            """
        )


def _read_csv(path):
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.reader(file))


def test_export_pipeline_videos_includes_all_videos_and_titles(tmp_path):
    db_path = tmp_path / "pipeline.db"
    output = tmp_path / "videos.csv"
    _create_db(db_path)

    assert export_videos(["--db", str(db_path), "--out", str(output)]) == 0

    assert _read_csv(output) == [
        ["video_title", "video_id"],
        ["Traffic [P9]", "video-3"],
        ["Traffic - P20", "video-4"],
        ["Traffic [P100]", "video-2"],
        ["Traffic, morning", "video-1"],
        ["", "video-5"],
    ]


def test_export_pipeline_chunks_includes_labels_and_unlabeled_chunks(tmp_path):
    db_path = tmp_path / "pipeline.db"
    output = tmp_path / "chunks.csv"
    _create_db(db_path)

    assert export_chunks(["--db", str(db_path), "--out", str(output)]) == 0

    assert _read_csv(output) == [
        ["video_title", "video_id", "chunk_id", "difficulty", "event_label"],
        ["Traffic, morning", "video-1", "chunk-1", "easy", "accident"],
        ["Traffic, morning", "video-1", "chunk-2", "", ""],
    ]
