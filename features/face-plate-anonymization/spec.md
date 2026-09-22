# Spec — License plate and face anonymization

Synthesizes `requirements.md` (decisions D1-D4, assumptions A1-A5) and
`conflicts.md` (PASS, recommended approach). No new decisions here.

## What

A standalone script, `scripts/anonymize.py`, backed by a `vqa/anonymize.py`
module (mirrors the existing `vqa/media.py` split between logic and CLI):

```
anonymize.py <input_folder> [--output <folder>]
```

For every `.mp4` in `<input_folder>`:

1. Decode frame-by-frame (`cv2.VideoCapture`).
2. Run `cv2.FaceDetectorYN` (YuNet) on every frame → face boxes.
3. Run the ONNX plate detector (`onnxruntime`) on every frame → plate boxes.
4. Gaussian-blur every detected box directly in the frame's pixels.
5. Write the redacted frames (`cv2.VideoWriter`) straight to the output path
   — **no audio track** (user decision, 2026-09-22: "do not need audio").
   No `ffmpeg` call in this script at all; `cv2.VideoWriter` is the entire
   write path.
6. Output path: `<output_folder or input_folder's sibling>/<same filename>`.
   Input file is never opened for writing.

Both model weight files are fetched once on first use and cached under
`models/` (same idea as the VLM's GGUF weights in `GUIDE.md`), with the
source URL and a sha256 pin recorded in the script — open question Q1 in
`requirements.md`, resolved by whoever implements: pick one well-documented
open-license face model (YuNet, already OpenCV's own) and one well-documented
open-license plate-detector ONNX export, cite both in code comments.

## Why

Closes the BLOCKED item in `TODO.md` ("The pipeline does not blur faces or
licence plates at all") and the correction already sitting in
`docs/01_pipeline_overview_TeamA.md:59`. Detection-only (no OCR), CPU-only, no
new service, no DB/config coupling — see `conflicts.md` for why each of those
is safe.

## Non-goals (explicitly out of scope, per `conflicts.md` "Not doing")

- Wiring into `run_pipeline.py` / `config.json` / `pipeline.db` as a tracked
  stage.
- GPU inference.
- `ultralytics` / `torch`.
- Any sidecar metadata file recording detected boxes (requirements.md Q3
  default: no).
- Re-processing the 30 already-flagged `trimmed/` files automatically — the
  script *can* be pointed at that folder by an operator, but this feature
  does not do so itself.

## Architecture note

`vqa/anonymize.py` owns: model loading/caching, per-frame detection, box→blur
application, the OpenCV read/write loop. It does **not** import `vqa/db.py`,
`vqa/config.py`, `vqa/review.py`, or `app.py` — enforced the same way
`tests/test_vlm_isolation.py` enforces `vlm/`'s read-only DB boundary: add
`tests/test_anonymize_isolation.py` asserting no `import vqa.db` /
`import vqa.config` appears in `vqa/anonymize.py` or `scripts/anonymize.py`.

No ffmpeg dependency: since output is silent, `cv2.VideoWriter` writes the
final file directly — no subprocess, no `_run([FFMPEG, ...])` call needed.

## Testing

Per `conflicts.md` #2: the fast suite (`python -m pytest tests -q`) must stay
network-free and (per existing behavior) not require real ffmpeg. Unit-test
the box→blur pixel logic and the file-safety logic (temp-write-then-rename,
never touching the input) with synthetic in-memory frames and a stubbed
detector — do not download real model weights or invoke real ffmpeg in the
fast suite. A separate manual smoke test (documented in `ship-review.md` at
step 08, not part of `pytest tests`) verifies real detection quality on a real
clip.
