"""Trim geometry: shot construction, mark-cut, conflict resolution.

Pure functions, no DB, no filesystem, no Streamlit — that is the point of
keeping this logic in trim.py rather than app.py (architecture.md 10).
"""

from __future__ import annotations

from vqa import trim


# ── shot / whole_clip / is_untouched ─────────────────────────────────────

def test_shot_rounds_to_one_decimal_and_defaults_flags_false():
    s = trim.shot(1.234, 5.678)

    assert s == {"start": 1.2, "end": 5.7, "auto": False, "default": False}


def test_whole_clip_is_a_single_default_shot_spanning_the_duration():
    shots = trim.whole_clip(12.34)

    assert shots == [{"start": 0.0, "end": 12.3, "auto": False, "default": True}]
    assert trim.is_untouched(shots, 12.34)


def test_is_untouched_is_false_once_a_second_shot_exists():
    shots = trim.whole_clip(20.0) + [trim.shot(5.0, 10.0)]

    assert not trim.is_untouched(shots, 20.0)


# ── overlap ───────────────────────────────────────────────────────────────

def test_overlap_is_positive_for_overlapping_shots():
    a, b = trim.shot(0.0, 5.0), trim.shot(3.0, 8.0)

    assert trim.overlap(a, b) == 2.0


def test_overlap_is_negative_for_disjoint_shots():
    a, b = trim.shot(0.0, 5.0), trim.shot(6.0, 8.0)

    assert trim.overlap(a, b) < 0


def test_resolve_shrinks_the_conflicting_shot_and_returns_a_new_list():
    shots = [trim.shot(0.0, 5.0), trim.shot(4.0, 9.0)]

    result = trim.resolve(shots, 1, duration=9.0)

    assert result is not None
    assert result[0] == shots[0]                      # shot 0 untouched
    assert result[1]["start"] >= 5.0 - 1e-9            # shot 1 shrunk to clear it
    assert not trim.conflicts(result)


def test_resolve_returns_none_and_leaves_shots_untouched_when_it_cannot_fit():
    """Shot 1 is buried inside shot 0 -- no centre-preserving shrink clears it."""
    shots = [trim.shot(0.0, 10.0), trim.shot(4.0, 6.0)]
    original = [dict(s) for s in shots]

    result = trim.resolve(shots, 1, duration=10.0)

    assert result is None
    assert shots == original                          # not mutated


def test_mark_cut_centres_a_full_pad_shot_when_there_is_room():
    made = trim.mark_cut(10.0, duration=20.0, others=[], pad=5.0)

    assert made == {"start": 5.0, "end": 15.0, "auto": False, "default": False}


def test_mark_cut_shrinks_when_the_full_pad_would_overlap():
    """A shot already sits at 12-20s, so the full +/-5s pad from x=10 won't fit."""
    others = [trim.shot(12.0, 20.0)]

    made = trim.mark_cut(10.0, duration=20.0, others=others, pad=5.0)

    assert made is not None
    assert made["auto"] is True
    assert made["end"] <= 12.0 + 1e-9


def test_mark_cut_returns_none_when_even_pad_min_does_not_fit():
    others = [trim.shot(9.5, 20.0)]   # leaves under 1s on the right at x=10

    made = trim.mark_cut(10.0, duration=20.0, others=others, pad=5.0)

    assert made is None


def test_why_no_room_names_the_blocking_shot():
    others = [trim.shot(9.5, 20.0)]

    msg = trim.why_no_room(10.0, duration=20.0, others=others, pad=5.0)

    assert "shot 1" in msg


def test_why_no_room_names_the_clip_edge_when_that_is_the_problem():
    msg = trim.why_no_room(0.3, duration=20.0, others=[], pad=5.0)

    assert "edge of the clip" in msg


def test_apply_mark_replaces_the_untouched_whole_clip_default():
    """The first Mark cut must not collide with the default it was handed."""
    shots = trim.whole_clip(20.0)

    result = trim.apply_mark(shots, duration=20.0, x=10.0, pad=5.0)

    assert result is not None
    assert len(result) == 1
    assert result[0]["start"] == 5.0 and result[0]["end"] == 15.0
    assert result[0]["default"] is False


