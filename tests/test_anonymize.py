"""Unit tests for vqa/anonymize.py's pixel and file-safety logic.

No network, no real ffmpeg, no real model weights -- per
features/face-plate-anonymization/spec.md "Testing". Detectors are stubbed;
cv2's own bundled video codec (not the external ffmpeg binary) is used to
build tiny synthetic .mp4 fixtures, the same way it's used everywhere else
cv2 already is in this codebase.
"""

from __future__ import annotations

import hashlib

import cv2
import numpy as np
import pytest

from vqa import anonymize


# ---------------------------------------------------------------------------
# blur_boxes: pixel logic only, no I/O
# ---------------------------------------------------------------------------

def _flat_frame(w=64, h=48, value=200):
    return np.full((h, w, 3), value, dtype=np.uint8)


def test_blur_boxes_leaves_pixels_outside_the_box_untouched():
    frame = _flat_frame()
    frame[10:20, 10:20] = [10, 20, 30]  # a distinct patch, not near the box
    box = (30, 5, 15, 15)

    out = anonymize.blur_boxes(frame.copy(), [box])

    assert np.array_equal(out[10:20, 10:20], frame[10:20, 10:20])


def test_blur_boxes_changes_pixels_inside_the_box():
    frame = _flat_frame(value=0)
    # A checkerboard inside the box gives Gaussian blur something to smooth.
    frame[5:25, 5:25:2] = 255
    box = (5, 5, 20, 20)
    original_patch = frame[5:25, 5:25].copy()

    out = anonymize.blur_boxes(frame.copy(), [box])

    assert not np.array_equal(out[5:25, 5:25], original_patch)


def test_blur_boxes_clips_a_box_that_hangs_off_the_frame_edge():
    frame = _flat_frame()
    box = (-5, -5, 20, 20)  # partially off top-left corner

    out = anonymize.blur_boxes(frame.copy(), [box])  # must not raise

    assert out.shape == frame.shape


def test_blur_boxes_ignores_a_degenerate_zero_size_box():
    frame = _flat_frame()
    out = anonymize.blur_boxes(frame.copy(), [(10, 10, 0, 0)])
    assert np.array_equal(out, frame)


def test_blur_boxes_handles_no_boxes():
    frame = _flat_frame()
    out = anonymize.blur_boxes(frame.copy(), [])
    assert np.array_equal(out, frame)


# ---------------------------------------------------------------------------
# ensure_model: download-and-verify, no real network
# ---------------------------------------------------------------------------

def test_ensure_model_skips_download_when_cached_file_already_matches(tmp_path, monkeypatch):
    content = b"fake onnx weights"
    digest = hashlib.sha256(content).hexdigest()
    cached = tmp_path / "model.onnx"
    cached.write_bytes(content)

    def _boom(*a, **kw):
        raise AssertionError("must not download when the cached file already verifies")

    monkeypatch.setattr(anonymize.urllib.request, "urlretrieve", _boom)

    result = anonymize.ensure_model(cached, "https://example.invalid/model.onnx", digest)

    assert result == cached


def test_ensure_model_downloads_when_missing(tmp_path, monkeypatch):
    content = b"fake onnx weights"
    digest = hashlib.sha256(content).hexdigest()
    dest = tmp_path / "sub" / "model.onnx"

    def _fake_urlretrieve(url, filename):
        __import__("pathlib").Path(filename).write_bytes(content)

    monkeypatch.setattr(anonymize.urllib.request, "urlretrieve", _fake_urlretrieve)

    result = anonymize.ensure_model(dest, "https://example.invalid/model.onnx", digest)

    assert result == dest
    assert dest.read_bytes() == content


def test_ensure_model_raises_and_cleans_up_on_checksum_mismatch(tmp_path, monkeypatch):
    dest = tmp_path / "model.onnx"

    def _fake_urlretrieve(url, filename):
        __import__("pathlib").Path(filename).write_bytes(b"corrupted")

    monkeypatch.setattr(anonymize.urllib.request, "urlretrieve", _fake_urlretrieve)

    with pytest.raises(anonymize.AnonymizeError, match="checksum mismatch"):
        anonymize.ensure_model(dest, "https://example.invalid/model.onnx",
                               "0" * 64)

    assert not dest.exists()
    assert not dest.with_name(dest.name + ".part").exists()


def test_ensure_model_redownloads_a_corrupt_cached_file(tmp_path, monkeypatch):
    dest = tmp_path / "model.onnx"
    dest.write_bytes(b"stale garbage")
    good = b"the real weights"
    digest = hashlib.sha256(good).hexdigest()
    calls = []

    def _fake_urlretrieve(url, filename):
        calls.append(url)
        __import__("pathlib").Path(filename).write_bytes(good)

    monkeypatch.setattr(anonymize.urllib.request, "urlretrieve", _fake_urlretrieve)

    result = anonymize.ensure_model(dest, "https://example.invalid/model.onnx", digest)

    assert calls == ["https://example.invalid/model.onnx"]
    assert result.read_bytes() == good


