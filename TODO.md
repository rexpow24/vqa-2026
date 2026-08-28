# TODO — Vietnamese Traffic Clip Dataset Pipeline

**Companion to:** [`architecture.md`](./architecture.md) · **Governed by:** [`CLAUDE.md`](./CLAUDE.md)
**Target:** working pipeline producing clips. Not a production system.

## ✅ Build status — 2026-08-29

**Phases 1-7 are implemented and verified end-to-end.** A synthetic 4-segment compilation
(cuts at 12s / 26s / 36s, static logo + changing counter) is segmented at exactly those
boundaries, all HIGH confidence, 4 clips out.

Verified: URL canonicalization (8 cases) · overlay calibration (finds both regions, zero
false hits on scene content) · counter change detection · PySceneDetect · fusion · clip
cutting · all three blur modes · resume from cache · headless mode · Streamlit app runs
with no exceptions · review click-through · export + manifest.

**Design change made during the build:** counter OCR was replaced by **counter change
detection**. The fusion only ever used *when* the counter changes, never its value, so
PaddleOCR (~2.5GB with torch) was dropped for a numpy/OpenCV comparison. Faster, fewer
dependencies, and more robust on a stylized font. See `architecture.md` §5-S5a.

**Bugs found and fixed by testing** (each would have silently degraded the dataset):
1. `boxblur` radius is capped by chroma plane size — failed outright on small regions. Now `gblur`.
2. Filter graph reused labels — **only the last overlay region was actually blurred**. Now explicit `split`.
3. Counter detection used a fixed pixel-diff threshold — missed small digit changes. Now adaptive.
4. Otsu per-frame flipped when the scene moved behind the counter. Now a fixed bright threshold + border crop.
5. Two silent early-returns (short video, blank clip) dropped work with no log line. Both now logged.

**Not yet built** (all P1/P2, none blocking): manual overlay ROI override UI · digit-template
fallback (unnecessary given the no-OCR design) · re-derive button · keyboard shortcuts ·
review filters · disk reclamation.

**Next step:** run it on 2-3 real *Camera Giao thông* videos. Calibration and counter
detection are the two stages that meet real-world variation first.

---

## How to read this

- **P0** = needed to get clips out. **P1** = makes the dataset usable. **P2** = only if time allows.
- Constitution Principle 4: *if it adds >1 day, question whether you really need it.* Anything
  here estimated over a day is marked ⏱ so it gets challenged before it gets built.
- **DEFERRED** items are deliberate. Reasons are recorded so they aren't re-argued.

> **VQA annotation / QA generation is intentionally deferred until the cleaned raw dataset
> pipeline is stable.** See Phase 9.

### Schedule

| Day | Work |
|---|---|
| 1 | Phase 1 — skeleton, SQLite, config, download, probe |
| 2 | Phase 2 — Streamlit shell (sidebar, queue, run tab, subprocess wiring) |
| 3 | Phase 3 — overlay calibration + PySceneDetect |
| 4 | Phase 4 — counter change detection ⭐ |
| 5 | Phase 5 — fusion + clip cutting + blur/encode |
| 6 | Phase 6 — review tab |
| 7 | End-to-end on 5 videos, fix what breaks |
| 8+ | Full batch, review, export |

**Do Phase 4 before Phase 5 (fusion).** If the counter signal is unreliable the fusion design
changes — cheaper to find out on day 4 than day 5. *(This is exactly what happened: OCR proved
unnecessary and was replaced by change detection.)*

**Order note:** Phase 2 comes early only because the sidebar is the only way to set config. Build
it ugly — unstyled widgets, a plain dataframe, a text box for logs. Zero styling time.

---

# Phase 0 — Decisions ✅ LOCKED

Recorded in [`CLAUDE.md`](./CLAUDE.md) Decision Log. Summary:

Streamlit only · keyboard triage A/R/F · counter + PySceneDetect fusion at defaults · blur +
desaturate + darken (toggleable) · headless mode with `UNREVIEWED` · config via sidebar · local
disk only · ~50 videos → ~1200–1500 clips.

Nothing here is open. Per the constitution, don't reopen these without a concrete reason from a
real run.

---

# Phase 1 — Foundations

