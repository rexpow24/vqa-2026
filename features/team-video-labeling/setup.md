# Hosted Labeling setup

The live site is [vqa-vn-traffic-labeling.vercel.app](https://vqa-vn-traffic-labeling.vercel.app).
The Vercel project is `quyen244s-projects/vqa-vn-traffic-labeling` and its Root Directory is the local `frontend` folder for CLI deployment.
Its framework preset is Next.js.
Production and Preview have `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the secret `SUPABASE_SECRET_KEY`.
Queue, Run, Review, Relabel, Prompts, Export, local media, and sidecar routes return 404 on Vercel.

## Supabase

Both [`20261003_team_video_labeling.sql`](../../supabase/migrations/20261003_team_video_labeling.sql) and [`20261003_qa_labeling.sql`](../../supabase/migrations/20261003_qa_labeling.sql) were applied to Supabase project `xjktuhpvcmkjshmutcdv`.
The root [migration runner](../../scripts/apply-team-labeling-migration.mjs) reads the ignored `DB_CONNECTION` value from `.env` and accepts a migration filename as its first argument.
The first admin is already created.
Its temporary password is in ignored `frontend/.admin-credentials`; remove that file after storing the password securely.
In Supabase Authentication settings, disable public signup and set minimum password length to four if four-character account passwords are required.
The application and RLS deny users without an enabled profile even before public signup is disabled.

## Administrator CSV

Open `/admin/videos`, select the video, and click **Tải mẫu CSV**.
Fill each `answer` cell and optionally fill `difficulty` and `event_label` with the same reference labels on all nine rows.
Keep the header `video_id,qgroup,question,answer,difficulty,event_label` unchanged and save as UTF-8 CSV.
The `video_id` in the template is already the Supabase UUID for the selected video.
Upload the completed file on the same page.
The UI and database require exactly nine distinct groups and reject replacement once annotator work exists.
The reference labels are stored in an admin-only table.

## Drive upload

`scripts/drive-auth.mjs` authorises once and `scripts/drive-upload.mjs` then uploads every `finished/*.mp4` and writes `videos.csv` (`filename,drive_file_id,duration_s`).

A **service account does not work here**: it has no Drive storage quota of its own, so uploading into a folder in a personal My Drive fails with `storageQuotaExceeded` because the file would be owned by the service account. Service accounts only work against a Shared Drive, which requires Google Workspace. Authorising as the account that owns the folder avoids that entirely.

Create the OAuth client once in [Google Cloud Console](https://console.cloud.google.com/): enable the Google Drive API, set the OAuth consent screen to External and add the Drive owner's Gmail as a test user, then create an OAuth client ID of type **Desktop app**.
Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_DRIVE_FOLDER_ID` in `frontend/.env.local`.

The scope is `drive.file`, which grants access only to files this script creates — never the rest of the user's Drive.
The output CSV doubles as the resume ledger: a filename already listed is skipped, so an interrupted run continues rather than uploading duplicates, and the script never needs to list the folder.
`node scripts/drive-upload.mjs --limit 2` uploads a couple of files first when trying it out.

## Existing drafts

Two local shot videos with nine latest-version VLM drafts each were imported using [`import-labeling-drafts.mjs`](../../frontend/scripts/import-labeling-drafts.mjs).
The script checks the video SHA-256 against each local draft before import.
The original Drive clip was copied to H.264 for browser playback and currently waits for an administrator CSV.
The original file remains in Drive.
Local historical judgments were not imported because their free-form annotator IDs have not been mapped to Supabase Auth IDs.

## Verification

From `frontend/`, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
Run `node scripts/verify-annotator-queue.mjs` for the work queue: completed videos leaving the annotator's own queue, progress counts, coverage ordering, and the next-video handoff.
That script's HTTP half needs a hosted-mode server, which locally means `PLATFORM_MODE=hosted npm run dev -- -p 3001` and `TEST_BASE_URL=http://localhost:3001`; without `TEST_BASE_URL` only the database half runs.
Run `node scripts/verify-deployment.mjs` for production session, page, and Drive byte-range checks.
Run `TEST_BASE_URL=https://vqa-vn-traffic-labeling.vercel.app node scripts/verify-labeling.mjs` from a shell that supports that variable syntax for the full labeling and admin lifecycle check.
The PowerShell equivalent is to set `$env:TEST_BASE_URL`, run the command, and remove that environment variable.
The verification scripts create temporary accounts or videos and remove them on completion.
The Google Drive folder currently gives anyone with its link writer access, so the videos can also be accessed outside the app.