# ---------------------------------------------------------------------------
# process_video: file-safety (temp-write-then-rename), never opens src for
# writing. Real cv2 codec (no system ffmpeg, no subprocess at all) for both
# the fixture and the actual write path -- D5 dropped audio, so
# cv2.VideoWriter is the entire write path now.
# ---------------------------------------------------------------------------

def _make_fixture_video(path, n_frames=4, w=32, h=24, fps=5.0):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(n_frames):
        writer.write(np.full((h, w, 3), i * 20, dtype=np.uint8))
    writer.release()


def test_process_video_never_opens_src_for_writing(tmp_path, monkeypatch):
    src = tmp_path / "in.mp4"
    _make_fixture_video(src)
    before = hashlib.sha256(src.read_bytes()).hexdigest()
    dst = tmp_path / "out" / "in.mp4"

    monkeypatch.setattr(anonymize, "detect_faces", lambda frame, det: [])
    monkeypatch.setattr(anonymize, "detect_plates", lambda frame, sess, **kw: [])

    anonymize.process_video(src, dst, face_detector=None, plate_session=None)

    after = hashlib.sha256(src.read_bytes()).hexdigest()
    assert before == after, "source file must never be modified"
    assert dst.exists()
    # No leftover temp/partial files: only src and the final dst remain.
    assert list(tmp_path.rglob("*.part.mp4")) == []
    all_mp4s = sorted(tmp_path.rglob("*.mp4"))
    assert all_mp4s == sorted([src, dst])


def test_process_video_leaves_no_orphaned_file_when_writer_fails_to_open(tmp_path, monkeypatch):
    src = tmp_path / "in.mp4"
    _make_fixture_video(src)
    dst = tmp_path / "out.mp4"

    monkeypatch.setattr(anonymize, "detect_faces", lambda frame, det: [])
    monkeypatch.setattr(anonymize, "detect_plates", lambda frame, sess, **kw: [])

    class _DeadWriter:
        def isOpened(self):
            return False

        def write(self, frame):
            raise AssertionError("must not write to a writer that failed to open")

        def release(self):
            pass

    monkeypatch.setattr(anonymize.cv2, "VideoWriter", lambda *a, **kw: _DeadWriter())

    with pytest.raises(anonymize.AnonymizeError, match="cannot open video writer"):
        anonymize.process_video(src, dst, face_detector=None, plate_session=None)

    assert not dst.exists()
    assert list(tmp_path.rglob("*.part.mp4")) == []
    assert list(tmp_path.rglob("*.mp4")) == [src]


def test_process_video_raises_on_missing_source(tmp_path):
    src = tmp_path / "does_not_exist.mp4"
    dst = tmp_path / "out.mp4"
    with pytest.raises(anonymize.AnonymizeError):
        anonymize.process_video(src, dst, face_detector=None, plate_session=None)


# ---------------------------------------------------------------------------
# _tile_origins: tiling geometry for tiled plate inference, no real model
# ---------------------------------------------------------------------------

def test_tile_origins_single_tile_when_frame_fits():
    assert anonymize._tile_origins(200, 640, 128) == [0]
    assert anonymize._tile_origins(640, 640, 128) == [0]


def test_tile_origins_exact_multiple_of_stride_has_constant_stride():
    # 1152 = 640 + 512*1, so the regular range already lands exactly on the
    # end -- no pullback needed, the one gap equals tile - overlap.
    origins = anonymize._tile_origins(1152, 640, 128)
    assert origins == [0, 512]
    assert origins[-1] + 640 == 1152


def test_tile_origins_pulls_the_last_tile_back_to_end_exactly_on_dim():
    dim, tile, overlap = 1920, 640, 128
    origins = anonymize._tile_origins(dim, tile, overlap)

    assert origins[0] == 0
    assert origins[-1] + tile == dim  # last tile ends exactly on the frame edge

    stride = tile - overlap
    # every pair except the pulled-back last one keeps the regular stride
    for prev, nxt in zip(origins[:-2], origins[1:-1]):
        assert nxt - prev == stride
    # no gap anywhere: each tile starts at or before the previous one's end
    for prev, nxt in zip(origins, origins[1:]):
        assert nxt <= prev + tile


# ---------------------------------------------------------------------------
# _expand_box: bounding-box margin, pixel arithmetic only
# ---------------------------------------------------------------------------

