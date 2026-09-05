"""Clip -> JPEG keyframes.

`vqa.media.sample_gray` exists but samples grayscale for the overlay detector.
The VLM needs colour, and needs specific timestamps rather than a fixed rate,
so this is its own path -- it does not change a module the clip pipeline's 55
tests are holding still.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

# Windows: keep the console from flashing, same as vqa.media does.
_NOWINDOW = {"creationflags": subprocess.CREATE_NO_WINDOW} if hasattr(
    subprocess, "CREATE_NO_WINDOW") else {}


class FrameError(RuntimeError):
    """Extraction failed for a reason worth printing."""


def duration_s(path: Path) -> float:
    cp = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], capture_output=True, **_NOWINDOW)
    raw = cp.stdout.decode(errors="replace").strip()
    if cp.returncode != 0 or not raw:
        raise FrameError(f"ffprobe could not read {path.name}: "
                         f"{cp.stderr.decode(errors='replace')[:200]}")
    return float(raw)


def keyframes(path: Path, times_s: list[float], width: int = 768) -> list[bytes]:
    """One JPEG per timestamp, in order.

    Seeks per frame rather than decoding the whole clip: the accuracy matters
    more than the speed here, because a group-C question needs the frame just
    before the impact and not merely a frame from nearby.
    """
    if not path.exists():
        raise FrameError(f"clip is gone: {path}")
    if not times_s:
        raise FrameError("no timestamps requested")

    out: list[bytes] = []
    for t in times_s:
        cp = subprocess.run(
            [FFMPEG, "-v", "error", "-ss", f"{t:.3f}", "-i", str(path),
             "-frames:v", "1", "-vf", f"scale={width}:-2",
             "-f", "image2", "-c:v", "mjpeg", "-"],
            capture_output=True, **_NOWINDOW)
        if cp.returncode != 0 or not cp.stdout:
            raise FrameError(
                f"no frame at {t:.3f}s in {path.name}: "
                f"{cp.stderr.decode(errors='replace')[:200]}")
        if not cp.stdout.startswith(b"\xff\xd8\xff"):
            raise FrameError(f"ffmpeg returned non-JPEG data at {t:.3f}s")
        out.append(cp.stdout)
    return out


def grey_frames(n: int, width: int = 768, height: int = 432) -> list[bytes]:
    """`n` identical flat-grey JPEGs, the control condition for a vision check.

    A model whose vision encoder is wired up describes these very differently
    from real footage; one that is quietly answering from language priors does
    not notice the difference.
    """
    cp = subprocess.run(
        [FFMPEG, "-v", "error", "-f", "lavfi",
         "-i", f"color=c=gray:s={width}x{height}", "-frames:v", "1",
         "-f", "image2", "-c:v", "mjpeg", "-"],
        capture_output=True, **_NOWINDOW)
    if cp.returncode != 0 or not cp.stdout:
        raise FrameError("could not synthesise a grey control frame: "
                         f"{cp.stderr.decode(errors='replace')[:200]}")
    return [cp.stdout] * n
