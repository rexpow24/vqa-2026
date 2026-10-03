"""Team B's annotation store — a separate SQLite file from `pipeline.db`.

Two databases on purpose. `pipeline.db` holds the *operator's* view: one review
decision per clip, written by the reviewer while cutting shots. This file holds
the *dataset's* view: one independent judgement per annotator per draft, which is
what inter-annotator agreement is computed from (`docs/DC.pdf` steps 6-7).

`difficulty` and `event_label` appear in both, with the same vocabulary, and that
duplication is deliberate rather than an oversight. In `pipeline.db` they are a
single reviewer's operational tag, required at approve time. Here they are one
ballot among several, keyed by annotator. Collapsing the two would destroy the
agreement signal, which is the only reason this file exists.

Nothing here ever writes to `pipeline.db`. The VLM package does not import this
module either -- `vlm/` only writes JSONL, and the importer below reads it.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path("annotations.db")

# The nine question groups of docs/DC.pdf, in the order an annotator works them.
QGROUPS = ("S", "E", "N", "C", "V", "O", "R", "Attr", "Prev")

QGROUP_NAMES = {
    "S": "Bối cảnh", "E": "Thực thể", "N": "Diễn biến", "C": "Nguyên nhân",
    "V": "Vi phạm", "O": "Hậu quả", "R": "Ứng xử",
    "Attr": "Quy trách nhiệm", "Prev": "Phòng tránh",
}

# Three verdicts, not two. NOT_ANSWERABLE is a property of the clip -- the video
# simply contains no event the question could be about, e.g. group V on footage
# with no visible violation. That is legitimate dataset content (the
# "câu hỏi không đáp án" checklist at DC.pdf step 4), not a model failure, and
# folding it into DISAGREE would lose the distinction permanently.
VERDICTS = ("AGREE", "NOT_ANSWERABLE", "DISAGREE")

# Closed list so the failures can be counted per group; `khác` keeps whatever
# the list does not yet cover, and the UI requires a note when it is chosen.
REASONS = ("thiếu thực thể", "sai thực thể", "sai nhân quả", "sai mốc thời gian",
           "bịa chi tiết", "sai diễn đạt", "khác")

# Copied verbatim from pipeline.db rather than re-cased. `sidecar/main.py`
# enforces exactly these strings at approve time; a capitalised variant here
# would make every join between the two files miss silently.
DIFFICULTIES = ("easy", "medium", "high")
EVENT_LABELS = ("accident", "near-miss")

SCHEMA = """
CREATE TABLE IF NOT EXISTS annotators (
    annotator_id TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    team         TEXT NOT NULL CHECK (team IN ('A', 'B')),
    created_at   TEXT
);

CREATE TABLE IF NOT EXISTS qa_drafts (
    draft_id       TEXT PRIMARY KEY,
    clip_id        TEXT NOT NULL,
    shot           INTEGER NOT NULL,
    source_sha256  TEXT NOT NULL,
    qgroup         TEXT NOT NULL CHECK (qgroup IN
                     ('S','E','N','C','V','O','R','Attr','Prev')),
    question       TEXT NOT NULL,
    answer         TEXT NOT NULL,
    keyframes_s    TEXT,
    frame_times_s  TEXT NOT NULL,
    model          TEXT NOT NULL,
    prompt_name    TEXT NOT NULL,
    prompt_version INTEGER NOT NULL,
    mlflow_run_id  TEXT,
    latency_ms     INTEGER,
    prompt_tokens  INTEGER,
    completion_tokens INTEGER,
    truncated      INTEGER DEFAULT 0,
    created_at     TEXT,
    UNIQUE (clip_id, shot, source_sha256, qgroup, prompt_version)
);

