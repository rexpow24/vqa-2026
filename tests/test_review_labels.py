from __future__ import annotations


def test_review_labels_migrate_and_persist(fresh_db):
    conn = fresh_db.connect()
    conn.execute("ALTER TABLE reviews RENAME TO reviews_before_labels")
    conn.execute(
        "CREATE TABLE reviews (clip_id TEXT PRIMARY KEY, decision TEXT NOT NULL, reviewed_at TEXT)"
    )
    conn.execute(
        "INSERT INTO reviews VALUES ('clip-1', ?, '2026-01-01T00:00:00+00:00')",
        (fresh_db.APPROVED,),
    )
    conn.commit()
    conn.close()

    fresh_db.init()
    fresh_db.set_decision("clip-1", fresh_db.FLAGGED, "high", "near-miss")

    with fresh_db.tx() as check:
        row = check.execute(
            "SELECT decision, difficulty, event_label FROM reviews WHERE clip_id='clip-1'"
        ).fetchone()
    assert tuple(row) == (fresh_db.FLAGGED, "high", "near-miss")


def _insert_clip(db, clip_id: str, video_id: str = "video-1") -> None:
    with db.tx() as conn:
        conn.execute(
            "INSERT INTO videos (youtube_video_id, canonical_url, status)"
            " VALUES (?, ?, ?) ON CONFLICT(youtube_video_id) DO NOTHING",
            (video_id, f"https://youtu.be/{video_id}", db.READY_FOR_REVIEW),
        )
        conn.execute(
            "INSERT INTO clips (clip_id, youtube_video_id, seq, start_ms, end_ms,"
            " duration_ms, confidence) VALUES (?, ?, 0, 0, 1000, 1000, 'MEDIUM')",
            (clip_id, video_id),
        )


def test_list_missing_labels_excludes_unreviewed_and_fully_labeled(fresh_db):
    _insert_clip(fresh_db, "clip-unreviewed")
    fresh_db.set_decision("clip-unreviewed", fresh_db.UNREVIEWED)

    _insert_clip(fresh_db, "clip-fully-labeled")
    fresh_db.set_decision("clip-fully-labeled", fresh_db.APPROVED, "easy", "accident")

    _insert_clip(fresh_db, "clip-missing-both")
    fresh_db.set_decision("clip-missing-both", fresh_db.APPROVED)

    _insert_clip(fresh_db, "clip-missing-one")
    fresh_db.set_decision("clip-missing-one", fresh_db.REJECTED, "medium", None)

    backlog = {row["clip_id"] for row in fresh_db.list_missing_labels()}
    assert backlog == {"clip-missing-both", "clip-missing-one"}


def test_list_missing_labels_trimmed_only_excludes_rejected(fresh_db):
    _insert_clip(fresh_db, "clip-approved-trimmed")
    fresh_db.set_decision("clip-approved-trimmed", fresh_db.APPROVED)
    fresh_db.set_trim_segments("clip-approved-trimmed", [
        {"start_ms": 0, "end_ms": 1000, "path": "work/video-1/trimmed/clip-approved-trimmed_t01.mp4"},
    ])

    _insert_clip(fresh_db, "clip-rejected-no-trim")
    fresh_db.set_decision("clip-rejected-no-trim", fresh_db.REJECTED)

    backlog = {row["clip_id"] for row in fresh_db.list_missing_labels(trimmed_only=True)}
    assert backlog == {"clip-approved-trimmed"}

    backlog_all = {row["clip_id"] for row in fresh_db.list_missing_labels(trimmed_only=False)}
    assert backlog_all == {"clip-approved-trimmed", "clip-rejected-no-trim"}


def test_set_labels_backfills_without_touching_decision(fresh_db):
    _insert_clip(fresh_db, "clip-1")
    fresh_db.set_decision("clip-1", fresh_db.REJECTED)

    fresh_db.set_labels("clip-1", "high", "near-miss")

    with fresh_db.tx() as check:
        row = check.execute(
            "SELECT decision, difficulty, event_label FROM reviews WHERE clip_id='clip-1'"
        ).fetchone()
    assert tuple(row) == (fresh_db.REJECTED, "high", "near-miss")
    assert fresh_db.list_missing_labels() == []
