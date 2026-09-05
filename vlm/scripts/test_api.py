"""Prove the VLM actually reads the images -- not that it returns HTTP 200.

A server answering 200 says nothing about whether the vision encoder is wired
up. So the same question is asked three ways against one approved clip:

    real   4 keyframes from the clip
    grey   4 flat-grey frames of the same size
    blind  no images at all

If `real` matches `blind`, the pixels changed nothing and the model is answering
from language priors -- the small-scale version of the modality-collapse check
in `docs/modality_collapse_evaluation.md`. That exits non-zero.

    python -m vlm.scripts.test_api [--clip CLIP_ID] [--timeout SECONDS]

Writes one JSONL row per call to vlm/data/output/. Nothing is written to
pipeline.db: the clip pipeline owns that file and this path only reads it.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vlm import client, frames, select, source

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "vlm" / "data" / "output"

QUESTION = ("Mô tả các phương tiện nhìn thấy được và màu sắc của chúng. "
            "Trả lời ngắn gọn bằng tiếng Việt.")

# Checked by eye on 2026-09-05 against bzWcgH7kcMg_074600_113467_t01.mp4: a
# dashcam view with a Hyundai box truck on the left and an unmistakably yellow
# coach on the right. "vàng" cannot be guessed without looking (acceptance A6).
EXPECTED = {"bzWcgH7kcMg_074600_113467": "vàng"}


def _row(clip, condition: str, n_frames: int, model: str, **rest) -> dict:
    return {"clip_id": clip.clip_id, "shot": clip.shot,
            "source_sha256": clip.sha256, "condition": condition,
            "question": QUESTION, "n_frames": n_frames, "model": model,
            "at": dt.datetime.now().isoformat(timespec="seconds"), **rest}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--clip", help="clip_id to probe (default: the first approved one)")
    ap.add_argument("--frames", type=int, default=4)
    ap.add_argument("--timeout", type=float, default=180.0)
    ap.add_argument("--model", default="qwen3-vl-2b")
    args = ap.parse_args(argv)

    found = source.approved_clips()
    if found.missing:
        print(f"note: {len(found.missing)} approved shot(s) no longer on disk "
              f"(rejected or purged since): {', '.join(found.missing[:5])}")
    if not found.clips:
        print("FAIL: no approved clip to probe. Approve one in the review tab first.")
        return 1

    clip = next((c for c in found.clips if c.clip_id == args.clip), None) if args.clip \
        else found.clips[0]
    if clip is None:
        print(f"FAIL: {args.clip} is not an approved shot on disk")
        return 1

    try:
        client.health()
    except client.ServerDown as e:
        print(f"FAIL: {e}")
        return 1

    dur = frames.duration_s(clip.path)
    times = select.keyframe_times(dur, args.frames)
    try:
        real = frames.keyframes(clip.path, times)
    except frames.FrameError as e:
        print(f"FAIL: {e}")
        return 1
    grey = frames.grey_frames(len(real))

    print(f"clip      : {clip.clip_id} shot {clip.shot} ({dur:.1f}s)")
    print(f"sha256    : {clip.sha256[:16]}")
    print(f"keyframes : {times}")
    print(f"question  : {QUESTION}\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"probe_{dt.datetime.now():%Y%m%d_%H%M%S}.jsonl"

    answers: dict[str, str] = {}
    failed = False
    with out_path.open("w", encoding="utf-8") as fh:
        for condition, images in (("real", real), ("grey", grey), ("blind", [])):
            try:
                a = client.ask(QUESTION, images, timeout=args.timeout,
                               model=args.model)
            except client.VLMError as e:
                # Never drop a failed sample silently (overview.md §18).
                fh.write(json.dumps(_row(clip, condition, len(images), args.model,
                                         status="error", answer=None,
                                         latency_ms=None,
                                         error=f"{type(e).__name__}: {e}"),
                                    ensure_ascii=False) + "\n")
                print(f"[{condition:5}] ERROR {type(e).__name__}: {e}")
                failed = True
                continue
            answers[condition] = a.text
            fh.write(json.dumps(_row(clip, condition, len(images), args.model,
                                     status="success", answer=a.text,
                                     latency_ms=a.latency_ms,
                                     prompt_tokens=a.prompt_tokens,
                                     error=None), ensure_ascii=False) + "\n")
            print(f"[{condition:5}] {a.latency_ms:>6} ms  {a.prompt_tokens or '?':>5} tok  "
                  f"{a.text[:150]}")

    print(f"\nwrote {out_path.relative_to(REPO)}")
    if failed:
        print("FAIL: at least one condition errored (see the JSONL above)")
        return 1

    print()
    if answers["real"] == answers["blind"]:
        print("FAIL: 'real' and 'blind' produced the SAME answer.")
        print("      The images changed nothing -- the vision encoder is not "
              "contributing. Check that --mmproj is loaded.")
        return 1
    if answers["real"] == answers["grey"]:
        print("FAIL: 'real' and 'grey' produced the SAME answer.")
        print("      The model cannot tell real footage from a flat grey frame.")
        return 1

    expected = EXPECTED.get(clip.clip_id)
    if expected and expected.lower() not in answers["real"].lower():
        print(f"FAIL: the answer does not mention {expected!r}, which a human "
              f"verified is visible in this clip.")
        return 1

    print("PASS: real != grey != blind"
          + (f", and the answer names {expected!r} as a human did" if expected else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