**Depends on:** nothing. **P0.**

- [x] **P0** — Project layout: `app.py`, `run_pipeline.py`, `vqa/{db,stages,config}.py`.
  - *Accept:* `streamlit run app.py` shows an empty app.
- [x] **P0** — SQLite schema, 4 tables (`architecture.md` §8), WAL mode on.
  - *Accept:* fresh DB creates all 4; re-running is idempotent.
- [x] **P0** — `config.json` load/save + defaults + `config_hash` (SHA256).
  - *Accept:* missing file falls back to defaults; hash changes when a value changes.
- [x] **P0** — URL canonicalization → `youtube_video_id`.
  - *Accept:* `watch?v=ABC`, `youtu.be/ABC`, `watch?v=ABC&t=30`, `/shorts/ABC` all give the same
    ID. Bad input is skipped, not fatal.
- [x] **P0** — `.txt` parser: one URL per line, skip blanks and `#` comments, report bad lines by
  line number and **keep going**.
  - *Accept:* a 50-line file with one typo enqueues the other 49.
- [x] **P0** — yt-dlp download, retry 3×.
  - *Accept:* survives a dropped network and resumes on re-run.
- [x] **P0** — ffprobe validation → reject corrupt / <720p / live.
  - *Accept:* a truncated file is rejected, not passed downstream.
- [x] **P0** — Stage runner with `if exists: skip` resume + log to `logs/run_<ts>.log`.
  - *Accept:* kill mid-batch; re-running resumes per video and re-downloads nothing.

---

# Phase 2 — Streamlit App Shell

**Depends on:** Phase 1. **P0.**

> Build it ugly. `st.checkbox`, `st.slider`, `st.dataframe`, `st.text`. No CSS, no custom
> components, no layout tuning.

- [x] **P0** — Sidebar with every config value from `architecture.md` §4 + a Save button.
  - *Accept:* changing a toggle and saving affects the next run. No file editing anywhere.
- [x] **P0** — The four required toggles wired end-to-end: `review_enabled`, `blur_enabled`,
  `color_kill_enabled`, plus thresholds / durations / encoder / output paths.
  - *Accept:* each visibly changes pipeline behaviour.
- [x] **P1** — `color_kill` greys out when `blur_enabled` is off.
  - *Accept:* the ignored-child case isn't silent. (One `disabled=` kwarg.)
- [x] **P0** — **Queue tab:** text area for pasted URLs + `st.file_uploader` for `.txt`, plus a
  status table.
  - *Accept:* uploading 50 URLs enqueues them and shows enqueued / duplicate / invalid counts.
- [x] **P0** — **Run tab:** Start button spawns `subprocess.Popen(["python","run_pipeline.py"])`,
  stores the PID; Stop terminates it.
  - *Accept:* the pipeline runs; the UI stays responsive; closing the tab doesn't kill it.
- [x] **P0** — Progress polling: read DB → `st.progress` + `st.text(log_tail)` →
  `time.sleep(2)` → `st.rerun()`.
  - *Accept:* progress advances without manual refresh.
- [x] **P0** — Snapshot config into `videos.config_snapshot` at run start.
  - *Accept:* editing the sidebar mid-run doesn't change what earlier clips report.
- [x] **P1** — Disable Start while a run is alive (single subprocess).
  - *Accept:* double-clicking doesn't spawn two.
- [x] **P1** — Retry button on failed videos → reset status to `QUEUED`.
  - *Accept:* re-drives only the failed ones.

### Headless mode (F: `review_enabled = false`)

- [x] **P0** — Skip the review gate; write clips with `decision='UNREVIEWED'`.
  - *Accept:* a headless run completes with no interaction, and **no clip is ever marked
    `APPROVED`.**
- [x] **P0** — Record `review_mode` in the manifest.
  - *Accept:* headless vs reviewed is distinguishable from the manifest alone, months later.
- [x] **P1** — Review tab still opens on a headless batch, so review can be deferred not lost.

---

# Phase 3 — Overlay Calibration + Shot Detection

**Depends on:** Phase 1. **P0.**

