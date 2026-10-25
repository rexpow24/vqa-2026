"""Incrementally compare approved trimmed clips and publish a fresh index.

Run with the project's GPU virtual environment:
    .venv/Scripts/python.exe scripts/dedup_all.py
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vqa import dedup  # noqa: E402


def _previous_durations() -> dict[str, tuple[str, float]]:
    try:
        index = json.loads(dedup.INDEX_PATH.read_text(encoding="utf-8"))
        signatures = {source["path"]: source["signature"] for source in index.get("sources", [])}
        return {
            query["path"]: (signatures[query["path"]], float(query["duration_s"]))
            for query in index.get("queries", []) if query["path"] in signatures
        }
    except (OSError, ValueError, TypeError, KeyError):
        return {}


def _video_duration(path: Path) -> float:
    import cv2

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    try:
        count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        if count <= 0 or fps <= 0:
            raise RuntimeError(f"Cannot read video timing: {path}")
        return count / fps
    finally:
        capture.release()


def run_incremental(
    run_id: str,
    *,
    feature_loader=None,
    scorer=None,
) -> dict:
    """Fill missing pair scores and publish the top-five index.

    Injectable feature/scoring functions keep incremental behavior testable
    without loading the local GPU model.
    """
    pairs_computed = 0
    try:
        sources = dedup.current_sources()
        if not sources:
            raise RuntimeError("No approved trimmed clips found")
        signatures = [source["signature"] for source in sources]
        paths = [dedup.ROOT / source["path"] for source in sources]
        output = dedup.INDEX_PATH.parent
        output.mkdir(parents=True, exist_ok=True)
        saved = dedup.pair_scores()
        work_pairs = []
        pair_rows = {}
        for i in range(len(sources)):
            for j in range(i + 1, len(sources)):
                key = dedup.pair_key(signatures[i], signatures[j])
                cached = saved.get(key)
                if cached and cached["signature_a"] in signatures and cached["signature_b"] in signatures:
                    pair_rows[key] = cached
                else:
                    work_pairs.append((i, j, key))

        previous_durations = _previous_durations()
        durations = {
            source["path"]: previous_durations[source["path"]][1]
            for source in sources
            if source["path"] in previous_durations
            and previous_durations[source["path"]][0] == source["signature"]
        }

        embeddings = hashes = feature_durations = None
        if work_pairs:
            if feature_loader is None:
                from scripts.dedup_pilot import load_or_embed, load_or_hash

                def feature_loader(feature_paths, root, output):
                    vectors, clip_durations = load_or_embed(feature_paths, root, output)
                    frame_hashes = load_or_hash(feature_paths, root, output)
                    return vectors, frame_hashes, clip_durations

            embeddings, hashes, feature_durations = feature_loader(
                paths, dedup.ROOT, dedup.INDEX_PATH.parent
            )
            for source, duration in zip(sources, feature_durations):
                durations[source["path"]] = float(duration)
            if scorer is None:
                from scripts.dedup_pilot import verified_score

                scorer = verified_score
            for count, (i, j, key) in enumerate(work_pairs, 1):
                score, dino_score, phash_score = scorer(
                    embeddings[i], embeddings[j], hashes[i], hashes[j]
                )
                a, b = sorted((sources[i], sources[j]), key=lambda source: source["signature"])
                pair_rows[key] = {
                    "path_a": a["path"], "signature_a": a["signature"],
                    "path_b": b["path"], "signature_b": b["signature"],
                    "score": float(score), "dino_score": float(dino_score),
                    "phash_score": float(phash_score),
                }
                pairs_computed = count
                if count % 100 == 0 or count == len(work_pairs):
                    print(f"Compared {count}/{len(work_pairs)} new pairs", flush=True)
        for source in sources:
            if source["path"] not in durations:
                durations[source["path"]] = _video_duration(dedup.ROOT / source["path"])

        by_signature = {source["signature"]: source for source in sources}
        neighbors: dict[str, list[tuple[dict, dict]]] = {signature: [] for signature in signatures}
        for key, pair in pair_rows.items():
            a = by_signature.get(pair["signature_a"])
            b = by_signature.get(pair["signature_b"])
            if a is None or b is None:
                continue
            neighbors[a["signature"]].append((b, pair))
            neighbors[b["signature"]].append((a, pair))

        queries = []
        for source in sources:
            matches = sorted(neighbors[source["signature"]], key=lambda entry: entry[1]["score"], reverse=True)[:5]
            candidate_signatures = [candidate["signature"] for candidate, _ in matches]
            queries.append({
                "path": source["path"],
                "duration_s": round(durations[source["path"]], 2),
                "top_score": round(matches[0][1]["score"], 6) if matches else -1.0,
                "review_key": dedup.review_key(source["signature"], candidate_signatures),
                "matches": [
                    {
                        "path": candidate["path"],
                        "duration_s": round(durations[candidate["path"]], 2),
                        "score": round(pair["score"], 6),
                        "dino_score": round(pair["dino_score"], 6),
                        "phash_score": round(pair["phash_score"], 6),
                    }
                    for candidate, pair in matches
                ],
            })

        index = {
            "version": dedup.INDEX_VERSION,
            "score_version": dedup.SCORE_VERSION,
            "model": "facebook/dinov2-base",
            "sample_count": 8,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sources": sources,
            "queries": queries,
        }
        if sources != dedup.current_sources():
            raise RuntimeError("Trimmed files changed during analysis; retry the comparison.")
        temporary = output / "index.json.tmp"
        temporary.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
        # Persist scores before replacing the index. If replacing fails, the old
        # index remains intact and the next run can publish from cached scores.
        dedup.save_pair_scores(sources, pair_rows)
        temporary.replace(dedup.INDEX_PATH)
        dedup.finish_run(run_id, pairs_computed)
        print(f"Indexed {len(paths)} clips; computed {pairs_computed} pairs", flush=True)
        return {"sources": len(sources), "pairs_computed": pairs_computed}
    except Exception as error:
        dedup.fail_run(run_id, str(error), pairs_computed)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id")
    args = parser.parse_args()
    sources = dedup.current_sources()
    if not sources:
        print("No approved trimmed clips found", flush=True)
        return 1
    run_id = args.run_id
    if run_id is None:
        changes = dedup.source_changes(sources)
        run_id = dedup.create_run(len(sources), changes["added"], changes["changed"], changes["removed"])
    try:
        dedup.set_run_pid(run_id, __import__("os").getpid())
        run_incremental(run_id)
    except Exception as error:
        print(f"Dedup failed: {error}", flush=True)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
