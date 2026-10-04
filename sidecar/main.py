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
from pydantic import BaseModel, FiniteFloat

from vqa import annotations, config, db, media, review, trim, urls

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
    annotations.init()      # separate file; never touches pipeline.db


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
ANON_PAUSE_FILE = LOG_DIR / "anonymize.pause"


def _anon_busy() -> bool:
    return _anon_proc is not None and _anon_proc.poll() is None


def _anonymize_progress(work_root: Path) -> dict:
    """Count only finished outputs corresponding to current trimmed clips."""
    sources = sorted(work_root.glob("*/trimmed/*.mp4"))
    completed_files = []
    for src in sources:
        dst = src.parent.parent / "finished" / src.name
        try:
            finished_at = dst.stat().st_mtime
        except FileNotFoundError:
            continue
        completed_files.append({
            "video_id": src.parent.parent.name,
            "file_name": src.name,
            "completed_at": finished_at,
        })
    completed_files.sort(key=lambda item: (item["completed_at"], item["video_id"], item["file_name"]))
    return {
        "total": len(sources),
        "completed": len(completed_files),
        "completed_files": completed_files,
    }


@app.get("/anonymize/status")
def anonymize_status():
    busy = _anon_busy()
    exit_code = _anon_proc.poll() if _anon_proc is not None else None
    progress = _anonymize_progress(REPO_ROOT / "work")
    pause_requested = ANON_PAUSE_FILE.exists()
    return {
        "busy": busy,
        "pause_supported": True,
        "pause_requested": busy and pause_requested,
        "paused": pause_requested and not busy and exit_code in (None, 0)
                  and progress["completed"] < progress["total"],
        "exit_code": exit_code,
        **progress,
    }


