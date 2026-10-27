# Video CSV import - architecture

## Shape

| File | Change | Seam |
|---|---|---|
| `frontend/src/lib/drive.ts` (new) | `probeDriveVideo(driveFileId): Promise<"ok" \| "not_video" \| "unreachable">`, moved out of the single-add route unchanged in behaviour | The one definition of "Drive serves this as a seekable video" |
| `frontend/src/app/api/admin/videos/route.ts` | Calls `probeDriveVideo`; same status codes and messages as before | Single-add API, unchanged contract |
| `frontend/src/lib/video-csv.ts` (new, no imports) | `VIDEO_CSV_COLUMNS`, `headerError(headerLine)`, `chunkVideoCsv(text, size = 100)` → `{ header, chunks: { csv, lines: number[] }[] }` | Pure, runs in both browser and Node, so the verify script can test it directly |
| `frontend/src/app/api/admin/videos/import/route.ts` (new) | `POST`, JSON `{ csv }`, admin only, `maxDuration = 60`; returns `{ results: RowResult[] }` | Import API, one chunk per call |
| `frontend/src/app/admin/videos/video-import.tsx` (new) | Client component: file picker, header check, sequential chunk posts, progress, combined report, `router.refresh()` | Rendered first inside `VideoManager` |
| `frontend/scripts/verify-video-import.mjs` (new) | End-to-end checks against `TEST_BASE_URL` plus Supabase fixtures | Test harness, same style as `verify-annotator-queue.mjs` |

`RowResult = { index: number, filename: string, status: "inserted" | "skipped" | "conflict" | "failed", reason?: string, existing_drive_file_id?: string }`.
`index` is the 0-based data row within the chunk; the browser maps it to the original line number through `chunks[i].lines`.

## Data

No schema change.
`public.videos` rows written by the import: `drive_file_id`, `filename`, `duration_s` from the CSV, plus `status = 'active'` and `available = true`, exactly as the single-add route writes them.
Owner: the admin's session client, under RLS policy `videos_admin_write`.
The import route is a second **code path** to the same writer, not a second owner: both go through the same RLS policy and the same UNIQUE constraints, and both use `probeDriveVideo`.

## Flow

```
browser: read file text
  └ headerError? ─ yes → show error, stop (no request)
  └ chunkVideoCsv → chunks of ≤ 100 rows, each with original line numbers
  └ for each chunk in order: POST /api/admin/videos/import { csv }
        server:
          requireApiProfile("admin")          ─ 401 / 403 JSON
          body JSON, csv string ≤ 2 MB        ─ 422
          csv-parse (bom, trim, skip empty)   ─ parse error / non-UTF-8 → 422
          header exactly the 3 columns        ─ 422
          1..100 data rows                    ─ 0 or > 100 → 422
          per row, no network:
            invalid id / empty name / duration ≤ 0 or NaN → failed
            filename seen earlier in chunk                 → skipped
          one select: existing rows by filename ∪ by drive_file_id
            same filename, same id   → skipped
            same filename, other id  → conflict (+ existing id)
            id owned by other name   → failed ("Drive ID đã dùng cho …")
          probe remaining rows, 10 at a time
            unreachable → failed ("Không kết nối được Drive")
            not_video   → failed ("Drive không trả về video phát được")
          insert remaining rows one at a time
            23505 on filename      → skipped
            23505 on drive_file_id → failed
            other error            → failed (message)
          → 200 { results }
        browser: network error or non-200 → stop, keep results so far, show error
  └ router.refresh(); show combined counts + non-imported rows with line numbers
```

## Why this shape

**conflicts.md #1, the function time limit.** A chunk holds at most 100 rows, and probes run 10 at a time, so a chunk is at most 10 probe rounds, about 30 s at the measured worst of 3.1 s per probe. `maxDuration = 60` is allowed on every Vercel plan, so the route fits whatever the project's plan is. The file's total size then only changes how many requests the browser makes.

**conflicts.md #2, Drive throttling.** Concurrency 10 is the value measured clean (60/60 probes `206`).

**conflicts.md #3, `import-labeling-drafts.mjs`.** Not changed. It collides on filename UNIQUE rather than corrupting data, and it is flagged at ship review as stale.

**conflicts.md #5, second run.** Classification reads existing rows before probing, so a re-run skips everything already imported without spending a Drive probe on it. The UNIQUE constraint covers a concurrent manual add.

**"Same check as the manual add".** Both routes call `probeDriveVideo`, so the check cannot drift between them.

## Rejected

- One request for the whole file: about 7 minutes at 1400 rows, past any safe function limit.
- Browser loop over the existing single-add route: 1400 round trips, and skip/conflict classification would have to be rebuilt on the client from a full `videos` read.
- Batch `insert` of all valid rows: one UNIQUE violation fails the whole batch, which breaks per-row outcomes.
- `upsert … ignoreDuplicates`: hides a concurrent duplicate filename without reporting it, and still fails the batch on a `drive_file_id` collision.

Diagrams: one sequence (browser ↔ route ↔ Drive/Supabase) and one row-classification state chart, drawn in step 03.
