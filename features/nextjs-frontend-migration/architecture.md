# Architecture — Next.js frontend migration

**Status:** first pass scaffolded and running · **Updated:** 2026-09-22

Governed by `CLAUDE.md`. Where this document and the constitution disagree, the
constitution wins.

---

## 1. The one open question: how does Node reach `pipeline.db` and `run_pipeline.py`?

Three options were on the table, per the task brief:

1. Next.js API routes shell out to small Python helper scripts per operation.
2. A lightweight Python sidecar process the Next.js backend talks to over a
   local port.
3. A Node SQLite driver reading the same WAL file directly.

**Chosen: option 2 — a Python sidecar (FastAPI + uvicorn), bound to
`127.0.0.1` only, at `sidecar/main.py`.**

### Why not option 3 (Node reads the DB directly)

`pipeline.db` is not just rows. Two thirds of what the Review tab needs to do
is business logic that already lives in Python and is deliberately kept out
of `app.py` so it can be exercised without Streamlit:

- `vqa/trim.py` — mark-cut, the pad-shrink ladder, conflict detection,
  auto-resolve. Several rounds of real bugs (`TODO.md`: "Mark cut always
  collided", "Cannot auto-adjust said nothing") came from getting this
  geometry wrong. Reimplementing it in TypeScript means maintaining two
  copies of the same shrink-ladder math and hoping they never drift.
- `vqa/review.py` — `materialize()` and `discard()` don't just write rows,
  they run `ffmpeg` (via `vqa/media.py`) to cut segments and manage
  `trimmed/`. A Node SQLite driver would still need to shell out to Python
  (or reimplement `ffmpeg` invocation) for the one action that actually
  matters — Approve.
- `vqa/db.py`'s write helpers encode real invariants: `insert_clip` is an
  UPSERT (not `INSERT OR REPLACE`) specifically so a re-run doesn't wipe a
  reviewer's trim; `remove_video`'s status check lives *inside* the DELETE
  because `run_pipeline.py` is a separate process that can move a row
  between the check and the write. A second SQL implementation in
  `better-sqlite3` would have to re-derive every one of these from scratch,
  in a second language, without the existing tests.

Reading rows directly from Node for a list view would be fine in isolation.
But since almost every real action (Approve, Reject, remove-from-queue,
retry) needs the Python logic anyway, a direct DB driver would leave Node
doing reads only, with a second channel required for every write — two
channels to keep in sync instead of one.

### Why not option 1 (spawn a Python script per request)

Same logic reuse as the sidecar, but paying process-startup cost (interpreter
boot, module import) on every single click, and losing the one thing a
persistent process gives for free: an in-memory handle to the running
`run_pipeline.py` subprocess. `app.py` keeps that handle in
`st.session_state` because Streamlit reruns the whole script per interaction;
a per-request script has no equivalent, and would need to keep re-discovering
which PID is `run_pipeline.py`. A long-lived sidecar just holds the
`subprocess.Popen` object as a module global, which is simpler than what
`app.py` had to do, not more complex.

### Why the sidecar is not a "second writer" in the sense `TODO.md` warns about

`vlm/`'s read-only rule exists because that path was tempted to invent *new*
write logic (or a stored file path that goes stale) alongside the reviewer.
The sidecar does not do that: it imports `vqa.db`, `vqa.review`, `vqa.trim`,
`vqa.media`, `vqa.config`, `vqa.urls` and calls the exact same functions
`app.py` already calls. No new SQL is written anywhere under `sidecar/`.

Two Python **processes** (`app.py` and the sidecar) each calling
`vqa.db.connect()` concurrently is not a new failure mode — it is the
existing architecture. `run_pipeline.py` and `app.py` already do this today:
both open independent connections against the same file, both rely on
`journal_mode=WAL` + `busy_timeout=30000` set inside `vqa/db.py:connect()`,
and every write goes through `vqa.db`'s helpers, which already assume they
can be called from a different process than the one currently reading. The
sidecar adds a third such process, using the same connection helper, the same
timeout, the same UPSERT/DELETE-with-status-guard patterns. Nothing in
`vqa/db.py` needed to change, and nothing did.

**Boundary, made explicit:** `sidecar/` may import `vqa/`. `vqa/` never
imports `sidecar/`. This mirrors the `vlm/` boundary already in `CLAUDE.md`.
Unlike `vlm/`, the sidecar *does* write — because unlike VLM annotation, the
Review/Queue tabs' entire job is to write review decisions and queue changes.
The safety property it preserves is narrower and correct for this case: no
new write *logic*, only new **callers** of write logic that was already
designed to be called from more than one process.

### What the sidecar does NOT do

- It does not read or write `vlm/data/output/*.jsonl` or import `vlm/`.
- It does not touch `tests/` or change any `AppTest`-driven test.
- It does not change `vqa/db.py`'s schema, SQL, or write path in any way.

---

## 2. Process topology

```
┌─────────────────────┐        ┌──────────────────────┐
│ frontend/ (Next.js)  │  HTTP  │ sidecar/main.py       │
│ npm run dev :3000    │──────▶│ uvicorn :8787          │
│ Route handlers proxy │        │ (127.0.0.1 only)      │
│ JSON to the sidecar; │        │ imports vqa/ directly  │
│ stream video files   │        └──────────┬────────────┘
│ from disk themselves │                   │ spawns (Start)
└──────────┬───────────┘                   ▼
           │ reads file bytes      ┌──────────────────┐
           │ directly (Range)      │ run_pipeline.py   │
           ▼                       │ (subprocess)      │
     work/<id>/delivered/*.mp4     └─────────┬─────────┘
     work/<id>/trimmed/*.mp4                 │ writes
                                              ▼
                                     ┌──────────────────┐
                                     │ pipeline.db       │
                                     │ SQLite, WAL       │
                                     └──────────────────┘
                                              ▲
                                              │ reads/writes
                                     sidecar.main (same as app.py did)
```

Video **files** are streamed by a Next.js route handler reading the local
disk path directly (`fs.createReadStream` with HTTP Range support for
scrubbing) — the sidecar only needs to hand back the path string from the
clip row. This keeps the sidecar JSON-only and avoids proxying large binary
streams through a second hop. Both processes run on the same machine reading
the same local filesystem, exactly as `app.py`'s `st.video(path)` did.

`app.py` is untouched and still fully functional; running both UIs against
the same `pipeline.db` at once is supported by the existing WAL setup (this
is the same situation as `app.py` + `run_pipeline.py` today), though running
the pipeline run/stop controls from *both* UIs at the same time is not
something either UI guards against — same as today, only one Start should be
clicked from anywhere.

## 3. Sidecar API surface

All endpoints are plain JSON, no auth, bound to `127.0.0.1:8787`. This
matches the security posture already accepted for the VLM llama.cpp server
(`architecture.md` §15: "bound to `127.0.0.1` only ... do not change that to
`0.0.0.0`").

| Endpoint | Wraps |
|---|---|
| `GET /videos` | `db.list_videos()` |
| `POST /videos/enqueue` | `urls.parse_lines` + `db.enqueue_many` |
| `POST /videos/{id}/remove` | `review.purge_video` |
| `POST /videos/retry/{status}` | `db.retry_status` |
| `POST /videos/mark-stopped` | `db.mark_stopped` |
| `GET /run/status` | `busy` state + `db.list_videos()` progress + log tail |
| `POST /run/start` | spawns `run_pipeline.py`, same venv-python lookup as `app.py` |
| `POST /run/stop` | `proc.terminate()` → `wait(10)` → `kill()`, then `db.mark_stopped()` — same ordering as `app.py`, because that ordering is what fixed the STOPPED-state bug |
| `GET /review/next` | reproduces `app.py`'s TOP-then-LOW queue pick + initial shot state (`trim.whole_clip` or existing `trim_segments`) |
| `POST /review/{clip_id}/decision` | `review.materialize` (APPROVED) / `review.discard` (REJECTED) / no-op (FLAGGED), then `db.set_decision` |
| `POST /trim/mark`, `/trim/add`, `/trim/resolve`, `/trim/reshape`, `/trim/validate` | stateless wrappers around `vqa/trim.py`'s pure functions — the frontend owns the shot list in React state and calls these on every interaction, the same shape as `app.py`'s `_set()` pattern |

The `/trim/*` endpoints are deliberately stateless RPC over pure functions,
not a session. `trim.py`'s functions already take the current shot list and
return a new one — that is exactly what a stateless HTTP call wants, and it
is why `trim.py`'s own module docstring says it is kept out of `app.py` "so
the rules can be exercised without starting Streamlit." This is that reuse,
now exercised over HTTP instead of `pytest`.

## 4. What this buys vs. Streamlit's `st.session_state` tricks

Streamlit's widget-versioning trick (`rm_pick_{rev}`, `s_{cid}_{rev}_{i}`)
exists because Streamlit re-renders a widget from its `key=`'d prior state,
ignoring a new `value=`. React has no such trap — `useState` is simply
overwritten on every render — so the Next.js Review tab does not need an
equivalent workaround. This is a genuine simplification, not just a
framework swap; it is called out here so nobody re-derives the versioning
hack in TypeScript by mistake.

## 5. Known gaps, stated so they aren't discovered by surprise later

- The sidecar's `/run/*` endpoints hold the subprocess handle as a module
  global. If the sidecar process itself is restarted while a run is active,
  that handle is lost, the same way it would be lost if a Streamlit session
  ended — `db.mark_stopped()`'s manual "stranded" recovery path in the Queue
  tab covers this, ported as-is.
- No auth on the sidecar. Acceptable per the same reasoning already recorded
  for the VLM server: single user, single machine, bound to loopback only.
- This first pass does not yet replace `app.py`. Both can run concurrently
  against `pipeline.db`; `app.py` remains the reviewer's real interface until
  the Next.js frontend reaches parity and is deliberately cut over.