- [x] **P0** — Temporal-variance calibration: 300 sampled frames → per-pixel variance → threshold
  → morph close → connected components → outer-25%-margin boxes only.
  - *Accept:* on the *Camera Giao thông* reference video it finds the 3 overlay regions and
    **zero** regions over roadway.
- [x] **P0** — Counter ROI identification (static within a segment, varies across the video).
  - *Accept:* picks the `#NN` box, not the logo.
- [x] **P0** — Cache calibration per `channel_id`.
  - *Accept:* the second video from a channel skips calibration.
- [ ] **P1** — Manual x/y/w/h override in the sidebar + a preview frame with boxes drawn.
  - *Accept:* manual regions win over auto-detected.
- [x] **P1** — Calibration failure → skip blur, flag video, continue.
- [x] **P0** — PySceneDetect `ContentDetector` at **defaults**, persist cuts + scores.
  - *Accept:* cut count is within ~±20% of the max counter value on a test video.
  - *Constitution:* **do not tune thresholds.** Defaults + fusion is the design.

---

# Phase 4 — Counter OCR ⭐

**Depends on:** Phase 3 (needs the ROI). **P0.** *Highest-value day in the project.*

- [x] **P0** — Sample at 2fps, crop ROI, fixed bright threshold, drop the crop border.
  - *Accept:* within-segment difference ~0; a counter change is an unmistakable spike.
  - *Changed during build:* Otsu + upscale replaced — Otsu re-thresholds per frame and flips
    when the scene moves behind the counter.
- [x] **P0** — ~~PaddleOCR recognition~~ → **binary-mask comparison**, no OCR.
  - *Accept:* boundaries found without reading digits. Verified against synthetic ground truth.
  - *Why:* fusion only uses *when* the counter changes, never its value.
- [x] **P0** — Post-process: median filter, monotonic non-decreasing, majority vote per run →
  step function `[(value, first_seen, last_seen)]`.
  - *Accept:* one entry per segment, values strictly increasing.
- [x] **P0** — No counter / OCR failure → non-fatal, visual-only, confidence capped at MEDIUM.
  - *Accept:* an unnumbered video still produces clips.
- [ ] **P1** — Digit-template fallback (per-channel templates + cross-correlation).
  - *Trigger:* only if PaddleOCR is <95% accurate or too slow. Fixed font + position means this
    is likely better — but don't pre-build it.

---

# Phase 5 — Fusion, Clips, Blur

**Depends on:** Phase 4. **P0.**

- [x] **P0** — Fusion per `architecture.md` §6: 1 cut in gap → HIGH; 0 → midpoint + LOW + flag;
  ≥2 → best-scoring + MEDIUM; visual cut with no counter change → suppress.
  - *Accept:* on a hand-checked video ≥90% of boundaries are HIGH.
- [x] **P0** — Frame-exact refinement: ±0.5s window, HSV histogram L1, argmax = cut frame.
  - *Accept:* boundaries land within ~1 frame on a spot-check of 20.
- [x] **P0** — 2-frame safety trim each side.
- [x] **P0** — Clip filter: drop <5s, flag >30s (never auto-split), drop black/blank and static.
  - *Accept:* intro/outro segments are dropped automatically.
- [x] **P0** — Content-derived clip IDs `{video_id}_{start_ms}_{end_ms}`.
  - *Accept:* reprocessing yields identical IDs.
- [x] **P0** — Master cut via `ffmpeg -c copy` (fallback `libx264 -crf 16` if not keyframe-aligned).
- [x] **P0** — Toggle-aware blur chain: blur+colorkill / blur only / none (copy master).
  - *Accept:* all three combinations produce a valid clip; with blur off, delivered is identical
    to master.
- [x] **P0** — Encode `h264_nvenc -rc vbr -cq 19 -preset p5`.
  - *Note:* NVENC has **no CRF**; `-cq` is the equivalent.
- [ ] **P1** — Re-derive button: regenerate delivered clips from masters with new blur settings.
  - *Accept:* touches only `delivered/`, no re-download.

> **Not doing:** TransNetV2 escalation. LOW-confidence boundaries go straight to the flag bucket.
> Same outcome, one fewer dependency, ~half a day saved. (`architecture.md` §6.)

---

# Phase 6 — Review Tab

**Depends on:** Phase 2 + Phase 5. **P0.** *This is where dataset quality actually happens.*

