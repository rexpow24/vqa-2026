# Architecture — Vietnamese Traffic Clip Dataset Pipeline

**Status:** implemented, end-to-end verified · **Version:** `v0.1.0` · **Updated:** 2026-08-29
**Governed by:** [`CLAUDE.md`](./CLAUDE.md) — the constitution wins any conflict with this doc.

---

## 1. Objective & scope

Turn YouTube Vietnamese traffic compilations into clean, segmented short clips for later VQA
annotation.

```
YouTube URL → download → detect boundaries → cut clips → blur overlays → triage → local dataset
```

**Out of scope:** VQA/QA generation, semantic event interpretation, Google Drive, benchmarks,
threshold tuning, near-duplicate detection, multi-machine coordination.

This is a **preprocessing pipeline, not an annotation platform**. Rough cuts are acceptable;
review is where quality happens.

---

## 2. Source material — the facts that drive the design

Confirmed from a reference frame (*Camera Giao thông*) and the author:

1. Edited YouTube **compilations**, ~15 min (sometimes ~60 min).
2. Each contains **20–100+ segments** separated by **hard cuts**.
3. Each segment is **fixed-camera CCTV** — no pans, no zooms.
4. Each segment carries a **burned-in counter** (`#01`, `#02`, …) at a fixed position, **in every
   frame**.
5. Segments are **≤30s**, one incident each.
6. Static overlays are corner-anchored and **identical across a whole channel**: brand block
   (top-right), circular logo (bottom-right), counter (bottom-left).

### Why these matter

| Fact | Consequence |
|---|---|
| Hard cuts between unrelated fixed cameras | Frame difference at a cut is enormous. PySceneDetect defaults work. No tuning needed. |
| Counter in **every** frame, not just at cuts | Sampling the ROI at 2fps shows exactly when it changes — and a change *is* a boundary. Strongest available signal, and it needs no OCR. |
| 1 segment = 1 shot = 1 clip | **No SHOT/EVENT/CLIP hierarchy.** No semantic grouping code. |
| Overlays static + per-channel | Find them once per channel by temporal pixel variance. No learned detector, no GPU, no false positives on traffic. |
| Camera never moves | Optical-flow / motion heuristics are useless. Don't build them. |

---

## 3. System architecture

**One Streamlit app. One process. One SQLite file.**

```
   ┌──────────────────────────────────────────────────────────────┐
   │                  streamlit run app.py                        │
   │                                                              │
   │   SIDEBAR                    MAIN AREA (tabs)                │
   │   ┌────────────────┐  ┌────────────────────────────────────┐ │
   │   │ ☑ review mode  │  │  📥 Queue    — paste URLs / upload │ │
   │   │ ☑ blur         │  │              .txt, see table       │ │
   │   │ ☑ desat+darken │  │  ▶️  Run      — start, progress,    │ │
   │   │ ─ threshold    │  │              inline log tail       │ │
   │   │ ─ min/max dur  │  │  👀 Review   — video + A/R/F       │ │
   │   │ ─ output path  │  │  📦 Export   — write manifest      │ │
   │   │ [Save]         │  │                                    │ │
   │   └────────┬───────┘  └───────────────┬────────────────────┘ │
   └────────────┼──────────────────────────┼──────────────────────┘
                │ writes                   │ reads/writes
                ▼                          ▼
        config.json              ┌──────────────────┐
                                 │   pipeline.db    │  ← SQLite
                                 └────────┬─────────┘
                                          │
                    ┌─────────────────────┴──────────────────┐
                    │  run_pipeline.py   (subprocess)        │
                    │  spawned by the Run tab, writes state  │
                    │  to SQLite + log file as it goes       │
                    └─────────────────────┬──────────────────┘
                                          ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  S1 canonicalize → S2 download → S3 probe → S4 calibrate     │
   │  → S5a counter change ∥ S5b PySceneDetect → S6 fuse          │
   │  → S7 cut clips → S8 blur+encode → done                      │
   └──────────────────────────────────────────────────────────────┘
```

### Why a subprocess and not a direct call

Streamlit reruns the whole script on every widget interaction. A pipeline call inside the script
would freeze the UI for hours and die on any rerun. So:

- **Run tab** spawns `python run_pipeline.py` via `subprocess.Popen` and stores the PID.
- The subprocess writes progress to **SQLite** and appends to `logs/run_<ts>.log`.
- The Run tab polls: read DB → draw `st.progress` → `st.text` the log tail → `time.sleep(2)` →
  `st.rerun()`.

This is ~20 lines, survives browser refresh and Streamlit reruns, and the pipeline keeps running
if the tab is closed. It's the *simplest thing that works*, not an architecture layer.

---

## 4. Configuration

All config lives in **sidebar widgets**. Save writes `config.json`; the subprocess reads it at
startup. No file editing, no CLI flags.

```json
{
  "review_enabled": true,
  "blur_enabled": true,
  "color_kill_enabled": true,
  "blur_sigma": 20,
  "desaturate": 0.15,
  "darken": 0.10,
  "content_threshold": 27.0,
  "min_duration_s": 5.0,
  "max_duration_s": 30.0,
  "counter_enabled": true,
  "counter_sample_fps": 2.0,
  "counter_change_threshold": 0.05,
  "encoder": "h264_nvenc",
  "nvenc_cq": 19,
  "output_dir": "export",
  "work_dir": "work"
}
```

**Toggle behaviour**

| Setting | Off means |
|---|---|
| `review_enabled` | **Headless.** No review gate; clips written with `decision='UNREVIEWED'` |
| `blur_enabled` | No blur pass; delivered clip = copy of master |
| `color_kill_enabled` | Blur only; brand colour survives as a smear (child of `blur_enabled`) |
| `counter_enabled` | Visual-only detection; all confidence capped at MEDIUM |

Config is snapshotted into the DB when a run starts, so mid-run sidebar edits can't retroactively
change what earlier clips claim. That's one column, not a subsystem.

---

## 5. Pipeline stages

| # | Stage | Tool | Bound | Notes |
|---|---|---|---|---|
| S1 | Canonicalize URL → `video_id` | `urllib` | — | Handles `watch?v=`, `youtu.be/`, `&t=`, `/shorts/`. Video ID is the dedup key. |
| S2 | Download | `yt-dlp` | net | `bestvideo[height<=1080]+bestaudio`. Retry 3×. |
| S3 | Probe / validate | `ffprobe` | cpu | Reject corrupt, <720p, live streams. |
| S4 | Overlay calibration | `opencv` | cpu | **Per channel, cached.** ~30s once. |
| S5a | Counter change | numpy/cv2 | cpu | 2fps → change events. No OCR. |
| S5b | Shot detection | PySceneDetect | cpu | `ContentDetector`, **defaults**. |
| S6 | Fusion + confidence | — | — | See §6. |
| S7 | Cut clips | `ffmpeg -c copy` | disk | Master, lossless, instant. |
| S8 | Blur + encode | `ffmpeg` NVENC | gpu | Delivered derivative. |

### S4 — Overlay calibration (per channel, cached)

Sample 300 frames → **per-pixel temporal variance** → threshold → morphological close →
connected components → keep boxes in the outer 25% margin only.

A static overlay has ~zero variance while the scene around it moves. Real content moves, so this
**cannot** mask a license plate, road sign, or shop signage — which a learned text detector
absolutely would. It's also CPU-only and deterministic.

The **counter ROI** is the box that's static *within* a segment but varies *across* the video
(windowed variance ≪ global variance).

Fails → skip blur, log it, keep going. (A manual x/y/w/h override per channel is designed but
not yet built — see TODO Phase 3.)

### S5a — Counter change detection (no OCR)

**The fusion never uses the counter's value — only *when it changes*.** So there is no reason to
read the digits. We crop the ROI, binarize to isolate the glyph, and compare consecutive samples.

Decode at 2fps → crop counter ROI → drop the outer 10% of the crop → threshold at a **fixed**
bright level (≥190) → compare consecutive binary masks. A spike above
`max(floor, 5 × median)` is a counter change.

Design details that matter, each fixing a failure seen in testing:

- **Fixed bright threshold, not Otsu.** Otsu re-thresholds per frame, so when the scene behind a
  counter moves, the binarization flips and *every* frame looks like a change. A fixed cutoff
  keeps only near-white glyph pixels, which traffic scenes rarely reach.
- **Border dropped.** The outer 10% of the crop is where surrounding scene pixels leak in.
- **Adaptive spike threshold.** A fixed cutoff misses a 1→2 digit change (a few percent of the
  crop) while over-firing on busy footage. Comparing against the video's own median separates
  them at any glyph size.

**Not fragile:** the counter is in every frame, so a 20s segment yields ~40 samples of an
identical glyph. Within-segment difference is ~0; a change is unmistakable.

**What this buys:** no PaddleOCR, no torch, no model weights, no GPU for this stage — a ~2.5GB
dependency removed, and more robust on a stylized font than OCR would have been.

No counter, or the toggle is off → **non-fatal**, degrade to visual-only, cap confidence at
MEDIUM.

*Future work, not needed now:* actual digit values (EasyOCR has Python 3.14 wheels) would let the
counter number each clip. The pipeline numbers clips sequentially instead.

---

## 6. Boundary fusion — the core of the design

Two signals that **fail in uncorrelated ways**. PySceneDetect is blind to fades and fires on
headlight flashes; OCR fails independently of scene content. So agreement is strong evidence, and
disagreement is exactly what a human should look at.

```
FOR each counter transition gap (last_seen[i], first_seen[i+1]):

    cuts = PySceneDetect cuts inside the gap (±1s)

    1 cut   → accept it                      → HIGH
    0 cuts  → accept gap midpoint            → LOW   + auto-flag
    ≥2 cuts → accept the highest-scoring one → MEDIUM

PySceneDetect cut with NO counter change nearby
    → SUPPRESS. The editor didn't cut here; it's a flash or a
      vehicle filling frame.

No counter in the video at all
    → PySceneDetect alone, everything MEDIUM.
```

Then **frame-exact refinement**: decode ±0.5s at full rate, HSV-histogram L1 distance between
consecutive frames, `argmax` = the cut frame. Trim 2 frames each side for transition residue.

> **Deliberately dropped: TransNetV2 escalation.** The earlier design escalated ambiguous windows
> to a neural shot detector. Per Constitution Principle 1, LOW-confidence boundaries go **straight
> to the review flag bucket** instead. Same outcome (a human looks at it), one fewer dependency,
> one fewer model download, ~half a day saved. Revisit only if the flagged bucket proves large.

**Clip filter:** drop `<5s`; emit + flag `TOO_LONG` if `>30s` (never auto-split); drop black/blank
(kills intro/outro) and fully static clips.

---

## 7. Overlay removal

Per-region ffmpeg chain, assembled from config:

```bash
ffmpeg -i master.mp4 -filter_complex "
  [0:v]split=2[b0][c0];
  [c0]crop=w:h:x:y,gblur=sigma=20:steps=3,hue=s=0.15,eq=brightness=-0.10[r0];
  [b0][r0]overlay=x:y[v0];
  [v0]null[vout]
" -map "[vout]" -c:v h264_nvenc -rc vbr -cq 19 -preset p5 delivered.mp4
```

Two implementation details found in testing:

- **`gblur`, not `boxblur`.** boxblur's radius is capped by the chroma plane size and fails
  outright on small overlay regions (`Invalid chroma_param radius value 20`). gblur takes a real
  sigma with no such limit.
- **Explicit `split`.** Each stage needs the same frame twice — as the overlay base and as the
  crop source. Reusing one label for both silently drops the overlay for every region but the
  last, which is easy to miss because ffmpeg does not error.

| `blur_enabled` | `color_kill_enabled` | Chain |
|---|---|---|
| ✓ | ✓ | `split → crop → gblur → hue → eq → overlay` |
| ✓ | ✗ | `split → crop → gblur → overlay` |
| ✗ | — | none — delivered is a copy of master |

**Two-tier artifacts.** `master.mp4` is cut with `-c copy` (lossless, instant, never modified);
`delivered.mp4` is the blurred derivative. Changing blur settings later = one re-derive pass over
local masters. No re-download, no re-detection. Costs disk only.