def test_expand_box_grows_by_margin_fraction_on_every_side():
    box = (100, 100, 40, 20)  # x, y, w, h
    out = anonymize._expand_box(box, frame_w=1000, frame_h=1000, margin_frac=0.25)
    # margin = 0.25 * 40 = 10 on x, 0.25 * 20 = 5 on y
    assert out == (90, 95, 60, 30)


def test_expand_box_clips_to_frame_bounds_near_the_edge():
    near_top_left = anonymize._expand_box(
        (2, 3, 40, 20), frame_w=1000, frame_h=1000, margin_frac=0.25)
    x0, y0, w, h = near_top_left
    assert x0 == 0
    assert y0 == 0

    near_bottom_right = anonymize._expand_box(
        (960, 980, 40, 20), frame_w=1000, frame_h=1000, margin_frac=0.25)
    x0b, y0b, wb, hb = near_bottom_right
    assert x0b + wb <= 1000
    assert y0b + hb <= 1000


def test_expand_box_keeps_a_zero_size_box_zero_size():
    out = anonymize._expand_box((10, 10, 0, 0), frame_w=1000, frame_h=1000, margin_frac=0.25)
    assert out == (10, 10, 0, 0)


# ---------------------------------------------------------------------------
# _iou: box overlap ratio, pixel arithmetic only
# ---------------------------------------------------------------------------

def test_iou_of_identical_boxes_is_one():
    box = (10, 10, 20, 20)
    assert anonymize._iou(box, box) == pytest.approx(1.0)


def test_iou_of_disjoint_boxes_is_zero():
    assert anonymize._iou((0, 0, 10, 10), (100, 100, 10, 10)) == 0.0


def test_iou_of_partially_overlapping_boxes_matches_hand_computed_ratio():
    a = (0, 0, 10, 10)   # area 100
    b = (5, 5, 10, 10)   # area 100, overlap is the 5x5 quadrant = 25
    # union = 100 + 100 - 25 = 175
    assert anonymize._iou(a, b) == pytest.approx(25 / 175)


# ---------------------------------------------------------------------------
# PersistenceTracker: bridges a short detector flicker across frames
# ---------------------------------------------------------------------------

def test_tracker_returns_a_new_detection_immediately():
    tracker = anonymize.PersistenceTracker(persist_frames=2)
    box = (10, 10, 20, 20)
    assert tracker.update([box]) == [box]


def test_tracker_coasts_the_last_box_through_a_short_miss():
    tracker = anonymize.PersistenceTracker(persist_frames=2, iou_match=0.15)
    box = (10, 10, 20, 20)

    assert tracker.update([box]) == [box]  # frame 1: real detection
    assert tracker.update([]) == [box]     # frame 2: miss #1, still coasting
    assert tracker.update([]) == [box]     # frame 3: miss #2, still <= persist_frames


def test_tracker_drops_a_track_after_persist_frames_of_misses():
    tracker = anonymize.PersistenceTracker(persist_frames=1)
    box = (10, 10, 20, 20)

    assert tracker.update([box]) == [box]  # frame 1: real detection, misses=0
    assert tracker.update([]) == [box]     # frame 2: misses=1, still <= persist_frames(1)
    assert tracker.update([]) == []        # frame 3: misses=2 > persist_frames(1), dropped


def test_tracker_match_resets_the_miss_counter():
    tracker = anonymize.PersistenceTracker(persist_frames=2, iou_match=0.15)
    a = (100, 100, 20, 20)
    a_shifted = (102, 101, 20, 20)  # small shift, still high IoU with `a`

    assert tracker.update([a]) == [a]                  # frame 1: real detection
    assert tracker.update([]) == [a]                   # frame 2: miss #1, still coasting
    assert tracker.update([a_shifted]) == [a_shifted]   # frame 3: re-matched, counter reset
    assert tracker.update([]) == [a_shifted]            # frame 4: miss #1 again (post-reset)
    assert tracker.update([]) == [a_shifted]            # frame 5: miss #2, still <= persist_frames
    assert tracker.update([]) == []                     # frame 6: miss #3 > persist_frames, dropped


def test_tracker_handles_two_independent_objects_separately():
    tracker = anonymize.PersistenceTracker(persist_frames=2, iou_match=0.15)
    left = (0, 0, 20, 20)
    right = (500, 500, 20, 20)
    right_moved = (505, 503, 20, 20)  # small shift, still high IoU with `right`

    out1 = tracker.update([left, right])
    assert set(out1) == {left, right}

    # `left` flickers out (no detection this frame); `right` keeps getting
    # fresh, slightly-shifted real detections every frame.
    out2 = tracker.update([right_moved])
    assert set(out2) == {left, right_moved}  # left still coasting, miss #1

    out3 = tracker.update([right_moved])
    assert set(out3) == {left, right_moved}  # left miss #2, still <= persist_frames

    out4 = tracker.update([right_moved])
    assert set(out4) == {right_moved}  # left miss #3 > persist_frames, dropped