@app.post("/anonymize/start")
def anonymize_start():
    global _anon_proc
    if _anon_busy():
        raise HTTPException(409, "an anonymize sweep is already in progress")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    ANON_PAUSE_FILE.unlink(missing_ok=True)
    python_exe = REPO_ROOT / "venv" / "Scripts" / "python.exe"
    if not python_exe.exists():
        python_exe = Path(sys.executable)
    _anon_proc = subprocess.Popen(
        [str(python_exe), str(REPO_ROOT / "scripts" / "anonymize_all.py"),
         "--pause-file", str(ANON_PAUSE_FILE)],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return {"started": True, "pid": _anon_proc.pid}


@app.post("/anonymize/pause")
def anonymize_pause():
    if not _anon_busy():
        return {"pause_requested": False, "message": "no anonymize sweep is running"}
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    ANON_PAUSE_FILE.touch()
    return {"pause_requested": True, "message": "finishing the current clip before pausing"}


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
    saved_labels = db.segment_labels(clip["clip_id"])
    initial_shots = (
        [
            {
                **trim.shot(x["start_ms"] / 1000, x["end_ms"] / 1000),
                "difficulty": saved_labels[i]["difficulty"] if i < len(saved_labels) else None,
                "event_label": saved_labels[i]["event_label"] if i < len(saved_labels) else None,
            }
            for i, x in enumerate(existing)
        ]
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
    difficulty: str | None = None
    event_label: str | None = None


@app.post("/review/{clip_id}/decision")
def review_decision(clip_id: str, req: DecisionRequest):
    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(404, "clip not found")

    if req.decision == db.APPROVED:
        errs = trim.errors(req.shots, clip["duration_ms"] / 1000.0)
        if errs:
            raise HTTPException(400, "; ".join(errs))
        for i, shot in enumerate(req.shots, 1):
            if shot.get("difficulty") not in {"easy", "medium", "high"}:
                raise HTTPException(422, f"shot {i}: choose a difficulty")
            if shot.get("event_label") not in {"accident", "near-miss"}:
                raise HTTPException(422, f"shot {i}: choose an event label")
        cfg = config.load()
        try:
            written = review.materialize(clip, trim.segments(req.shots), cfg)
        except media.MediaError as exc:
            raise HTTPException(400, str(exc))
        labeled = [
            {**segment, "difficulty": req.shots[i].get("difficulty"),
             "event_label": req.shots[i].get("event_label")}
            for i, segment in enumerate(written)
        ]
        db.set_segment_labels(clip_id, labeled)
        # Keep the legacy clip-level columns only as a compatibility summary.
        # The authoritative labels for a split clip are review_segments.
        same_difficulty = len({x["difficulty"] for x in labeled}) == 1
        same_event = len({x["event_label"] for x in labeled}) == 1
        db.set_decision(
            clip_id,
            db.APPROVED,
            labeled[0]["difficulty"] if same_difficulty else None,
            labeled[0]["event_label"] if same_event else None,
        )
        return {"decision": db.APPROVED, "detail": f"{len(written)} file(s) -> trimmed/"}

    if req.decision == db.REJECTED:
        removed = review.discard(clip)
        db.set_decision(clip_id, db.REJECTED)
        return {"decision": db.REJECTED, "detail": f"removed {removed} file(s) from trimmed/"}

    if req.decision == db.FLAGGED:
        for i, shot in enumerate(req.shots, 1):
            if shot.get("difficulty") not in {"easy", "medium", "high"}:
                raise HTTPException(422, f"shot {i}: choose a difficulty")
            if shot.get("event_label") not in {"accident", "near-miss"}:
                raise HTTPException(422, f"shot {i}: choose an event label")
        db.set_decision(clip_id, db.FLAGGED, req.difficulty, req.event_label)
        return {"decision": db.FLAGGED, "detail": "needs a second look"}

    raise HTTPException(400, f"unknown decision {req.decision!r}")


# ── relabel backlog: clips decided before difficulty/event_label existed ──


def _relabel_video_path(clip) -> str | None:
    """First trim_segments entry that still exists on disk, or None.

    Deliberately NOT the anonymize sweep's `finished/` copy: `finished/` is
    written by vqa/anonymize.py's process_video() via
    cv2.VideoWriter_fourcc(*"mp4v") -- MPEG-4 Part 2, which no browser's
    native <video> element decodes (confirmed via ffprobe: finished/ reports
    codec_name=mpeg4, trimmed/ reports codec_name=h264). A <video src=...>
    pointed at finished/ shows an empty, non-seekable player. trimmed/ is
    always H.264 (vqa/media.py, ffmpeg) and is what the Review tab has always
    played, so relabel uses the same source. trim_segments can go stale (a
    clip re-cut, or its trimmed/ file removed by hand outside the normal
    Approve/Reject flow) without the DB row noticing, so existence is
    checked here rather than trusted.
    """
    for seg in json.loads(clip["trim_segments"] or "[]"):
        p = Path(seg["path"])
        if p.exists():
            return str(p).replace("\\", "/")
    return None


@app.get("/relabel/next")
def relabel_next():
    # trimmed_only=True: this backlog is scoped to clips whose output is
    # actually in trimmed/ -- the finished-product folder -- not every
    # decided clip, so a REJECTED clip (no trimmed/ output) never appears here.
    backlog = [(c, _relabel_video_path(c)) for c in db.list_missing_labels(trimmed_only=True)]
    backlog = [(c, p) for c, p in backlog if p is not None]

    if not backlog:
        return {"clip": None, "remaining": 0}

    clip, path = backlog[0]
    return {
        "clip": {
            "clip_id": clip["clip_id"],
            "youtube_video_id": clip["youtube_video_id"],
            "duration_s": clip["duration_ms"] / 1000.0,
            "flags": json.loads(clip["flags"] or "[]"),
            "video_path": path,
            "decision": clip["decision"],
        },
        "remaining": len(backlog),
    }


class LabelRequest(BaseModel):
    difficulty: str | None = None
    event_label: str | None = None


@app.post("/relabel/{clip_id}")
def relabel_clip(clip_id: str, req: LabelRequest):
    clip = db.get_clip(clip_id)
    if clip is None:
        raise HTTPException(404, "clip not found")
    if req.difficulty not in {"easy", "medium", "high"}:
        raise HTTPException(422, "difficulty must be easy, medium, or high")
    if req.event_label not in {"accident", "near-miss"}:
        raise HTTPException(422, "event_label must be accident or near-miss")

    db.set_labels(clip_id, req.difficulty, req.event_label)
    return {"ok": True}


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


class ValidateShot(BaseModel):
    start: FiniteFloat
    end: FiniteFloat
    auto: bool = False
    default: bool = False


class ValidateRequest(BaseModel):
    shots: list[ValidateShot]
    duration: FiniteFloat


@app.post("/trim/validate")
def trim_validate(req: ValidateRequest):
    shots = [s.model_dump() for s in req.shots]
    return {
        "errors": trim.errors(shots, req.duration),
        "conflicts": trim.conflicts(shots),
        "segments": trim.segments(shots),
    }


# ── Team B annotation over VLM drafts ────────────────────────────────────
#
# Reads pipeline.db for the video path only; every write goes to
# annotations.db. The difficulty/event labels written here are a *second,
# independent* ballot and deliberately do not touch reviews.difficulty --
# see vqa/annotations.py and features/qa-draft-annotation/conflicts.md #3.


def _shot_video_path(clip_id: str, shot: int) -> str | None:
    """The trimmed/ file for one shot, as a forward-slash URL path segment."""
    clip = db.get_clip(clip_id)
    if clip is None:
        return None
    segs = json.loads(clip["trim_segments"] or "[]")
    if not 1 <= shot <= len(segs):
        return None
    p = Path(segs[shot - 1]["path"])
    return str(p).replace("\\", "/") if p.exists() else None


@app.get("/annotate/annotators")
def annotate_annotators():
    return {"annotators": annotations.list_annotators()}


class AnnotatorRequest(BaseModel):
    annotator_id: str
    name: str
    team: str          # A or B


@app.post("/annotate/annotators")
def annotate_upsert_annotator(req: AnnotatorRequest):
    try:
        annotations.upsert_annotator(req.annotator_id.strip(), req.name.strip(),
                                     req.team.strip().upper())
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True}


@app.get("/annotate/shots")
def annotate_shots(annotator_id: str | None = None):
    """Every shot that has drafts, with how many this annotator has judged."""
    out = []
    for s in annotations.shots_with_drafts():
        done = len([d for d in annotations.drafts_for(
            s["clip_id"], s["shot"], annotator_id) if d["verdict"]]) \
            if annotator_id else 0
        out.append({**s, "n_done": done,
                    "available": _shot_video_path(s["clip_id"], s["shot"]) is not None})
    return {"shots": out}


@app.get("/annotate/shot")
def annotate_shot(clip_id: str, shot: int, annotator_id: str | None = None):
    """One shot: the video, its nine drafts, and this annotator's work so far."""
    drafts = annotations.drafts_for(clip_id, shot, annotator_id)
    if not drafts:
        raise HTTPException(404, "no drafts for that shot")

    path = _shot_video_path(clip_id, shot)
    clip = db.get_clip(clip_id)
    # A draft whose shot file has gone is a named state, not a crash: the
    # reviewer is allowed to Reject after drafting, and review.discard()
    # unlinks the trimmed/ file (conflicts.md #7).
    stale = path is None

    # The earlier reviewer's difficulty/event is deliberately NOT returned. An
    # annotator who sees it anchors to it, and this endpoint feeds the screen
    # where they choose their own -- the same reason predicted_keyframes_s stays
    # hidden until they have saved. Comparing the two is a reporting job, done
    # after the fact, not something to put in front of the person labelling.
    mine = annotations.clip_label(clip_id, shot, annotator_id) if annotator_id else None

    return {
        "clip_id": clip_id,
        "shot": shot,
        "video_path": path,
        "stale": stale,
        "duration_s": (clip["duration_ms"] / 1000.0) if clip is not None else None,
        "frame_times_s": drafts[0]["frame_times_s"],
        "my_label": mine,
        "drafts": [
            {
                "draft_id": d["draft_id"],
                "qgroup": d["qgroup"],
                "group_name": annotations.QGROUP_NAMES.get(d["qgroup"], d["qgroup"]),
                "question": d["question"],
                "answer": d["answer"],
                "truncated": bool(d["truncated"]),
                "completion_tokens": d["completion_tokens"],
                "latency_ms": d["latency_ms"],
                "prompt_version": d["prompt_version"],
                # The model's own evidence timestamps are withheld until the
                # annotator has saved their own, so Grounding Accuracy compares
                # two independent columns instead of one anchored to the other.
                "predicted_keyframes_s": (d["keyframes_s"] if d["revealed_at"] else None),
                "verdict": d["verdict"],
                "reason_code": d["reason_code"],
                "reason_note": d["reason_note"],
                "edited_question": d["edited_question"],
                "edited_answer": d["edited_answer"],
                "human_keyframes_s": d["human_keyframes_s"],
                "annotated_at": d["annotated_at"],
            }
            for d in drafts
        ],
        "vocab": {
            "verdicts": list(annotations.VERDICTS),
            "reasons": list(annotations.REASONS),
            "difficulties": list(annotations.DIFFICULTIES),
            "event_labels": list(annotations.EVENT_LABELS),
        },
    }


class AnnotationRequest(BaseModel):
    annotator_id: str
    verdict: str
    reason_code: str | None = None
    reason_note: str | None = None
    question: str | None = None
    answer: str | None = None
    keyframes_s: list[FiniteFloat] = []


@app.post("/annotate/draft/{draft_id}")
def annotate_draft(draft_id: str, req: AnnotationRequest):
    if not req.annotator_id.strip():
        raise HTTPException(422, "chọn người gán nhãn trước")
    if len(req.keyframes_s) > 3:
        raise HTTPException(422, "tối đa 3 mốc bằng chứng mỗi câu (DC.pdf)")
    try:
        annotations.save_annotation(
            draft_id, req.annotator_id.strip(), req.verdict,
            reason_code=req.reason_code, reason_note=req.reason_note,
            question=req.question, answer=req.answer,
            keyframes_s=[round(x, 3) for x in req.keyframes_s],
            revealed=True)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True}


