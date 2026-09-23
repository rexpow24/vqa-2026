"""FastAPI sidecar bridging the Next.js frontend to pipeline.db + run_pipeline.py.

    ./venv/Scripts/python.exe -m uvicorn sidecar.main:app --port 8787

Run from the repo root, same as `streamlit run app.py` was. `vqa/` is imported
as-is; no write path in `vqa/db.py` was changed to make this work. See
features/nextjs-frontend-migration/architecture.md for the full reasoning.

Bound to 127.0.0.1 only (uvicorn default host is 127.0.0.1) — same posture
already accepted for the VLM llama.cpp server in architecture.md §15.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vqa import config, db, media, review, trim, urls

REPO_ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = REPO_ROOT / "logs"

app = FastAPI(title="vqa-sidecar")

# Calls are expected to come from Next.js server-side route handlers (no
# browser CORS involved), but the browser dev origin is allowed too so the
# sidecar can be hit directly while iterating.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init()


def row_to_dict(row) -> dict:
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


@app.get("/health")
def health():
    return {"ok": True}


# ── videos / queue ───────────────────────────────────────────────────────


@app.get("/videos")
def list_videos():
    return {"videos": [row_to_dict(r) for r in db.list_videos()]}


class EnqueueRequest(BaseModel):
    text: str


@app.post("/videos/enqueue")
def enqueue_videos(req: EnqueueRequest):
    ok, bad = urls.parse_lines(req.text)
    added, dupes = db.enqueue_many(ok)
    return {"added": added, "dupes": dupes, "bad": bad}


@app.post("/videos/{video_id}/remove")
def remove_video(video_id: str):
    # review.purge_video, not db.remove_video: a STOPPED video can already own
    # APPROVED files in trimmed/, since clips are reviewable while a run is
    # still going. Same reasoning as app.py's Queue tab.
    rows, files = review.purge_video(video_id)
    return {"removed_rows": rows, "removed_files": files}


@app.post("/videos/retry/{status}")
def retry_videos(status: str):
    if status not in db.RETRYABLE:
        raise HTTPException(400, f"status must be one of {list(db.RETRYABLE)}")
    return {"requeued": db.retry_status(status)}


@app.post("/videos/mark-stopped")
def mark_stopped_route():
    return {"marked": db.mark_stopped()}


# ── run control ──────────────────────────────────────────────────────────

# Held as a module global because this process, unlike a Streamlit script
# run, actually stays alive between requests — no st.session_state needed.
_proc: subprocess.Popen | None = None


def _busy() -> bool:
    return _proc is not None and _proc.poll() is None


def _log_tail(n: int = 200) -> str:
    latest = LOG_DIR / "latest.log"
    if not latest.exists():
        return "(no runs yet)"
    try:
        path = Path(latest.read_text(encoding="utf-8").strip())
        lines = path.read_text(encoding="utf-8").splitlines()
        return "\n".join(lines[-n:]) or "(empty)"
    except OSError:
        return "(log unavailable)"


@app.get("/run/status")
def run_status():
    rows = db.list_videos()
    done = sum(1 for r in rows if r["status"] in (db.READY_FOR_REVIEW, db.DONE))
    return {
        "busy": _busy(),
        "queued": len(db.list_videos(db.QUEUED)),
        "done": done,
        "total": len(rows),
        "log_tail": _log_tail(),
    }


@app.post("/run/start")
def run_start():
    global _proc
    if _busy():
        raise HTTPException(409, "a run is already in progress")
    if len(db.list_videos(db.QUEUED)) == 0:
        raise HTTPException(400, "queue is empty")
    python_exe = REPO_ROOT / "venv" / "Scripts" / "python.exe"
    if not python_exe.exists():
        python_exe = Path(sys.executable)
    _proc = subprocess.Popen(
        [str(python_exe), str(REPO_ROOT / "run_pipeline.py")],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return {"started": True, "pid": _proc.pid}


@app.post("/run/stop")
def run_stop():
    global _proc
    if not _busy():
        return {"stopped": False, "message": "nothing running here"}
    _proc.terminate()
    # Wait for it to actually die before marking STOPPED: the runner writes
    # status too, and a dying one would overwrite STOPPED with whatever stage
    # it was in. Same ordering as app.py's Stop button.
    try:
        _proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        _proc.kill()
        _proc.wait(timeout=5)
    marked = db.mark_stopped()
    return {"stopped": True, "marked": marked}


# ── anonymize (trimmed/ -> finished/) ───────────────────────────────────
#
# Same subprocess pattern as /run/* above, held as its own module global so
# an anonymize sweep and a pipeline run can be tracked independently -- they
# touch disjoint files (trimmed/ + finished/ vs pipeline.db + delivered/) and
# don't need to exclude each other.

_anon_proc: subprocess.Popen | None = None


def _anon_busy() -> bool:
    return _anon_proc is not None and _anon_proc.poll() is None


@app.get("/anonymize/status")
def anonymize_status():
    return {"busy": _anon_busy()}


@app.post("/anonymize/start")
def anonymize_start():
    global _anon_proc
    if _anon_busy():
        raise HTTPException(409, "an anonymize sweep is already in progress")
    python_exe = REPO_ROOT / "venv" / "Scripts" / "python.exe"
    if not python_exe.exists():
        python_exe = Path(sys.executable)
    _anon_proc = subprocess.Popen(
        [str(python_exe), str(REPO_ROOT / "scripts" / "anonymize_all.py")],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return {"started": True, "pid": _anon_proc.pid}


# ── review ───────────────────────────────────────────────────────────────


@app.get("/review/next")
def review_next():
    # Same source app.py's sidebar reads/writes (cfg["trim_pad_s"]): the
    # operator can change the mark-cut padding there, and the frontend must
    # see that value too, not the trim.py module constant.
    cfg = config.load()
    pad_default = float(cfg.get("trim_pad_s", trim.PAD_DEFAULT))

    pending = db.list_clips(decision=db.UNREVIEWED)
    top = [c for c in pending if db.priority(c["duration_ms"]) == db.TOP]
    low = [c for c in pending if db.priority(c["duration_ms"]) == db.LOW_PRIORITY]

    counts = db.clip_counts()
    total = sum(counts["by_decision"].values()) or 1
    approved = counts["by_decision"].get(db.APPROVED, 0)
    reviewed = total - counts["by_decision"].get(db.UNREVIEWED, 0)
    summary = {
        "top_left": len(top),
        "low_left": len(low),
        "reviewed": reviewed,
        "approved": approved,
    }

    queue = top or low
    if not queue:
        return {"clip": None, "initial_shots": [], "summary": summary}

    band = db.TOP if top else db.LOW_PRIORITY
    clip = queue[0]
    dur = clip["duration_ms"] / 1000.0
    dmax = round(dur, 1)
    existing = db.trim_segments(clip)
    initial_shots = (
        [trim.shot(x["start_ms"] / 1000, x["end_ms"] / 1000) for x in existing]
        if existing else trim.whole_clip(dmax)
    )
    # Forward slashes only: this string becomes a URL path segment on the
    # Next.js side, and Windows backslashes would need per-segment escaping.
    path = (clip["delivered_path"] or clip["master_path"]).replace("\\", "/")

    return {
        "clip": {
            "clip_id": clip["clip_id"],
            "youtube_video_id": clip["youtube_video_id"],
            "duration_s": dur,
            "duration_rounded": dmax,
            "flags": json.loads(clip["flags"] or "[]"),
            "band": band,
            "video_path": path,
            "already_materialized": len(existing),
            "pad_default": pad_default,
            "max_shots": trim.MAX_SHOTS,
        },
        "initial_shots": initial_shots,
        "summary": summary,
    }


class DecisionRequest(BaseModel):
    decision: str  # APPROVED | REJECTED | FLAGGED
    shots: list[dict] = []


@app.post("/review/{clip_id}/decision")
def review_decision(clip_id: str, req: DecisionRequest):
    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(404, "clip not found")

    if req.decision == db.APPROVED:
        errs = trim.errors(req.shots, clip["duration_ms"] / 1000.0)
        if errs:
            raise HTTPException(400, "; ".join(errs))
        cfg = config.load()
        try:
            written = review.materialize(clip, trim.segments(req.shots), cfg)
        except media.MediaError as exc:
            raise HTTPException(400, str(exc))
        db.set_decision(clip_id, db.APPROVED)
        return {"decision": db.APPROVED, "detail": f"{len(written)} file(s) -> trimmed/"}

    if req.decision == db.REJECTED:
        removed = review.discard(clip)
        db.set_decision(clip_id, db.REJECTED)
        return {"decision": db.REJECTED, "detail": f"removed {removed} file(s) from trimmed/"}

    if req.decision == db.FLAGGED:
        db.set_decision(clip_id, db.FLAGGED)
        return {"decision": db.FLAGGED, "detail": "needs a second look"}

    raise HTTPException(400, f"unknown decision {req.decision!r}")


# ── trim geometry: stateless wrappers around vqa/trim.py's pure functions ─
#
# The frontend owns the shot list in React state (no server-side session
# needed — React re-renders on every setState, unlike Streamlit's
# ignore-value-once-key-exists trap). Every mutation still goes through
# vqa/trim.py, which is the same rule app.py follows: no shot-list rule is
# reimplemented outside this module.


class MarkRequest(BaseModel):
    shots: list[dict]
    duration: float
    x: float
    pad: float = trim.PAD_DEFAULT


@app.post("/trim/mark")
def trim_mark(req: MarkRequest):
    new_shots = trim.apply_mark(req.shots, req.duration, req.x, req.pad)
    if new_shots is None:
        base = [] if trim.is_untouched(req.shots, req.duration) else req.shots
        if len(base) >= trim.MAX_SHOTS:
            return {"shots": None, "error": f"Already at the {trim.MAX_SHOTS}-shot limit."}
        reason = trim.why_no_room(req.x, req.duration, base, req.pad)
        return {"shots": None, "error": f"Cannot auto-adjust - {reason}."}
    return {"shots": new_shots, "error": None}


class AddRequest(BaseModel):
    shots: list[dict]
    duration: float
    pad: float = trim.PAD_DEFAULT


@app.post("/trim/add")
def trim_add(req: AddRequest):
    new_shots = trim.append_shot(req.shots, req.duration, req.pad)
    if new_shots is None:
        return {"shots": None, "error": f"Already at the {trim.MAX_SHOTS}-shot limit."}
    return {"shots": new_shots, "error": None}


class ResolveRequest(BaseModel):
    shots: list[dict]
    duration: float
    idx: int


@app.post("/trim/resolve")
def trim_resolve(req: ResolveRequest):
    new_shots = trim.resolve(req.shots, req.idx, req.duration)
    if new_shots is None:
        return {"shots": None, "error": "Cannot resolve automatically - adjust Start/End manually."}
    return {"shots": new_shots, "error": None}


class ReshapeRequest(BaseModel):
    shot: dict
    start: float
    end: float


@app.post("/trim/reshape")
def trim_reshape(req: ReshapeRequest):
    return {"shot": trim.reshape(req.shot, req.start, req.end)}


class ValidateRequest(BaseModel):
    shots: list[dict]
    duration: float


@app.post("/trim/validate")
def trim_validate(req: ValidateRequest):
    return {
        "errors": trim.errors(req.shots, req.duration),
        "conflicts": trim.conflicts(req.shots),
        "segments": trim.segments(req.shots),
    }
