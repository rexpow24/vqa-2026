# Video CSV import - overview

## Desire (user's words, 2026-10-27)

> Làm tính năng import CSV video trên trang Admin (filename,drive_file_id,duration_s, đúng định dạng của videos.smoke.csv/videos.csv).
> Mỗi dòng vẫn được kiểm tra Drive như khi thêm tay, video trùng tên thì bỏ qua.

Context from the same conversation:

- "hiện tại vẫn làm thủ công add từng drive file id đúng k ? tôi muốn gửi csv này lên thì nó import vào database à"
- Today the only way to create a `videos` row on the hosted app is the single-video form on `/admin/videos` (`POST /api/admin/videos`), one Drive file id at a time.
- `frontend/scripts/drive-upload.mjs` already produces the CSV: header `filename,drive_file_id,duration_s`, one row per file appended as each upload returns.
- 77 files in `finished/`; 3 uploaded so far to the new Drive folder (`videos.smoke.csv`).
- Supabase video tables were emptied on 2026-10-27 at the user's request (backup: `backups/supabase-videos-2026-10-27.json`).

## Out of scope (not asked for)

- Importing the 9 QA drafts per video - a separate, existing per-video CSV flow.
- Uploading files to Drive from the browser.