# ---------------------------------------------------------------------------
# scan_faces: used by scripts/check_face_blur.py to verify blurring actually
# removed a detectable face. Stub detector -- no real model weights.
# ---------------------------------------------------------------------------

class _StubFaceDetector:
    def __init__(self, faces_by_frame):
        self._faces_by_frame = faces_by_frame
        self._frame_idx = 0

    def setInputSize(self, size):
        pass

    def detect(self, frame):
        faces = self._faces_by_frame.get(self._frame_idx)
        self._frame_idx += 1
        if faces is None:
            return None, None
        return None, np.array(faces, dtype=np.float32)


def test_scan_faces_yields_one_entry_per_detected_face(tmp_path):
    src = tmp_path / "in.mp4"
    _make_fixture_video(src, n_frames=3)
    stub = _StubFaceDetector({1: [[10, 10, 20, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9]]})

    hits = list(anonymize.scan_faces(src, detector=stub))

    assert len(hits) == 1
    idx, t, box, score = hits[0]
    assert idx == 1
    assert box == (10, 10, 20, 20)
    assert score == pytest.approx(0.9)


def test_scan_faces_returns_nothing_when_no_face_detected(tmp_path):
    src = tmp_path / "in.mp4"
    _make_fixture_video(src, n_frames=3)
    stub = _StubFaceDetector({})

    assert list(anonymize.scan_faces(src, detector=stub)) == []


def test_scan_faces_raises_on_missing_source(tmp_path):
    with pytest.raises(anonymize.AnonymizeError):
        list(anonymize.scan_faces(tmp_path / "nope.mp4", detector=_StubFaceDetector({})))


# ---------------------------------------------------------------------------
# anonymize_folder: skip-existing-by-default / --force, for a growing
# trimmed/ folder re-run cheaply without redoing already-anonymized files.
# ---------------------------------------------------------------------------

def test_anonymize_folder_skips_existing_output_by_default(tmp_path, monkeypatch):
    src_folder = tmp_path / "in"
    src_folder.mkdir()
    out_folder = tmp_path / "out"
    out_folder.mkdir()
    (src_folder / "a.mp4").write_bytes(b"fake")
    (out_folder / "a.mp4").write_bytes(b"already done")

    def _boom_process(*a, **kw):
        raise AssertionError("must not reprocess an already-anonymized file by default")

    def _boom_load():
        raise AssertionError("must not load models when nothing needs processing")

    monkeypatch.setattr(anonymize, "process_video", _boom_process)
    monkeypatch.setattr(anonymize, "load_face_detector", _boom_load)
    monkeypatch.setattr(anonymize, "load_plate_session", _boom_load)

    outputs = anonymize.anonymize_folder(src_folder, out_folder)
    assert outputs == [out_folder / "a.mp4"]


def test_anonymize_folder_force_reprocesses_existing_output(tmp_path, monkeypatch):
    src_folder = tmp_path / "in"
    src_folder.mkdir()
    out_folder = tmp_path / "out"
    out_folder.mkdir()
    a = src_folder / "a.mp4"
    a.write_bytes(b"fake")
    (out_folder / "a.mp4").write_bytes(b"stale")

    calls = []
    monkeypatch.setattr(anonymize, "load_face_detector", lambda: object())
    monkeypatch.setattr(anonymize, "load_plate_session", lambda: object())
    monkeypatch.setattr(anonymize, "process_video", lambda src, dst, *a, **kw: calls.append(src))

    anonymize.anonymize_folder(src_folder, out_folder, force=True)
    assert calls == [a]


def test_anonymize_folder_processes_only_the_not_yet_done_files(tmp_path, monkeypatch):
    src_folder = tmp_path / "in"
    src_folder.mkdir()
    out_folder = tmp_path / "out"
    out_folder.mkdir()
    (src_folder / "done.mp4").write_bytes(b"fake")
    (src_folder / "pending.mp4").write_bytes(b"fake")
    (out_folder / "done.mp4").write_bytes(b"already done")

    calls = []
    monkeypatch.setattr(anonymize, "load_face_detector", lambda: object())
    monkeypatch.setattr(anonymize, "load_plate_session", lambda: object())
    monkeypatch.setattr(anonymize, "process_video", lambda src, dst, *a, **kw: calls.append(src.name))

    anonymize.anonymize_folder(src_folder, out_folder)
    assert calls == ["pending.mp4"]
