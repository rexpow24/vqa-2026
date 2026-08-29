"""The Queue tab, driven through Streamlit's own AppTest harness."""

from __future__ import annotations

from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

from vqa import db

APP = Path(__file__).resolve().parent.parent / "app.py"


@pytest.fixture
def app(fresh_db):
    """app.py against a throwaway database. `fresh_db` patches db.DB_PATH."""
    return AppTest.from_file(str(APP), default_timeout=30)


def test_remove_button_drops_the_selected_url(app, fresh_db):
    db.enqueue("keepme", "https://youtu.be/keepme")
    db.enqueue("dropme", "https://youtu.be/dropme")
    db.set_status("dropme", db.DOWNLOAD_FAILED)

    app.run()
    app.multiselect[0].set_value(["dropme (DOWNLOAD_FAILED)"]).run()
    app.button(key="rm_go").click().run()

    assert not app.exception, [e.value for e in app.exception]
    assert db.get_video("dropme") is None
    assert db.get_video("keepme") is not None
    # The removed URL must not still be sitting in the picker afterwards.
    assert app.multiselect[0].value == []


def test_processed_videos_are_not_offered_for_removal(app, fresh_db):
    db.enqueue("done", "https://youtu.be/done")
    db.set_status("done", db.READY_FOR_REVIEW)

    app.run()

    assert app.multiselect[0].options == []


def test_pasting_a_known_url_says_which_one_and_where_it_got_to(app, fresh_db):
    # YouTube IDs are exactly 11 chars; urls.parse_lines rejects anything else.
    old, new = "dupdupdup11", "brandnewvid"
    db.enqueue(old, f"https://youtu.be/{old}")
    db.set_status(old, db.DOWNLOAD_FAILED)

    app.run()
    app.text_area(key="paste").set_value(
        f"https://youtu.be/{old}\nhttps://youtu.be/{new}").run()
    app.button(key="paste_go").click().run()

    shown = " ".join([e.value for e in app.info] + [e.value for e in app.success])
    assert old in shown and "DOWNLOAD_FAILED" in shown
    assert db.get_video(new) is not None
