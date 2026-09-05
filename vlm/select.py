"""Where in a clip to look.

The clip pipeline cuts a shot as `impact ± pad`, so in a file under `trimmed/`
the collision sits near the middle, not at the start. Frames are picked around
that middle: group C questions need the frame just *before* the impact and group
T needs one either side of it (`docs/02_annotator_guideline_TeamB.md`).

Spreading frames evenly across the file instead would put them ~9s from the
impact on the longest real clip (29s) -- far enough to answer neither group.
"""

from __future__ import annotations


def keyframe_times(duration_s: float, n: int = 4) -> list[float]:
    """`n` timestamps (seconds) to sample from a clip `duration_s` long.

    Symmetric about the middle and clustered near it. The reviewer can widen a
    shot by hand -- median length is 16s against a 10s default -- so the spread
    is capped rather than scaled all the way up, and on those the middle is a
    best guess at the impact rather than a measurement.
    """
    if duration_s <= 0:
        raise ValueError(f"duration must be positive, got {duration_s}")
    if n < 1:
        raise ValueError(f"need at least one frame, got {n}")

    mid = duration_s / 2.0
    if n == 1:
        return [round(mid, 3)]

    pad = min(duration_s / 3.0, 3.0)
    step = 2.0 * pad / (n - 1)
    # Keep a hair inside the file: ffmpeg seeking to exactly 0 or the last frame
    # is the one case where it can hand back nothing.
    lo, hi = 0.05 * duration_s, 0.95 * duration_s
    return [round(min(max(mid - pad + step * i, lo), hi), 3) for i in range(n)]


def even_times(duration_s: float, n: int = 4) -> list[float]:
    """`n` timestamps spread evenly across the whole clip.

    The right default for an arbitrary video, where nothing says the interesting
    moment is in the middle. `keyframe_times` is the one to use on a shot the
    reviewer cut as `impact ± pad`.
    """
    if duration_s <= 0:
        raise ValueError(f"duration must be positive, got {duration_s}")
    if n < 1:
        raise ValueError(f"need at least one frame, got {n}")
    if n == 1:
        return [round(duration_s / 2.0, 3)]
    step = duration_s / (n + 1)
    return [round(step * (i + 1), 3) for i in range(n)]
