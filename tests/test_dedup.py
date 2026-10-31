"""Dedup gate uses current trimmed files, a strict threshold and durable choices."""

import json

import pytest

from scripts import anonymize_all as anonymize_script
from vqa import db, dedup


def test_review_gate_archives_existing_finished_and_detects_changed_trim(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "pipeline.db")
    monkeypatch.setattr(dedup, "ROOT", tmp_path)
    monkeypatch.setattr(dedup, "INDEX_PATH", tmp_path / "artifacts" / "dedup" / "index.json")
    db.init()

    paths = []
    for video_id in ("video_a", "video_b"):
        trimmed = tmp_path / "work" / video_id / "trimmed"
        trimmed.mkdir(parents=True)
        path = trimmed / f"{video_id}_001_002_t01.mp4"
        path.write_bytes(video_id.encode())
        paths.append(path)
    sources = dedup.current_sources()
    a, b = [source["path"] for source in sources]
    signatures = [source["signature"] for source in sources]
    queries = [
        {"path": a, "top_score": 0.82,
         "review_key": dedup.review_key(signatures[0], [signatures[1]]),
         "matches": [{"path": b, "score": 0.82}]},
        {"path": b, "top_score": 0.80,
         "review_key": dedup.review_key(signatures[1], [signatures[0]]),
         "matches": [{"path": a, "score": 0.80}]},
    ]
    dedup.INDEX_PATH.parent.mkdir(parents=True)
    dedup.INDEX_PATH.write_text(json.dumps({
        "version": dedup.INDEX_VERSION, "score_version": dedup.SCORE_VERSION,
        "sources": sources, "queries": queries,
    }), encoding="utf-8")

    state = dedup.queue()
    assert state["suggested"] == 1  # Exactly 0.80 is not above 0.80.
    assert state["pending"] == 1
    with pytest.raises(ValueError, match="1 clip"):
        dedup.allowed_sources()

    finished = tmp_path / "finished" / paths[0].name
    finished.parent.mkdir()
    finished.write_bytes(b"old anonymous copy")
    dedup.save_decision(a, "duplicate", b)
    assert dedup.allowed_sources() == {b}
    assert paths[0].exists()
    assert not finished.exists()
    assert len(list((dedup.INDEX_PATH.parent / "excluded_finished").glob("*.mp4"))) == 1

    dedup.set_threshold(0.79)
    assert dedup.queue()["pending"] == 1
    dedup.save_decision(b, "duplicate", a)
    with pytest.raises(ValueError, match="vòng trùng"):
        dedup.allowed_sources()
    dedup.save_duplicate_and_keep(a, b)
    decisions = {item["path"]: item["decision"] for item in dedup.queue()["items"]}
    assert decisions[a] == "duplicate"
    assert decisions[b] == "keep"
    assert dedup.allowed_sources() == {b}

    paths[1].write_bytes(b"changed source")
    assert not dedup.queue()["ready"]
    with pytest.raises(ValueError, match="thay đổi"):
        dedup.allowed_sources()


def test_anonymize_gate_accepts_relative_work_paths(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "pipeline.db")
    monkeypatch.setattr(dedup, "ROOT", tmp_path)
    monkeypatch.setattr(dedup, "INDEX_PATH", tmp_path / "artifacts" / "dedup" / "index.json")
    db.init()
    source = tmp_path / "work" / "video_a" / "trimmed" / "video_a_001_002_t01.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"clip")
    sources = dedup.current_sources()
    dedup.INDEX_PATH.parent.mkdir(parents=True)
    dedup.INDEX_PATH.write_text(json.dumps({
        "version": dedup.INDEX_VERSION, "score_version": dedup.SCORE_VERSION,
        "sources": sources,
        "queries": [{"path": sources[0]["path"], "top_score": -1,
                     "review_key": dedup.review_key(sources[0]["signature"], []),
                     "matches": []}],
    }), encoding="utf-8")

    def fake_anonymize(work_root, finished_root, **kwargs):
        assert kwargs["should_include"](source.relative_to(tmp_path))
        return {}

    monkeypatch.setattr(anonymize_script.anonymize, "anonymize_all_trimmed", fake_anonymize)
    assert anonymize_script.main(["--limit", "1"]) == 0
