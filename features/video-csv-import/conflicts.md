# Video CSV import - conflict audit

## Conflicts

| # | New vs. existing | What breaks | Verified how |
|---|---|---|---|
| 1 | One import request vs the Vercel function time limit | A Drive probe costs 2.3-3.1 s. One request probing a whole `videos.csv` is bounded by the function's `maxDuration`, which this project does not set and whose plan default I could not read (no Vercel CLI or token here). At the dataset's target size (~1400 rows, CLAUDE.md) a single request would take ~7 min even at concurrency 10, so it would time out and the admin would see a generic error after part of the rows were already inserted. | Measured: 60 probes at concurrency 10 = 11.0 s, slowest 3.1 s (`probe-burst.mjs`, scratchpad). The request size cannot be proven safe without knowing the plan limit, so the design must not depend on it. |
| 2 | Bulk probing vs Drive throttling | Clean. 60 concurrent-10 probes over 6 ids: `{ '206 video/mp4': 60 }`. | Same run as #1. |
| 3 | Import vs other writers of `videos` | `import-labeling-drafts.mjs` (service role) still hardcodes 2 clips with **old-folder** Drive ids. Run after an import, it updates those rows' metadata by drive id lookup, else inserts. With the new folder it would insert old-id rows whose filenames already exist, which then hits the filename UNIQUE and fails. No silent corruption, but the script is stale. | Read `frontend/scripts/import-labeling-drafts.mjs:13-40`. Not in scope; noted for the ship review. |
| 4 | Import vs `videos` consumers | Clean. `annotator_queue` only shows videos with exactly 9 drafts, so imported videos without drafts stay invisible to annotators, which is the intended state. `admin_stats` counts active videos, so imported ones count as videos with 0 assignments, correctly. `/admin/videos` lists all videos and renders two `<select>`s, fine at 77. | Read `20261004_admin_stats.sql:14-24`, `annotator_queue` row in CLAUDE.md, `admin/videos/page.tsx`. |
| 5 | Second run | Clean by design: existing filenames are skipped (requirement 2), and the DB UNIQUE on filename is the backstop for a concurrent add. | Constraint read in `20261004_videos_filename_unique.sql`. Exercised by acceptance criterion 2. |
| 6 | Auth and the proxy | Clean. `proxy.ts` exempts `/api/*` from the page redirect and rejects cross-origin non-GET; `requireApiProfile("admin")` answers 401/403 JSON. | Read `frontend/src/proxy.ts:5-17`, `frontend/src/lib/supabase/auth.ts:39-42`. |
| 7 | Recorded decisions | Clean, and aligned: `20261004_videos_filename_unique.sql` already names filename as "the join key for the bulk CSV flow (videos.csv, ...)". This feature is that flow. | Read the migration header. |

Hypothesis, not reproduced (outside this feature): `/admin/videos` loads every `video_drafts` row in one select. PostgREST caps responses at its `max_rows` (Supabase default 1000), so at ~112 fully-drafted videos the "Bản nháp: n/9" counts would silently go wrong. This feature makes that size reachable but does not cause it; flagged for the ship review.

## Verdict: PASS

## Recommended approach

A server route `POST /api/admin/videos/import` that takes a **chunk** of at most 100 CSV rows, validates the header strictly, probes Drive with concurrency 10 using the **same probe function** extracted from the single-add route, inserts per row through the caller's session client, and returns a per-row report (`inserted`, `skipped`, `conflict` with both ids, `failed` with reason). The browser reads the chosen file, checks the header, splits the data rows into 100-row chunks and posts them in sequence, adding up the reports and showing progress. A chunk is ≤ 10 probe rounds ≈ 30 s worst case, so the route sets `maxDuration = 60`, which every Vercel plan allows, and the total CSV size no longer depends on the plan.

**Trade-off:** an import is no longer one HTTP request. A browser closed mid-run leaves earlier chunks imported. That is safe, because a re-run skips them, but the report from the interrupted run is lost.
**Not doing:** one request for the whole file (fails at dataset size, see #1). A browser loop over the existing single-add route (77-1400 round trips, and the duplicate/conflict classification would have to be rebuilt on the client). A background job table (more machinery than the problem needs).
