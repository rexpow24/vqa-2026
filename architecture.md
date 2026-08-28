# Architecture — Vietnamese Traffic Clip Dataset Pipeline

**Status:** implemented, verified end-to-end on real footage · **Updated:** 2026-08-29

Governed by [`CLAUDE.md`](./CLAUDE.md). Where this document and the constitution
disagree, the constitution wins.

---

## 1. Objective & scope

Turn YouTube compilations from Vietnamese traffic channels into short, clean,
single-incident clips on local disk, ready for later VQA annotation.

**In scope:** download → segment → redact overlays → human review → export.

**Out of scope, deliberately:** VQA/QA generation, Google Drive or any cloud
storage, multi-machine coordination, formal boundary benchmarks, threshold
tuning campaigns.

---

## 2. Source material — what the footage actually looks like

Measured on `KdhIs56QWuQ` (*Camera giao thông*, "Bad driving [P314]"):

| Property | Value |
|---|---|
| Duration | 12 min (some are ~60 min) |
| Resolution / fps | 1920×1080, 30fps |
| Segments | ~35, separated by hard cuts |
| Segment length | 5–58s |

Every frame carries burned-in overlays, but **not the same ones**:

| Overlay | Position | Behaviour |
|---|---|---|
| Channel logo "CAMERA Giao thông" | top-right | present always, **alpha-blended** |
| Source clock | top-left (CCTV) *or* bottom-left (dashcam) | present always, digits change every second |
| Compilation counter `#03` | bottom-left | **transient** — a few seconds per segment |
| Source-camera name "Yen Hoa 1" | bottom-right | present on some segments only |

Source footage is heterogeneous within one compilation: fixed CCTV and dashcam
material are interleaved, which is why overlay positions move.

### Why these facts drive the design

1. **The logo is alpha-blended.** The scene shows through it, so no pixel is ever
   truly static. Measured temporal-variance floor inside the logo box: **258**.
   A static-overlay detector using an absolute threshold of 18 finds *nothing*.
2. **The counter is transient.** It is absent from most frames, so per-pixel
   temporal variance can never classify it as a static region.
3. **Overlay positions vary by source.** No single fixed rectangle covers the
   clock, the counter and the camera name.

---

## 3. System architecture

```
┌──────────────────────────────────────────┐
│  streamlit run app.py                    │
│  Queue │ Run │ Review │ Export           │
│  sidebar = all configuration             │
└───────┬───────────────────────┬──────────┘
        │ spawns                │ polls
        ▼                       ▼
┌────────────────────┐   ┌──────────────────┐
│ run_pipeline.py    │──▶│ pipeline.db      │
│ (subprocess)       │   │ SQLite, WAL      │
│ drains the queue   │   └──────────────────┘
└─────────┬──────────┘            ▲
          │ appends               │ reads
          ▼                       │
   logs/latest.log ───────────────┘
```

### Why a subprocess and not a direct call

Streamlit re-runs its entire script on every widget interaction. A pipeline
running inside that script would be killed and restarted by any click. So the
pipeline is a separate process; the app watches SQLite and the log file.

SQLite is in **WAL** mode with `busy_timeout=30000`, so the app reads while the
subprocess writes.

---

## 4. Configuration

One `config.json`, written **only** by the Streamlit sidebar. No CLI flags, no
manual editing.

| Group | Keys |
|---|---|
| Toggles | `review_enabled`, `blur_enabled`, `color_kill_enabled` |
| Overlay removal | `blur_sigma`, `desaturate`, `darken`, `fixed_blur[]` |
| Detection | `content_threshold` |
| Clip policy | `min_duration_s`, `max_duration_s`, `safety_trim_frames` |
| Encoding | `encoder`, `nvenc_cq`, `libx264_crf` |
| Paths | `work_dir`, `output_dir` |
| Download | `max_height`, `cookies_file`, `cookies_browser` |

