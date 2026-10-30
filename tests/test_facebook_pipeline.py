from __future__ import annotations

import sqlite3
from pathlib import Path

from vqa import dedup, facebook


def test_facebook_url_parser_accepts_only_supported_hosts_and_keeps_each_line():
    accepted, rejected = facebook.parse_lines(
        "https://www.facebook.com/watch/?v=123\n"
        "https://fb.watch/abc\n"
        "https://youtu.be/video\n"
        "file:///private/video.mp4\n"
    )

    assert len(accepted) == 2
    assert accepted[0][0].startswith("fb_")
    assert accepted[0][0] != accepted[1][0]
    assert rejected == [
        (3, "https://youtu.be/video"),
        (4, "file:///private/video.mp4"),
    ]


def test_facebook_downloader_uses_yt_dlp_and_resumes_cached_video(tmp_path, monkeypatch):
    observed = {}

    class FakeYoutubeDL:
        def __init__(self, options):
            observed.update(options)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def extract_info(self, url, download):
            assert url == "https://www.facebook.com/watch/?v=123"
            assert download is True
            target = Path(observed["outtmpl"].replace("%(ext)s", "mp4"))
            target.write_bytes(b"x" * 2048)
            return {
                "title": "Traffic incident", "uploader": "Publisher",
                "duration": 32, "webpage_url": url,
            }

    monkeypatch.setattr(facebook.yt_dlp, "YoutubeDL", FakeYoutubeDL)
    work = tmp_path / "work"

    metadata = facebook.download("https://www.facebook.com/watch/?v=123", work)

    assert (work / "source" / "original.mp4").is_file()
    assert metadata["duration_s"] == 32
    assert "cookiesfrombrowser" not in observed
    assert "remote_components" not in observed
    assert facebook.download("https://www.facebook.com/watch/?v=123", work) == metadata


def test_old_database_migration_marks_existing_rows_as_youtube(tmp_path, monkeypatch):
    database = tmp_path / "legacy.db"
    with sqlite3.connect(database) as conn:
        conn.execute(
            "CREATE TABLE videos (youtube_video_id TEXT PRIMARY KEY, "
            "canonical_url TEXT NOT NULL, title TEXT, channel_id TEXT, "
            "channel_name TEXT, duration_s REAL, status TEXT NOT NULL, stage TEXT, "
            "error_code TEXT, error_detail TEXT, retry_count INTEGER DEFAULT 0, "
            "config_snapshot TEXT, n_clips INTEGER DEFAULT 0, "
            "n_boundaries INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT)"
        )
        conn.execute(
            "INSERT INTO videos (youtube_video_id, canonical_url, status) "
            "VALUES ('yt1', 'https://youtu.be/yt1', 'QUEUED')"
        )

    monkeypatch.setattr(facebook.db, "DB_PATH", database)
    facebook.db.init()

    assert facebook.db.get_video("yt1")["source"] == "youtube"


def test_runner_and_stop_retry_operations_are_scoped_by_source(fresh_db):
    db = fresh_db
    db.enqueue("yt1", "https://youtu.be/yt1")
    db.enqueue("fb_1", "https://www.facebook.com/watch/?v=1", source="facebook")
    assert db.next_queued(source="youtube")["youtube_video_id"] == "yt1"
    assert db.next_queued(source="facebook")["youtube_video_id"] == "fb_1"

    db.set_status("yt1", db.PROCESSING)
    db.set_status("fb_1", db.PROCESSING)
    assert db.mark_stopped(source="facebook") == 1
    assert db.get_video("yt1")["status"] == db.PROCESSING
    assert db.get_video("fb_1")["status"] == db.STOPPED

    assert db.retry_status(db.STOPPED, source="youtube") == 0
    assert db.retry_status(db.STOPPED, source="facebook") == 1
    assert db.get_video("fb_1")["status"] == db.QUEUED


def test_facebook_worker_does_not_consume_youtube_queue(fresh_db, monkeypatch):
    db = fresh_db
    db.enqueue("yt1", "https://youtu.be/yt1")
    db.enqueue("fb_1", "https://www.facebook.com/watch/?v=1", source="facebook")
    processed = []

    def fake_process(video_id, url, log):
        processed.append(video_id)
        db.set_status(video_id, db.READY_FOR_REVIEW)

    monkeypatch.setattr(facebook, "process_video", fake_process)

    count = facebook.run(lambda _: None)

    assert count == 1
    assert processed == ["fb_1"]
    assert db.get_video("yt1")["status"] == db.QUEUED


def test_facebook_pipeline_creates_one_full_video_review_clip(
    fresh_db, tmp_path, monkeypatch,
):
    db = fresh_db
    video_id = "fb_example"
    db.enqueue(video_id, "https://www.facebook.com/watch/?v=example", source="facebook")
    source_path = tmp_path / "work" / "facebook" / video_id / "source" / "original.mp4"
    source_path.parent.mkdir(parents=True)
    source_path.write_bytes(b"video")
    monkeypatch.setattr(facebook.config, "load", lambda: {"work_dir": str(tmp_path / "work")})
    monkeypatch.setattr(
        facebook, "download",
        lambda url, work: {
            "title": "Traffic incident", "channel_name": "Publisher", "duration_s": 42.0,
        },
    )
    monkeypatch.setattr(
        facebook.media, "probe",
        lambda path: {"duration_s": 42.0, "width": 1920, "height": 1080},
    )
    logs = []

    facebook.process_video(video_id, "https://www.facebook.com/watch/?v=example", logs.append)

    clip = db.list_clips(video_id=video_id)[0]
    assert clip is not None
    assert clip["duration_ms"] == 42_000
    assert clip["start_ms"] == 0
    assert clip["end_ms"] == 42_000
    assert clip["master_path"] == str(source_path)
    assert clip["delivered_path"] == str(source_path)
    assert clip["source"] == "facebook"
    assert db.get_video(video_id)["status"] == db.READY_FOR_REVIEW
    assert "no preprocessing" in logs[-1]


def test_dedup_source_scan_never_includes_facebook_tree(tmp_path, monkeypatch):
    monkeypatch.setattr(dedup, "ROOT", tmp_path)
    youtube_clip = tmp_path / "work" / "youtube-id" / "trimmed" / "youtube_t01.mp4"
    facebook_clip = (
        tmp_path / "work" / "facebook" / "fb_1" / "trimmed" / "fb_1_t01.mp4"
    )
    youtube_clip.parent.mkdir(parents=True)
    facebook_clip.parent.mkdir(parents=True)
    youtube_clip.write_bytes(b"youtube")
    facebook_clip.write_bytes(b"facebook")

    sources = dedup.current_sources()

    assert len(sources) == 1
    assert sources[0]["path"] == "work/youtube-id/trimmed/youtube_t01.mp4"


def test_clip_without_parent_video_keeps_legacy_source_default(fresh_db):
    db = fresh_db
    db.insert_clip({
        "clip_id": "legacy_orphan", "youtube_video_id": "old-id", "seq": 1,
        "start_ms": 0, "end_ms": 1000, "duration_ms": 1000,
        "confidence": "MEDIUM", "flags": "[]", "master_path": "master.mp4",
        "delivered_path": "delivered.mp4", "pipeline_version": "legacy",
        "config_hash": "legacy",
    })

    assert db.list_clips()[0]["source"] == "youtube"
