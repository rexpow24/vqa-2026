"""Incremental pair-cache behavior without loading the local GPU model."""

import json

import pytest

from scripts import dedup_all
from vqa import db, dedup


@pytest.fixture
def dedup_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "pipeline.db")
    monkeypatch.setattr(dedup, "ROOT", tmp_path)
    monkeypatch.setattr(dedup, "INDEX_PATH", tmp_path / "artifacts" / "dedup" / "index.json")
    db.init()
    return tmp_path


def add_clip(root, name, content=None):
    path = root / "work" / name / "trimmed" / f"{name}_001_002_t01.mp4"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if content is not None else name.encode())
    return path


def fake_features(paths, _root, _output):
    vectors = [[float(i)] for i, _ in enumerate(paths)]
    hashes = [[i] for i, _ in enumerate(paths)]
    return vectors, hashes, [10.0 + i for i, _ in enumerate(paths)]


def fake_score(a, b, _ha, _hb):
    value = 0.9 - abs(a[0] - b[0]) * 0.01
    return value, value - 0.01, value + 0.01


def start_run():
    sources = dedup.current_sources()
    changes = dedup.source_changes(sources)
    return dedup.create_run(len(sources), changes["added"], changes["changed"], changes["removed"])


def test_incremental_run_compares_only_new_or_changed_pairs_and_drops_deleted_pairs(
    dedup_workspace,
):
    for name in ("a", "b", "c"):
        add_clip(dedup_workspace, name)
    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 3
    assert len(dedup.pair_scores()) == 3

    scorer_calls = []
    result = dedup_all.run_incremental(
        start_run(), feature_loader=fake_features,
        scorer=lambda *args: (scorer_calls.append(args) or fake_score(*args)),
    )
    assert result["pairs_computed"] == 0
    assert scorer_calls == []

    add_clip(dedup_workspace, "d")
    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 3
    assert len(dedup.pair_scores()) == 6

    changed = next((dedup_workspace / "work" / "a" / "trimmed").glob("*.mp4"))
    changed.write_bytes(b"retrimmed")
    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 3
    assert len(dedup.pair_scores()) == 6

    removed = next((dedup_workspace / "work" / "b" / "trimmed").glob("*.mp4"))
    removed.unlink()
    removed.parent.rmdir()
    removed.parent.parent.rmdir()
    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 0
    assert len(dedup.pair_scores()) == 3
    assert dedup.queue()["ready"]


def test_failed_run_preserves_index_and_is_retryable(dedup_workspace):
    add_clip(dedup_workspace, "a")
    add_clip(dedup_workspace, "b")
    first_run = start_run()
    dedup_all.run_incremental(first_run, feature_loader=fake_features, scorer=fake_score)
    old_index = dedup.INDEX_PATH.read_bytes()

    add_clip(dedup_workspace, "c")
    failed_run = start_run()
    with pytest.raises(RuntimeError, match="model failed"):
        dedup_all.run_incremental(
            failed_run, feature_loader=fake_features,
            scorer=lambda *_: (_ for _ in ()).throw(RuntimeError("model failed")),
        )
    assert dedup.INDEX_PATH.read_bytes() == old_index
    run = next(row for row in dedup.run_history() if row["run_id"] == failed_run)
    assert run["status"] == "failed"
    assert run["pairs_computed"] == 0
    assert "model failed" in run["error"]

    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 2
    assert dedup.queue()["ready"]


def test_first_run_seeds_all_pairs_even_when_previous_index_has_no_pair_store(dedup_workspace):
    for name in ("a", "b", "c", "d"):
        add_clip(dedup_workspace, name)
    sources = dedup.current_sources()
    dedup.INDEX_PATH.parent.mkdir(parents=True)
    dedup.INDEX_PATH.write_text(json.dumps({"sources": sources, "queries": []}), encoding="utf-8")
    result = dedup_all.run_incremental(start_run(), feature_loader=fake_features, scorer=fake_score)
    assert result["pairs_computed"] == 6
    assert len(dedup.pair_scores()) == 6
    assert dedup.queue()["ready"]


def test_review_key_is_stable_when_top_five_order_and_sources_are_unchanged():
    signature = "work/a/trimmed/a_t01.mp4|10|1"
    candidates = [f"candidate-{i}" for i in range(5)]
    assert dedup.review_key(signature, candidates) == dedup.review_key(signature, candidates)
    assert dedup.review_key(signature, candidates) != dedup.review_key(signature, candidates[::-1])
