# CLAUDE.md — VQA-VN-Traffic-2026

Vietnamese traffic video dataset for VQA. Current phase: **YouTube compilations → clean short
clips** — done and verified. **Phase 2 opened 2026-09-05: VLM-assisted QA annotation**, a
self-hosted Qwen3-VL-2B server behind an HTTP API in `vlm/` + `docker/`.

Design docs: [`architecture.md`](./architecture.md) · [`TODO.md`](./TODO.md)

---

## CONSTITUTION — Preprocessing Pipeline

**This section is the source of truth for decision-making. If a question isn't explicitly
covered, default to "ship it" and move on.**

### Principles

1. **This is a preprocessing pipeline, NOT an annotation platform.**
   - Goal: produce candidate clips for later review
   - Perfection is not required at this stage
   - Rough cuts are acceptable — human review exists to clean up

2. **Ship it, don't polish it.**
   - If it works 80% of the time on 80% of videos, it's good enough
   - Edge cases are handled by the review tool, not by making the detector smarter
   - Default parameters are fine — don't tune thresholds unless proven necessary

3. **Do not overthink things that don't matter for this phase:**
   - Exact number of videos to crawl → just grab enough, ~50 is fine
   - Boundary P/R/F1 benchmarks → not needed until evaluation phase
   - Optimal parameters → use PySceneDetect defaults
   - Review UI polish → ugly but functional is the goal
   - Multi-machine coordination → not needed (single user, single machine)

4. **Keep the scope tight.**
   - If a feature isn't required to get clips out, defer it
   - If it adds >1 day of work, question whether you really need it
   - The review tool is where quality happens, not the pipeline

5. **Progress over perfection.**
   - A working pipeline that produces clips is better than a perfect pipeline that never ships
   - You can always iterate after seeing real outputs

### Decision Log

