"""Cut Playwright takes at scene boundaries, add Hải Đăng audio, and join MP4."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
FFMPEG = r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffprobe.exe"


def run(args: list[str]) -> None:
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


if __name__ == "__main__":
    takes = json.loads((OUT / "timing" / "takes.json").read_text(encoding="utf-8"))
    scene_dir = OUT / "scenes"
    scene_dir.mkdir(exist_ok=True)
    files = []
    master = []
    cursor = 0.0
    # Playwright's WebM timestamps run slightly ahead of the Python wall clock.
    # These offsets and rates were measured against the genuine scene screenshots
    # and the raw takes; take 2 also contains page loading before its first scene.
    calibration = [(0.2, 1.010), (1.5, 1.026), (0.1, 1.000)]
    for take_index, take in enumerate(takes):
        offset, rate = calibration[take_index]
        for scene in take["scenes"]:
            duration = scene["duration"]
            raw_start = offset + rate * scene["take_start"]
            raw_duration = rate * duration
            output = scene_dir / f"{scene['id']}.mp4"
            run(["-ss", str(raw_start), "-t", str(raw_duration), "-i", take["path"],
                 "-i", str(OUT / "audio" / f"{scene['id']}.wav"),
                 "-map", "0:v:0", "-map", "1:a:0", "-vf", f"setpts=(PTS-STARTPTS)/{rate},fps=30,scale=1920:1080:flags=lanczos,format=yuv420p",
                 "-af", "apad", "-t", str(duration), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                 "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(output)])
            files.append(output)
            master.append({"id":scene["id"],"start":round(cursor,3),"duration":duration})
            cursor += duration
            print(f"{scene['id']}: {duration:.2f}s", flush=True)
    playlist = OUT / "timing" / "playlist.txt"
    playlist.write_text("\n".join(f"file '{file.as_posix()}'" for file in files) + "\n", encoding="utf-8")
    run(["-f", "concat", "-safe", "0", "-i", str(playlist), "-c", "copy", "-movflags", "+faststart", str(OUT / "welcome.mp4")])
    (OUT / "timing" / "master.json").write_text(json.dumps(master, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"welcome.mp4: {cursor:.2f}s", flush=True)
