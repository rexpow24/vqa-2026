# Requirements — License plate and face anonymization

## Reality

| Claim | Actually true | Where they differ |
|---|---|---|
| "The pipeline blurs overlays already" | `vqa/media.py:196` `blur_filter()` builds a static ffmpeg `filter_complex` over **fixed-position rectangles** (`config.py` `fixed_blur[]`) plus calibrated regions found by *temporal variance* (`architecture.md` §4/§7). Every region is constant `x,y,w,h` for the whole clip. | A face or a plate on a moving vehicle/pedestrian has no fixed position and is never the steadiest 1% of pixels — this mechanism cannot address it, by construction, not by omission. |
| "30 files in `trimmed/` still show a burned-in plate" (`TODO.md`) | Confirmed: `config.py:30` already has a `middle_bottom` fixed band (`enabled: True`), added *after* those 30 files were built. That band fixes one specific always-in-the-same-spot plate overlay (a dashcam readout), not plates on other vehicles anywhere in frame. | The existing fix only solved the fixed-position case. The general moving-object case is still fully open. |
| "docs/ already call this an Anonymize stage" | `docs/01_pipeline_overview_TeamA.md:59` step 2 is literally "Filter & Dedup + Anonymize" and its own text has a 2026-09-05 correction: "pipeline KHÔNG blur mặt hay biển số — nó chỉ xoá overlay". `docs/EG-TrafficQA-VN_report.md:122,135` and `docs/visual_explainer.html:478` all draw the same 3-step "Anonymize" box. | Not a new idea — it's a pipeline stage the docs already assume exists and is documented as *not yet built*. This feature closes a documented, known gap, not a speculative one. |
| "Adding a face/plate detector means adding OCR, which is rejected" | `architecture.md` §13 rejects "PaddleOCR or any OCR" — that was for *reading* the compilation counter's digits (a text-recognition problem). Detecting a face or plate's bounding box is localization, not recognition; no OCR is involved anywhere in this feature. | Not a conflict once separated: detection-only, no text recognition, ever. |
| "This needs a new Docker service like the VLM" | `CLAUDE.md` "Don't add a layer" allowed exactly one exception (VLM), because a GGUF model cannot live inside the Streamlit process. A small CPU face/plate detector has no such constraint. | No new service authorised or needed; runs in-process as a Python script. |

## Decided (via user, this session — binding, not open questions)

| # | Decision | Why |
|---|---|---|
| D1 | **Invocation:** a standalone script taking a folder path as input (mirrors `vlm/scripts/*.py`), not wired into `app.py`/`pipeline.db`. | User: "have a script to paste the folder name to anonymize." Keeps this decoupled from reviewer/DB state — lower conflict-audit surface. |
| D2 | **Detectors:** OpenCV built-in (`cv2.FaceDetectorYN`, bundled YuNet ONNX) for faces; a small pretrained license-plate ONNX detector (fetched once, cached like the VLM GGUF weights) run via `onnxruntime`, for plates. No `ultralytics`, no `torch`. | User picked "OpenCV built-in + small ONNX weights" over the full YOLO/torch stack — smallest new dependency footprint, detection-only (no text recognition). |
| D3 | **Device:** CPU only. | User picked CPU over GPU — avoids contention with NVENC encode and the VLM container on the shared 6 GB GTX 1660 Ti; revisit only if CPU throughput is measured too slow on real footage. |
| D4 | **Output:** anonymized copies written alongside the originals; the input folder is never modified in place. | User picked non-destructive output — matches the existing `clips/` (never modified) → `delivered/` (derived copy) pattern in `architecture.md` §8, and keeps the operation rerunnable. |
| D5 | **Audio: dropped entirely.** Output is silent video only, no remux step. | User, this session: "do not need audio." Removes A4/the ffmpeg dependency — `cv2.VideoWriter` alone is now the whole write path, no subprocess call anywhere in the script. |

## Assumptions