`config_hash()` is the first 8 chars of the SHA-256 of the sorted config. Every
clip records the hash of the config that produced it; the export manifest records
the hash at export time. They can differ, and the field names say so.

Settings are **locked during a run**, so one batch cannot span two configs.

---

## 5. Pipeline stages

| # | Stage | Cache file | Notes |
|---|---|---|---|
| S1 | enqueue | `videos` row | video ID is the dedup key |
| S2 | download | `source.mp4`, `metadata.json` | yt-dlp + cookies + JS runtime |
| S3 | probe | `probe.json` | rejects anything under 30s |
| S4 | calibrate | `channels` row | **per channel**, not per video |
| S5 | shot detection | `shots.json` | PySceneDetect `ContentDetector` |
| S6 | boundaries → clips | `boundaries.json` | clip policy + blank filter |
| S7 | cut masters | `clips/*.mp4` | lossless `-c copy` |
| S8 | blur + encode | `delivered/*.mp4` | NVENC, libx264 fallback |
| S9 | **reviewer approve** | `trimmed/*.mp4` | **not** part of the automated run |

### S2 — Download

YouTube bot-gates most IPs. Two things are required and both are in the yt-dlp
options:

- **Cookies** — `cookies_file` accepts Netscape `.txt` or extension `.json`;
  JSON is converted on the fly and cached by mtime.
- **JS runtime** — `js_runtimes: {"deno": {}, "node": {}}` plus
  `remote_components: ["ejs:github"]`. YouTube's "n" challenge needs a real JS
  engine and yt-dlp's solver script; without both, extraction fails with
  `The page needs to be reloaded`.

> `ejs:github` fetches and executes a solver script from GitHub at run time.
> That is yt-dlp's official mechanism and there is currently no offline
> alternative, but it is third-party code running locally — worth knowing.

### S4 — Overlay calibration (per channel, cached)

Per-pixel temporal variance over ~300 sampled frames at 480px wide.

The "static" cutoff is **relative**, not absolute:

```python
cutoff = max(VAR_MAX, percentile(var, VAR_PCT))   # VAR_MAX=18, VAR_PCT=1.0
```

Real branding is alpha-blended, so an absolute threshold finds nothing. But
overlay pixels are still ~4× steadier than scene pixels, and the steadiest 1% of
the frame is overwhelmingly overlay: **97.8% of selected pixels fell inside the
logo box** on real footage. `VAR_MAX` stays as a floor so an opaque overlay
behaves exactly as before.

Candidate boxes are then filtered by area, by sitting in the outer 25% of the
frame, and by having real spatial detail (flat sky and road are rejected).

Because this measures *motion*, it cannot mask a licence plate or a road sign —
those move. A learned text detector absolutely would.

### S5 — Shot detection

PySceneDetect `ContentDetector` at defaults, `auto_downscale = True`.
**This is the only segmentation signal.**

---

## 6. Segmentation — one signal, honestly labelled

An earlier design fused visual cuts with counter-change detection, routing
agreement to `HIGH` confidence. **That path was removed after testing against
real footage.**

The counter exists — the yellow `#03` at bottom-left — but it is transient, so
temporal variance cannot find it. Worse, when calibration *did* latch onto the
alpha-blended logo and label it "counter", that region changed **whenever the
scene behind it changed**. Measured change rate: logo `0.244` vs a pure-scene
control `0.000`.

A counter derived from scene bleed-through is not an independent signal. Fusing
it with PySceneDetect would have produced `HIGH` confidence from **one signal
wearing two hats** — confidence that looks earned and isn't.

So: one signal, every boundary `MEDIUM`, and review order driven by clip duration
instead. This is a real capability loss, recorded here rather than papered over.

### Clip policy

```
edges  = [0] + boundaries + [duration]
start  = edge + safety_trim   (except the first)
end    = next_edge - safety_trim
```

