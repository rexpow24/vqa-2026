"""What the VLM path is allowed to read. No ffmpeg, no network."""

from __future__ import annotations

import json

from vlm import source


def _approved_shot(fresh_db, tmp_path, clip_id="v1_000000_010000", body=b"shot-one"):
    """One APPROVED clip with one materialised file, as the reviewer leaves it."""
    f = tmp_path / f"{clip_id}_t01.mp4"
    f.write_bytes(body)
    with fresh_db.tx() as c:
        c.execute(
            "INSERT INTO clips (clip_id, youtube_video_id, start_ms, end_ms,"
            " duration_ms, confidence, trim_segments) VALUES (?,?,?,?,?,?,?)",
            (clip_id, "v1", 0, 10000, 10000, "MEDIUM",
             json.dumps([{"start_ms": 0, "end_ms": 10000, "path": str(f)}])))
        c.execute("INSERT INTO reviews (clip_id, decision, reviewed_at)"
                  " VALUES (?,?,?)", (clip_id, "APPROVED", "2026-09-05"))
    return f


def test_approved_shot_is_offered_to_the_vlm(fresh_db, tmp_path):
    _approved_shot(fresh_db, tmp_path)

    found = source.approved_clips()

    assert [c.clip_id for c in found.clips] == ["v1_000000_010000"]
    assert found.missing == []


def test_rejecting_a_clip_makes_it_a_named_missing_source(fresh_db, tmp_path):
    # The reviewer owns trimmed/ and deletes from it on Reject. The VLM path
    # must notice that as a state, not carry a path that quietly points at
    # nothing (features/qa-pipeline/conflicts.md #2).
    f = _approved_shot(fresh_db, tmp_path)
    assert len(source.approved_clips().clips) == 1

    f.unlink()

    found = source.approved_clips()
    assert found.clips == []
    assert found.missing == ["v1_000000_010000_t01"]


def test_recutting_a_clip_changes_its_hash(fresh_db, tmp_path):
    # Re-approving with a different cut rewrites the same filename. Without a
    # content hash an old annotation would silently describe a different video.
    f = _approved_shot(fresh_db, tmp_path)
    before = source.approved_clips().clips[0].sha256

    f.write_bytes(b"a different cut of the same shot")

    after = source.approved_clips().clips[0].sha256
    assert after != before


def test_unreviewed_and_rejected_clips_are_never_offered(fresh_db, tmp_path):
    # delivered/ holds 105 UNREVIEWED clips and clips/ holds unblurred masters;
    # only an APPROVED shot is finished product (conflicts.md #5).
    _approved_shot(fresh_db, tmp_path, "v1_000000_010000", b"approved")
    other = _approved_shot(fresh_db, tmp_path, "v1_020000_030000", b"rejected")
    with fresh_db.tx() as c:
        c.execute("UPDATE reviews SET decision='REJECTED' WHERE clip_id=?",
                  ("v1_020000_030000",))

    ids = [c.clip_id for c in source.approved_clips().clips]

    assert ids == ["v1_000000_010000"]
    assert other.exists(), "REJECTED must not be offered, but the file is not ours to delete"
