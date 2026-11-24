"""Render the group E training video from narration.vi.draft.json + boxes.json.

Per scene:
1. Narration audio with local VieNeu-TTS (voice "Hải Đăng"), one cached WAV per
   sentence, joined with the same silences as the group C series
   (tham-khao-C/video-training/render_training.py).
2. Visual parts with ffmpeg only: text cards, footage segments from the
   anonymized finished/ clips (C1's 0-1.6 s segment gets the rider-face and
   painted-plate masks from boxes.json), and freezes of the approved stills
   (make_stills.py --final, no draft watermark).
3. Scene MP4 = parts + WAV; master = concat of all scenes.

Run with the C video venv (has vieneu, numpy, soundfile):
  D:\\Projects\\Assignment\\VQA-VN-Traffic-2026\\.venv-c-video\\Scripts\\python.exe render_training.py --finished-dir D:/Projects/Assignment/VQA-VN-Traffic-2026
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output"
FFMPEG = r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffprobe.exe"
FONT = "C:/Windows/Fonts/arial.ttf"
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"
FPS = 30
LEAD, GAP, TAIL = 0.5, 0.55, 1.4  # same as the group C series
VOICE = "Hải Đăng"
MIN_HOLD = 2.0
ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def esc(path: Path | str) -> str:
    return "'" + str(path).replace("\\", "/").replace(":", "\\:") + "'"


def run(args: list[str]) -> None:
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]


# ---------------------------------------------------------------- audio (as in the C series)
_tts = None


def synth(text: str, cache: Path):
    import numpy as np
    import soundfile as sf

    key = hashlib.sha1(f"{VOICE}|{text}".encode("utf-8")).hexdigest()[:16]
    path = cache / f"{key}.wav"
    if not path.exists():
        global _tts
        if _tts is None:
            from vieneu import Vieneu
            _tts = Vieneu(mode="v3turbo", device="cpu")
        result = _tts.infer(text, voice=VOICE)
        audio = np.asarray(result[0] if isinstance(result, tuple) else result, dtype=np.float32)
        rate = int(result[1]) if isinstance(result, tuple) and len(result) > 1 else int(getattr(_tts, "sample_rate", 48000))
        sf.write(path, audio.reshape(-1), rate)
    audio, rate = sf.read(path, dtype="float32")
    return audio, rate


def build_audio(scene: dict, wav: Path, timing_path: Path) -> dict:
    import numpy as np
    import soundfile as sf

    cache = OUTPUT / "audio" / "parts"
    cache.mkdir(parents=True, exist_ok=True)
    parts, timing, cursor, rate = [], [], LEAD, None
    for i, text in enumerate(sentences(scene["narration"])):
        audio, r = synth(text, cache)
        rate = rate or r
        if r != rate:
            raise RuntimeError(f"sample rate changed between sentences: {r} vs {rate}")
        if i:
            parts.append(np.zeros(int(GAP * rate), dtype=np.float32))
            cursor += GAP
        parts.append(audio)
        timing.append({"text": text, "start": round(cursor, 3), "end": round(cursor + len(audio) / rate, 3)})
        cursor += len(audio) / rate
    full = np.concatenate([np.zeros(int(LEAD * rate), dtype=np.float32), *parts, np.zeros(int(TAIL * rate), dtype=np.float32)])
    sf.write(wav, full, rate)
    result = {"sentences": timing, "duration": round(len(full) / rate, 3)}
    timing_path.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    return result


def scene_audio(scene: dict) -> tuple[Path, dict]:
    adir = OUTPUT / "audio"
    adir.mkdir(parents=True, exist_ok=True)
    wav, timing_path = adir / f"{scene['id']}.wav", adir / f"{scene['id']}.timing.json"
    if wav.exists() and timing_path.exists():
        timing = json.loads(timing_path.read_text(encoding="utf-8"))
        if [s["text"] for s in timing["sentences"]] == sentences(scene["narration"]):
            return wav, timing
    return wav, build_audio(scene, wav, timing_path)


# ---------------------------------------------------------------- visuals
def card_png(card: dict, out: Path, tmp: Path) -> None:
    draws, y = [], 250
    title = tmp / f"{out.stem}_title.txt"
    title.write_text(card["title"], encoding="utf-8")
    draws.append(f"drawtext=fontfile={esc(FONT_BOLD)}:textfile={esc(title)}:x=(w-text_w)/2:y={y}:fontsize=68:fontcolor=0xFFB000")
    y += 140
    for i, line in enumerate(card.get("lines", [])):
        for j, piece in enumerate(textwrap.wrap(line, 58)):
            f = tmp / f"{out.stem}_l{i}_{j}.txt"
            f.write_text(piece, encoding="utf-8")
            if j == 0:
                bullet = tmp / f"{out.stem}_bullet.txt"
                bullet.write_text("•", encoding="utf-8")
                draws.append(f"drawtext=fontfile={esc(FONT)}:textfile={esc(bullet)}:x=255:y={y}:fontsize=46:fontcolor=0xFFB000")
            draws.append(f"drawtext=fontfile={esc(FONT)}:textfile={esc(f)}:x=300:y={y}:fontsize=46:fontcolor=white")
            y += 66
        y += 22
    run(["-f", "lavfi", "-i", "color=c=0x14161A:s=1920x1080", "-vf", ",".join(draws), "-frames:v", "1", str(out)])


def interp(keys: list[dict], t: float) -> dict | None:
    if t < keys[0]["t"] or t > keys[-1]["t"]:
        return None
    for a, b in zip(keys, keys[1:]):
        if a["t"] <= t <= b["t"]:
            k = (t - a["t"]) / (b["t"] - a["t"]) if b["t"] > a["t"] else 0
            return {c: a[c] + (b[c] - a[c]) * k for c in ("x", "y", "w", "h")}
    return dict(keys[-1])


def mask_filters(segment_masks: dict, start: float, end: float, step: float = 0.1, pad: int = 25) -> list[tuple[float, float, dict]]:
    """Static boxes per short window: the union of the interpolated box at both ends, padded."""
    out = []
    t = start
    while t < end - 1e-6:
        t2 = min(t + step, end)
        for name, keys in segment_masks.items():
            if not isinstance(keys, list):
                continue
            boxes = [b for b in (interp(keys, t), interp(keys, t2), interp(keys, (t + t2) / 2)) if b]
            if not boxes:
                continue
            x0 = max(0, int(min(b["x"] for b in boxes)) - pad)
            y0 = max(0, int(min(b["y"] for b in boxes)) - pad)
            x1 = min(1920, int(max(b["x"] + b["w"] for b in boxes)) + pad)
            y1 = min(1080, int(max(b["y"] + b["h"] for b in boxes)) + pad)
            out.append((t, t2, {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}))
        t = t2
    return out


def play_part(part: dict, clips: dict, finished: Path, out: Path) -> float:
    clip = clips[part["clip"]]
    src = finished / clip["source"]
    start, end, speed = part["start"], part["end"], part.get("speed", 1.0)
    chain = [f"[0:v]scale=1920:1080,setsar=1,fps={FPS}[v0]"]
    cur = "v0"
    masks = clip.get("segment_masks")
    if masks:
        # Times in the trimmed stream start at 0, the keyframes are clip times.
        for i, (a, b, m) in enumerate(mask_filters(masks, start, end)):
            if b <= start or a >= end:
                continue
            ea, eb = a - start, b - start + 0.5 / FPS
            chain.append(
                f"[{cur}]split[s{i}a][s{i}b];[s{i}b]crop={m['w']}:{m['h']}:{m['x']}:{m['y']},"
                f"boxblur=luma_radius=20:luma_power=3:chroma_radius=10[m{i}];"
                f"[s{i}a][m{i}]overlay={m['x']}:{m['y']}:enable='between(t,{ea:.3f},{eb:.3f})'[p{i}]"
            )
            cur = f"p{i}"
    chain.append(f"[{cur}]setpts=(PTS-STARTPTS)/{speed}[out]")
    run(["-ss", f"{start}", "-to", f"{end}", "-i", str(src), "-filter_complex", ";".join(chain),
         "-map", "[out]", "-an", *ENC, str(out)])
    return (end - start) / speed


def still_part(image: Path, hold: float, out: Path) -> None:
    run(["-loop", "1", "-framerate", str(FPS), "-t", f"{hold:.3f}", "-i", str(image),
         "-vf", "scale=1920:1080,setsar=1", *ENC, str(out)])


def render_scene(scene: dict, clips: dict, finished: Path, wav: Path, timing: dict, tmp: Path) -> Path:
    plays = [v for v in scene["visual"] if v["kind"] == "play"]
    flex = [v for v in scene["visual"] if v["kind"] != "play"]
    play_time = sum((v["end"] - v["start"]) / v.get("speed", 1.0) for v in plays)
    hold = max(MIN_HOLD, (timing["duration"] - play_time) / len(flex)) if flex else 0
    parts = []
    for k, v in enumerate(scene["visual"]):
        out = tmp / f"{scene['id']}_{k}.mp4"
        if v["kind"] == "play":
            play_part(v, clips, finished, out)
        elif v["kind"] == "freeze":
            still_part(OUTPUT / "stills_final" / f"{v['still']}.jpg", hold, out)
        else:
            png = tmp / f"{scene['id']}_{k}.png"
            card_png(v, png, tmp)
            still_part(png, hold, out)
        parts.append(out)
    visual = play_time + hold * len(flex)
    total = max(visual, timing["duration"])
    inputs = []
    for p in parts:
        inputs += ["-i", str(p)]
    n = len(parts)
    fc = "".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v];[{n}:a]apad,atrim=0:{total:.3f}[a]"
    final = OUTPUT / "videos" / f"{scene['id']}.mp4"
    final.parent.mkdir(parents=True, exist_ok=True)
    tmp_out = final.with_suffix(".tmp.mp4")
    run([*inputs, "-i", str(wav), "-filter_complex", fc, "-map", "[v]", "-map", "[a]", *ENC,
         "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", f"{total:.3f}", "-movflags", "+faststart", str(tmp_out)])
    tmp_out.replace(final)
    info = {"scene": scene["id"], "audio_duration": timing["duration"], "visual_duration": round(visual, 3),
            "scene_duration": round(total, 3), "hold_per_flex_part": round(hold, 3), "sentences": timing["sentences"],
            "parts": [{"kind": v["kind"], **{k: v[k] for k in ("clip", "start", "end", "speed", "still", "title") if k in v}} for v in scene["visual"]]}
    (OUTPUT / "timing").mkdir(exist_ok=True)
    (OUTPUT / "timing" / f"{scene['id']}.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    return final


def master(scenes: list[dict]) -> Path:
    vdir = OUTPUT / "videos"
    playlist = OUTPUT / "playlist.txt"
    playlist.write_text("".join(f"file 'videos/{s['id']}.mp4'\n" for s in scenes), encoding="utf-8")
    out = vdir / "E-training-full.mp4"
    run(["-f", "concat", "-safe", "0", "-i", str(playlist), "-c", "copy", "-movflags", "+faststart", str(out)])
    # Scene start times in the master, for sync checks.
    t, index = 0.0, []
    for s in scenes:
        d = float(subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                  str(vdir / f"{s['id']}.mp4")], capture_output=True, text=True, check=True).stdout)
        index.append({"scene": s["id"], "start": round(t, 3), "duration": round(d, 3)})
        t += d
    (OUTPUT / "timing" / "master.json").write_text(json.dumps({"total": round(t, 3), "scenes": index}, indent=1), encoding="utf-8")
    return out


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--finished-dir", required=True)
    ap.add_argument("--audio-only", action="store_true")
    ap.add_argument("ids", nargs="*")
    args = ap.parse_args()
    scenes = json.loads((HERE / "narration.vi.draft.json").read_text(encoding="utf-8"))["scenes"]
    clips = json.loads((HERE / "boxes.json").read_text(encoding="utf-8"))["clips"]
    chosen = [s for s in scenes if not args.ids or s["id"] in args.ids]
    audio = {}
    for s in chosen:
        audio[s["id"]] = scene_audio(s)
        print(f"audio {s['id']}: {audio[s['id']][1]['duration']} s", flush=True)
    if args.audio_only:
        return 0
    with tempfile.TemporaryDirectory() as t:
        for s in chosen:
            wav, timing = audio[s["id"]]
            print("video", render_scene(s, clips, Path(args.finished_dir), wav, timing, Path(t)), flush=True)
    if not args.ids:
        print("master", master(scenes), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
