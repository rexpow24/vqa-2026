"""Lightweight dedup index and review state shared by sidecar and worker.

The GPU extractor lives in scripts/dedup_pilot.py. This module imports no ML
packages, so the existing sidecar environment can inspect and gate the index.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
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


def pair_key(signature_a: str, signature_b: str) -> str:
    """Stable identity for an unordered pair under the current score version."""
    ordered = sorted((signature_a, signature_b))
    content = json.dumps([SCORE_VERSION, *ordered], separators=(",", ":"))
    return sha256(content.encode()).hexdigest()


def pair_scores() -> dict[str, dict]:
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT * FROM dedup_pair_scores WHERE score_version=?", (SCORE_VERSION,)
        ).fetchall()
    return {row["pair_key"]: dict(row) for row in rows}


def pair_score_count() -> int:
    with db.tx() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM dedup_pair_scores WHERE score_version=?", (SCORE_VERSION,)
        ).fetchone()
    return int(row["n"])


def save_pair_scores(sources: list[dict], scores: dict[str, dict]) -> None:
    """Replace the cache with exactly the pairs valid for the published corpus."""
    current = {source["signature"] for source in sources}
    with db.tx() as conn:
        rows = conn.execute("SELECT pair_key, signature_a, signature_b FROM dedup_pair_scores").fetchall()
        for row in rows:
            if row["signature_a"] not in current or row["signature_b"] not in current:
                conn.execute("DELETE FROM dedup_pair_scores WHERE pair_key=?", (row["pair_key"],))
        for key, score in scores.items():
            conn.execute(
                "INSERT INTO dedup_pair_scores"
                " (pair_key, score_version, path_a, signature_a, path_b, signature_b,"
                " score, dino_score, phash_score, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
                " ON CONFLICT(pair_key) DO UPDATE SET score_version=excluded.score_version,"
                " path_a=excluded.path_a, signature_a=excluded.signature_a,"
                " path_b=excluded.path_b, signature_b=excluded.signature_b,"
                " score=excluded.score, dino_score=excluded.dino_score,"
                " phash_score=excluded.phash_score, updated_at=excluded.updated_at",
                (key, SCORE_VERSION, score["path_a"], score["signature_a"],
                 score["path_b"], score["signature_b"], score["score"],
                 score["dino_score"], score["phash_score"], db.now()),
            )


def _pid_alive(pid: int | None) -> bool:
    if not pid or pid == os.getpid():
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.GetExitCodeProcess.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        try:
            exit_code = wintypes.DWORD()
            return bool(kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))) and exit_code.value == 259
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def recover_stale_runs() -> None:
    """Turn abandoned run rows into retryable failures after a worker exits."""
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT run_id, worker_pid, started_at FROM dedup_runs WHERE status='running'"
        ).fetchall()
        for row in rows:
            if row["worker_pid"] is None:
                try:
                    started = datetime.fromisoformat(row["started_at"])
                    if (datetime.now(timezone.utc) - started).total_seconds() < 60:
                        continue
                except (ValueError, TypeError):
                    pass
            if not _pid_alive(row["worker_pid"]):
                conn.execute(
                    "UPDATE dedup_runs SET status='failed', completed_at=?, error=?"
                    " WHERE run_id=? AND status='running'",
                    (db.now(), "Worker stopped before publishing a result. Retry the comparison.", row["run_id"]),
                )


def create_run(source_count: int, added: int, changed: int, removed: int) -> str:
    run_id = uuid4().hex
    with db.tx() as conn:
        conn.execute(
            "INSERT INTO dedup_runs"
            " (run_id,status,started_at,source_count,added_count,changed_count,removed_count)"
            " VALUES(?,'running',?,?,?,?,?)",
            (run_id, db.now(), source_count, added, changed, removed),
        )
    return run_id


def set_run_pid(run_id: str, pid: int) -> None:
    with db.tx() as conn:
        conn.execute("UPDATE dedup_runs SET worker_pid=? WHERE run_id=?", (pid, run_id))


def finish_run(run_id: str, pairs_computed: int) -> None:
    with db.tx() as conn:
        conn.execute(
            "UPDATE dedup_runs SET status='completed', completed_at=?, pairs_computed=?, error=NULL"
            " WHERE run_id=?",
            (db.now(), pairs_computed, run_id),
        )


def fail_run(run_id: str, error: str, pairs_computed: int = 0) -> None:
    with db.tx() as conn:
        conn.execute(
            "UPDATE dedup_runs SET status='failed', completed_at=?, pairs_computed=?, error=?"
            " WHERE run_id=?",
            (db.now(), pairs_computed, error[-4000:], run_id),
        )


def run_history(limit: int = 20) -> list[dict]:
    recover_stale_runs()
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT * FROM dedup_runs ORDER BY started_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(row) for row in rows]


def active_run() -> dict | None:
    recover_stale_runs()
    with db.tx() as conn:
        row = conn.execute(
            "SELECT * FROM dedup_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
    return dict(row) if row else None


def source_changes(sources: list[dict]) -> dict[str, int]:
    """Count added, modified, and removed paths against the last published index."""
    try:
        previous = json.loads(INDEX_PATH.read_text(encoding="utf-8")).get("sources", [])
        old = {source["path"]: source["signature"] for source in previous}
    except (OSError, ValueError, TypeError, KeyError):
        old = {}
    current = {source["path"]: source["signature"] for source in sources}
    return {
        "added": len(current.keys() - old.keys()),
        "changed": sum(current[path] != old[path] for path in current.keys() & old.keys()),
        "removed": len(old.keys() - current.keys()),
    }


def _decisions() -> dict[str, dict]:
    with db.tx() as conn:
        rows = conn.execute(
            "SELECT query_path, review_key, decision, duplicate_of, reviewed_at FROM dedup_decisions"
        ).fetchall()
    return {row["query_path"]: dict(row) for row in rows}


def queue() -> dict:
    index, problem = read_index()
    threshold = get_threshold()
    sources = current_sources()
    changes = source_changes(sources)
    expected_pairs = len(sources) * (len(sources) - 1) // 2
    cached_pairs = pair_score_count()
    cache_current = not any(changes.values()) and cached_pairs == expected_pairs
    run_info = {
        "has_index": INDEX_PATH.exists(),
        "source_changes": changes,
        "pairs_cached": cached_pairs,
        "pairs_total": expected_pairs,
        "pair_baseline_ready": cache_current,
    }
    if index is None:
        return {
            "ready": False, "problem": problem, "threshold": threshold,
            "total": len(sources), "suggested": 0, "pending": 0,
            "duplicates": 0, "max_score": None, "items": [],
            **run_info,
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
        **run_info,
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


def save_duplicate_and_keep(query_path: str, keep_path: str) -> dict:
    state = queue()
    if not state["ready"]:
        raise ValueError(state["problem"])
    query = next((item for item in state["items"] if item["path"] == query_path), None)
    if query is None:
        raise ValueError("Clip này không nằm trong hàng chờ theo ngưỡng hiện tại.")
    if keep_path not in {match["path"] for match in query["matches"]}:
        raise ValueError("Hãy chọn một video trong top kết quả làm bản giữ.")

    index, _ = read_index()
    assert index is not None
    keep_query = next((item for item in index["queries"] if item["path"] == keep_path), None)
    if keep_query is None:
        raise ValueError("Không tìm thấy clip được chọn để giữ trong kết quả Dedup hiện tại.")

    finished = ROOT / "finished" / Path(query_path).name
    archived = None
    if finished.exists():
        archive_dir = INDEX_PATH.parent / "excluded_finished"
        archive_dir.mkdir(parents=True, exist_ok=True)
        archived = archive_dir / f"{finished.stem}.{uuid4().hex[:8]}{finished.suffix}"
        finished.replace(archived)
    try:
        with db.tx() as conn:
            for path, review_key, decision, duplicate_of in (
                (query_path, query["review_key"], "duplicate", keep_path),
                (keep_path, keep_query["review_key"], "keep", None),
            ):
                conn.execute(
                    "INSERT INTO dedup_decisions(query_path, review_key, decision, duplicate_of, reviewed_at) "
                    "VALUES(?,?,?,?,?) ON CONFLICT(query_path) DO UPDATE SET "
                    "review_key=excluded.review_key, decision=excluded.decision, "
                    "duplicate_of=excluded.duplicate_of, reviewed_at=excluded.reviewed_at",
                    (path, review_key, decision, duplicate_of, db.now()),
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