class ShotLabelRequest(BaseModel):
    annotator_id: str
    clip_id: str
    shot: int
    difficulty: str
    event_label: str


@app.post("/annotate/label")
def annotate_label(req: ShotLabelRequest):
    if not req.annotator_id.strip():
        raise HTTPException(422, "chọn người gán nhãn trước")
    try:
        annotations.save_clip_label(req.clip_id, req.shot, req.annotator_id.strip(),
                                    req.difficulty, req.event_label)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {"ok": True}


@app.get("/annotate/summary")
def annotate_summary():
    return {"by_group": annotations.verdict_summary(),
            "by_reason": annotations.reason_summary()}


@app.get("/annotate/consensus")
def annotate_consensus(clip_id: str, shot: int):
    """Majority vote across annotators for one shot (DC.pdf steps 6-7)."""
    return {"labels": annotations.label_consensus(clip_id, shot),
            "verdicts": annotations.verdict_consensus(clip_id, shot)}


# ── prompt registry ──────────────────────────────────────────────────────
#
# vlm/prompts.py is the source of truth for prompt text; this exposes it
# read-only alongside the usage counts from annotations.db, so "which prompt
# wrote this draft" is answerable without reading the code.


@app.get("/prompts")
def prompts_registry():
    from vlm import prompts as P

    with annotations.tx() as c:
        used = [dict(r) for r in c.execute(
            "SELECT prompt_name, prompt_version, qgroup, count(*) AS n_drafts,"
            " sum(truncated) AS n_truncated,"
            " round(avg(completion_tokens), 1) AS avg_out_tokens,"
            " round(avg(latency_ms)) AS avg_latency_ms,"
            " min(created_at) AS first_used, max(created_at) AS last_used"
            " FROM qa_drafts GROUP BY prompt_name, prompt_version, qgroup"
            " ORDER BY prompt_version DESC, qgroup")]
        verdicts = [dict(r) for r in c.execute(
            "SELECT d.prompt_version, d.qgroup,"
            " sum(a.verdict='AGREE') AS agree,"
            " sum(a.verdict='NOT_ANSWERABLE') AS not_answerable,"
            " sum(a.verdict='DISAGREE') AS disagree"
            " FROM qa_drafts d JOIN qa_annotations a ON a.draft_id = d.draft_id"
            " GROUP BY d.prompt_version, d.qgroup")]

    score = {(v["prompt_version"], v["qgroup"]): v for v in verdicts}
    for u in used:
        u.update(score.get((u["prompt_version"], u["qgroup"]), {}))

    # Recorded text wins over the module's current text. vlm/prompts.py holds
    # only the latest wording, so reading it alone makes every older version
    # unreadable -- which is exactly what stops two versions being compared.
    recorded = annotations.prompt_versions()

    return {
        "draft": {
            "name": P.PROMPT_NAME,
            "version": P.PROMPT_VERSION,
            "preamble": P.PREAMBLE,
            "repeat_penalty": P.REPEAT_PENALTY,
            "groups": [{"code": g.code, "name": g.name, "question": g.question,
                        "max_tokens": g.max_tokens} for g in P.GROUPS],
        },
        "versions": recorded,
        "judge": {
            "name": P.JUDGE_NAME,
            "version": P.JUDGE_VERSION,
            "rubrics": [{"key": j.key, "groups": list(j.groups),
                         "title": j.title, "rubric": j.rubric} for j in P.JUDGES],
        },
        "usage": used,
    }
