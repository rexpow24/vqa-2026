"""Direct Facebook video ingestion without the YouTube preprocessing stages."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import yt_dlp

from . import config, db, media


class FacebookDownloadError(RuntimeError):
    pass


def parse_lines(text: str) -> tuple[list[tuple[str, str]], list[tuple[int, str]]]:
    """Validate Facebook links; every accepted line gets an independent ID."""
    accepted: list[tuple[str, str]] = []
    rejected: list[tuple[int, str]] = []
    for line_number, raw in enumerate(text.splitlines(), 1):
        url = raw.strip()
        if not url or url.startswith("#"):
            continue
        try:
            parts = urlsplit(url)
            host = (parts.hostname or "").lower().rstrip(".")
            valid_host = (
                host == "fb.watch"
                or host == "facebook.com"
                or host.endswith(".facebook.com")
            )
            if (parts.scheme not in {"http", "https"} or not valid_host
                    or parts.username or parts.password):
                raise ValueError
        except ValueError:
            rejected.append((line_number, raw))
            continue
        accepted.append((f"fb_{uuid4().hex}", url))
    return accepted, rejected


def download(url: str, work: Path) -> dict:
    """Download a public Facebook video to work/source/original.mp4."""
    source_dir = work / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    target = source_dir / "original.mp4"
    metadata_path = work / "metadata.json"

    if target.is_file() and target.stat().st_size > 1024 and metadata_path.is_file():
        return json.loads(metadata_path.read_text(encoding="utf-8"))

    options = {
        "format": "bestvideo+bestaudio/best",
        "merge_output_format": "mp4",
        "outtmpl": str(source_dir / "original.%(ext)s"),
        "quiet": True,
        "noprogress": True,
        "no_warnings": True,
        "retries": 3,
        "fragment_retries": 3,
        "continuedl": True,
        "noplaylist": True,
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        raise FacebookDownloadError(str(exc)[:400]) from exc

    if info.get("is_live"):
        raise FacebookDownloadError("live streams are not supported")
    if not target.is_file():
        candidates = sorted(
            path for path in source_dir.glob("original.*")
            if path.suffix.lower() in {".mp4", ".mkv", ".webm"}
        )
        if candidates:
            candidates[0].replace(target)
    if not target.is_file() or target.stat().st_size <= 1024:
        raise FacebookDownloadError("download produced no usable video file")

    metadata = {
        "title": info.get("title") or "",
        "channel_name": info.get("uploader") or info.get("channel") or "Facebook",
        "duration_s": float(info.get("duration") or 0.0),
        "webpage_url": info.get("webpage_url") or url,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def process_video(video_id: str, url: str, log) -> None:
    """Create one reviewable clip spanning the downloaded Facebook video."""
    work = Path(config.load()["work_dir"]) / "facebook" / video_id
    db.set_status(video_id, db.DOWNLOADING, stage="download")
    log(f"[{video_id}] downloading Facebook video")
    try:
        metadata = download(url, work)
    except FacebookDownloadError as exc:
        log(f"[{video_id}] DOWNLOAD FAILED: {exc}")
        db.set_status(video_id, db.DOWNLOAD_FAILED, stage="download",
                      error_code="DOWNLOAD_FAILED", error_detail=str(exc)[:500])
        return

    source = work / "source" / "original.mp4"
    db.set_status(video_id, db.PROCESSING, stage="probe")
    try:
        info = media.probe(source)
    except media.MediaError as exc:
        log(f"[{video_id}] INVALID VIDEO: {exc}")
        db.set_status(video_id, db.FAILED, stage="probe",
                      error_code="INVALID_VIDEO", error_detail=str(exc)[:500])
        return

    duration = info["duration_s"] or metadata["duration_s"]
    if duration <= 0:
        db.set_status(video_id, db.FAILED, stage="probe",
                      error_code="INVALID_VIDEO", error_detail="video duration is unknown")
        return

    clip_id = f"{video_id}_full"
    config_hash = config.config_hash({"source": "facebook", "pipeline": 1})
    db.update_video(
        video_id, title=metadata["title"], channel_name=metadata["channel_name"],
        duration_s=duration, n_clips=1, n_boundaries=0,
        config_snapshot=json.dumps({"source": "facebook", "pipeline": 1}),
    )
    db.insert_clip({
        "clip_id": clip_id,
        "youtube_video_id": video_id,
        "seq": 1,
        "start_ms": 0,
        "end_ms": int(round(duration * 1000)),
        "duration_ms": int(round(duration * 1000)),
        "confidence": "MEDIUM",
        "flags": "[]",
        "master_path": str(source),
        "delivered_path": str(source),
        "pipeline_version": "facebook-direct-v1",
        "config_hash": config_hash,
    })
    db.set_status(video_id, db.READY_FOR_REVIEW, stage="done")
    log(f"[{video_id}] READY_FOR_REVIEW - one full-video clip, no preprocessing")


def run(log) -> int:
    """Process only Facebook queue rows; never consume YouTube work."""
    processed = 0
    while True:
        row = db.next_queued(source="facebook")
        if row is None:
            break
        video_id = row["youtube_video_id"]
        try:
            process_video(video_id, row["canonical_url"], log)
        except Exception as exc:
            log(f"[{video_id}] UNEXPECTED ERROR: {exc}")
            db.set_status(video_id, db.FAILED, stage="unknown",
                          error_code="FAILED", error_detail=str(exc)[:500])
        processed += 1
    return processed
