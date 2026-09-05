"""Ask the VLM a question about any video file.

    python -m vlm.scripts.ask <video> "<your question>"
    python -m vlm.scripts.ask clip.mp4 "Xe nào gây ra va chạm?" --frames 8
    python -m vlm.scripts.ask clip.mp4 "What happened?" --middle --json

Samples N frames, sends them in one request, prints the answer. The server has
to be up: docker compose -f docker/docker-compose.yml up -d
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vlm import client, frames, select


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path, help="path to any video file")
    ap.add_argument("prompt", help="the question to ask about it")
    ap.add_argument("--frames", type=int, default=4,
                    help="how many keyframes to send (default 4; each costs "
                         "~344 tokens of a 4096 context, so 8 is the practical max)")
    ap.add_argument("--width", type=int, default=768,
                    help="resize frames to this width (default 768)")
    ap.add_argument("--middle", action="store_true",
                    help="cluster frames around the middle, as the clip pipeline "
                         "does for shots cut as impact +/- pad. Default is to "
                         "spread them evenly across the whole video.")
    ap.add_argument("--at", type=float, nargs="+", metavar="SEC",
                    help="exact timestamps in seconds, instead of sampling")
    ap.add_argument("--temperature", type=float, default=0.0)
    ap.add_argument("--max-tokens", type=int, default=600)
    ap.add_argument("--timeout", type=float, default=300.0)
    ap.add_argument("--json", action="store_true", help="print one JSON object")
    args = ap.parse_args(argv)

    if not args.video.exists():
        print(f"FAIL: no such file: {args.video}")
        return 1

    try:
        client.health()
    except client.ServerDown as e:
        print(f"FAIL: {e}")
        return 1

    try:
        dur = frames.duration_s(args.video)
        if args.at:
            times = [t for t in args.at if 0 <= t <= dur]
            if len(times) != len(args.at):
                print(f"note: dropped timestamps outside 0-{dur:.1f}s")
            if not times:
                print(f"FAIL: no timestamp lands inside 0-{dur:.1f}s")
                return 1
        else:
            pick = select.keyframe_times if args.middle else select.even_times
            times = pick(dur, args.frames)
        images = frames.keyframes(args.video, times, width=args.width)
    except (frames.FrameError, ValueError) as e:
        print(f"FAIL: {e}")
        return 1

    if not args.json:
        print(f"video  : {args.video.name}  ({dur:.1f}s)")
        print(f"frames : {len(images)} at {times}")
        print(f"prompt : {args.prompt}\n")

    try:
        a = client.ask(args.prompt, images, temperature=args.temperature,
                       max_tokens=args.max_tokens, timeout=args.timeout)
    except client.VLMError as e:
        if args.json:
            print(json.dumps({"video": str(args.video), "prompt": args.prompt,
                              "status": "error", "error": f"{type(e).__name__}: {e}"},
                             ensure_ascii=False))
        else:
            print(f"FAIL: {type(e).__name__}: {e}")
        return 1

    if args.json:
        print(json.dumps({"video": str(args.video), "prompt": args.prompt,
                          "frame_times_s": times, "status": "success",
                          "answer": a.text, "latency_ms": a.latency_ms,
                          "prompt_tokens": a.prompt_tokens}, ensure_ascii=False))
    else:
        print(a.text)
        print(f"\n({a.latency_ms} ms, {a.prompt_tokens} prompt tokens)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
