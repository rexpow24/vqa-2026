# Facebook direct-video branch

## End-to-end flow

1. Queue accepts only `facebook.com` subdomains and `fb.watch` links, one per
   line. Each accepted line receives a unique `fb_<uuid>` internal ID.
2. The Facebook worker downloads via yt-dlp into
   `work/facebook/<id>/source/original.mp4`, probes its duration, and stores
   metadata.
3. One clip spanning `[0, duration]` is inserted into the existing clips and
   reviews tables. No scene detection, calibration, blank filtering, or
   pre-review blur is called.
4. The existing Review tab owns Approve / Reject / Flag and shot trimming.
   `master_path` and `delivered_path` both point at the downloaded original.
5. Approved shots enter `work/facebook/<id>/trimmed/`. Optional Facebook
   anonymize runs separately to `finished/facebook/` with `--skip-dedup`.

## Storage and source identity

`videos.source` is additive and defaults to `youtube`, preserving every
existing row without rewriting its key. The legacy `youtube_video_id` column
continues to hold YouTube IDs and holds generated `fb_<uuid>` IDs for Facebook.
The `source` value is authoritative for selecting a worker, retry, stop, and
Review source label.

```text
pipeline.db
  videos(source, youtube_video_id, canonical_url, status, ...)
  clips(clip_id, youtube_video_id, ..., master_path, delivered_path, ...)
  reviews(clip_id, decision, ...)
  review_segments(clip_id, segment_index, ...)

work/
  <youtube-id>/...                         # unchanged YouTube data
  facebook/
    fb_<uuid>/
      metadata.json
      source/original.mp4
      trimmed/<clip-id>_t01.mp4
      trimmed/<clip-id>_t02.mp4

finished/
  <youtube-file>.mp4                       # unchanged YouTube output
  facebook/<clip-id>_t01.mp4
```

Dedup remains restricted to its existing YouTube source scan. Facebook
anonymize has a separate status/start/pause lifecycle, filesystem root, and
finished output directory; it never consults Dedup state.

## Operations

The Queue page has a separate Facebook URL box, source column, and
source-scoped retry/stranded-row controls. The Run page owns a separate
Facebook start/stop/status section. Only one video-ingest worker may run at a
time, preventing the two workers from claiming or stopping each other's rows.
The shared Review tab displays the source on each clip.

Facebook downloading currently targets URLs accessible to yt-dlp without
configured credentials. Private or login-gated posts return their download
error on the queue row; no YouTube cookie configuration is reused.