-- What was actually sent, version by version. `vlm/prompts.py` only ever holds
-- the current text, so once a prompt is edited the old wording is gone from the
-- code -- and with it any way to read what produced the older drafts. This table
-- keeps the real sent text, which is what makes two versions comparable at all.
CREATE TABLE IF NOT EXISTS prompt_versions (
    prompt_name    TEXT NOT NULL,
    prompt_version INTEGER NOT NULL,
    qgroup         TEXT NOT NULL,
    group_name     TEXT,
    question       TEXT NOT NULL,
    prompt_text    TEXT NOT NULL,
    max_tokens     INTEGER,
    model          TEXT,
    first_seen     TEXT,
    PRIMARY KEY (prompt_name, prompt_version, qgroup)
);

CREATE TABLE IF NOT EXISTS qa_annotations (
    draft_id     TEXT NOT NULL,
    annotator_id TEXT NOT NULL,
    verdict      TEXT NOT NULL CHECK (verdict IN
                   ('AGREE', 'NOT_ANSWERABLE', 'DISAGREE')),
    reason_code  TEXT,
    reason_note  TEXT,
    question     TEXT,
    answer       TEXT,
    keyframes_s  TEXT,
    revealed_at  TEXT,
    annotated_at TEXT,
    PRIMARY KEY (draft_id, annotator_id)
);

CREATE TABLE IF NOT EXISTS clip_labels (
    clip_id      TEXT NOT NULL,
    shot         INTEGER NOT NULL,
    annotator_id TEXT NOT NULL,
    difficulty   TEXT CHECK (difficulty IN ('easy', 'medium', 'high')),
    event_label  TEXT CHECK (event_label IN ('accident', 'near-miss')),
    labeled_at   TEXT,
    PRIMARY KEY (clip_id, shot, annotator_id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_shot ON qa_drafts(clip_id, shot);
CREATE INDEX IF NOT EXISTS idx_ann_annotator ON qa_annotations(annotator_id);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def tx():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with tx() as c:
        c.executescript(SCHEMA)


def draft_id(clip_id: str, shot: int, sha: str, qgroup: str, version: int) -> str:
    """Identity from content, never from a file path.

    `trimmed/` is rewritten whenever the reviewer re-approves, so a stored path
    goes stale without saying so (CLAUDE.md decision log). Hashing the source
    instead means a genuinely re-cut shot produces new drafts rather than
    silently re-labelling the old ones -- the sha is stable across a re-cut with
    identical in/out points, so only a real change is visible as one.
    """
    key = f"{clip_id}|{shot}|{sha}|{qgroup}|{version}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


# ── annotators ───────────────────────────────────────────────────────────

def upsert_annotator(annotator_id: str, name: str, team: str) -> None:
    if team not in ("A", "B"):
        raise ValueError(f"team must be A or B, got {team!r}")
    with tx() as c:
        c.execute(
            "INSERT INTO annotators (annotator_id, name, team, created_at)"
            " VALUES (?,?,?,?) ON CONFLICT(annotator_id) DO UPDATE SET"
            " name=excluded.name, team=excluded.team",
            (annotator_id, name, team, now()))


def list_annotators(team: str | None = None) -> list[dict]:
    q = "SELECT * FROM annotators"
    args: tuple = ()
    if team:
        q += " WHERE team = ?"
        args = (team,)
    with tx() as c:
        return [dict(r) for r in c.execute(q + " ORDER BY team, name", args)]


# ── drafts ───────────────────────────────────────────────────────────────

def import_drafts(rows: list[dict]) -> tuple[int, int]:
    """Insert draft rows, skipping ones already stored. Returns (added, skipped).

    `INSERT OR IGNORE` against the UNIQUE key is what makes the batch runner
    resumable: killing it mid-run and starting again re-reads the same JSONL and
    adds only what is missing, rather than duplicating every row it already had.
    """
    added = 0
    with tx() as c:
        for r in rows:
            # Recorded even when the draft itself is a duplicate: a re-import
            # must still be able to restore the prompt text for a version whose
            # wording no longer exists anywhere in the code.
            if r.get("prompt_text"):
                c.execute(
                    "INSERT OR IGNORE INTO prompt_versions (prompt_name,"
                    " prompt_version, qgroup, group_name, question, prompt_text,"
                    " max_tokens, model, first_seen) VALUES (?,?,?,?,?,?,?,?,?)",
                    (r["prompt_name"], r["prompt_version"], r["qgroup"],
                     r.get("group_name"), r["question"], r["prompt_text"],
                     r.get("max_tokens"), r.get("model"), r.get("at")))
            if r.get("qgroup") not in QGROUPS:
                # The probe files in vlm/data/output/ carry clip_id, shot and
                # source_sha256 but no qgroup; without this they would import
                # as 33 bogus drafts (features/qa-draft-annotation/conflicts.md #1).
                raise ValueError(
                    f"row has no valid qgroup ({r.get('qgroup')!r}) -- "
                    f"is this a draft file or an old probe file?")
            did = draft_id(r["clip_id"], r["shot"], r["source_sha256"],
                           r["qgroup"], r["prompt_version"])
            cur = c.execute(
                "INSERT OR IGNORE INTO qa_drafts (draft_id, clip_id, shot,"
                " source_sha256, qgroup, question, answer, keyframes_s,"
                " frame_times_s, model, prompt_name, prompt_version,"
                " mlflow_run_id, latency_ms, prompt_tokens, completion_tokens,"
                " truncated, created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (did, r["clip_id"], r["shot"], r["source_sha256"], r["qgroup"],
                 r["question"], r["answer"],
                 json.dumps(r.get("keyframes_s") or [], ensure_ascii=False),
                 json.dumps(r["frame_times_s"]), r["model"], r["prompt_name"],
                 r["prompt_version"], r.get("mlflow_run_id"), r.get("latency_ms"),
                 r.get("prompt_tokens"), r.get("completion_tokens"),
                 int(bool(r.get("truncated"))), now()))
            added += cur.rowcount
    return added, len(rows) - added


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in
            Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def prompt_versions() -> list[dict]:
    """Every prompt version ever sent, with the text as it was actually sent."""
    order = " ".join(f"WHEN '{g}' THEN {i}" for i, g in enumerate(QGROUPS))
    with tx() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM prompt_versions"
            f" ORDER BY prompt_version DESC, CASE qgroup {order} END")]


