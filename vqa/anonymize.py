"""Face and license-plate blurring for a folder of clips.

Standalone: never imports vqa.db, vqa.config, or vqa.review
(tests/test_anonymize_isolation.py enforces this). The pipeline's own
overlay removal (vqa/media.py:blur_filter) only blurs fixed-position bands
baked into a static ffmpeg filter graph -- it cannot follow a face or a
plate that moves frame to frame. This module decodes with OpenCV instead,
detects per frame, and blurs in pixel space.

Two CPU-only ONNX detectors, both fetched once and cached under models/:

* Faces  -- YuNet, OpenCV Zoo
  (https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet),
  MIT License (Shiqi Yu). Ships with cv2.FaceDetectorYN, but the .onnx
  weight is not bundled in the opencv-python wheel.
* Plates -- YOLOv9-t (256, end2end export), ankandrew/open-image-models
  (https://github.com/ankandrew/open-image-models), MIT License. Single
  class, localization only -- no OCR. "end2end" means NMS is baked into
  the graph: output is already a filtered detection list, not raw logits.
"""

from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

FACE_MODEL_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
FACE_MODEL_SHA256 = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"
FACE_MODEL_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"

PLATE_MODEL_URL = (
    "https://github.com/ankandrew/open-image-models/releases/download/"
    "assets/yolo-v9-t-256-license-plates-end2end.onnx"
)
PLATE_MODEL_SHA256 = "938a34ce868da69432fd5a872f24337b86e3dc8753426e16ae18163f615c2a2c"
PLATE_MODEL_PATH = MODELS_DIR / "yolo-v9-t-256-license-plates-end2end.onnx"

PLATE_INPUT_SIZE = 256
PLATE_CONF_THRESH = 0.25
FACE_SCORE_THRESH = 0.6

# Tiled plate inference (fix for a verified real-footage miss: resizing the
# whole 1920x1080 frame to 256x256 in one shot shrinks a normal-distance
# plate below what this small model can resolve --
# features/face-plate-anonymization/ship-review.md). Each tile keeps its own
# downscale factor much smaller; overlap keeps a plate straddling a tile
# boundary from being missed by both tiles, and NMS across tiles removes the
# resulting duplicates.
PLATE_TILE_SIZE = 640
PLATE_TILE_OVERLAP = 128
PLATE_NMS_IOU = 0.3

BLUR_SIGMA = 45.0
# Downsample the ROI by this factor before blurring, so the redaction is a
# real pixelation floor, not just a soft-focus Gaussian a strong sharpen
# filter could partially claw back.
BLUR_PIXELATE_DIVISOR = 8

# Pad every box outward by this fraction of its own size before blurring --
# compensates for a detector's box being a hair tighter than the real
# face/plate, which would otherwise leave an unblurred sliver at the edge.
BOX_MARGIN_FRAC = 0.25

# Bridges a short detector flicker: a face/plate detected correctly, missed
# for a frame or two purely because it moved (motion blur, angle change),
# then detected again nearby. `persist_frames` is how long a track keeps
# coasting its last known box after its last real match before it's dropped
# -- long enough to cover a flicker, not so long it blurs empty road.
PERSIST_FRAMES = 5
# Loose on purpose: a fast-moving box shifts a lot between consecutive
# frames, so a strict IoU match would just start a new track on every
# flicker instead of continuing the old one.
TRACK_IOU_MATCH = 0.15

Box = tuple[int, int, int, int]  # x, y, w, h in frame pixels


class AnonymizeError(RuntimeError):
    pass


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_model(path: Path, url: str, sha256: str) -> Path:
    """Return `path`, downloading and verifying it first if missing or corrupt."""
    if path.exists() and sha256_of(path) == sha256:
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".part")
    try:
        urllib.request.urlretrieve(url, tmp)
    except OSError as e:
        raise AnonymizeError(f"failed to download {url}: {e}") from e

    got = sha256_of(tmp)
    if got != sha256:
        tmp.unlink(missing_ok=True)
        raise AnonymizeError(
            f"checksum mismatch for {url}: expected {sha256}, got {got}")
    tmp.replace(path)
    return path


