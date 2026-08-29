"""Queue management: adding URLs, and taking them back out again."""

from __future__ import annotations


def test_queued_video_can_be_removed(fresh_db):
    db = fresh_db
    db.enqueue("vid1", "https://youtu.be/vid1")

    assert db.remove_video("vid1") == 1
    assert db.get_video("vid1") is None


def test_reviewed_video_is_not_removable(fresh_db):
    """A processed video owns clips, and `clips` has no FK back to `videos`."""
    db = fresh_db
    db.enqueue("vid1", "https://youtu.be/vid1")
    db.set_status("vid1", db.READY_FOR_REVIEW)

    assert db.remove_video("vid1") == 0
    assert db.get_video("vid1") is not None


def test_failed_download_is_removable_then_re_addable(fresh_db):
    """The whole point: drop a broken URL and paste it again to retry."""
    db = fresh_db
    db.enqueue("vid1", "https://youtu.be/vid1")
    db.set_status("vid1", db.DOWNLOAD_FAILED, error_code="DOWNLOAD_FAILED")

    assert db.enqueue("vid1", "https://youtu.be/vid1") is False   # blocked before
    assert db.remove_video("vid1") == 1
    assert db.enqueue("vid1", "https://youtu.be/vid1") is True    # free after
    assert db.get_video("vid1")["status"] == db.QUEUED


def test_in_flight_video_is_not_removable(fresh_db):
    """The runner is another process; it may claim a row between render and click."""
    db = fresh_db
    db.enqueue("vid1", "https://youtu.be/vid1")
    for status in (db.DOWNLOADING, db.PROCESSING, db.DONE):
        db.set_status("vid1", status)
        assert db.remove_video("vid1") == 0, status


def test_removing_twice_is_harmless(fresh_db):
    db = fresh_db
    db.enqueue("vid1", "https://youtu.be/vid1")

    assert db.remove_video("vid1") == 1
    assert db.remove_video("vid1") == 0


def test_enqueue_many_names_the_duplicates_and_their_state(fresh_db):
    """"duplicate: 2" tells the reviewer nothing; which ones, and how they went,
    is what decides whether anything needs doing."""
    db = fresh_db
    db.enqueue("old_ok", "https://youtu.be/old_ok")
    db.set_status("old_ok", db.READY_FOR_REVIEW)
    db.enqueue("old_bad", "https://youtu.be/old_bad")
    db.set_status("old_bad", db.DOWNLOAD_FAILED)

    added, dupes = db.enqueue_many([
        ("new", "https://youtu.be/new"),
        ("old_ok", "https://youtu.be/old_ok"),
        ("old_bad", "https://youtu.be/old_bad"),
    ])

    assert added == ["new"]
    assert dupes == [("old_ok", db.READY_FOR_REVIEW),
                     ("old_bad", db.DOWNLOAD_FAILED)]
