# Requirements

## Verified facts (2026-11-08)

- **Drive leak, proven by a probe with a temporary annotator:**
  - an annotator reads `drive_file_id` for all 1496 videos through the Supabase REST API (`videos_read` lets any annotator read every `available` video, all columns);
  - an anonymous `drive.google.com/uc?id=…` request returns the original file (206 `video/mp4`), because the stream route relies on link sharing.
- Self-claim of any video is allowed (`assignments_insert` policy, `/api/videos/{id}/claim`).
- `video_drafts_read` also opens every `available` video's drafts to any annotator.
- 13 assignments exist:
  - 4 have answers (1 completed with 9 answers, 3 in progress with 3, 1, 1);
  - 9 are pending with 0 answers.
- Review labels (`difficulty`, `event_label`) live in each teammate's local `pipeline.db` (`reviews`, joined by `clip_id` = filename without `_tNN.mp4`):
  - this machine covers 675 of the 689 videos in `videos-quyen.csv`;
  - the other 807 belong to the teammate and are not available yet;
  - `video_reference_labels` is empty.
- Admin pages read `drive_file_id` through the session client (`admin/videos/page.tsx`, `api/admin/videos`, video import).

## Decisions

- **Drive id hidden from every session client:** `select` on `videos.drive_file_id` is revoked from `authenticated`. The stream route and admin pages read it with the privileged client, after their own access check. Annotators see a video row only when it is assigned to them.
- **Assignment-only labeling:**
  - only admins create assignments;
  - the claim route refuses;
  - drafts and videos are readable only by the assignee (or an admin).
- **Exclusive regular videos:** a video outside the agreement group can have at most one annotator. Agreement videos can have several.
- **Numbering:**
  - `videos.seq`: the agreement group is 1..N, the rest N+1.. by filename;
  - new imports take the next number;
  - regrouping (and with it renumbering) is refused once any non-legacy assignment exists, so an assigned range never shifts.
- **Agreement group:**
  - the admin chooses N (50-100 recommended);
  - stratified by reference `event_label` × `difficulty`, with a largest-remainder proportional allocation;
  - within a stratum, ordered by `md5(drive_file_id)`;
  - only active, assignable videos with 9 drafts and reference labels;
  - replaces the old 224-video `agreement_sample`;
  - the admin assigns the whole group to the chosen annotators in one action.
- **Range assignment:** an admin gives an annotator `from..to` with a batch label. Agreement videos, videos already taken and videos without 9 drafts are skipped and reported. The page suggests the next free range. Unassigning a range removes only assignments with no answers and no event label.
- **Annotator label:** `user_profiles.label`, free text, edited on `/admin/users`.
- **Reference labels import:**
  - the existing `scripts/export_labels_csv.py` reads a `pipeline.db` read-only and writes `video_id,difficulty,event_label`, per shot, with `video_id` = filename without `.mp4`;
  - the admin uploads that CSV (or a merged one);
  - a key may also be a full filename or a `clip_id`, which applies to every shot of the clip.
- **Annotator list:**
  - only their assigned videos, ordered by number, 10 per page;
  - numbered page links 1..n plus a "go to page" box;
  - search by number or filename;
  - completed videos stay listed with their status, so they can be revisited;
  - "next video" after completing is the next unfinished assigned one.
- **Legacy:** keep the 4 assignments with answers (batch `legacy`); delete the 9 without answers, and their event labels.
- The 114 MB Facebook clip that Drive will not stream is marked not assignable (`available = false`).

## Out of scope

- Computing kappa (Fleiss' kappa for three annotators later).
- Making the Drive files private and streaming with credentials. That is stronger than hiding the ids and worth doing later: today a leaked id still opens the file.
- Hiding the YouTube source id embedded in filenames.
