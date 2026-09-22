# Ship review — License plate and face anonymization

## What shipped

A standalone, non-destructive anonymization script, matching D1-D5 in
`requirements.md`:

- `vqa/anonymize.py` — core logic: model download+verify (`ensure_model`),
  face detection (`detect_faces`, `cv2.FaceDetectorYN`/YuNet), plate
  detection (`detect_plates`, ONNX via `onnxruntime`), pixel blur
  (`blur_boxes`), per-file processing (`process_video`), folder driver
  (`anonymize_folder`).
- `scripts/anonymize.py` — thin CLI wrapper (`<input_folder> [--output <folder>]`).
- `requirements.txt` — added `onnxruntime>=1.19` (only new dependency).
- `tests/test_anonymize.py` (12 tests) and `tests/test_anonymize_isolation.py`
  (3 tests) — 15 new tests, all synthetic/stubbed, no network, no real model
  weights, no real ffmpeg.

Run it:

```
python scripts/anonymize.py <input_folder> [--output <folder>]
```

Default output is `<input_folder>_anonymized` next to the input. The input
folder is only ever read; each output is written to a `.part` temp file and
atomically renamed on success, so a crash mid-run never leaves a
half-written or orphaned file, and a source file is never opened for
writing.

## Decisions carried through (D1-D5, `requirements.md`)

- **D1** Standalone script, not wired into `app.py`/`pipeline.db`/`config.json`.
- **D2** `cv2.FaceDetectorYN` (YuNet, bundled with `opencv-python-headless`,
  weight fetched separately) for faces; an ONNX plate detector via
  `onnxruntime` for plates. No `ultralytics`, no `torch`.
- **D3** CPU only (`CPUExecutionProvider`). Verified: `import torch` does not
  appear anywhere in `vqa/anonymize.py` or `scripts/anonymize.py`
  (`tests/test_anonymize_isolation.py`), and the real smoke test ran
  end-to-end on CPU.
- **D4** Non-destructive: writes to a sibling output folder, input is never
  opened for writing. Verified both synthetically and on real footage
  (checksum-identical source before/after).
- **D5** (scope change, 2026-09-22, mid-implementation): audio dropped
  entirely. `cv2.VideoWriter` is the whole write path — no `ffmpeg`
  subprocess call anywhere in the script, no audio track in the output.

## Model swap: plate detector license

The plate detector was changed mid-implementation from a model published by
`morsetechlab` (AGPL-3.0) to `ankandrew/open-image-models`'s YOLOv9-t
(256, end2end export) — confirmed MIT-licensed via
`GET https://api.github.com/repos/ankandrew/open-image-models` ->
`license.spdx_id == "MIT"`. AGPL would have imposed copyleft obligations on
this repository for shipping a derivative work; MIT does not. The two models
have different ONNX output formats:

- morsetechlab (AGPL, not used): raw `(1,5,N)` `[cx,cy,w,h,conf]`, requires a
  manual `cv2.dnn.NMSBoxes` dedup step.
- ankandrew (MIT, shipped): `end2end` export, `(N,7)`
  `[batch_idx,x1,y1,x2,y2,class_id,conf]` — NMS is already baked into the
  graph, box corners not center+size, no manual dedup needed.

`detect_plates()` in `vqa/anonymize.py` implements the second (simpler)
decode. Model provenance: URL and sha256 both pinned in
`vqa/anonymize.py` (`PLATE_MODEL_URL`, `PLATE_MODEL_SHA256`); the file is
downloaded once and cached under `models/`, verified against the pin on
every subsequent run before use.

## Verification performed

**Fast suite**: `python -m pytest tests -q` — 81 passed in 8.62s (66
pre-existing + 15 new). No network access, no real model weights, no real
ffmpeg invoked.

**Isolation**: `tests/test_anonymize_isolation.py` (3 tests) confirms
`vqa/anonymize.py` and `scripts/anonymize.py` contain no
`import vqa.db` / `import vqa.config` / `import vqa.review`, and no
`import torch` anywhere.

