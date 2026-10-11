"""Progress follows completed outputs, including work from earlier runs."""

import os

from sidecar.main import _anonymize_progress


def test_progress_counts_current_trimmed_files_and_logs_each_finished_clip(tmp_path):
    work = tmp_path / "work"
    finished = tmp_path / "finished"

    first = work / "video_a" / "trimmed" / "video_a_001_002_t01.mp4"
    second = work / "video_a" / "trimmed" / "video_a_003_004_t01.mp4"
    third = work / "video_b" / "trimmed" / "video_b_005_006_t01.mp4"
    for source in (first, second, third):
        source.parent.mkdir(parents=True, exist_ok=True)
        source.touch()
    (first.parent / "video_a_001_002_t01_anonymized.mp4").touch()

    first_output = finished / first.name
    third_output = finished / third.name
    for output in (first_output, third_output):
        output.parent.mkdir(parents=True, exist_ok=True)
        output.touch()
    os.utime(first_output, (100, 100))
    os.utime(third_output, (200, 200))
    (finished / "orphan.mp4").touch()
    (finished / "clip_2.part.mp4").touch()

    progress = _anonymize_progress(work, finished)

    assert progress == {
        "total": 3,
        "completed": 2,
        "completed_files": [
            {"video_id": "video_a", "file_name": first.name, "completed_at": 100},
            {"video_id": "video_b", "file_name": third.name, "completed_at": 200},
        ],
    }