> **`h264_nvenc` has no CRF** — `-cq` is the equivalent. `-cq 19` ≈ `libx264 -crf 18`, and runs
> ~1–2h instead of ~12–25h for this corpus.

> **Honest limitation:** the overlay is composited on every frame, so the pixels underneath are
> never revealed anywhere in the video. Nothing can recover them. Blurring a region whose content
> *is* the logo yields a **blurred logo** — removing legibility, not presence. Desaturate+darken
> kills the brand colour signature, which closes most of the gap. Good enough; moving on.

---

## 8. Data model

Four tables. SQLite, WAL mode (app reads while subprocess writes).

```sql
CREATE TABLE channels (
    channel_id      TEXT PRIMARY KEY,
    name            TEXT,
    overlay_regions TEXT,          -- JSON [{x,y,w,h,role}]
    counter_roi     TEXT,          -- JSON {x,y,w,h}
    calibrated_at   TEXT
);

CREATE TABLE videos (
    youtube_video_id TEXT PRIMARY KEY,   -- dedup key
    canonical_url    TEXT NOT NULL,
    title            TEXT,
    channel_id       TEXT,
    duration_s       REAL,
    status           TEXT NOT NULL,      -- see §9
    error_code       TEXT,
    retry_count      INTEGER DEFAULT 0,
    config_snapshot  TEXT,               -- JSON, frozen at run start
    created_at       TEXT,
    updated_at       TEXT
);

CREATE TABLE clips (
    clip_id          TEXT PRIMARY KEY,   -- {video_id}_{start_ms}_{end_ms}
    youtube_video_id TEXT,
    counter_value    INTEGER,
    start_ms         INTEGER NOT NULL,
    end_ms           INTEGER NOT NULL,
    confidence       TEXT NOT NULL,      -- HIGH | MEDIUM | LOW
    flags            TEXT,               -- JSON: TOO_LONG, LOW_QUALITY, NO_COUNTER
    master_path      TEXT,
    delivered_path   TEXT,
    pipeline_version TEXT,
    config_hash      TEXT,
    created_at       TEXT
);

CREATE TABLE reviews (
    clip_id     TEXT PRIMARY KEY,
    decision    TEXT NOT NULL,           -- APPROVED | REJECTED | FLAGGED | UNREVIEWED
    reviewed_at TEXT
);
```

**Dropped from the earlier design:** the `pipeline_runs` and `stage_events` tables. Progress goes
to a log file; provenance lives in `config_snapshot` + `config_hash`. Two fewer tables to maintain.

### Clip ID is content-derived

```python
clip_id = f"{video_id}_{start_ms:06d}_{end_ms:06d}"   # dQw4w9WgXcQ_017033_034100
```

Reprocessing the same video with the same config yields **identical IDs**, so re-runs overwrite
instead of duplicating. The ID is also its own provenance — source and time range readable
straight off the filename. Free idempotence for zero effort.

---

## 9. States

```
QUEUED → DOWNLOADING → PROCESSING → READY_FOR_REVIEW → DONE
              ↓             ↓
        DOWNLOAD_FAILED  FAILED     (both retryable from the Queue tab)
```

Per-clip: `UNREVIEWED → APPROVED | REJECTED | FLAGGED`.

Five video states, not eleven. Retry is a button that resets status to `QUEUED`.

---

## 10. Resume & caching

Each stage writes a predictable file. Resume = "what's on disk already?"

```
work/<video_id>/
  source.mp4          # S2 — the expensive one, never recomputed
  probe.json          # S3
  ocr_counter.json    # S5a
  scenedetect.json    # S5b
  boundaries.json     # S6
  clips/*.mp4         # S7 masters
  delivered/*.mp4     # S8 blurred
```

Crash during encoding → re-run reads `boundaries.json` and resumes. Nothing re-downloads. This is
`if os.path.exists(): skip`, not a caching framework.

---

## 11. Performance

~25h of footage ≈ one overnight batch. Not the bottleneck — **review is.**

3000 clips × ~5s attention ≈ 4h of human time. Mouse-clicking makes it 12h+. So **autoplay +
preload the next clip** is the highest-leverage thing in the whole build.

