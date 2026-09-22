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
