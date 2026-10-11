"""Build a full-corpus dedup index for every approved trimmed clip.

Run with the project's GPU virtual environment:
    .venv/Scripts/python.exe scripts/dedup_all.py
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.dedup_pilot import (  # noqa: E402
    MODEL_ID, SAMPLE_COUNT, load_or_embed, load_or_hash, verified_score,
)
from vqa import dedup  # noqa: E402


def main() -> int:
    sources = dedup.current_sources()
    if not sources:
        print("No approved trimmed clips found", flush=True)
        return 1
    paths = [dedup.ROOT / source["path"] for source in sources]
    output = dedup.INDEX_PATH.parent
    output.mkdir(parents=True, exist_ok=True)

    # Reuse the 10-clip pilot's completed GPU work on the first integrated run.
    pilot_cache = dedup.ROOT / "artifacts" / "dedup_pilot"
    for name in ("embeddings.npz", "frame_hashes.npz"):
        target = output / name
        if not target.exists() and (pilot_cache / name).exists():
            shutil.copy2(pilot_cache / name, target)

    embeddings, durations = load_or_embed(paths, dedup.ROOT, output)
    hashes = load_or_hash(paths, dedup.ROOT, output)
    neighbors: list[list[tuple[int, float, float, float]]] = [[] for _ in paths]
    for i in range(len(paths)):
        for j in range(i + 1, len(paths)):
            score, dino_score, phash_score = verified_score(
                embeddings[i], embeddings[j], hashes[i], hashes[j]
            )
            neighbors[i].append((j, score, dino_score, phash_score))
            neighbors[j].append((i, score, dino_score, phash_score))
        if (i + 1) % 25 == 0 or i + 1 == len(paths):
            print(f"Compared {i + 1}/{len(paths)} clips", flush=True)

    queries = []
    for i, matches in enumerate(neighbors):
        matches.sort(key=lambda item: item[1], reverse=True)
        top = matches[:5]
        queries.append({
            "path": sources[i]["path"],
            "duration_s": round(float(durations[i]), 2),
            "top_score": round(top[0][1], 6) if top else -1.0,
            "review_key": dedup.review_key(
                sources[i]["signature"], [sources[j]["signature"] for j, *_ in top]
            ),
            "matches": [
                {"path": sources[j]["path"], "duration_s": round(float(durations[j]), 2),
                 "score": round(score, 6), "dino_score": round(dino_score, 6),
                 "phash_score": round(phash_score, 6)}
                for j, score, dino_score, phash_score in top
            ],
        })
    index = {
        "version": dedup.INDEX_VERSION,
        "score_version": dedup.SCORE_VERSION,
        "model": MODEL_ID,
        "sample_count": SAMPLE_COUNT,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": sources,
        "queries": queries,
    }
    # If a reviewer changes a trim during the scan, never publish mixed data.
    if sources != dedup.current_sources():
        print("Trimmed files changed during analysis; run Dedup again", flush=True)
        return 2
    temporary = output / "index.json.tmp"
    temporary.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(dedup.INDEX_PATH)
    print(f"Indexed {len(paths)} clips -> {dedup.INDEX_PATH}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
