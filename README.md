# VQA-VN-Traffic-2026 — clip pipeline

Turns YouTube Vietnamese traffic compilations into clean, segmented short clips
for later VQA annotation.

**Docs:** [`CLAUDE.md`](./CLAUDE.md) (constitution) · [`architecture.md`](./architecture.md) · [`TODO.md`](./TODO.md)

---

## Setup

```bash
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # Windows
```

Requires **ffmpeg** and **ffprobe** on `PATH`. An NVIDIA GPU enables `h264_nvenc`;
without one, switch the encoder to `libx264` in the sidebar.

## Run

```bash
venv/Scripts/streamlit run app.py
```

That is the entire interface — configuration, queueing, running, review, export.
There are no command-line flags.

1. **Queue** — paste URLs or upload a `.txt` (one per line)
2. **Settings** (sidebar) — toggles and parameters, then Save
3. **Run** — Start; progress and the log update inline
4. **Review** — approve / reject / flag, LOW-confidence clips first
5. **Export** — writes `export/<batch>/` plus `manifest.json`

## How segmentation works

Two independent signals, fused:

- **Burned-in counter** (`#01`, `#02`, …). It appears in *every* frame, so
  sampling the ROI and comparing binarized crops shows exactly when it changes.
  We never read the digits — only the change matters, which removes any OCR
  dependency.
- **PySceneDetect** `ContentDetector` at defaults.

They fail in uncorrelated ways, so agreement is strong evidence:

| Visual cuts inside a counter gap | Result |
|---|---|
| exactly 1 | `HIGH` |
| 0 | midpoint, refined; `LOW` + auto-flag |
| 2 or more | closest to gap midpoint; `MEDIUM` |
| cut with no counter change | **suppressed** — the editor didn't cut there |

No counter (or it's disabled) → visual-only, everything capped at `MEDIUM`.

**Free sanity check:** in the Queue table, `bounds` should be ≈ `counter` − 1.
A large gap means the two signals disagree on that video.

## Layout

```
app.py               Streamlit UI — the whole interface
run_pipeline.py      subprocess entrypoint (Streamlit spawns this)
vqa/
  config.py          config.json load/save + config_hash
  db.py              SQLite: channels, videos, clips, reviews
  urls.py            YouTube URL -> video_id (the dedup key)
  media.py           ffmpeg/ffprobe: probe, sample, cut, blur, encode
  pipeline.py        per-video orchestration with resume
  stages/
    download.py      yt-dlp
    calibrate.py     overlay regions + counter ROI (per channel, cached)
    counter.py       counter change detection
    shots.py         PySceneDetect
    fuse.py          fusion, clip policy, blank filter
work/<video_id>/     cache: source.mp4, *.json, clips/, delivered/
export/<batch>/      approved clips + manifest.json
```

## Two-tier clips

`clips/` holds **masters** — lossless `-c copy` cuts, never modified.
`delivered/` holds the blurred derivatives.

So changing blur settings is a re-derive from local masters: no re-download, no
re-detection. Disk is the only cost.

## Resume

Every stage writes a predictable file and is skipped if it exists. Kill the run
at any point and start it again — it re-enters where it stopped and never
re-downloads. To force a stage, delete its JSON in `work/<video_id>/`.

## Notes

- `h264_nvenc` has no CRF; `-cq` is the equivalent (sidebar: *NVENC cq*).
- Overlay blur removes *legibility*, not *presence* — the pixels under a
  composited overlay are never revealed in any frame, so nothing can recover
  them. Desaturate + darken removes the brand colour signature.
- Headless mode (review toggle off) writes clips as `UNREVIEWED`, never
  `APPROVED`. A headless batch must not be able to pass as a reviewed one.
# vqa
