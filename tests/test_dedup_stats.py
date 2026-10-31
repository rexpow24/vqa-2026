import json
import sqlite3

import pytest

from scripts.dedup_stats import collect_stats
from vqa import dedup


def _create_db(path):
    with sqlite3.connect(path) as conn:
        conn.executescript(
            """
            CREATE TABLE dedup_settings (key TEXT PRIMARY KEY, value REAL NOT NULL);
            CREATE TABLE dedup_decisions (
                query_path TEXT PRIMARY KEY,
                review_key TEXT NOT NULL,
                decision TEXT NOT NULL,
                duplicate_of TEXT,
                reviewed_at TEXT NOT NULL
            );
            INSERT INTO dedup_settings VALUES ('threshold', 0.79);
            """
        )
        conn.executemany(
            "INSERT INTO dedup_decisions VALUES (?, ?, ?, ?, ?)",
            [
                ("work/a/trimmed/a_t01.mp4", "key-a", "duplicate",
                 "work/b/trimmed/b_t01.mp4", "2026-10-01"),
                ("work/b/trimmed/b_t01.mp4", "key-b", "keep", None, "2026-10-02"),
                ("work/c/trimmed/c_t01.mp4", "outdated", "keep", None, "2026-10-03"),
            ],
        )


def test_collect_stats_reports_duplicate_pair_and_queue_scores(tmp_path):
    db_path = tmp_path / "pipeline.db"
    index_path = tmp_path / "index.json"
    _create_db(db_path)
    sources = []
    for video_id in ("a", "b", "c"):
        source = tmp_path / "work" / video_id / "trimmed" / f"{video_id}_t01.mp4"
        source.parent.mkdir(parents=True)
        source.write_bytes(video_id.encode())
        stat = source.stat()
        relative_path = source.relative_to(tmp_path).as_posix()
        sources.append({
            "path": relative_path,
            "signature": f"{relative_path}|{stat.st_size}|{stat.st_mtime_ns}",
        })
    queries = [
        {
            "path": "work/a/trimmed/a_t01.mp4",
            "top_score": 0.91,
            "review_key": "key-a",
            "matches": [{
                "path": "work/b/trimmed/b_t01.mp4", "score": 0.88,
                "dino_score": 0.90, "phash_score": 0.86,
            }],
        },
        {
            "path": "work/b/trimmed/b_t01.mp4",
            "top_score": 0.83,
            "review_key": "key-b",
            "matches": [{"path": "work/a/trimmed/a_t01.mp4", "score": 0.83}],
        },
        {
            "path": "work/c/trimmed/c_t01.mp4",
            "top_score": 0.82,
            "review_key": "current-c",
            "matches": [],
        },
    ]
    index_path.write_text(json.dumps({
        "version": dedup.INDEX_VERSION,
        "score_version": dedup.SCORE_VERSION,
        "sources": sources,
        "queries": queries,
    }), encoding="utf-8")

    stats = collect_stats(db_path, index_path, root=tmp_path)

    assert stats["threshold"] == 0.79
    assert stats["duplicate_count"] == 1
    assert stats["keep_count"] == 1
    assert stats["stale_count"] == 1
    assert stats["duplicate_pair_scores"] == [0.88]
    assert stats["duplicate_queue_scores"] == [0.91]
    assert stats["keep_queue_scores"] == [0.83]
    assert stats["candidate_threshold_interval"] == (0.83, 0.91)


def test_collect_stats_rejects_stale_index(tmp_path):
    db_path = tmp_path / "pipeline.db"
    index_path = tmp_path / "index.json"
    _create_db(db_path)
    index_path.write_text(json.dumps({
        "version": dedup.INDEX_VERSION,
        "score_version": dedup.SCORE_VERSION,
        "sources": [{"path": "work/missing/trimmed/missing_t01.mp4", "signature": "old"}],
        "queries": [],
    }), encoding="utf-8")

    with pytest.raises(ValueError, match="stale"):
        collect_stats(db_path, index_path, root=tmp_path)
