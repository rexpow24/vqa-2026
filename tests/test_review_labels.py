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