| Condition | Action |
|---|---|
| `duration < min_duration_s` | dropped |
| `duration > max_duration_s` | kept, flagged `TOO_LONG` — never auto-split |
| mean luma `< 12` | dropped, logged as `black` |
| inter-frame motion `< 0.25` | dropped, logged as `static` |

The blank filter catches title cards and bumpers. The motion floor is
deliberately low: a real traffic clip can be a genuinely quiet street at night.
Drops are **counted and logged**, never silent.

---

## 7. Overlay removal

Two layers, both applied, both into one ffmpeg `filter_complex`:

1. **Calibrated regions** (S4) — whatever branding is static enough to find.
2. **Fixed bands** — `fixed_blur[]` from config, as fractions of the frame,
   applied to **every** video. These cover the clock, the counter and the camera
   name, which S4 structurally cannot see. Defaults: `bottom_left`, `top_left`,
   `bottom_right`.

Per region: `crop → gblur → [hue → eq] → overlay`.

Two ffmpeg details that cost real debugging time:

- **`gblur`, not `boxblur`.** boxblur's radius is capped by the chroma plane size
  and fails outright on small regions.
- **Explicit `split=2` per region.** Each stage needs the same frame twice — as
  the overlay base and as the crop source. Reusing one label for both silently
  drops every overlay but the last, with no ffmpeg error. It was caught only by
  measuring per-region pixel variance before and after.

### Verified effect

| Region | Master | Delivered |
|---|---|---|
| Logo | std 79.59 | std 18.83 (**−76.3%**) |
| Roadway control, same size | std 17.71 | std 17.68 (−0.2%) |

Blur removes *legibility*, not *presence*. Pixels under a composited overlay are
never revealed in any frame, so no method can recover them. Desaturate + darken
removes the brand colour signature.

---

## 8. Data model

```sql
channels(channel_id PK, name, overlay_regions, calibrated_at)
videos(youtube_video_id PK, canonical_url, title, channel_id, duration_s,
       status, stage, error_code, error_detail, retry_count,
       config_snapshot, n_clips, n_boundaries, created_at, updated_at)
clips(clip_id PK, youtube_video_id, seq, start_ms, end_ms, duration_ms,
      confidence, flags, master_path, delivered_path,
      pipeline_version, config_hash, trim_segments, created_at)
reviews(clip_id PK, decision, reviewed_at)
```

### Clip ID is content-derived

```
{video_id}_{start_ms:06d}_{end_ms:06d}
```

Same input plus same config ⇒ same ID. That gives idempotent re-runs and safe
merges for free, with no ID allocator.

### `trim_segments` is JSON, not columns

```json
[{"start_ms": 4000, "end_ms": 9000, "path": "work/.../trimmed/..._t01.mp4"}]
```

One clip can produce several output files, so a fixed set of trim columns does
not fit. `insert_clip` is an **UPSERT**, not `INSERT OR REPLACE` — a replace
drops the whole row and would wipe the reviewer's work on every re-run.

### Three tiers of artifact

| Folder | Written by | Modified? |
|---|---|---|
| `clips/` | pipeline, lossless | never |
| `delivered/` | pipeline, blurred | re-encoded on re-run |
| `trimmed/` | **reviewer, on Approve** | replaced on re-approve, deleted on Reject |

`trimmed/` is the finished product. When `delivered/` is re-encoded, any existing
approved segments are **re-cut from the new file**, so a blur-settings change can
never leave stale output in the deliverable.

---

## 9. States

```
QUEUED → DOWNLOADING → PROCESSING → READY_FOR_REVIEW → (reviewed)
              ↓             ↓
      DOWNLOAD_FAILED    FAILED        ← both retryable from the Queue tab
```

Headless runs end at `DONE` with clips marked `UNREVIEWED` — never `APPROVED`,
and nothing is written to `trimmed/`. A headless batch must not be able to pass
as a reviewed one.

Clip decisions: `UNREVIEWED` → `APPROVED` | `REJECTED` | `FLAGGED`.

