from pathlib import Path

import pytest
from fastapi import HTTPException

import sidecar.main as sidecar
from sidecar.main import EnqueueRequest


def test_facebook_enqueue_preserves_each_valid_line_and_reports_bad_lines(fresh_db):
    result = sidecar.enqueue_facebook_videos(EnqueueRequest(text=(
        "https://www.facebook.com/watch/?v=one\n"
        "https://m.facebook.com/video/two\n"
        "https://youtu.be/not-facebook\n"
    )))

    assert len(result["added"]) == 2
    assert result["bad"] == [(3, "https://youtu.be/not-facebook")]
    assert all(fresh_db.get_video(video_id)["source"] == "facebook"
               for video_id in result["added"])


def test_facebook_review_response_marks_source(fresh_db, monkeypatch):
    fresh_db.enqueue("fb_review", "https://www.facebook.com/watch/?v=1", source="facebook")
    fresh_db.insert_clip({
        "clip_id": "fb_review_full", "youtube_video_id": "fb_review", "seq": 1,
        "start_ms": 0, "end_ms": 30_000, "duration_ms": 30_000,
        "confidence": "MEDIUM", "flags": "[]", "master_path": "work/facebook/fb_review/source/original.mp4",
        "delivered_path": "work/facebook/fb_review/source/original.mp4",
        "pipeline_version": "facebook-direct-v1", "config_hash": "facebook",
    })
    monkeypatch.setattr(sidecar.config, "load", lambda: {"trim_pad_s": 5})

    result = sidecar.review_next()

    assert result["clip"]["source"] == "facebook"
    assert result["clip"]["video_path"].replace("\\", "/").startswith("work/facebook/")


def test_review_source_filter_keeps_queues_and_counts_separate(fresh_db, monkeypatch):
    fresh_db.enqueue("yt_review", "https://youtu.be/one")
    fresh_db.enqueue("fb_review", "https://www.facebook.com/watch/?v=one",
                     source="facebook")
    for video_id, clip_id, path in (
        ("yt_review", "yt_review_clip", "work/yt_review/delivered/yt.mp4"),
        ("fb_review", "fb_review_clip", "work/facebook/fb_review/source/original.mp4"),
    ):
        fresh_db.insert_clip({
            "clip_id": clip_id, "youtube_video_id": video_id, "seq": 1,
            "start_ms": 0, "end_ms": 30_000, "duration_ms": 30_000,
            "confidence": "MEDIUM", "flags": "[]", "master_path": path,
            "delivered_path": path, "pipeline_version": "test", "config_hash": "test",
        })
    fresh_db.set_decision("yt_review_clip", fresh_db.APPROVED)
    monkeypatch.setattr(sidecar.config, "load", lambda: {"trim_pad_s": 5})

    facebook_result = sidecar.review_next(source="facebook")
    youtube_result = sidecar.review_next(source="youtube")
    all_result = sidecar.review_next()

    assert facebook_result["clip"]["source"] == "facebook"
    assert facebook_result["summary"] == {
        "top_left": 1, "low_left": 0, "reviewed": 0, "approved": 0,
    }
    assert youtube_result["clip"] is None
    assert youtube_result["summary"] == {
        "top_left": 0, "low_left": 0, "reviewed": 1, "approved": 1,
    }
    assert all_result["clip"]["source"] == "facebook"
    assert all_result["summary"]["top_left"] == 1
    assert all_result["summary"]["approved"] == 1


def test_review_source_filter_rejects_unknown_source():
    with pytest.raises(HTTPException) as exc:
        sidecar.review_next(source="instagram")
    assert exc.value.status_code == 400
    assert exc.value.detail == "source must be all, youtube, or facebook"


def test_review_source_filter_is_exposed_as_http_query():
    parameters = sidecar.app.openapi()["paths"]["/review/next"]["get"]["parameters"]
    source = next(parameter for parameter in parameters if parameter["name"] == "source")
    assert source["in"] == "query"
    assert source["schema"]["default"] == "all"


def test_facebook_anonymize_uses_isolated_paths_and_explicit_dedup_bypass(
    tmp_path, monkeypatch,
):
    work_root = tmp_path / "work" / "facebook"
    trimmed = work_root / "fb_1" / "trimmed"
    trimmed.mkdir(parents=True)
    (trimmed / "fb_1_full_t01.mp4").write_bytes(b"approved")
    monkeypatch.setattr(sidecar, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(sidecar, "LOG_DIR", tmp_path / "logs")
    monkeypatch.setattr(
        sidecar, "FACEBOOK_ANON_PAUSE_FILE",
        tmp_path / "logs" / "facebook-anonymize.pause",
    )
    monkeypatch.setattr(sidecar, "_facebook_anon_proc", None)
    monkeypatch.setattr(sidecar, "_facebook_busy", lambda: False)
    monkeypatch.setattr(sidecar, "_facebook_anonymize_busy", lambda: False)
    spawned = {}

    class FakeProcess:
        pid = 1234

    def fake_popen(args, **kwargs):
        spawned["args"] = args
        spawned["kwargs"] = kwargs
        return FakeProcess()

    monkeypatch.setattr(sidecar.subprocess, "Popen", fake_popen)

    result = sidecar.facebook_anonymize_start()

    args = spawned["args"]
    assert result == {"started": True, "pid": 1234}
    assert args[args.index("--work-root") + 1] == str(work_root)
    assert args[args.index("--finished-root") + 1] == str(
        tmp_path / "finished" / "facebook"
    )
    assert "--skip-dedup" in args
    assert "--require-dedup" not in args
