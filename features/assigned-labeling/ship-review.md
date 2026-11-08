# Ship review

## Shipped (production, 2026-11-08)

- Migration `20261108_assigned_labeling.sql`, applied in a single transaction. The first attempt rolled back cleanly: see "Found while testing".
- Frontend deployed with `vercel deploy --prod`. The new routes answer 401 JSON when unauthenticated. This deploy also carried the answer-adjudication feature.
- Drive ids:
  - no session client can read `drive_file_id`;
  - the stream route and admin pages read it privileged.
- Assignment-only labeling:
  - only admins assign;
  - claim is 403;
  - videos and drafts are visible only to their assignee.
- One annotator per regular video; the agreement group takes several.
- `videos.seq` 1..1496 (by filename until an agreement group exists); new imports take the next number.
- `/admin/assignments`:
  - reference label upload;
  - stratified agreement group preview, create and assign;
  - range assign and unassign;
  - per-person ranges and progress.
- `user_profiles.label` on `/admin/users`.
- `/annotate`: own videos by number, 10 per page, numbered pages, "Đến trang", search by number or filename.
- Legacy: 4 assignments with answers kept; 9 untouched ones deleted, with their event labels.

## Verification

- `verify-assignments.mjs`: 33 checks against production.
- Regression on production, all passing:
  - `verify-labeling`;
  - `verify-difficulty` (17);
  - `verify-revisions` (10);
  - `verify-adjudication` (39).
- Locally: `tsc` and `eslint` clean, `pytest` 164 passed.
- Browser on a hosted-mode local server:
  - numbered pages with ellipsis and "Đến trang" (page 3 shows #1594-#1598);
  - search `1590` returns one video;
  - the admin assignment page renders counts, strata, group and range controls, and the people table.
- No test data left on production; the `video_number` sequence was reset to 1496.

## Found while testing

- **Annotators could download the original dataset.** A probe with a temporary annotator read 1496 Drive ids and fetched an original anonymously (206 `video/mp4`). Fixed.
- **`validate_assignment` re-checked completion on every update.** The legacy backfill hit a video completed before the verdict/answer rule existed. It now checks only on the transition to completed.
- **React splits `Trang {n}` into two text nodes** (`Trang <!-- -->2`). Changed to one string.

## Not done

- The agreement group: waiting for the teammate's review labels. Upload them on `/admin/assignments` before assigning any range, because the group cannot change after that.
- Video #46 is held by two legacy annotators (from the old 2-per-video sample).
- Drive files are still link-shared: a leaked id still opens the file. Streaming with credentials would close it.
- Kappa (Fleiss for three annotators).
