"""Draft nine QA pairs for every approved shot.

    python -m vlm.scripts.draft --limit 2          # pilot
    python -m vlm.scripts.draft                    # everything
    python -m vlm.scripts.draft --resume           # skip shots already drafted

Writes JSONL to `vlm/data/drafts/`, one file per run. Nothing else: this package
may not write to any database (`tests/test_vlm_isolation.py`), and the JSONL is
also what makes the run resumable. `python -m scripts.import_drafts` loads it
into `annotations.db` afterwards.

Shot outer, group inner, deliberately. llama.cpp runs one slot (`--parallel 1`),
so its prefix cache holds exactly one image prefix. Keeping all nine groups of a
shot together costs one 17s image encode per shot; looping groups on the outside
would re-encode the same eight images nine times -- measured at ~7 hours over the
full set instead of ~47 minutes.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vlm import client, frames, prompts, select, source

OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "drafts"

N_FRAMES = 8
WIDTH = 768


def already_done(out_dir: Path) -> set[tuple[str, int, str]]:
    """(clip_id, shot, qgroup) triples present in any previous run's output."""
    done: set[tuple[str, int, str]] = set()
    for f in sorted(out_dir.glob("draft_*.jsonl")):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            if r.get("status") == "success":
                done.add((r["clip_id"], r["shot"], r["qgroup"]))
    return done


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, help="only the first N shots")
    ap.add_argument("--labeled-first", action="store_true",
                    help="prefer shots that already carry a human difficulty/event "
                         "label, so draft and human judgement can be compared now")
    ap.add_argument("--resume", action="store_true",
                    help="skip (shot, group) pairs already drafted successfully")
    ap.add_argument("--frames", type=int, default=N_FRAMES)
    ap.add_argument("--width", type=int, default=WIDTH)
    ap.add_argument("--timeout", type=float, default=900.0)
    args = ap.parse_args(argv)

    try:
        client.health()
    except client.ServerDown as e:
        print(f"FAIL: {e}")
        return 1

    src = source.approved_clips()
    shots = src.clips
    if args.labeled_first:
        labeled = source.labeled_clip_ids()
        shots = [s for s in shots if s.clip_id in labeled] + \
                [s for s in shots if s.clip_id not in labeled]
    if args.limit:
        shots = shots[:args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    skip = already_done(OUT_DIR) if args.resume else set()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out = OUT_DIR / f"draft_{stamp}.jsonl"

    print(f"{len(shots)} shot x {len(prompts.GROUPS)} nhóm -> {out.name}")
    if skip:
        print(f"resume: bỏ qua {len(skip)} (shot, nhóm) đã có")
    if src.missing:
        print(f"note: {len(src.missing)} shot đã duyệt nhưng file không còn trên đĩa")

    n_ok = n_fail = n_skip = 0
    t_start = time.perf_counter()

    with out.open("w", encoding="utf-8") as fh:
        for si, s in enumerate(shots, 1):
            try:
                dur = frames.duration_s(s.path)
                times = select.even_times(dur, args.frames)
                imgs = frames.keyframes(s.path, times, width=args.width)
            except frames.FrameError as e:
                print(f"[{si}/{len(shots)}] {s.clip_id} t{s.shot:02d}  FAIL: {e}")
                n_fail += len(prompts.GROUPS)
                continue

            t_shot = time.perf_counter()
            marks = []
            for g in prompts.GROUPS:
                if (s.clip_id, s.shot, g.code) in skip:
                    n_skip += 1
                    marks.append(".")
                    continue
                row = {
                    "clip_id": s.clip_id, "video_id": s.video_id, "shot": s.shot,
                    "source_sha256": s.sha256, "qgroup": g.code,
                    "group_name": g.name,
                    "question": g.question,
                    "prompt_text": prompts.render(g, len(imgs)),
                    "prompt_name": prompts.PROMPT_NAME,
                    "prompt_version": prompts.PROMPT_VERSION,
                    "model": "qwen3-vl-2b",
                    "frame_times_s": times, "n_frames": len(imgs),
                    "frame_width": args.width,
                    "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }
                try:
                    a = client.ask(prompts.render(g, len(imgs)), imgs,
                                   max_tokens=g.max_tokens, timeout=args.timeout,
                                   repeat_penalty=prompts.REPEAT_PENALTY)
                    row.update(status="success", answer=a.text,
                               latency_ms=a.latency_ms,
                               prompt_tokens=a.prompt_tokens,
                               completion_tokens=a.completion_tokens,
                               max_tokens=g.max_tokens,
                               truncated=bool(a.completion_tokens
                                              and a.completion_tokens >= g.max_tokens),
                               keyframes_s=[])
                    n_ok += 1
                    marks.append("!" if row["truncated"] else "+")
                except client.VLMError as e:
                    row.update(status="error", error=f"{type(e).__name__}: {e}")
                    n_fail += 1
                    marks.append("x")
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                fh.flush()   # a kill mid-run must not lose the shots already done

            print(f"[{si}/{len(shots)}] {s.clip_id} t{s.shot:02d} "
                  f"{dur:5.1f}s  {''.join(marks)}  "
                  f"{time.perf_counter() - t_shot:5.1f}s")

    mins = (time.perf_counter() - t_start) / 60
    print(f"\n{n_ok} thành công, {n_fail} lỗi, {n_skip} bỏ qua, {mins:.1f} phút")
    print(f"-> {out}")
    print(f"nạp vào DB:  python -m scripts.import_drafts {out.as_posix()}")
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