def load_face_detector(model_path: Path | None = None) -> cv2.FaceDetectorYN:
    path = model_path or ensure_model(FACE_MODEL_PATH, FACE_MODEL_URL, FACE_MODEL_SHA256)
    return cv2.FaceDetectorYN.create(
        str(path), "", (320, 320), score_threshold=FACE_SCORE_THRESH)


def load_plate_session(model_path: Path | None = None) -> ort.InferenceSession:
    path = model_path or ensure_model(PLATE_MODEL_PATH, PLATE_MODEL_URL, PLATE_MODEL_SHA256)
    return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])


def detect_faces(frame: np.ndarray, detector: cv2.FaceDetectorYN) -> list[Box]:
    h, w = frame.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(frame)
    if faces is None:
        return []
    return [(int(f[0]), int(f[1]), int(f[2]), int(f[3])) for f in faces]


def _tile_origins(dim: int, tile: int, overlap: int) -> list[int]:
    """Overlapping tile start coordinates covering [0, dim). Consecutive tiles
    are `tile - overlap` apart; the last one is pulled back to end exactly at
    `dim` so no tile runs past the frame (and no strip past the last full
    stride goes uncovered).
    """
    tile = min(tile, dim)
    stride = max(1, tile - overlap)
    origins = list(range(0, dim - tile + 1, stride))
    if not origins:
        return [0]
    if origins[-1] + tile < dim:
        origins.append(dim - tile)
    return origins


def _detect_plates_in_frame(frame: np.ndarray, session: ort.InferenceSession,
                             conf_thresh: float) -> list[Box]:
    """Single-shot detection on whatever's handed in (a whole frame or a
    tile), in that image's own pixel space. Kept separate from `detect_plates`
    so tiling is just "call this per tile and offset the result" (below).
    """
    h0, w0 = frame.shape[:2]
    size = PLATE_INPUT_SIZE
    resized = cv2.resize(frame, (size, size))
    blob = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))[None, ...]

    name = session.get_inputs()[0].name
    out = session.run(None, {name: blob})[0]  # (N, 7): batch_idx,x1,y1,x2,y2,class_id,conf
    if out.size == 0:
        return []

    conf = out[:, 6]
    keep = conf >= conf_thresh
    if not np.any(keep):
        return []

    x1, y1, x2, y2 = out[keep, 1], out[keep, 2], out[keep, 3], out[keep, 4]
    sx, sy = w0 / size, h0 / size
    boxes = np.stack([x1 * sx, y1 * sy, (x2 - x1) * sx, (y2 - y1) * sy], axis=1)
    scores = conf[keep]
    return [((float(x), float(y), float(w), float(h)), float(s))
            for (x, y, w, h), s in zip(boxes, scores)]


def detect_plates(frame: np.ndarray, session: ort.InferenceSession,
                   conf_thresh: float = PLATE_CONF_THRESH,
                   tile: int = PLATE_TILE_SIZE, overlap: int = PLATE_TILE_OVERLAP) -> list[Box]:
    """Tiled inference. Resizing the whole frame to 256x256 in one shot (the
    original approach) shrinks a normal-distance plate below what this small
    model can resolve -- verified on real footage, see
    features/face-plate-anonymization/ship-review.md: a clearly legible plate
    at ordinary following distance scored ~0.20 confidence and its best
    candidate box wasn't even near the plate. Splitting the frame into
    overlapping tiles and running the (still end2end, still NMS-free-of-need)
    detector on each keeps each tile's own downscale factor much smaller.
    Overlap keeps a plate straddling a tile boundary from being missed by
    both tiles; NMS across every tile's detections removes the resulting
    duplicates. Costs roughly `len(tiles)`x the plate-detector inference time
    per frame.
    """
    h0, w0 = frame.shape[:2]
    raw: list[tuple[Box, float]] = []
    for ty in _tile_origins(h0, tile, overlap):
        for tx in _tile_origins(w0, tile, overlap):
            th = min(tile, h0 - ty)
            tw = min(tile, w0 - tx)
            crop = frame[ty:ty + th, tx:tx + tw]
            for (x, y, w, h), score in _detect_plates_in_frame(crop, session, conf_thresh):
                raw.append(((tx + x, ty + y, w, h), score))

    if not raw:
        return []

    boxes = [b for b, _ in raw]
    scores = [s for _, s in raw]
    keep_idx = cv2.dnn.NMSBoxes(boxes, scores, conf_thresh, PLATE_NMS_IOU)
    if len(keep_idx) == 0:
        return []
    return [(int(max(0, boxes[i][0])), int(max(0, boxes[i][1])),
              int(boxes[i][2]), int(boxes[i][3]))
             for i in np.array(keep_idx).reshape(-1)]


