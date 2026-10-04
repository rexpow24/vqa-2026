"""Pause finishes the current clip and resume skips finished outputs."""

import subprocess
import sys
from pathlib import Path

from sidecar import main as sidecar
from vqa import anonymize


def test_pause_between_clips_and_resume_across_video_folders(tmp_path, monkeypatch):
    work = tmp_path / "work"
    finished = tmp_path / "finished"
    for video_id, names in (("video_a", ("a.mp4", "b.mp4")),
                            ("video_b", ("c.mp4",))):
        trimmed = work / video_id / "trimmed"
        trimmed.mkdir(parents=True)
        for name in names:
            (trimmed / name).touch()

    marker = tmp_path / "pause"
    processed = []

    def process(src, dst, *_args):
        processed.append(src.name)
        dst.write_bytes(b"complete")
        if src.name == "a.mp4":
            marker.touch()

    monkeypatch.setattr(anonymize, "load_face_detector", lambda: object())
    monkeypatch.setattr(anonymize, "load_plate_session", lambda: object())
    monkeypatch.setattr(anonymize, "process_video", process)

    anonymize.anonymize_all_trimmed(work, finished, should_pause=marker.exists)
    assert processed == ["a.mp4"]
    assert not (finished / "b.mp4").exists()
    assert not (finished / "c.mp4").exists()

    marker.unlink()
    anonymize.anonymize_all_trimmed(work, finished, should_pause=marker.exists)
    assert processed == ["a.mp4", "b.mp4", "c.mp4"]


def test_sidecar_pause_marker_is_cleared_on_resume(tmp_path, monkeypatch):
    marker = tmp_path / "anonymize.pause"
    monkeypatch.setattr(sidecar, "ANON_PAUSE_FILE", marker)
    monkeypatch.setattr(sidecar, "LOG_DIR", tmp_path)
    monkeypatch.setattr(sidecar, "REPO_ROOT", tmp_path)

    class Process:
        pid = 123

        def poll(self):
            return None

    monkeypatch.setattr(sidecar, "_anon_proc", Process())
    assert sidecar.anonymize_pause()["pause_requested"] is True
    assert marker.exists()

    monkeypatch.setattr(sidecar, "_anon_proc", None)
    launches = []

    def launch(args, **kwargs):
        launches.append((args, kwargs))
        return Process()

    monkeypatch.setattr(sidecar.subprocess, "Popen", launch)
    assert sidecar.anonymize_start()["started"] is True
    assert not marker.exists()
    assert launches[0][0][-2:] == ["--pause-file", str(marker)]


def test_script_honors_existing_pause_marker_before_loading_models(tmp_path):
    work = tmp_path / "work"
    finished = tmp_path / "finished"
    trimmed = work / "video_a" / "trimmed"
    trimmed.mkdir(parents=True)
    (trimmed / "clip.mp4").touch()
    marker = tmp_path / "pause"
    marker.touch()
    script = Path(__file__).resolve().parents[1] / "scripts" / "anonymize_all.py"

    result = subprocess.run(
        [sys.executable, str(script), "--work-root", str(work),
         "--finished-root", str(finished), "--pause-file", str(marker)],
        capture_output=True, text=True, timeout=15,
    )

    assert result.returncode == 0, result.stderr
    assert not (finished / "clip.mp4").exists()
