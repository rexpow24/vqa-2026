"""Keyframe placement. Pure arithmetic -- no ffmpeg, no network."""

from __future__ import annotations

import pytest

from vlm import select


def test_keyframes_cluster_around_the_impact_on_the_longest_real_clip():
    # 29.0s is the longest file in work/*/trimmed/. Spreading four frames evenly
    # across it lands them ~9s from the collision, which answers no group-C
    # question -- so the useful assertion is how close they stay to the middle.
    duration = 29.0
    mid = duration / 2

    times = select.keyframe_times(duration, 4)

    assert len(times) == 4
    assert all(0 < t < duration for t in times)
    assert sum(t < mid for t in times) >= 1, "no frame before the impact"
    assert sum(t > mid for t in times) >= 1, "no frame after the impact"
    assert max(abs(t - mid) for t in times) <= 3.5, (
        f"frames stray too far from the impact at {mid}s: {times}")


def test_keyframes_are_symmetric_about_the_middle():
    times = select.keyframe_times(10.0, 4)
    offsets = sorted(t - 5.0 for t in times)
    assert offsets == pytest.approx([-o for o in reversed(offsets)])
