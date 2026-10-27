# Video CSV import - spec

## Problem

An admin who has just run `drive-upload.mjs` holds a `videos.csv` with one row per uploaded file (`filename,drive_file_id,duration_s`).
To get those videos into the hosted labeling app today they must copy each Drive id, name and duration into the single-video form, one at a time.
That is 77 entries now and about 1400 at the dataset's target size.
They want to hand the CSV to the admin page and have it import the rows, with each row checked against Drive the same way the form checks it, and with videos already present left alone.

## Behaviour

- `/admin/videos` has a section "Nhập video từ CSV" with a file picker and an import button.
- Choosing a file whose header is not exactly the three columns `filename`, `drive_file_id`, `duration_s` (any order) shows an error immediately and sends nothing.
- During an import the section shows progress as rows processed out of total.
- At the end it shows one report: counts of imported, skipped, conflicting and failed rows, then every non-imported row with its line number in the original file and a reason.
- A row is **imported** when its filename is new, its Drive id is unused, its duration is a positive number and Drive serves the id as a seekable video (`206` + `video/*`).
- A row is **skipped** when a video with the same filename and the same Drive id already exists, or when the same filename already appeared earlier in the file.
- A row is a **conflict** when a video with the same filename exists with a different Drive id. Nothing is written, and the report shows both ids.
- A row **fails** when a field is invalid, the Drive id belongs to another filename, or Drive does not serve it as a video.
- The video list refreshes after the import without a manual reload.
- Importing the same file again imports nothing and skips every row that was imported before.
- The single-video form keeps working as before.

## Scope

- New admin API route accepting up to 100 CSV rows per request.
- Shared Drive probe used by both the single-add route and the import route.
- Browser-side header check, chunking, progress and combined report on `/admin/videos`.
- A verification script in `frontend/scripts/` in the style of the existing `verify-*.mjs`.

## Non-goals

- Importing QA drafts or reference labels: the existing per-video drafts CSV covers that, and the user did not ask to merge them.
- Updating an existing video's Drive id: the user chose skip + warn. A deliberate re-point is "delete, then import".
- Uploading video files from the browser to Drive: `drive-upload.mjs` owns Drive writes and holds the OAuth token locally.
- Server-side resume of an interrupted import: a re-run already skips what was imported, so a job table would add machinery and nothing more.
- Fixing the 1000-row `video_drafts` read on `/admin/videos` (conflicts.md hypothesis): this feature does not cause it, so it is flagged at ship review.

## Decisions

- **Same filename, different Drive id → skip + warn with both ids.** User choice, 2026-10-27. Trade-off: re-pointing a video to a new folder still needs a manual delete first.
- **Per-row outcome, not all-or-nothing.** User choice, 2026-10-27. Trade-off: the DB can hold a partial import between two runs; the re-run is what completes it.
- **Browser chunks the file into ≤ 100-row requests.** From conflicts.md #1. Trade-off: closing the tab mid-run loses that run's report, though not its inserted rows.
- **Same filename twice in one file → first wins, later rows skipped.** Default.
- **Drive id already used by another filename → row fails with the owning filename.** Default.
- **Concurrent insert of the same filename → reported as skipped**, via the UNIQUE violation, not as an error. Default.