| Decision | Choice |
|---|---|
| Tech stack | **SUPERSEDED 2026-09-22 — see below.** Was: Streamlit + Python (no FastAPI, no JS framework, no separate web server). |
| Tech stack (frontend), 2026-09-22 | **Next.js**, dark mode + minimalist theme, replacing the Streamlit UI. Reverses the row above deliberately, after the cost was stated explicitly (invalidates the `AppTest`-based test suite in §Repo rules below; needs a new backend tier for `pipeline.db`/`run_pipeline.py` access). Migration in progress under `features/nextjs-frontend-migration/`. |
| `app.py` (Streamlit), 2026-09-22 later same day | **Frozen legacy.** User: "bỏ legacy cũ streamlit... frozen legacy" — reverses the note above ("`app.py` remains the real interface until migration ships"). No new features go into `app.py` from here on, including ones already in flight (e.g. the anonymize-trimmed-clips trigger went into the Next.js/sidecar side instead, never added to `app.py`). Existing 66 `AppTest` tests keep running as a regression net for what's already there, but `app.py` itself is not a target for further work. All new UI work targets the Next.js frontend + `sidecar/`. |
| Review mode | Triage — Approve / Reject / Flag. **No Skip**: a decision is required to advance. |
| Segmentation | **PySceneDetect only**, defaults. Counter/OCR fusion removed 2026-08-29: the real counter is transient, and a mis-detected one made the two signals correlated. All boundaries are `MEDIUM`. |
| Overlay removal | Blur + desaturate + darken (toggleable), over **calibrated regions + always-on fixed bands** |
| Headless mode | Yes, clips marked `UNREVIEWED` |
| Config | Streamlit sidebar widgets (no separate config file editing) |
| Output | Local disk only (no Drive upload) |
| Review order | Clip duration: `>15s` = TOP priority, drains before LOW |
| Reviewer output | `trimmed/` is the finished product. Approve writes it (one file per shot, up to 3); Reject deletes only from there. |
| Cut rule | Impact → impact + 5s (`GUIDE.md` §2.4). Dataset policy, not architecture. |
| Trim UI | **Mark cut** (playhead → `impact ± pad`) + visual timeline. Max 3 shots. Overlaps auto-shrink ±5s→±1s, then refuse; a conflict blocks Approve. |
| Queue removal | Removable = the states the runner is done with: `QUEUED` / `DOWNLOAD_FAILED` / `FAILED` / `STOPPED`. Status checked inside the `DELETE`, since the runner is another process. Go through `review.purge_video()` — a `STOPPED` video can own clips *and* approved files in `trimmed/`. The download itself is never deleted. |
| Stop | Marks in-flight rows `STOPPED`, after `proc.wait()` — a dying runner overwrites the status otherwise. `STOPPED` is both resumable and removable. Rows stranded by a crash get a separate manual button; never reconcile automatically, since `busy` is per-session and another tab may be running. |
| Run monitoring | `st.fragment(run_every=2)`. Never poll at app scope: Streamlit runs every tab's body, so it restarts the reviewer's video player. |
| Crawl target | ~50 videos, ~1200–1500 clips expected |
| VLM runtime | **llama.cpp `server-cuda` in Docker, pinned by digest**, Qwen3-VL-2B-Instruct Q4_K_M + mmproj FP16. Measured 2026-09-05: 2.7 GB VRAM of 6, 4 keyframes = 1378 tokens of a 4096 context, ~3–7s warm. Bound to `127.0.0.1` only — llama.cpp has no auth and enables CORS `*`. |
| VLM input | **`trimmed/` of APPROVED clips only** (30 shot files / 27 clips). Never `clips/` (unblurred masters) or `delivered/` (105 UNREVIEWED). |
| VLM identity | Records key on **`clip_id` + `shot` + `source_sha256`, never a file path.** The reviewer deletes from `trimmed/` on Reject, so a stored path goes stale silently; a hash makes a re-cut visible. |
| VLM writes | **`vlm/data/output/*.jsonl` only.** `pipeline.db` is opened `mode=ro` and guarded by `tests/test_vlm_isolation.py`. |
| VLM proposes answers | **Yes — accepted 2026-09-05 against the methodology in `docs/`.** The VLM drafts answers, not just questions. Cost, stated once and not to be relitigated: a draft answer anchors annotators, so κ between two annotators weakens, and Gate B measures a model on labels a model helped write. Mitigation kept: drafts live outside `pipeline.db` and never enter `reviews`. |
| Keyframes | 4 per shot, **clustered around the middle** where `impact ± pad` puts the collision — not spread evenly. Even spacing lands ~9s from impact on the longest clip (29s). |
| Label backlog, 2026-10-01, scoped to trimmed/ 2026-10-02 | Clips decided before `difficulty`/`event_label` existed (added in `cc9aa87`) are found by **`reviews.difficulty IS NULL OR reviews.event_label IS NULL` on an already-decided row**, not a download-date cutoff — a date is arbitrary and this isn't. **Scoped to clips actually materialized into `trimmed/`** (`clips.trim_segments IS NOT NULL`, file existence re-checked on disk since the column can go stale) — a REJECTED clip has no `trimmed/` output and is dataset-irrelevant, so it's excluded from the backlog entirely. `scripts/query_missing_labels.py --trimmed-only` reports it; the **Relabel** tab (`frontend/src/app/relabel/`, `GET`/`POST /relabel/*` in `sidecar/main.py`) backfills labels one clip at a time without re-opening the Approve/Reject/Flag decision. Video shown is always `trimmed/`, never the anonymize sweep's `finished/` copy, even when `finished/` exists — `finished/` is written by `cv2.VideoWriter_fourcc(*"mp4v")` (MPEG-4 Part 2), which no browser decodes natively; confirmed via `ffprobe` (`finished/` → `codec_name=mpeg4`, `trimmed/` → `codec_name=h264`). A real, pre-existing gap in the anonymize pipeline, invisible until something tried to play `finished/` directly in a browser. |
| `finished/` codec + layout, 2026-10-04 | **`process_video()` now writes H.264 directly**: blur/detect still write via `cv2.VideoWriter_fourcc(*"mp4v")` to a raw temp file (the one fourcc guaranteed to work without extra system codecs), then `vqa/media.transcode_h264()` re-encodes that to H.264/AAC+faststart before the atomic rename — so every *new* `/anonymize/start` run is browser-playable with no follow-up step. `vqa/anonymize.fix_finished_codec()` (`scripts/fix_finished_codec.py`) remains only as a one-off historical cleanup for files written before this fix; already run once, all pre-existing files are H.264. **Location also changed**: output is now a single flat `finished/` folder at the repo root, sibling to `work/` — not `work/<video_id>/finished/`, and no per-video subfolder under `finished/` either (clip filenames already start with their `video_id`, so flat stays collision-free). `frontend/src/app/api/media/[...path]/route.ts`'s `ALLOWED_ROOTS` includes `"finished"` so it can still be streamed. Relabel's "always `trimmed/`, never `finished/`" choice above (Label backlog row) is intentionally unchanged regardless of this fix — it still has to work for any `finished/` file that predates it, and has no reason to depend on anonymize having run at all. |

