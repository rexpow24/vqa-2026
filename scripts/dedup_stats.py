"""Summarize reviewed Dedup scores without modifying the database or index."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from vqa import dedup


def _read_index(index_path: Path, root: Path) -> dict:
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ValueError(f"Cannot read Dedup index: {index_path}") from exc

    if index.get("version") != dedup.INDEX_VERSION or index.get("score_version") != dedup.SCORE_VERSION:
        raise ValueError("Dedup scoring version changed; run Dedup again before calculating stats.")

    sources = []
    for path in sorted((root / "work").glob("*/trimmed/*.mp4")):
        if dedup.TRIMMED_NAME.search(path.name):
            sources.append({
                "path": path.relative_to(root).as_posix(),
                "signature": (
                    f"{path.relative_to(root).as_posix()}|"
                    f"{path.stat().st_size}|{path.stat().st_mtime_ns}"
                ),
            })
    if index.get("sources") != sources:
        raise ValueError("Dedup index is stale; run Dedup again before calculating stats.")
    if len(index.get("queries", [])) != len(sources):
        raise ValueError("Dedup index is incomplete; run Dedup again before calculating stats.")
    return index


def _read_decisions(db_path: Path) -> tuple[list[dict], float]:
    uri = f"{db_path.resolve().as_uri()}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute(
                "SELECT query_path, review_key, decision, duplicate_of, reviewed_at "
                "FROM dedup_decisions ORDER BY reviewed_at, query_path"
            ).fetchall()
            threshold_row = conn.execute(
                "SELECT value FROM dedup_settings WHERE key='threshold'"
            ).fetchone()
        finally:
            conn.close()
    except sqlite3.Error as exc:
        raise ValueError(f"Cannot read Dedup decisions from {db_path}: {exc}") from exc
    threshold = float(threshold_row["value"]) if threshold_row else dedup.DEFAULT_THRESHOLD
    return [dict(row) for row in rows], threshold


def collect_stats(db_path: Path, index_path: Path, root: Path = ROOT) -> dict:
    index = _read_index(index_path, root)
    decisions, threshold = _read_decisions(db_path)
    queries = {query["path"]: query for query in index["queries"]}

    reviewed = []
    stale = 0
    invalid_duplicates = 0
    for decision in decisions:
        query = queries.get(decision["query_path"])
        if query is None or query["review_key"] != decision["review_key"]:
            stale += 1
            continue

        row = {
            "query_path": decision["query_path"],
            "decision": decision["decision"],
            "duplicate_of": decision["duplicate_of"] or "",
            "top_score": float(query["top_score"]),
            "selected_match_score": "",
            "selected_match_dino_score": "",
            "selected_match_phash_score": "",
            "reviewed_at": decision["reviewed_at"],
        }
        if decision["decision"] == "duplicate":
            match = next(
                (match for match in query["matches"]
                 if match["path"] == decision["duplicate_of"]),
                None,
            )
            if match is None:
                invalid_duplicates += 1
                continue
            row["selected_match_score"] = float(match["score"])
            row["selected_match_dino_score"] = float(match["dino_score"])
            row["selected_match_phash_score"] = float(match["phash_score"])
        reviewed.append(row)

    duplicates = [row for row in reviewed if row["decision"] == "duplicate"]
    keeps = [row for row in reviewed if row["decision"] == "keep"]
    duplicate_pair_scores = [row["selected_match_score"] for row in duplicates]
    duplicate_queue_scores = [row["top_score"] for row in duplicates]
    keep_queue_scores = [row["top_score"] for row in keeps]

    interval = None
    if duplicate_queue_scores and keep_queue_scores:
        max_keep = max(keep_queue_scores)
        min_duplicate = min(duplicate_queue_scores)
        if max_keep < min_duplicate:
            interval = (max_keep, min_duplicate)

    return {
        "threshold": threshold,
        "reviewed": reviewed,
        "duplicate_count": len(duplicates),
        "keep_count": len(keeps),
        "stale_count": stale,
        "invalid_duplicate_count": invalid_duplicates,
        "duplicate_pair_scores": duplicate_pair_scores,
        "duplicate_queue_scores": duplicate_queue_scores,
        "keep_queue_scores": keep_queue_scores,
        "candidate_threshold_interval": interval,
    }


def _score_summary(label: str, scores: list[float]) -> None:
    if not scores:
        print(f"{label}: no reviewed samples")
        return
    print(
        f"{label}: n={len(scores)}, mean={mean(scores):.4f}, "
        f"min={min(scores):.4f}, max={max(scores):.4f}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=ROOT / "pipeline.db")
    parser.add_argument("--index", type=Path, default=ROOT / "artifacts" / "dedup" / "index.json")
    parser.add_argument("--out", type=Path, help="Optional CSV with one row per current reviewed query.")
    args = parser.parse_args(argv)

    try:
        stats = collect_stats(args.db, args.index)
    except ValueError as exc:
        parser.error(str(exc))

    print(f"Current queue threshold: {stats['threshold']:.4f}")
    print(f"Current reviewed decisions: {len(stats['reviewed'])}")
    print(f"Duplicate: {stats['duplicate_count']}; keep: {stats['keep_count']}")
    print(f"Skipped stale decisions: {stats['stale_count']}")
    print(f"Skipped duplicates without a current selected match: {stats['invalid_duplicate_count']}")
    _score_summary("Selected duplicate-pair score", stats["duplicate_pair_scores"])
    _score_summary("Duplicate-query top score", stats["duplicate_queue_scores"])
    _score_summary("Keep-query top score", stats["keep_queue_scores"])

    interval = stats["candidate_threshold_interval"]
    if interval is None:
        print("No threshold cleanly separates the reviewed duplicate and keep queries.")
    else:
        print(
            "Observed candidate threshold interval "
            f"(max keep <= threshold < min duplicate): [{interval[0]:.4f}, {interval[1]:.4f})"
        )
    print("Scores summarize reviewed examples; they are not calibrated probabilities.")

    if args.out:
        with args.out.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=[
                "query_path", "decision", "duplicate_of", "top_score",
                "selected_match_score", "selected_match_dino_score",
                "selected_match_phash_score", "reviewed_at",
            ])
            writer.writeheader()
            writer.writerows(stats["reviewed"])
        print(f"Reviewed-query details: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