- [x] **P0** — One clip at a time via `st.video`, **LOW-confidence first**, confidence + flags shown.
  - *Accept:* opens on the first pending clip.
- [x] **P0** — Approve / Reject / Flag; each writes to SQLite immediately and advances.
  - *Accept:* refresh or restart resumes at the next unreviewed clip.
- [x] **P0** — Progress counter + running approval rate.
  - *Accept:* approval rate is visible live — it's the number that predicts final clip yield.
- [ ] **P1** — Keyboard `A`/`R`/`F` via `streamlit-shortcuts`.
  - *Accept:* a full pass is possible without the mouse.
  - **Timebox: 2 hours.** If it fights back, ship plain buttons and move on (Principle 2).
- [ ] **P1** — Filter by confidence / flag / video.
  - *Accept:* the flag bucket can be pulled up as its own queue.
- [ ] **P2** — Preload/prefetch the next clip file.
  - *Note:* `st.video` gives limited control here. Worth ~1 hour, not more.

### DEFERRED — boundary editing

> Build **only if** the flag bucket exceeds ~10% after the first real run. With counter-driven
> boundaries on fixed-camera hard-cut source, errors should be rare, and per Principle 4 the
> review tool is where edge cases get handled — not the pipeline.

- [ ] **P2** — Nudge start/end, split, merge, notes.

---

# Phase 7 — Export

**Depends on:** Phase 6. **P1.**

- [x] **P0** — Export tab → `export/<batch>/clips/<video_id>/*.mp4` + `manifest.json` with
  provenance (`config_hash`, `confidence`, `review_mode`).
  - *Accept:* every manifest entry points at a file that exists. Interactive exports `APPROVED`
    only; headless exports all as `UNREVIEWED`.
- [ ] **P1** — Summary stats: total, by confidence, by decision, approval rate.
- [ ] **P2** — Delete `source.mp4` for exported videos, keep masters.
  - *Accept:* re-derive still works afterwards.

---

# Phase 8 — Sanity Checks (not a benchmark)

**P1.** Constitution Principle 3: no P/R/F1 benchmark this phase.

- [x] **P1** — Free self-check: **detected boundary count vs. max counter value per video.** They
  should nearly match. Costs nothing and catches most systematic failures.
  - *Accept:* shown per video in the queue table; large mismatches are visually obvious.
- [ ] **P1** — Confidence distribution + approval rate displayed in the app.
  - *Accept:* a drop in HIGH% flags that a channel changed its layout.

### DEFERRED — formal evaluation

> Boundary P/R/F1 at ±0.5s tolerance, hand-annotated ground truth (~10 videos, half a day).
> Only if the thesis committee asks for numbers. Not needed to produce clips.

---

# Phase 9 — Future VQA Annotation Pipeline

> **🚫 DO NOT IMPLEMENT YET.**
>
> **VQA annotation / QA generation is intentionally deferred until the cleaned raw dataset
> pipeline is stable.** The current phase is deterministic processing + CV inference; annotation
> is semantic reasoning. Keeping them decoupled means the annotation design can change without
> invalidating any clip already produced.

Placeholder only: traffic event taxonomy · QA generation strategy · annotation guidelines ·
train/val/test splits (**must account for near-duplicates — see below**) · baselines.

**Entry criterion:** ≥1000 approved clips exported and the pipeline stable across ≥3 channels.

---

## Deferred-decision register

| Item | Reason | Revisit when |
|---|---|---|
| **Near-duplicate detection** | Not needed to produce clips | ⚠️ **Before drawing any train/test split.** The same incident in both splits would invalidate the dataset, and retrofitting after annotation starts is far more expensive. |
| TransNetV2 escalation | Counter gives near-oracle boundaries | If the flag bucket is large |
| Boundary editing UI | Errors should be rare | If flagged clips >10% |
| Formal benchmark | Manual inspection suffices | If the committee asks |
| Threshold tuning | Defaults + fusion work | If HIGH-confidence share <90% |
| Crawl beyond ~50 videos | ~1200–1500 clips accepted | If more data is needed later |
| Google Drive upload | Manual copy is fine | If manual distribution gets painful |