Modest parallelism, only if it's easy: 2–3 concurrent downloads while another video is in
detection. NVENC runs on a separate ASIC block from CUDA, so encoding overlaps with OCR for free.
Don't build a scheduler.

---

## 12. Review (Streamlit)

Tab shows one clip at a time, LOW-confidence first, with `st.video`, a confidence badge, and three
actions.

**Keyboard shortcuts:** use the `streamlit-shortcuts` package to bind `A`/`R`/`F` to the buttons.
If it misbehaves, **ship plain buttons** — per Constitution Principle 2, this is not worth a day.

Every decision writes to SQLite immediately, so a browser refresh or app restart resumes exactly
where it left off.

**Not building:** boundary nudging, split, merge, notes. `F` collects the exceptions; fix that
bucket in bulk at the end. Revisit only if flagged clips exceed ~10%.

---

## 13. Export

```
export/<batch>/
  clips/<video_id>/<clip_id>.mp4
  manifest.json
```

Interactive runs export `APPROVED` clips. Headless runs export everything as `UNREVIEWED`, and the
manifest records `review_mode`. **A headless run must never be able to pass as a reviewed one** —
otherwise nothing later distinguishes a clip you accepted from one nobody ever saw. That's one
field, and it's worth it.

Distribution is manual: copy the folder.

---

## 14. Provenance

Every clip carries enough to answer "what made you?":

```json
{
  "clip_id": "dQw4w9WgXcQ_017033_034100",
  "youtube_video_id": "dQw4w9WgXcQ",
  "start_ms": 17033, "end_ms": 34100, "counter_value": 2,
  "confidence": "HIGH",
  "pipeline_version": "v0.1.0",
  "config_hash": "a3f9c1e2",
  "review": { "decision": "APPROVED", "review_mode": "interactive" }
}
```

`config_hash` = SHA256 of `config.json`. Cheap, and it's what makes a thesis chapter defensible.

---

## 15. Tech stack

| Layer | Choice |
|---|---|
| App | **Streamlit** — the entire interface |
| Runner | `subprocess.Popen` + SQLite polling |
| Download | `yt-dlp` |
| Video | `ffmpeg` / `ffprobe` |
| Shot detection | `PySceneDetect` `ContentDetector` (defaults) |
| Counter | numpy + OpenCV threshold (no OCR) |
| CV | `OpenCV`, `numpy` |
| State | `sqlite3` (stdlib) |
| Shortcuts | `streamlit-shortcuts` (optional) |

**Rejected:** FastAPI, React/Next.js, Redis/Celery, PostgreSQL, ORM, TransNetV2, deep video
inpainting, learned logo detection, optical flow, fixed-duration chunking, multi-machine locking.

Two worth a sentence:

- **TransNetV2** — a ~1% F1 gain on academic benchmarks is meaningless when the counter already
  gives near-oracle boundaries. Dropped per Principle 3.
- **Learned logo/text detection** — would mask license plates and road signs, the exact content a
  traffic VQA model must read. Temporal variance can't make that mistake.

---

## 16. Known limitations (accepted, not problems to solve now)

| Thing | Why it's fine |
|---|---|
| Blur leaves a coloured smear | Legibility gone, presence remains. Desaturate+darken mitigates. |
| No near-duplicate detection | **Revisit before drawing any train/test split** — the same incident in both splits would invalidate the dataset. Not a blocker for producing clips. |
| ~50 videos → ~1200–1500 clips | Accepted per the constitution. Crawl more later if needed. |
| No formal benchmark | Manual inspection. Free sanity check: detected boundary count vs. max counter value should nearly match. |
| Gradual transitions handled weakly | Rare in this source. They land in the flag bucket. |
| Pipeline stops if the machine sleeps | Resume handles it. Disable sleep for overnight runs. |

---

## Sources

- [PySceneDetect — Detection Algorithms](https://www.scenedetect.com/docs/latest/api/detectors.html)
- [TransNet V2 (arXiv:2008.04838)](https://ar5iv.labs.arxiv.org/html/2008.04838) — evaluated, rejected
- [FFmpeg boxblur region technique](https://ottverse.com/blur-a-video-using-ffmpeg-boxblur/)
