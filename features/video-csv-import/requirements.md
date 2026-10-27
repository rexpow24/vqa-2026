# Video CSV import - requirements

## Reality

| Claim | What is actually true | Differs? |
|---|---|---|
| "Hiện tại vẫn làm thủ công add từng drive file id" | True. The only writer of `videos` on the hosted app is `POST /api/admin/videos` ([route.ts](../../frontend/src/app/api/admin/videos/route.ts)), one JSON body per video. The CSV box on `/admin/videos` is for the 9 QA drafts of one existing video (`video_id,qgroup,...`), not for videos. | No |
| CSV format `filename,drive_file_id,duration_s` | Exactly what `drive-upload.mjs` writes: header `filename,drive_file_id,duration_s`, no quoting, `duration_s` from ffprobe rounded to 3 decimals (`6`, `5.5`). Appended per file, LF line endings. | No |
| "Kiểm tra Drive như khi thêm tay" | The manual route probes `https://drive.google.com/uc?export=download&id=<id>` with `Range: bytes=0-0`, requires status `206` and `content-type` starting `video/`; network failure → 502, other failure → 422. | No |
| "Trùng tên thì bỏ qua" | `videos.filename` is `UNIQUE` (`20261004_videos_filename_unique.sql`), and so is `videos.drive_file_id`. A second insert with the same name fails with a unique violation today. | Partly: a duplicate **drive_file_id** under a new name is a second, distinct collision the request did not name. |
| Drive probe cost | Measured 2026-10-27 from the dev machine: 2.3-3.1 s per id (redirect followed), 0.9 s for a missing id (`404 text/html`). 77 rows sequentially ≈ 3 min. | New fact |
| Old Drive folder | An id from the old folder (`1TKRB0hq…`) still answers `206 video/mp4`, so the probe alone cannot tell old folder from new. | New fact |

Binding constraints:

- Hosted Next.js on Vercel (`regions: ["syd1"]`), Supabase is the store. No `app.py` work (frozen legacy).
- Writes go through the caller's session client so RLS (`videos_admin_write`) still guards them; admin only (`requireApiProfile("admin")`).
- Admin API routes answer JSON, never a redirect (CLAUDE.md, hosted latency row).

## Assumptions

- `verified` - `csv-parse` is already a dependency and used with `{ columns: true, bom: true, skip_empty_lines: true, trim: true }` in the drafts route; the same options read `videos.smoke.csv`.
- `verified` - 3 smoke rows in `videos.smoke.csv` all probe `206 video/mp4`.
- `verified` - Supabase `videos` is currently empty (counted after the 2026-10-27 delete).
- `unverified` - The Vercel function can run long enough for a 77-row import with bounded concurrency (≈ 77 / 6 × 3 s ≈ 40 s). Check: Vercel's default `maxDuration` for this project's plan; probe in 01.
- `unverified` - Drive does not rate-limit ~6 concurrent `uc` probes from one Vercel IP. Check: run the 77-row import once against a dev server and look for non-206 answers on known-good ids.

## Open questions

| # | Question | Why it matters | My default | Level | Status |
|---|---|---|---|---|---|
| 1 | Filename already in Supabase but with a different `drive_file_id` | Exactly what a Drive folder change produces; silent skip leaves the old id serving | Skip, but report separately as "trùng tên, khác Drive ID" with both ids | 🟡 | ✅ user chose |
| 2 | Some rows invalid | One unshared file must not block 76 good ones | Per-row: import good rows, list bad rows with reasons; re-upload of the same file is safe because imported rows are skipped | 🟡 | ✅ user chose |
| 3 | Same filename twice inside one CSV | Second copy would violate UNIQUE mid-run | First occurrence wins, later ones reported as skipped duplicates | 🟢 | 💭 |
| 4 | `drive_file_id` already used by another filename | UNIQUE on `drive_file_id`, not named in the request | Row fails with reason "Drive ID đã dùng cho <filename>" | 🟢 | 💭 |
| 5 | Where the work runs | Client loop over the single route vs one server route | One server route `POST /api/admin/videos/import` (multipart CSV), probes with bounded concurrency (6), shares the probe function with the single-add route so "same check" holds by construction | 🟡 | 💭 |
| 6 | Size limit | Bound function time and memory | Browser splits any file into chunks of ≤ 100 data rows (conflicts.md #1); the route rejects a chunk > 100 rows or > 2 MB with 422 before any probe | 🟢 | ✅ from 01 |
| 7 | Header strictness | `videos.csv` is machine-written | Exactly the 3 columns, any order; extra/missing column → whole file 422 | 🟢 | 💭 |
| 8 | Race with a concurrent manual add of the same filename | Check-then-insert gap | Unique violation on insert is mapped to "đã có" (skipped), not to an error | 🟢 | 💭 |

## Acceptance criteria

1. On `/admin/videos`, choose `videos.smoke.csv` and import → message reports `3 đã nhập, 0 bỏ qua, 0 lỗi`; `select count(*) from videos` = 3 and each row's `filename`, `drive_file_id`, `duration_s` equal the CSV; the 3 videos appear in the list without a manual reload.
2. **Second run:** import the same `videos.smoke.csv` again → `0 đã nhập, 3 bỏ qua, 0 lỗi`; row count still 3.
3. CSV with an existing filename and a different Drive id → that row is reported under "trùng tên, khác Drive ID" showing both ids; the stored `drive_file_id` is unchanged.
4. CSV mixing 1 good new row, 1 row whose id returns 404 from Drive, 1 row with `duration_s = 0` → exactly 1 inserted; the 2 bad rows are listed with their line number and a reason; neither bad row exists in `videos`.
5. Route given a CSV with a missing or extra column, non-UTF-8 bytes, > 2 MB or > 100 data rows → HTTP 422, nothing inserted, no Drive probe made. The UI shows the header error before sending anything.
6. Same filename twice in one CSV → inserted once, second reported as duplicate.
7. An annotator session calling `POST /api/admin/videos/import` → 403 JSON; anonymous → 401 JSON; `videos` unchanged.
8. The existing single-add form still works and still rejects a non-video Drive id with 422 (regression).
9. A CSV of 250 rows is imported from the UI as 3 chunks (100/100/50), with a progress count during the run and one combined report at the end whose line numbers refer to the original file.