---

## 10. Review

Order is **duration-based**, because with one detection signal confidence carries
no information:

| Band | Rule |
|---|---|
| `TOP` | `duration_ms > 15000` |
| `LOW` | otherwise |

TOP drains first, then LOW begins automatically. Priority comes from the
**original** duration and never changes when a reviewer trims.

| Action | Effect |
|---|---|
| **Approve** | cuts the defined segments from `delivered/` into `trimmed/` |
| **Reject** | deletes this clip's files from `trimmed/`, nothing else |
| **Flag** | records a decision, advances, writes nothing |

There is no Skip. A decision is required to advance.

**Multiple trim** lets one clip produce N files, for the case where the detector
merged two incidents into one shot. Re-approving replaces the previous segments,
so shrinking the row count never leaves orphans.

Reject is recoverable by construction: it touches only the finished-product
folder. The master, the delivered clip and the download all survive.

The cut rule reviewers follow (impact → impact+5s) lives in
[`GUIDE.md` §2.4](./GUIDE.md), not here — it is dataset policy, not architecture.

---

## 11. Export

`export/<batch>/clips/<video_id>/` plus `manifest.json`, one entry per **file**
(a clip with 3 segments yields 3 entries) carrying clip ID, segment index, trim
points, priority, confidence, flags, decision, pipeline version and config hash.

`review_mode` in the manifest records `interactive` vs `headless`.

---

## 12. Performance & disk

12-minute 1080p video, RTX-class GPU:

| Stage | Time |
|---|---|
| download | ~30s |
| calibration | ~2 min (per channel) |
| shot detection | ~8 min |
| cut + blur + encode | ~3 min |

| Artifact | Size |
|---|---|
| `source.mp4` | 149 MB |
| `clips/` (35 masters) | 627 MB |
| `delivered/` at `cq=23` | 608 MB |
| **per video** | **~1.4 GB** |
| **50 videos** | **~70 GB** |

`cq` was 19 originally, which produced 905 MB of delivered — about 6× the
lossless masters. 23 is visually equivalent and 33% smaller.

---

## 13. Tech stack

| Layer | Choice |
|---|---|
| UI | Streamlit (single process) |
| Runner | `subprocess.Popen` + SQLite polling |
| State | SQLite (WAL) |
| Download | yt-dlp |
| Segmentation | PySceneDetect `ContentDetector` |
| Video | ffmpeg / ffprobe |
| Arrays | numpy, OpenCV |

Explicitly rejected: FastAPI, React/Next.js, Celery/Redis, an ORM, PaddleOCR or
any OCR, TransNetV2, deep video inpainting, optical flow, cloud storage.

---

## 14. Known limitations (accepted, not problems to solve now)

1. **Every boundary is `MEDIUM`.** One signal. Every clip needs a human.
2. **Blur is destructive and approximate.** Fixed bands blur whatever sits under
   them, including a little roadway.
3. **Overlays are obscured, not removed.** Nothing can recover pixels that were
   never visible.
4. **No near-duplicate detection.** Compilations re-use footage across uploads.
   → **Must be revisited before drawing any train/test split.** The same incident
   landing in both splits would invalidate the dataset.
5. **Calibration is channel-scoped.** A channel that changes its layout
   mid-catalogue needs its cached row cleared.
6. **`remote_components: ejs:github`** executes third-party JS fetched at
   download time.
7. **Trim re-encodes an already-encoded file.** Generation loss, negligible at
   `cq=23`. Cutting from masters and re-blurring would avoid it, at a few seconds
   per trim.

---

## Sources

- PySceneDetect 0.7.1 — `open_video`, `SceneManager`, `ContentDetector`
- ffmpeg filters — `gblur`, `crop`, `overlay`, `split`, `hue`, `eq`
- NVENC rate control — `-rc vbr -cq N` (NVENC has no CRF)
- yt-dlp — cookies, `js_runtimes`, `remote_components`
