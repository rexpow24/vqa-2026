"""Render the report and help tutorial narration with the project's VieNeu voice."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output" / "audio"
VOICE = "Hải Đăng"
LEAD, GAP, TAIL = 0.5, 0.55, 1.3
_tts = None


def synth(text: str) -> tuple[np.ndarray, int]:
    global _tts
    cache = OUTPUT / "parts"
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{VOICE}|{text}".encode("utf-8")).hexdigest()[:16]
    path = cache / f"{key}.wav"
    if not path.exists():
        if _tts is None:
            from vieneu import Vieneu

            _tts = Vieneu(mode="v3turbo", device="cpu")
        result = _tts.infer(text, voice=VOICE)
        samples = np.asarray(result[0] if isinstance(result, tuple) else result, dtype=np.float32).reshape(-1)
        rate = int(result[1]) if isinstance(result, tuple) and len(result) > 1 else int(getattr(_tts, "sample_rate", 48000))
        sf.write(path, samples, rate)
    return sf.read(path, dtype="float32")


def render(scene: dict) -> None:
    parts = []
    timing = []
    rate = None
    cursor = LEAD
    for index, sentence in enumerate(scene["sentences"]):
        samples, current_rate = synth(sentence)
        rate = rate or current_rate
        if current_rate != rate:
            raise RuntimeError("VieNeu changed its sample rate during the recording")
        if index:
            parts.append(np.zeros(int(GAP * rate), dtype=np.float32))
            cursor += GAP
        parts.append(samples)
        timing.append({"text": sentence, "start": round(cursor, 3), "end": round(cursor + len(samples) / rate, 3)})
        cursor += len(samples) / rate
    audio = np.concatenate([np.zeros(int(LEAD * rate), dtype=np.float32), *parts, np.zeros(int(TAIL * rate), dtype=np.float32)])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sf.write(OUTPUT / f"{scene['id']}.wav", audio, rate)
    (OUTPUT / f"{scene['id']}.timing.json").write_text(
        json.dumps({"sentences": timing, "duration": round(len(audio) / rate, 3)}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{scene['id']}: {len(audio) / rate:.1f} s", flush=True)


if __name__ == "__main__":
    scenes = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
    for item in scenes:
        render(item)
