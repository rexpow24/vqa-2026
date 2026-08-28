# VQA-VN-Traffic-2026 — clip pipeline

Turns YouTube Vietnamese traffic compilations into clean, segmented short clips
for later VQA annotation.

**Docs:** [`CLAUDE.md`](./CLAUDE.md) (constitution) ·
[`GUIDE.md`](./GUIDE.md) (how to run it + reviewer guideline) ·
[`architecture.md`](./architecture.md) · [`TODO.md`](./TODO.md)

---

## Setup

```bash
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # Windows
```

Requires **ffmpeg** and **ffprobe** on `PATH`. An NVIDIA GPU enables
`h264_nvenc`; without one, switch the encoder to `libx264` in the sidebar.

YouTube bot-gates most IPs, so downloading also needs:

- **Cookies** — export from a logged-in browser to `cookies.json` (extension
  JSON) or `cookies.txt` (Netscape). Both are accepted; JSON is converted
  automatically. Set the path in the sidebar under *YouTube access*.
- **Node or Deno on `PATH`** — YouTube's "n" challenge needs a real JS runtime.
  Without one, extraction fails with `The page needs to be reloaded`.

## Run

```bash
venv/Scripts/streamlit run app.py
```

That is the entire interface — configuration, queueing, running, review,
export. There are no command-line flags.

1. **Queue** — paste URLs or upload a `.txt` (one per line)
2. **Settings** (sidebar) — toggles and parameters, then Save
3. **Run** — Start; progress and the log update inline
4. **Review** — longest clips first (>15s = TOP priority). Define the output
   segments, then Approve or Reject. A decision is required to advance —
   there is no Skip.
5. **Export** — writes `export/<batch>/` plus `manifest.json`

Step-by-step instructions and the rule for *where* to cut are in
[`GUIDE.md`](./GUIDE.md).

## How segmentation works

**PySceneDetect** `ContentDetector` at defaults. One signal, so every boundary
is `MEDIUM`.

The counter-fusion path was removed after testing against real footage. On
*Camera Giao thông* videos the burned-in `#03` counter is **transient** —
visible for a few seconds at the start of each segment — so per-pixel temporal
variance cannot detect it, and a mis-detected counter would make the two
"independent" signals correlated, inflating confidence on one signal wearing two
hats.

Review order is therefore driven by **clip duration**, not confidence.

## Overlay removal

Two layers, both applied:

1. **Calibrated regions** — per-pixel temporal variance finds static branding.
   The cutoff is a percentile (the steadiest 1% of the frame) with an absolute
   floor, because real branding is alpha-blended: the scene shows through, so no
   pixel is ever truly static. Measured variance floor on real footage is 258;
   the old absolute threshold of 18 found nothing at all.
2. **Fixed bands** — configured in the sidebar as fractions of the frame and
   applied to *every* video. These cover the burned-in clock, the `#03` counter
   and the source-camera name, which are intermittent and therefore invisible to
   step 1.

Verified on real footage: logo region std **79.6 → 18.8** (−76%), while an
equal-sized control patch of roadway was unchanged (17.71 → 17.68).

## Layout

```
app.py               Streamlit UI — the whole interface
run_pipeline.py      subprocess entrypoint (Streamlit spawns this)
vqa/
  config.py          config.json load/save + config_hash
  db.py              SQLite: channels, videos, clips, reviews
  urls.py            YouTube URL -> video_id (the dedup key)
  media.py           ffmpeg/ffprobe: probe, sample, cut, blur, encode, trim
  pipeline.py        per-video orchestration with resume
  review.py          materialise approved segments / discard rejected ones
  stages/
    download.py      yt-dlp (cookies + JS runtime)
    calibrate.py     static overlay regions (per channel, cached)
    shots.py         PySceneDetect
    fuse.py          boundary policy, clip policy, blank filter
work/<video_id>/
  source.mp4         the download
  *.json             stage caches (probe, shots, boundaries)
  clips/             masters — lossless cuts, never modified
  delivered/         blurred derivatives — what the reviewer watches
  trimmed/           FINISHED PRODUCT — written on Approve, deleted on Reject
export/<batch>/      exported clips + manifest.json
```

## Three tiers of clip

| Folder | What it is | Written by | Ever modified? |
|---|---|---|---|
| `clips/` | lossless `-c copy` cuts | pipeline | never |
| `delivered/` | blurred derivative | pipeline | re-encoded on re-run |
| `trimmed/` | the finished product | **reviewer, on Approve** | replaced on re-approve, deleted on Reject |

Changing blur settings is a re-derive from local masters: no re-download, no
re-detection. Existing approved segments are re-cut from the new `delivered`
automatically, so a settings change can never leave stale output in `trimmed/`.

## Review outputs

`trimmed/` is the finished-product folder. Nothing lands there until a reviewer
approves.

- **Approve** cuts the segments out of the *delivered* clip (the blurred video
  they actually watched) into `trimmed/{clip_id}_tNN.mp4`. With no trim that is
  one file, stream-copied. With **Multiple trim** it is one file per row — for
  the case where the detector merged two incidents into one shot.
- **Reject** deletes that clip's files from `trimmed/` and nothing else. The
  master, the delivered clip and the downloaded source all survive, so a
  rejection is always recoverable.
- Re-approving replaces the previous segments, so shrinking the row count never
  leaves orphans behind.

## Resume

Every stage writes a predictable file and is skipped if it exists. Kill the run
at any point and start it again — it re-enters where it stopped and never
re-downloads. To force a stage, delete its JSON in `work/<video_id>/`.

## Notes

- `h264_nvenc` has no CRF; `-cq` is the equivalent (sidebar: *NVENC cq*).
  Default is 23. At 19 the delivered clips came out ~6x larger than the
  lossless masters.
- Overlay blur removes *legibility*, not *presence* — the pixels under a
  composited overlay are never revealed in any frame, so nothing can recover
  them. Desaturate + darken removes the brand colour signature.
- Headless mode (review toggle off) writes clips as `UNREVIEWED`, never
  `APPROVED`, and produces nothing in `trimmed/`. A headless batch must not be
  able to pass as a reviewed one.
- Downloaded footage is third-party copyrighted material held for academic
  research. Keep it local; do not redistribute. `cookies.*`, `work/`, `export/`
  and `config.json` are all gitignored.
