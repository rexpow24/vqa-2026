# Acceptance — License plate and face anonymization

- [x] `python scripts/anonymize.py <folder>` on a folder of `.mp4` files produces one
      anonymized copy per input file in a sibling output location.
      Verified: ran against 2 real `trimmed/` clips (471 combined frames, 1920x1080),
      produced 2 output files in the sibling `_anonymized` folder.
- [x] None of the original input files are modified — checksum-identical before/after run.
      Verified: sha256 of both real source files identical before/after the run
      (`082a1769...`, `efc574c0...`), plus a dedicated unit test
      (`test_process_video_never_opens_src_for_writing`).
- [ ] On a clip with a visible human face for ≥1 continuous second, the face region is
      blurred in every frame it appears in the output, not a sampled subset.
      **Not verified** — neither of the two real clips used for the smoke test contains a
      humanly-visible face (both are night dashcam footage; `detect_faces` returned `[]`
      on every sampled frame from both clips). The blur-application code path
      (`blur_boxes`) is unit-tested with synthetic boxes, and the face detector
      (`cv2.FaceDetectorYN`/YuNet) loads and runs without error, but real face-recall
      was not exercised end-to-end. Needs a clip with a real visible face to confirm.
- [~] On a clip with a visible, legible license plate on a moving vehicle, the plate region
      is blurred in every frame it is large/clear enough to be legible in the source.
      **Partially verified.** Confirmed the detector DOES fire and blur is genuinely applied
      at the detected location on real footage (numerical pixel diff inside a detected plate
      box: ~13/~10 mean abs diff vs. ~2.3 baseline frame-to-frame recompression noise).
      Also confirmed a **real miss**: one clip has a truck with a large, legible plate
      (`77C-1B2.A3`) that the detector did not blur — inspected the raw model output and
      found its highest confidence for that frame was 2.2%, far below the 0.25 threshold,
      i.e. a genuine low-confidence miss on hard night/glare footage, not a coordinate bug
      (the same decode logic scored 54% confidence on a clean daylight frame during model
      selection). Recall is not 100%; see `ship-review.md`.
- [x] Re-running the script on the same folder is idempotent: clean overwrite, no errors, no
      orphaned partial files.
      Verified: ran the real smoke test twice against the same input/output folders;
      second run overwrote cleanly, exit 0, no `.part` files left behind.
- [x] The script runs to completion on CPU only — `import torch` does not appear anywhere in
      the new code, no CUDA dependency required.
      Verified: `test_anonymize_never_imports_torch` (static source check) plus the real
      smoke test ran end-to-end with only `onnxruntime`'s `CPUExecutionProvider`.
- [x] `python -m pytest tests -q` still passes, unmodified, plus new tests for this feature
      that require neither network access nor real ffmpeg/model-weight files.
      Verified: 81 passed in 8.96s (66 pre-existing + 15 new), no network, no real ffmpeg
      or model weights (detectors are monkeypatched in the fast suite).
- [x] `vqa/anonymize.py` and `scripts/anonymize.py` contain no `import vqa.db`,
      `import vqa.config`, or `import vqa.review` (isolation test, mirrors
      `tests/test_vlm_isolation.py`).
      Verified: `tests/test_anonymize_isolation.py`, 3 tests passing.
