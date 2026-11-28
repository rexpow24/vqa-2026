"""Join the real Playwright takes with VieNeu narration into one MP4."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
CHAPTERS = {
    "reporter": ["01-report", "02-privacy"],
    "peer": ["03-queue", "04-vote"],
    "admin": ["05-admin"],
}


def command(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def duration(path: Path) -> float:
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                            check=True, capture_output=True, text=True)
    return float(result.stdout.strip())


def admin_slides(scene_dir: Path) -> Path:
    """Use full-resolution screenshots because Chrome's admin WebM has gray padding."""
    stills = [OUT / "evidence-admin-votes.png", OUT / "evidence-admin-final.png"]
    clips = []
    for index, still in enumerate(stills, 1):
        clip = scene_dir / f"admin-still-{index}.mp4"
        command("-loop", "1", "-framerate", "30", "-i", str(still), "-t", "8",
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,"
                       "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
                "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", str(clip))
        clips.append(clip)
    playlist = scene_dir / "admin-stills.txt"
    playlist.write_text("\n".join(f"file '{clip.as_posix()}'" for clip in clips) + "\n", encoding="utf-8")
    result = scene_dir / "admin-stills.mp4"
    command("-f", "concat", "-safe", "0", "-i", str(playlist), "-c", "copy", str(result))
    return result


if __name__ == "__main__":
    scene_dir = OUT / "scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)
    parts = []
    for name, chapters in CHAPTERS.items():
        samples = []
        rate = None
        for chapter in chapters:
            audio, current_rate = sf.read(OUT / "audio" / f"{chapter}.wav", dtype="float32")
            rate = rate or current_rate
            if current_rate != rate:
                raise RuntimeError("The narration sample rate changed")
            samples.append(audio)
        wav = scene_dir / f"{name}.wav"
        sf.write(wav, np.concatenate(samples), rate)
        raw = admin_slides(scene_dir) if name == "admin" else OUT / "raw" / f"{name}.webm"
        target = scene_dir / f"{name}.mp4"
        seconds = duration(raw)
        command("-i", str(raw), "-i", str(wav), "-map", "0:v:0", "-map", "1:a:0",
                "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p", "-af", "apad",
                "-t", str(seconds), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(target))
        parts.append(target)
        print(f"{name}: {seconds:.1f}s", flush=True)
    playlist = scene_dir / "playlist.txt"
    playlist.write_text("\n".join(f"file '{part.as_posix()}'" for part in parts) + "\n", encoding="utf-8")
    output = OUT / "report-help-tutorial.mp4"
    command("-f", "concat", "-safe", "0", "-i", str(playlist), "-c", "copy", "-movflags", "+faststart", str(output))
    print(f"Created {output} ({duration(output):.1f}s)", flush=True)
