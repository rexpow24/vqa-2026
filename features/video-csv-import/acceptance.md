# Video CSV import - acceptance

`verify` = `cd frontend && TEST_BASE_URL=http://localhost:3000 node scripts/verify-video-import.mjs` against a dev server in hosted mode.
Fixture rows use filenames prefixed `zzz-import-test-` and are deleted in the script's `finally`.

| # | Criterion | How to check | Covers |
|---|---|---|---|
| A1 | 3 new valid rows → 3 `inserted`; each DB row's `filename`, `drive_file_id`, `duration_s` equals the CSV, `status = 'active'`, `available = true` | verify: POST chunk, then select by filename | req 1 |
| A2 | Same CSV posted again → 3 `skipped`, row count unchanged | verify: second POST, count | req 2, conflict 5 |
| A3 | Existing filename with a different Drive id → `conflict`, `existing_drive_file_id` = stored id, stored id unchanged | verify | req 3, decision 1 |
| A4 | Mixed chunk: 1 good, 1 Drive-404 id, 1 `duration_s = 0` → exactly 1 `inserted`, the other two `failed` with reasons naming Drive and duration; neither in DB | verify | req 4, decision 2 |
| A5 | Missing column, extra column, empty chunk, 101 rows, csv > 2 MB → each 422, `videos` count unchanged | verify | req 5 |
| A6 | Missing column and 101 rows → 422 returned in < 1.5 s, i.e. before any Drive probe (one probe alone costs > 2 s) | verify: time the request | req 5 |
| A7 | Same filename twice in one chunk → first `inserted`, second `skipped` | verify | req 6 |
| A8 | Drive id already stored under another filename → `failed`, reason contains that filename | verify | default #4 |
| A9 | Annotator session → 403 JSON; no cookie → 401 JSON; `videos` unchanged | verify | req 7, data owner |
| A10 | Single-add route: valid id → 201; id that Drive answers 404 → 422 "Drive file is not a seekable video" | verify | req 8, shared probe |
| A11 | `chunkVideoCsv` on a 250-row file with a blank line and CRLF → chunks of 100/100/50, each chunk's `lines` are the original 1-based file line numbers, header repeated in each chunk | verify: imports `src/lib/video-csv.ts` directly | req 9, conflict 1 |
| A12 | `headerError` returns null for `filename,drive_file_id,duration_s` (with BOM, any order) and a message for a missing or extra column | verify | req 5 |
| A13 | On `/admin/videos`, import `videos.smoke.csv` → report "3 đã nhập", the 3 videos appear in the list; import again → "3 bỏ qua" | Manual in the browser on the dev server, then on the deployed app | req 1, 2, UI |
| A14 | `npm run lint` and `npm run build` in `frontend/` pass | command | regression |
| A15 | `python -m pytest tests -q` passes | command | repo law |
