from __future__ import annotations

import sidecar.main as sidecar_main
from sidecar.main import DecisionRequest, review_decision

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


def test_segment_labels_are_stored_independently(fresh_db):
    _insert_clip(fresh_db, "clip-split")
    fresh_db.set_decision("clip-split", fresh_db.APPROVED)
    fresh_db.set_trim_segments("clip-split", [
        {"start_ms": 0, "end_ms": 10000, "path": "a.mp4"},
        {"start_ms": 10000, "end_ms": 20000, "path": "b.mp4"},
    ])

    fresh_db.set_segment_labels("clip-split", [
        {"start_ms": 0, "end_ms": 10000, "difficulty": "easy", "event_label": "accident"},
        {"start_ms": 10000, "end_ms": 20000, "difficulty": "high", "event_label": "near-miss"},
    ])

    rows = fresh_db.segment_labels("clip-split")
    assert [(r["segment_index"], r["difficulty"], r["event_label"]) for r in rows] == [
        (1, "easy", "accident"),
        (2, "high", "near-miss"),
    ]
    assert fresh_db.list_missing_labels(trimmed_only=True) == []

    fresh_db.clear_segment_labels("clip-split")
    assert fresh_db.segment_labels("clip-split") == []


def test_reject_does_not_require_or_store_labels(fresh_db):
    _insert_clip(fresh_db, "clip-reject")

    result = review_decision("clip-reject", DecisionRequest(decision=fresh_db.REJECTED))

    assert result["decision"] == fresh_db.REJECTED
    with fresh_db.tx() as check:
        row = check.execute(
            "SELECT decision, difficulty, event_label FROM reviews WHERE clip_id=?",
            ("clip-reject",),
        ).fetchone()
    assert tuple(row) == (fresh_db.REJECTED, None, None)


def test_approved_small_shots_are_independent_without_clip_label(fresh_db, monkeypatch):
    _insert_clip(fresh_db, "clip-small-shots")
    with fresh_db.tx() as conn:
        conn.execute(
            "UPDATE clips SET end_ms=20000, duration_ms=20000 WHERE clip_id=?",
            ("clip-small-shots",),
        )
    monkeypatch.setattr(
        sidecar_main.review,
        "materialize",
        lambda clip, segments, cfg: [
            {"start_ms": 0, "end_ms": 10000, "path": "a.mp4"},
            {"start_ms": 10000, "end_ms": 20000, "path": "b.mp4"},
        ],
    )

    result = review_decision(
        "clip-small-shots",
        DecisionRequest(
            decision=fresh_db.APPROVED,
            difficulty=None,
            event_label=None,
            shots=[
                {"start": 0, "end": 10, "difficulty": "easy", "event_label": "accident"},
                {"start": 10, "end": 20, "difficulty": "high", "event_label": "near-miss"},
            ],
        ),
    )

    assert result["decision"] == fresh_db.APPROVED
    assert [(r["difficulty"], r["event_label"]) for r in fresh_db.segment_labels("clip-small-shots")] == [
        ("easy", "accident"),
        ("high", "near-miss"),
    ]
    with fresh_db.tx() as check:
        row = check.execute(
            "SELECT difficulty, event_label FROM reviews WHERE clip_id=?",
            ("clip-small-shots",),
        ).fetchone()
    assert tuple(row) == (None, None)