def test_apply_mark_extends_an_already_touched_list():
    shots = [trim.shot(0.0, 5.0)]

    result = trim.apply_mark(shots, duration=20.0, x=10.0, pad=5.0)

    assert result is not None
    assert len(result) == 2
    assert result[0] == shots[0]                       # first shot untouched
    assert result[1]["start"] == 5.0 and result[1]["end"] == 15.0


def test_apply_mark_refuses_past_max_shots():
    shots = [trim.shot(0.0, 2.0), trim.shot(4.0, 6.0), trim.shot(8.0, 10.0)]
    assert len(shots) == trim.MAX_SHOTS

    result = trim.apply_mark(shots, duration=20.0, x=15.0, pad=1.0)

    assert result is None


def test_apply_mark_returns_none_when_no_room_fits():
    shots = [trim.shot(0.0, 20.0)]   # fills the whole clip already

    result = trim.apply_mark(shots, duration=20.0, x=10.0, pad=5.0)

    assert result is None


def test_append_shot_replaces_the_untouched_whole_clip_default():
    shots = trim.whole_clip(20.0)

    result = trim.append_shot(shots, duration=20.0, pad=5.0)

    assert result is not None
    assert len(result) == 1
    assert result[0]["start"] == 0.0 and result[0]["end"] == 10.0


def test_append_shot_starts_where_the_last_shot_ends():
    shots = [trim.shot(0.0, 5.0)]

    result = trim.append_shot(shots, duration=20.0, pad=5.0)

    assert result is not None
    assert len(result) == 2
    assert result[0] == shots[0]
    assert result[1]["start"] == 5.0 and result[1]["end"] == 15.0


def test_append_shot_refuses_past_max_shots():
    shots = [trim.shot(0.0, 2.0), trim.shot(4.0, 6.0), trim.shot(8.0, 10.0)]

    result = trim.append_shot(shots, duration=20.0, pad=1.0)

    assert result is None


def test_reshape_clears_auto_when_the_reviewer_moves_an_auto_shot():
    old = trim.shot(2.0, 8.0, auto=True)

    result = trim.reshape(old, 3.0, 8.0)

    assert result["start"] == 3.0 and result["end"] == 8.0
    assert result["auto"] is False


def test_reshape_keeps_auto_when_the_numbers_are_unchanged():
    old = trim.shot(2.0, 8.0, auto=True)

    result = trim.reshape(old, 2.0, 8.0)

    assert result["auto"] is True


# ── conflicts / errors / segments ────────────────────────────────────────

def test_conflicts_reports_overlapping_pairs_with_the_shared_region():
    shots = [trim.shot(0.0, 5.0), trim.shot(3.0, 8.0), trim.shot(10.0, 12.0)]

    found = trim.conflicts(shots)

    assert found == [{"i": 0, "j": 1, "start": 3.0, "end": 5.0, "amount": 2.0}]


def test_conflicts_ignores_overlaps_under_tolerance():
    shots = [trim.shot(0.0, 5.0), trim.shot(5.05, 8.0)]   # 0.05s, rounding noise

    assert trim.conflicts(shots) == []


def test_errors_is_empty_for_a_single_valid_shot():
    shots = trim.whole_clip(20.0)

    assert trim.errors(shots, 20.0) == []


def test_errors_flags_an_empty_shot_list():
    assert trim.errors([], 20.0) == ["Add at least one shot, or Reject the clip."]


def test_errors_flags_an_inverted_shot():
    shots = [trim.shot(8.0, 4.0)]

    errs = trim.errors(shots, 20.0)

    assert any("End must be after Start" in e for e in errs)


def test_errors_flags_a_shot_outside_the_clip():
    shots = [trim.shot(-1.0, 5.0)]

    errs = trim.errors(shots, 20.0)

    assert any("falls outside" in e for e in errs)


def test_errors_flags_a_conflict():
    shots = [trim.shot(0.0, 5.0), trim.shot(3.0, 8.0)]

    errs = trim.errors(shots, 20.0)

    assert any("overlap" in e for e in errs)


def test_segments_returns_start_end_tuples():
    shots = [trim.shot(1.0, 2.0), trim.shot(3.0, 4.0)]

    assert trim.segments(shots) == [(1.0, 2.0), (3.0, 4.0)]
