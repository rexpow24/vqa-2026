"""Lightweight dedup index and review state shared by sidecar and worker.

The GPU extractor lives in scripts/dedup_pilot.py. This module imports no ML
packages, so the existing sidecar environment can inspect and gate the index.
"""

from __future__ import annotations

import json
import re
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from . import db

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "artifacts" / "dedup" / "index.json"
INDEX_VERSION = 1
SCORE_VERSION = "dinov2-base-phash-ordered4-v1"
DEFAULT_THRESHOLD = 0.8
TRIMMED_NAME = re.compile(r"_t\d{2}\.mp4$")


def source_signature(path: Path) -> str:
    stat = path.stat()
    return f"{path.relative_to(ROOT).as_posix()}|{stat.st_size}|{stat.st_mtime_ns}"


def current_sources() -> list[dict[str, str]]:
    return [
        {"path": path.relative_to(ROOT).as_posix(), "signature": source_signature(path)}
        for path in sorted((ROOT / "work").glob("*/trimmed/*.mp4"))
        if TRIMMED_NAME.search(path.name)
    ]


def read_index() -> tuple[dict | None, str | None]:
    if not INDEX_PATH.exists():
        return None, "Chưa phân tích các clip trimmed. Hãy chạy Dedup trước khi anonymize."
    try:
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        if index["version"] != INDEX_VERSION or index["score_version"] != SCORE_VERSION:
            return None, "Cách tính điểm đã thay đổi. Hãy phân tích lại Dedup."
        if index["sources"] != current_sources():
            return None, "Các clip trimmed đã thay đổi sau lần phân tích. Hãy chạy Dedup lại."
        if len(index["queries"]) != len(index["sources"]):
            return None, "Kết quả Dedup chưa đầy đủ. Hãy phân tích lại."
        return index, None
    except (OSError, ValueError, KeyError, TypeError):
        return None, "Không đọc được kết quả Dedup. Hãy phân tích lại."


def get_threshold() -> float:
    with db.tx() as conn:
        row = conn.execute("SELECT value FROM dedup_settings WHERE key='threshold'").fetchone()
    return float(row["value"]) if row else DEFAULT_THRESHOLD


def set_threshold(value: float) -> float:
    if not 0 <= value < 1:
        raise ValueError("Ngưỡng phải nằm trong khoảng 0 đến dưới 1.")
    with db.tx() as conn:
        conn.execute(
            "INSERT INTO dedup_settings(key, value) VALUES('threshold', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (value,)
        )
    return value


def review_key(signature: str, candidate_signatures: list[str]) -> str:
    content = json.dumps([SCORE_VERSION, signature, candidate_signatures], separators=(",", ":"))
    return sha256(content.encode()).hexdigest()


def _decisions() -> dict[str, dict]:
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT query_path, review_key, decision, duplicate_of, reviewed_at FROM dedup_decisions"
        ).fetchall()
    return {row["query_path"]: dict(row) for row in rows}


def queue() -> dict:
    index, problem = read_index()
    threshold = get_threshold()
    if index is None:
        return {
            "ready": False, "problem": problem, "threshold": threshold,
            "total": len(current_sources()), "suggested": 0, "pending": 0,
            "duplicates": 0, "max_score": None, "items": [],
        }
    decisions = _decisions()
    items = []
    duplicates = 0
    for query in index["queries"]:
        if query["top_score"] <= threshold:
            continue
        decision = decisions.get(query["path"])
        if decision is None or decision["review_key"] != query["review_key"]:
            decision = None
        if decision and decision["decision"] == "duplicate":
            duplicates += 1
        items.append({**query, "decision": decision["decision"] if decision else None,
                      "duplicate_of": decision["duplicate_of"] if decision else None})
    return {
        "ready": True, "problem": None, "threshold": threshold,
        "total": len(index["sources"]), "suggested": len(items),
        "pending": sum(item["decision"] is None for item in items),
        "duplicates": duplicates,
        "max_score": max((query["top_score"] for query in index["queries"]), default=None),
        "items": items,
    }


def save_decision(query_path: str, decision: str, duplicate_of: str | None) -> dict:
    state = queue()
    if not state["ready"]:
        raise ValueError(state["problem"])
    query = next((item for item in state["items"] if item["path"] == query_path), None)
    if query is None:
        raise ValueError("Clip này không nằm trong hàng chờ theo ngưỡng hiện tại.")
    if decision not in ("keep", "duplicate", "pending"):
        raise ValueError("Quyết định Dedup không hợp lệ.")
    if decision == "duplicate" and duplicate_of not in {m["path"] for m in query["matches"]}:
        raise ValueError("Hãy chọn một video trong top kết quả làm bản trùng.")
    if decision != "duplicate":
        duplicate_of = None
    finished = ROOT / "finished" / Path(query_path).name
    archived = None
    if decision == "duplicate" and finished.exists():
        archive_dir = INDEX_PATH.parent / "excluded_finished"
        archive_dir.mkdir(parents=True, exist_ok=True)
        archived = archive_dir / f"{finished.stem}.{uuid4().hex[:8]}{finished.suffix}"
        finished.replace(archived)
    try:
        with db.tx() as conn:
            if decision == "pending":
                conn.execute("DELETE FROM dedup_decisions WHERE query_path=?", (query_path,))
            else:
                conn.execute(
                    "INSERT INTO dedup_decisions(query_path, review_key, decision, duplicate_of, reviewed_at) "
                    "VALUES(?,?,?,?,?) ON CONFLICT(query_path) DO UPDATE SET "
                    "review_key=excluded.review_key, decision=excluded.decision, "
                    "duplicate_of=excluded.duplicate_of, reviewed_at=excluded.reviewed_at",
                    (query_path, query["review_key"], decision, duplicate_of, db.now()),
                )
    except Exception:
        if archived is not None:
            archived.replace(finished)
        raise
    return queue()


def allowed_sources() -> set[str]:
    state = queue()
    if not state["ready"]:
        raise ValueError(state["problem"])
    if state["pending"]:
        raise ValueError(f"Còn {state['pending']} clip cần duyệt ở trang Dedup.")
    index, _ = read_index()
    assert index is not None
    duplicates = {
        item["path"]: item["duplicate_of"]
        for item in state["items"] if item["decision"] == "duplicate"
    }
    for start in duplicates:
        seen = set()
        current = start
        while current in duplicates:
            if current in seen:
                raise ValueError("Các quyết định Dedup tạo vòng trùng nhau. Hãy giữ ít nhất một clip trong nhóm.")
            seen.add(current)
            current = duplicates[current]
    excluded = set(duplicates)
    return {source["path"] for source in index["sources"]} - excluded
