# VQA-VN-Traffic-2026 — clip pipeline

Turns YouTube Vietnamese traffic compilations and Facebook traffic videos into
reviewable clips for later VQA annotation. YouTube runs scene detection and
pre-review overlay blur; Facebook downloads one full-length clip without
preprocessing or deduplication.

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

Start the local sidecar and Next.js frontend in separate terminals from the
project root:

```powershell
# Terminal 1
.\venv\Scripts\python.exe -m uvicorn sidecar.main:app --port 8787

# Terminal 2
Set-Location frontend
npm run dev
```

Open [http://localhost:3000/queue](http://localhost:3000/queue).

1. **Queue** — paste YouTube URLs or Facebook URLs, one per line
2. **Run** — start the matching source-specific worker
3. **Review** — longest clips first (>15s = TOP priority). Define the output
   segments, then Approve or Reject. A decision is required to advance —
   there is no Skip.
4. **Dedup / Anonymize** — YouTube goes through Dedup; Facebook has a separate
   anonymize action and is never compared with YouTube
5. **Export** — writes `export/<batch>/` plus `manifest.json`

The Facebook branch downloads each URL directly into one full-length clip.
It does not run scene detection, pre-review blur, or deduplication.

Step-by-step instructions and the rule for *where* to cut are in
[`GUIDE.md`](./GUIDE.md).

## YouTube segmentation

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
frontend/            Next.js UI
sidecar/main.py      local API and subprocess controls
run_pipeline.py      YouTube worker entrypoint
run_facebook_pipeline.py  Facebook worker entrypoint
vqa/
  config.py          config.json load/save + config_hash
  db.py              SQLite: channels, source-tagged videos, clips, reviews
  urls.py            YouTube URL -> video_id
  facebook.py        Facebook URL parsing, yt-dlp download, full-video clip
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
  trimmed/           reviewed output — written on Approve, deleted on Reject
work/facebook/<id>/
  source/original.mp4  downloaded video
  trimmed/             reviewed output; no intermediate clips or blur
finished/facebook/   anonymized Facebook outputs (flat, separate from YouTube)
export/<batch>/      exported clips + manifest.json
```

## YouTube clip tiers

| Folder | What it is | Written by | Ever modified? |
|---|---|---|---|
| `clips/` | lossless `-c copy` cuts | pipeline | never |
| `delivered/` | blurred derivative | pipeline | re-encoded on re-run |
| `trimmed/` | the finished product | **reviewer, on Approve** | replaced on re-approve, deleted on Reject |

Changing blur settings is a re-derive from local masters: no re-download, no
re-detection. Existing approved segments are re-cut from the new `delivered`
automatically, so a settings change can never leave stale output in `trimmed/`.
Facebook uses only `source/` and `trimmed/`; it has no `clips/` or `delivered/`
intermediate stage.

## Review outputs

`trimmed/` is the finished-product folder. Nothing lands there until a reviewer
approves.

- **Approve** cuts the marked shots out of the *delivered* clip (the blurred
  video they actually watched) into `trimmed/{clip_id}_tNN.mp4`. Untrimmed, that
  is one file, stream-copied; otherwise one file per shot, with no fixed maximum. The reviewer
  marks a shot by parking the playhead on the impact and pressing **Mark cut**,
  which builds `impact ± 5s` and shrinks it automatically if it would run off
  the clip or into another shot. Overlaps show red on the timeline and block
  Approve until resolved. See [`GUIDE.md` §2.5](./GUIDE.md).
- **Reject** deletes that clip's files from `trimmed/` and nothing else. The
  master, the delivered clip and the downloaded source all survive, so a
  rejection is always recoverable.
- Re-approving replaces the previous shots, so shrinking the shot count never
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