def shots_with_drafts() -> list[dict]:
    """Every (clip, shot) that has drafts, with how far annotation has got."""
    with tx() as c:
        return [dict(r) for r in c.execute(
            "SELECT d.clip_id, d.shot, d.source_sha256,"
            "       count(*) AS n_drafts,"
            "       count(a.draft_id) AS n_done"
            " FROM qa_drafts d"
            " LEFT JOIN qa_annotations a ON a.draft_id = d.draft_id"
            " GROUP BY d.clip_id, d.shot, d.source_sha256"
            " ORDER BY d.clip_id, d.shot")]


def drafts_for(clip_id: str, shot: int, annotator_id: str | None = None) -> list[dict]:
    """The nine drafts of one shot, each with this annotator's verdict if any."""
    order = " ".join(f"WHEN '{g}' THEN {i}" for i, g in enumerate(QGROUPS))
    with tx() as c:
        rows = c.execute(
            "SELECT d.*, a.verdict, a.reason_code, a.reason_note,"
            "       a.question AS edited_question, a.answer AS edited_answer,"
            "       a.keyframes_s AS human_keyframes_s, a.revealed_at,"
            "       a.annotated_at"
            " FROM qa_drafts d"
            " LEFT JOIN qa_annotations a"
            "        ON a.draft_id = d.draft_id AND a.annotator_id = ?"
            " WHERE d.clip_id = ? AND d.shot = ?"
            f" ORDER BY CASE d.qgroup {order} END",
            (annotator_id, clip_id, shot)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["frame_times_s"] = json.loads(d["frame_times_s"] or "[]")
        d["keyframes_s"] = json.loads(d["keyframes_s"] or "[]")
        d["human_keyframes_s"] = json.loads(d["human_keyframes_s"] or "[]")
        out.append(d)
    return out


# ── annotations ──────────────────────────────────────────────────────────

def save_annotation(draft_id_: str, annotator_id: str, verdict: str, *,
                    reason_code: str | None = None, reason_note: str | None = None,
                    question: str | None = None, answer: str | None = None,
                    keyframes_s: list[float] | None = None,
                    revealed: bool = False) -> None:
    """One annotator's judgement on one draft. Re-saving overwrites their own row
    and nobody else's -- the primary key is the pair, so two people annotating the
    same draft produce two rows, which is the whole point."""
    if verdict not in VERDICTS:
        raise ValueError(f"verdict must be one of {VERDICTS}, got {verdict!r}")
    if verdict == "DISAGREE":
        if reason_code not in REASONS:
            raise ValueError(f"DISAGREE needs a reason from {REASONS}")
        if reason_code == "khác" and not (reason_note or "").strip():
            raise ValueError("reason 'khác' needs a note saying what was wrong")
    with tx() as c:
        c.execute(
            "INSERT INTO qa_annotations (draft_id, annotator_id, verdict,"
            " reason_code, reason_note, question, answer, keyframes_s,"
            " revealed_at, annotated_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(draft_id, annotator_id) DO UPDATE SET"
            " verdict=excluded.verdict, reason_code=excluded.reason_code,"
            " reason_note=excluded.reason_note, question=excluded.question,"
            " answer=excluded.answer, keyframes_s=excluded.keyframes_s,"
            " revealed_at=COALESCE(qa_annotations.revealed_at, excluded.revealed_at),"
            " annotated_at=excluded.annotated_at",
            (draft_id_, annotator_id, verdict, reason_code, reason_note,
             question, answer,
             json.dumps(keyframes_s or [], ensure_ascii=False),
             now() if revealed else None, now()))


def save_clip_label(clip_id: str, shot: int, annotator_id: str,
                    difficulty: str, event_label: str) -> None:
    if difficulty not in DIFFICULTIES:
        raise ValueError(f"difficulty must be one of {DIFFICULTIES}")
    if event_label not in EVENT_LABELS:
        raise ValueError(f"event_label must be one of {EVENT_LABELS}")
    with tx() as c:
        c.execute(
            "INSERT INTO clip_labels (clip_id, shot, annotator_id, difficulty,"
            " event_label, labeled_at) VALUES (?,?,?,?,?,?)"
            " ON CONFLICT(clip_id, shot, annotator_id) DO UPDATE SET"
            " difficulty=excluded.difficulty, event_label=excluded.event_label,"
            " labeled_at=excluded.labeled_at",
            (clip_id, shot, annotator_id, difficulty, event_label, now()))


def clip_label(clip_id: str, shot: int, annotator_id: str) -> dict | None:
    with tx() as c:
        r = c.execute(
            "SELECT difficulty, event_label FROM clip_labels"
            " WHERE clip_id=? AND shot=? AND annotator_id=?",
            (clip_id, shot, annotator_id)).fetchone()
    return dict(r) if r else None


# ── consensus ────────────────────────────────────────────────────────────

def _majority(counts: dict[str, int]) -> tuple[str | None, int, int]:
    """(winner, votes_for_it, total). Winner is None on a tie.

    A tie is reported rather than broken. Picking one arbitrarily would turn
    disagreement into a fact and hide the item from the adjudication pass that
    DC.pdf step 8 sends it to.
    """
    total = sum(counts.values())
    if not total:
        return None, 0, 0
    top = max(counts.values())
    winners = [k for k, v in counts.items() if v == top]
    return (winners[0] if len(winners) == 1 else None), top, total


def label_consensus(clip_id: str, shot: int) -> dict:
    """Every annotator's difficulty/event for one shot, plus the majority.

    This is the shot-level half of inter-annotator agreement (DC.pdf steps 6-7).
    `pipeline.db` cannot answer it: `reviews` is keyed by clip alone, so it holds
    exactly one opinion and has nowhere to put a second.
    """
    with tx() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT l.annotator_id, a.name, a.team, l.difficulty, l.event_label,"
            " l.labeled_at FROM clip_labels l"
            " LEFT JOIN annotators a ON a.annotator_id = l.annotator_id"
            " WHERE l.clip_id=? AND l.shot=? ORDER BY l.labeled_at",
            (clip_id, shot))]

    out = {"votes": rows, "n": len(rows)}
    for field in ("difficulty", "event_label"):
        counts: dict[str, int] = {}
        for r in rows:
            if r[field]:
                counts[r[field]] = counts.get(r[field], 0) + 1
        winner, votes, total = _majority(counts)
        out[field] = {
            "counts": counts,
            "majority": winner,
            "votes": votes,
            "total": total,
            # Unanimous only counts when at least two people actually voted;
            # one annotator agreeing with themselves is not agreement.
            "unanimous": bool(winner and total >= 2 and votes == total),
            "tied": bool(total and winner is None),
        }
    return out


