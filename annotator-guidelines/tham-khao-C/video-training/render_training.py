"""Render the Group C learning series as animated, narrated clips.

Pipeline per item of narration.vi.json:
1. Split the narration into sentences and synthesise each one with local
   VieNeu-TTS (voice "Hải Đăng"), cached by text hash. Joining them gives the
   clip's WAV plus the start/end time of every sentence.
2. Open anim/page.html in headless Chrome. The page picks one shot per
   sentence (a sentence naming other codes becomes a side-by-side comparison,
   a sentence about missing evidence becomes a cropped "không rõ" view, a repeat
   becomes a 0.5x replay) and draws every frame from the animated scenarios.
3. Pipe the frames to ffmpeg with the WAV.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
FFMPEG = Path(r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe")
FPS = 30
LEAD, GAP, TAIL = 0.5, 0.55, 1.4  # seconds of silence around sentences
VOICE = "Hải Đăng"


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]


def load_content() -> tuple[list[dict], dict[str, str]]:
    content = json.loads((HERE / "narration.vi.json").read_text(encoding="utf-8"))
    codebook = json.loads((ROOT / "codebook" / "C.v4.json").read_text(encoding="utf-8"))
    labels = {o["code"]: o["label"] for o in codebook["cells"][3]["options"] if o.get("code")}
    items = content["foundations"] + content["episodes"] + content["comparisons"]
    for item in items:
        if "codes" in item:
            continue
        own = item["id"]
        # Only codes the narration itself contrasts; the "edge" field can hold ranges
        # such as "xem K01 đến K17" that are not look-alikes.
        found = re.findall(r"K\d\d", item["narration"])
        item["edges"] = list(dict.fromkeys(c for c in found if c != own))[:4]
    return items, labels


# ---------------------------------------------------------------- audio
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


def build_audio(item: dict, wav: Path, timing_path: Path) -> dict:
    import numpy as np
    import soundfile as sf

    cache = OUTPUT / "audio" / "parts"
    cache.mkdir(parents=True, exist_ok=True)
    parts, timing, cursor, rate = [], [], LEAD, None
    for i, text in enumerate(sentences(item["narration"])):
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


# ---------------------------------------------------------------- video
class Renderer:
    def __init__(self):
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(executable_path=str(CHROME), args=["--allow-file-access-from-files"])
        self.page = self._browser.new_page(viewport={"width": 1920, "height": 1080})
        errors: list[str] = []
        self.page.on("pageerror", lambda e: errors.append(str(e)))
        self.page.goto((HERE / "anim" / "page.html").as_uri())
        self.page.wait_for_function("window.Studio !== undefined")
        if errors:
            raise RuntimeError("page error: " + "; ".join(errors))
        self.errors = errors

    def setup(self, payload: dict) -> list[dict]:
        shots = self.page.evaluate("p => Studio.setup(p)", payload)
        if self.errors:
            raise RuntimeError("page error: " + "; ".join(self.errors))
        return shots

    def jpeg(self, t: float) -> bytes:
        url = self.page.evaluate("t => Studio.frame(t)", t)
        return base64.b64decode(url.split(",", 1)[1])

    def close(self):
        self._browser.close()
        self._pw.stop()


def payload_for(item: dict, timing: dict, labels: dict) -> dict:
    keep = {k: item[k] for k in ("id", "title", "codes", "cues", "edges", "shots") if k in item}
    return {"item": keep, "timing": timing, "labels": labels}


def render_clip(renderer: Renderer, item: dict, timing: dict, labels: dict, wav: Path, out: Path) -> None:
    shots = renderer.setup(payload_for(item, timing, labels))
    print("  shots: " + " | ".join(f"{'+'.join(s['panels'])}:{s['mode']}" for s in shots), flush=True)
    frames = math.ceil(timing["duration"] * FPS)
    tmp = out.with_suffix(".tmp.mp4")
    proc = subprocess.Popen([
        str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
        "-i", str(wav), "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", f"{timing['duration']:.3f}", "-movflags", "+faststart", str(tmp),
    ], stdin=subprocess.PIPE)
    try:
        for i in range(frames):
            proc.stdin.write(renderer.jpeg(i / FPS))
    finally:
        proc.stdin.close()
        code = proc.wait()
    if code:
        raise RuntimeError(f"ffmpeg failed for {out.name}")
    tmp.replace(out)


def render_stills(renderer: Renderer, item: dict, timing: dict, labels: dict, folder: Path) -> list[Path]:
    """One PNG per shot, taken where the conflict is on screen, for review."""
    shots = renderer.setup(payload_for(item, timing, labels))
    paths = []
    for k, s in enumerate(shots):
        t = renderer.page.evaluate("k => Studio.eventTime(k)", k)
        path = folder / f"{item['id']}-{k + 1}.jpg"
        path.write_bytes(renderer.jpeg(t))
        paths.append(path)
    return paths


def make_playlist(items: list[dict]) -> Path:
    video_dir = OUTPUT / "videos"
    missing = [it["id"] for it in items if not (video_dir / f"{it['id']}.mp4").exists()]
    if missing:
        raise FileNotFoundError("Missing clips: " + ", ".join(missing))
    playlist = OUTPUT / "playlist.txt"
    playlist.write_text("\n".join(f"file 'videos/{it['id']}.mp4'" for it in items) + "\n", encoding="utf-8")
    master = video_dir / "C-training-full.mp4"
    subprocess.run([
        str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(playlist), "-c", "copy", "-movflags", "+faststart", str(master),
    ], check=True)
    return master


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*", help="Only these item ids (default: all)")
    parser.add_argument("--stills", action="store_true", help="Write one review frame per shot instead of videos")
    parser.add_argument("--playlist-only", action="store_true")
    parser.add_argument("--force", action="store_true", help="Re-render even if the clip is newer than its inputs")
    args = parser.parse_args()

    items, labels = load_content()
    if args.playlist_only:
        print(f"Playlist ready: {make_playlist(items)}", flush=True)
        return 0
    chosen = [it for it in items if not args.ids or it["id"] in args.ids]
    unknown = set(args.ids) - {it["id"] for it in items}
    if unknown:
        raise SystemExit("Unknown ids: " + ", ".join(sorted(unknown)))

    for sub in ("audio", "videos", "stills"):
        (OUTPUT / sub).mkdir(parents=True, exist_ok=True)
    sources = [HERE / "narration.vi.json", *(HERE / "anim").glob("*.js"), HERE / "anim" / "page.html"]
    newest_source = max(p.stat().st_mtime for p in sources)

    renderer = Renderer()
    try:
        for n, item in enumerate(chosen, 1):
            key = item["id"]
            wav, timing_path = OUTPUT / "audio" / f"{key}.wav", OUTPUT / "audio" / f"{key}.timing.json"
            print(f"[{n}/{len(chosen)}] {key}", flush=True)
            timing = None
            if wav.exists() and timing_path.exists():
                timing = json.loads(timing_path.read_text(encoding="utf-8"))
                if [s["text"] for s in timing["sentences"]] != sentences(item["narration"]):
                    timing = None
            if timing is None:
                timing = build_audio(item, wav, timing_path)
            if args.stills:
                for p in render_stills(renderer, item, timing, labels, OUTPUT / "stills"):
                    print(f"  still: {p}", flush=True)
                continue
            out = OUTPUT / "videos" / f"{key}.mp4"
            if not args.force and out.exists() and out.stat().st_mtime > max(newest_source, wav.stat().st_mtime):
                print("  up to date", flush=True)
                continue
            render_clip(renderer, item, timing, labels, wav, out)
            print(f"  video: {out}", flush=True)
    finally:
        renderer.close()
    if not args.ids and not args.stills:
        print(f"Full training video ready: {make_playlist(items)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
