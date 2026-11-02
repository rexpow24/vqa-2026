# Requirements

## Verified facts

- Production has 1496 active videos with 9 drafts each, and 0 assignments, 0 annotations, 0 labels (read 2026-11-02), so no existing work needs migrating.
- Opening a video claims it (`POST /api/videos/{id}/claim`), which inserts a `video_assignments` row.
- `/complete` takes `annotator_queue(page_size=1)` as the next video.
- `fb_ca1ee5326f08417c8193d7bab278891a_full_t01.mp4` does not stream: Drive answers its virus-scan page because the file is 114 MB.

## Decisions (user delegated the details)

- Sample size: 15% of the active videos, 224 rows. The 10-20% range is a common rule of thumb, not a measurement from this project.
- Selection: lowest `md5(drive_file_id)`, stored in a column, so it is random-like, reproducible and does not shift later.
- The unplayable Facebook video is excluded, since it cannot produce a pair.
- Videos imported later are not added to the sample.
- A video already meeting its target stays visible at the tail, because excluding it would change the rule that everyone else can still see a video.

## Acceptance criteria

See `acceptance.md`.

## Out of scope

Computing agreement, admin reporting on the sample, UI changes.