def verdict_consensus(clip_id: str, shot: int) -> list[dict]:
    """Per draft of one shot: how each annotator judged it, and the majority."""
    drafts = drafts_for(clip_id, shot)
    with tx() as c:
        rows = [dict(r) for r in c.execute(
            "SELECT a.draft_id, a.annotator_id, a.verdict, a.reason_code"
            " FROM qa_annotations a JOIN qa_drafts d ON d.draft_id = a.draft_id"
            " WHERE d.clip_id=? AND d.shot=?", (clip_id, shot))]

    by_draft: dict[str, list[dict]] = {}
    for r in rows:
        by_draft.setdefault(r["draft_id"], []).append(r)

    out = []
    for d in drafts:
        votes = by_draft.get(d["draft_id"], [])
        counts: dict[str, int] = {}
        for v in votes:
            counts[v["verdict"]] = counts.get(v["verdict"], 0) + 1
        winner, n, total = _majority(counts)
        out.append({
            "draft_id": d["draft_id"], "qgroup": d["qgroup"],
            "votes": votes, "counts": counts, "majority": winner,
            "n_votes": n, "total": total,
            "tied": bool(total and winner is None),
        })
    return out


# ── reporting ────────────────────────────────────────────────────────────

def verdict_summary() -> list[dict]:
    """Per question group: how often the draft was accepted, and how it failed.

    This is the table that says which of the nine groups the model is actually
    usable on, which is what decides where annotation effort goes next.
    """
    with tx() as c:
        return [dict(r) for r in c.execute(
            "SELECT d.qgroup,"
            " sum(a.verdict = 'AGREE') AS agree,"
            " sum(a.verdict = 'NOT_ANSWERABLE') AS not_answerable,"
            " sum(a.verdict = 'DISAGREE') AS disagree,"
            " count(a.draft_id) AS annotated,"
            # DISTINCT because the join fans out: a draft judged by two
            # annotators is two rows but still one draft. Without it the
            # denominator grows as annotation progresses.
            " count(DISTINCT d.draft_id) AS drafts"
            " FROM qa_drafts d"
            " LEFT JOIN qa_annotations a ON a.draft_id = d.draft_id"
            " GROUP BY d.qgroup")]


def reason_summary() -> list[dict]:
    with tx() as c:
        return [dict(r) for r in c.execute(
            "SELECT d.qgroup, a.reason_code, count(*) AS n"
            " FROM qa_annotations a JOIN qa_drafts d ON d.draft_id = a.draft_id"
            " WHERE a.verdict = 'DISAGREE'"
            " GROUP BY d.qgroup, a.reason_code ORDER BY n DESC")]
