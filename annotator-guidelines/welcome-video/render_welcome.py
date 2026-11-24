"""Synthesize the approved welcome narration, one cached WAV per sentence."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output" / "audio"
VOICE = "Hải Đăng"
LEAD, GAP, TAIL = 0.5, 0.55, 1.4
_tts = None


def synth(text: str) -> tuple[np.ndarray, int]:
    global _tts
    cache = OUTPUT / "parts"
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{VOICE}|{text}".encode()).hexdigest()[:16]
    path = cache / f"{key}.wav"
    if not path.exists():
        if _tts is None:
            from vieneu import Vieneu

            _tts = Vieneu(mode="v3turbo", device="cpu")
        result = _tts.infer(text, voice=VOICE)
        audio = np.asarray(result[0] if isinstance(result, tuple) else result, dtype=np.float32)
        rate = int(result[1]) if isinstance(result, tuple) and len(result) > 1 else int(getattr(_tts, "sample_rate", 48000))
        sf.write(path, audio.reshape(-1), rate)
    return sf.read(path, dtype="float32")


def render(scene: dict) -> None:
    wav = OUTPUT / f"{scene['id']}.wav"
    timing_path = OUTPUT / f"{scene['id']}.timing.json"
    if wav.exists() and timing_path.exists():
        previous = json.loads(timing_path.read_text(encoding="utf-8"))
        if [entry["text"] for entry in previous["sentences"]] == scene["narration"]:
            print(f"{scene['id']}: cached {previous['duration']}s", flush=True)
            return
    parts: list[np.ndarray] = []
    timing = []
    cursor = LEAD
    rate = None
    for index, text in enumerate(scene["narration"]):
        audio, current_rate = synth(text)
        rate = rate or current_rate
        if current_rate != rate:
            raise RuntimeError("Narration sample rate changed")
        if index:
            parts.append(np.zeros(int(GAP * rate), dtype=np.float32))
            cursor += GAP
        parts.append(audio)
        timing.append({"text": text, "start": round(cursor, 3), "end": round(cursor + len(audio) / rate, 3)})
        cursor += len(audio) / rate
    full = np.concatenate([np.zeros(int(LEAD * rate), dtype=np.float32), *parts, np.zeros(int(TAIL * rate), dtype=np.float32)])
    sf.write(wav, full, rate)
    timing_path.write_text(json.dumps({"sentences": timing, "duration": round(len(full) / rate, 3)}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{scene['id']}: {len(full) / rate:.2f}s", flush=True)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    shotlist = json.loads((HERE / "shotlist.json").read_text(encoding="utf-8"))
    for item in shotlist["scenes"]:
        render(item)