---

## Working agreements

- **One app, one process — superseded 2026-09-22, mid-migration.** `streamlit run app.py`
  was the entire interface. It is being replaced by a Next.js frontend (Decision Log); until
  that migration ships, `app.py` is still the real reviewer interface and must keep working.
- **Don't add a layer** — two exceptions now. (1) granted 2026-09-05: the VLM server is a
  Docker container with an HTTP API, because a GGUF model cannot live inside a Streamlit
  process; bounded so `vlm/` may import `vqa/`, **never the reverse**, and `vlm/` opens
  `pipeline.db` read-only. (2) granted 2026-09-22: the Next.js frontend needs its own backend
  tier for `pipeline.db` and `run_pipeline.py` access — design and document that boundary in
  `features/nextjs-frontend-migration/architecture.md` rather than improvising it per-route.
- **Don't propose benchmarks, tuning campaigns, or coordination mechanisms** for this phase —
  they are explicitly out of scope per Principle 3.
- **`python -m pytest tests -q` before calling anything done.** 66 tests, ~10s,
  no ffmpeg and no network. They drive the real app through `AppTest`, which is
  the only way the widget-state and stranded-state bugs above were ever found.
- **Run the `quyen:ship-feature` skill for any feature or bug fix.** It routes the
  whole pipeline — grill → conflict gate → spec → decompose → TDD loop → verify →
  ship review — keeping its artefacts in `features/<slug>/`. It exists because
  features here break at the seam with what was already there.
- **Never walk past a BLOCK from `quyen:01_feature-conflict-audit`.** Run it on any
  proposed feature that touches shared state, reviewer outputs, the DB schema, or a
  recorded decision. Every serious bug here has been a new feature colliding with an
  existing default, owner or invariant — and none were found by reading code, only by
  running it.
- When a design question comes up that the constitution doesn't answer: pick the option that
  ships soonest, note the choice in a comment, and keep going.

---

## Repo rules the pipeline skills read

`quyen:ship-feature` is generic; these are this repo's specifics, and they outrank it.

- **Test command:** `python -m pytest tests -q`. Whole suite, not just your new file.
- **Drive the real app.** `streamlit.testing.v1.AppTest` against `app.py`, with
  `db.DB_PATH` monkeypatched to a tmp file. Every serious bug in this project was found
  by running the app; none by reading it.
- **Assert `not app.exception`** in every AppTest that clicks anything. A test that only
  checks the database passes happily while the page is showing a traceback — that is
  exactly how the `rm_pick` crash survived its first test.
- **Address widgets positionally** (`app.multiselect[0]`). Widget keys are versioned
  (`rm_pick_{rev}`, `s_{cid}_{rev}_{i}`) precisely so programmatic changes can reset them,
  so a test that pins a key pins something designed to change.
- **RED must name the bug.** `AppTest script run timed out after 30(s)` is a good RED.
- **Checkpoint before backing up the DB** — it runs in WAL mode, so an uncheckpointed
  copy is short:

  ```python
  with db.tx() as c:
      c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
  shutil.copy2("pipeline.db", backup)
  ```

- **Docs to fold up at step 08:** `architecture.md` for the mechanism and *why*, the
  Decision Log above for a choice worth not relitigating, `TODO.md`'s
  “Bugs found by testing” table for anything the tests caught, `GUIDE.md` for anything
  the operator now does differently.
- **Language:** the user writes Vietnamese; reply in Vietnamese. Code, comments, commit
  messages, docs and test names stay English.