def blur_boxes(frame: np.ndarray, boxes: list[Box], sigma: float = BLUR_SIGMA) -> np.ndarray:
    """Pixelate, then Gaussian-blur, every box directly in `frame`'s pixels.
    Mutates and returns it. Pixelating first destroys real detail; a strong
    enough sharpen filter can otherwise partially claw text back out of a
    Gaussian blur alone, especially at a fixed small sigma.
    """
    h, w = frame.shape[:2]
    for x, y, bw, bh in boxes:
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(w, x + bw), min(h, y + bh)
        if x1 <= x0 or y1 <= y0:
            continue
        roi = frame[y0:y1, x0:x1]
        rh, rw = roi.shape[:2]
        small = cv2.resize(roi, (max(1, rw // BLUR_PIXELATE_DIVISOR), max(1, rh // BLUR_PIXELATE_DIVISOR)),
                            interpolation=cv2.INTER_LINEAR)
        pixelated = cv2.resize(small, (rw, rh), interpolation=cv2.INTER_NEAREST)
        # Kernel must scale with the region: a fixed small radius leaves a
        # plate's digits legible through the blur.
        k = max(3, (min(rh, rw) // 2) | 1)
        frame[y0:y1, x0:x1] = cv2.GaussianBlur(pixelated, (k, k), sigma)
    return frame


def _expand_box(box: Box, frame_w: int, frame_h: int, margin_frac: float = BOX_MARGIN_FRAC) -> Box:
    """Pad `box` outward by `margin_frac` of its own size on every side,
    clipped to the frame. Compensates for a detector's box being a hair
    tighter than the real face/plate, which would otherwise leave an
    unblurred sliver at the edge. A zero-size box stays zero-size (no fixed
    floor), so a degenerate box is still a no-op for the caller.
    """
    x, y, w, h = box
    mx, my = int(w * margin_frac), int(h * margin_frac)
    x0, y0 = max(0, x - mx), max(0, y - my)
    x1, y1 = min(frame_w, x + w + mx), min(frame_h, y + h + my)
    return (x0, y0, max(0, x1 - x0), max(0, y1 - y0))


def _iou(a: Box, b: Box) -> float:
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax1, bx1) - max(ax0, bx0))
    ih = max(0, min(ay1, by1) - max(ay0, by0))
    inter = iw * ih
    if inter == 0:
        return 0.0
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


class PersistenceTracker:
    """Bridges a short detector flicker: a face or plate detected correctly,
    then missed for a frame or two purely because it moved (motion blur,
    angle change), then detected again nearby. Tracking real detections by
    IoU across frames and re-emitting a track's last known box for up to
    `persist_frames` frames after its last real match means those flicker
    frames still get blurred, instead of exposing the region for the gap.

    Deliberately forward-only, no lookahead or interpolation:
    `process_video` writes each frame as it's decoded, one pass, so a track
    that never gets re-matched just keeps coasting its last known position
    for the persist window and then drops, rather than guessing where the
    object actually went.
    """

    def __init__(self, persist_frames: int = PERSIST_FRAMES, iou_match: float = TRACK_IOU_MATCH):
        self.persist_frames = persist_frames
        self.iou_match = iou_match
        self._tracks: list[dict] = []  # each: {"box": Box, "misses": int}

    def update(self, detections: list[Box]) -> list[Box]:
        """Feed this frame's raw detections in; get back the boxes to blur
        this frame (real matches plus any coasting tracks)."""
        unmatched = list(detections)
        for track in self._tracks:
            best_iou, best_i = 0.0, -1
            for i, det in enumerate(unmatched):
                iou = _iou(track["box"], det)
                if iou > best_iou:
                    best_iou, best_i = iou, i
            if best_iou >= self.iou_match:
                track["box"] = unmatched.pop(best_i)
                track["misses"] = 0
            else:
                track["misses"] += 1

        self._tracks = [t for t in self._tracks if t["misses"] <= self.persist_frames]
        self._tracks.extend({"box": det, "misses": 0} for det in unmatched)

        return [t["box"] for t in self._tracks]


def process_video(src: Path, dst: Path, face_detector: cv2.FaceDetectorYN,
                   plate_session: ort.InferenceSession,
                   persist_frames: int = PERSIST_FRAMES,
                   margin_frac: float = BOX_MARGIN_FRAC) -> None:
    """Write an anonymized copy of `src` to `dst`. Never opens `src` for writing.

    Output is silent by design (D5: "do not need audio") -- cv2.VideoWriter
    is the entire write path, no ffmpeg subprocess involved. Writes to a
    temp path and renames on success, so an interrupted run never leaves a
    half-written `dst`.
    """
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise AnonymizeError(f"cannot open {src}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp_out = dst.with_name(dst.stem + ".part" + dst.suffix)
    writer = cv2.VideoWriter(str(tmp_out), cv2.VideoWriter_fourcc(*"mp4v"),
                             fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise AnonymizeError(f"cannot open video writer for {tmp_out}")

    tracker = PersistenceTracker(persist_frames=persist_frames)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            raw = detect_faces(frame, face_detector) + detect_plates(frame, plate_session)
            tracked = tracker.update(raw)
            boxes = [_expand_box(b, width, height, margin_frac) for b in tracked]
            blur_boxes(frame, boxes)
            writer.write(frame)
    finally:
        cap.release()
        writer.release()

    tmp_out.replace(dst)


def anonymize_file(input_path: Path, output_path: Path | None = None) -> Path:
    """Anonymize a single .mp4 file. `input_path` is only ever read.

    `output_path` may be an explicit destination file (has a suffix) or a
    destination folder (no suffix), matching `--output`'s dual meaning in
    the CLI. Default, if omitted: alongside the input, as
    `<stem>_anonymized<suffix>` -- same "write alongside, never overwrite
    the original" rule as `anonymize_folder` (D4), just without a folder to
    be a sibling of.
    """
    input_path = Path(input_path)
    if output_path is None:
        dst = input_path.with_name(f"{input_path.stem}_anonymized{input_path.suffix}")
    else:
        output_path = Path(output_path)
        dst = output_path / input_path.name if not output_path.suffix else output_path
    dst.parent.mkdir(parents=True, exist_ok=True)

    face_detector = load_face_detector()
    plate_session = load_plate_session()
    process_video(input_path, dst, face_detector, plate_session)
    return dst


def anonymize_folder(input_folder: Path, output_folder: Path | None = None) -> list[Path]:
    """Anonymize every .mp4 in `input_folder`, writing copies to a sibling folder.

    `input_folder` is only ever read. Re-running is idempotent: each output
    is produced via write-to-temp-then-rename, so a clean overwrite never
    leaves an orphaned partial file.
    """
    input_folder = Path(input_folder)
    if output_folder is None:
        output_folder = input_folder.parent / f"{input_folder.name}_anonymized"
    else:
        output_folder = Path(output_folder)
    output_folder.mkdir(parents=True, exist_ok=True)

    face_detector = load_face_detector()
    plate_session = load_plate_session()

    outputs = []
    for src in sorted(input_folder.glob("*.mp4")):
        dst = output_folder / src.name
        process_video(src, dst, face_detector, plate_session)
        outputs.append(dst)
    return outputs