**Real end-to-end smoke test** (outside the fast suite, by design per
`spec.md` "Testing"): ran `scripts/anonymize.py` against two real clips
from `trimmed/` (471 combined frames, 1920x1080, both night dashcam
footage), twice in a row against the same output folder.

- Both runs completed successfully (~66s and ~65s respectively for the
  two-file folder).
- Source file checksums (sha256) were identical before and after both runs
  — the non-destructive guarantee holds on real files, not just synthetic
  fixtures.
- Second run cleanly overwrote both outputs, exit code 0, no leftover
  `.part` files — idempotency confirmed.
- Extracted and inspected 6 frame pairs (3 per clip, source vs. output)
  visually and numerically (mean absolute pixel difference inside vs.
  outside each detected box):
  - Where the plate detector fired, blur was genuinely applied at the
    detected location: mean abs diff ~13.09 and ~9.75 inside detected
    plate boxes vs. ~2.35 baseline (whole-frame source-to-output diff from
    recompression noise alone).
  - One clip has a truck with a large, legible plate that the detector
    **missed**. Direct inspection of the raw ONNX output at that exact
    frame showed a maximum confidence of 2.2% across all candidate boxes,
    well below the 0.25 threshold. Cross-checked the same detector code
    against a clean daylight sample frame, where it correctly scored 54%
    confidence — ruling out a coordinate-scaling or decode bug and
    confirming this is a genuine low-confidence miss under hard
    night/glare conditions, not a defect in the implementation.

## What is NOT verified (stated plainly, not glossed over)

- **Face blur on a real face.** Neither of the two real clips used for the
  smoke test contains a humanly visible face — `detect_faces()` returned an
  empty list on every sampled frame from both clips. The pixel-blur
  application logic (`blur_boxes`) is unit-tested with synthetic boxes, and
  the YuNet detector loads and runs without error, but real face-recall was
  never exercised end-to-end. This acceptance criterion needs a clip with
  an actual visible face to confirm; none was available in the sampled
  footage during this session.
- **Plate detection is not 100% recall.** The real-footage test found one
  concrete miss (documented above). This is expected behavior for any
  detector at a fixed confidence threshold, not a bug, but it means the
  acceptance criterion "the plate region is blurred in every frame it is
  large/clear enough to be legible" is not fully met as literally worded —
  it is met for the large majority of frames where the detector fires with
  reasonable confidence, not unconditionally. An operator reviewing output
  before a dataset leaves the machine should not assume 100% coverage from
  this script alone.
- **Throughput was not systematically measured** (assumption A5 in
  `requirements.md` was left as "reasonable default, not load-tested").
  Informally: ~65-66s of wall time to process 2 clips totalling 471 frames
  at 1920x1080 on CPU (~7 fps combined). This will scale roughly linearly
  with clip count and frame count; a ~50-video, ~1200-1500-clip corpus at
  this pace would be multiple hours of CPU time. That is acceptable for a
  preprocessing pipeline per the constitution's "ship it, don't polish it,"
  but worth knowing before running it unattended on the full corpus.

## Non-goals confirmed unchanged

- Not wired into `run_pipeline.py` / `config.json` / `pipeline.db` as a
  tracked stage (D1). An operator must invoke the script explicitly.
- No GPU inference, no `ultralytics`, no `torch` (D2/D3).
- No sidecar metadata file of detected boxes (requirements.md Q3 default).
- Does not retroactively reprocess the 30 already-flagged `trimmed/` files
  from the other BLOCKED item — an operator has to point the script at that
  folder separately if those files need anonymizing.

## Follow-up worth flagging

Out of scope for this feature, noted per `CLAUDE.md` "Curiosity With
Discipline" — not acted on here.

- If the plate-detection recall gap on low-light/glare footage turns out to
  matter in practice (e.g. after running against the full 30-file backlog),
  lowering `PLATE_CONF_THRESH` below 0.25 would trade more false positives
  (over-blurring) for fewer misses — a tuning decision explicitly out of
  scope per the constitution ("don't tune thresholds unless proven
  necessary") unless a real problem shows up in a review pass.