| # | Assumption | Status |
|---|---|---|
| A1 | The script operates on decoded video frames (OpenCV `VideoCapture`/`VideoWriter`), not an ffmpeg `filter_complex`, because detected boxes move per-frame and the existing filter graph (`blur_filter`) only supports a fixed topology of static regions. | **verified** — read `vqa/media.py:196-224`; the filter graph's region list and coordinates are baked in at graph-build time, before any frame is seen. |
| A2 | `cv2.FaceDetectorYN` (YuNet) ships with `opencv-python`/`opencv-python-headless` (already a dependency, `requirements.txt:5`) and needs one small `.onnx` weight file, not a new heavy package. | **unverified** — need to confirm the exact weight file must be downloaded separately (OpenCV does not vendor the `.onnx` inside the wheel) and pin a source URL. |
| A3 | No pretrained open license-plate ONNX detector already ships anywhere in this repo or its dependencies. | **verified** — `Glob` for `*anonymiz*` and grep for `onnx`/`plate` across the repo found nothing; `requirements.txt` has no CV-model packages beyond `opencv-python-headless`. |
| A4 | ~~OpenCV must re-mux the original audio track itself~~ — **superseded by D5**: user decided audio is not needed, so `cv2.VideoWriter`'s silent output is the final artifact as-is, no ffmpeg step at all. | n/a |
| A5 | Detection runs on every frame (no frame-skipping/interpolation), since this is a privacy-critical stage where a missed frame is a real leak, not a cosmetic gap — different bar than Principle 2's "80% is fine" for boundary detection. | unverified — reasonable default given clip lengths (5–30s, ≤900 frames at 30fps) but not load-tested; flag as an acceptance criterion (timing budget) rather than a blocking question. |

## Open questions

| # | Question | Why it matters | My default | Level | Status |
|---|---|---|---|---|---|
| Q1 | Where does the license-plate ONNX weight file come from (exact model/source)? | Pins provenance and license, like the VLM GGUF download already documented in `GUIDE.md:335`. | Use a well-known open-licence-plate YOLO ONNX export from Hugging Face/GitHub, pin the exact URL + sha256 in the script (same pattern as `ejs:github`/GGUF downloads). | 🟡 | 💭 |
| Q2 | Does the script need a CLI report (e.g. "N faces, M plates blurred across K files") or is silent success enough? | Affects whether operators can spot-check without opening every output video. | Print a one-line summary per file plus a final total — matches `vqa/media.py`'s existing logging style, cheap to add. | 🟢 | 💭 |
| Q3 | Should detected-box metadata be written anywhere (e.g. a sidecar JSON), or is the blurred pixel output the only artifact? | A sidecar would let a reviewer audit misses without re-running detection, but adds a second thing that can go stale (echoes the `trimmed_path` dead-column lesson in `TODO.md`). | No sidecar. Blurred video is the only output; if audit tooling is needed later, it's a separate feature. | 🟢 | 💭 |

No 🔴 rows, no ⏳ rows — the decisions that would have been blocking were resolved directly by the user this session (D1-D4 above).

## Acceptance criteria

- Running `python scripts/anonymize.py <folder>` on a folder of `.mp4` files produces one anonymized copy per input file in a sibling output location; **none of the original files are modified** (checksum-identical before/after run).
- On a clip with a visible human face for ≥1 continuous second, the face region is blurred in **every** frame it appears in the output — not just a sampled subset.
- On a clip with a visible, legible license plate on a moving vehicle, the plate region is blurred in every frame it is large/clear enough to be legible in the source.
- Re-running the script on the same folder is idempotent: output files are overwritten cleanly, no errors, no orphaned partial files.
- The script runs to completion on CPU only — no CUDA/GPU dependency is imported or required (`import torch` must not appear anywhere in the new code).
- Output video is silent by design (D5) — no audio track, no ffmpeg dependency.
- `python -m pytest tests -q` still passes unmodified (this feature adds new tests; it does not touch existing pipeline/app code, per D1).
