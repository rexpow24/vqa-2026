# Mandatory training video before labelling group C

User request, 2026-11-24: every annotator must watch the group C training video before labelling C; start with C, other groups later.

## Decisions (user, 2026-11-24)

- Only group C is locked; the other groups of the same video stay usable.
- "Watched" means the video was played to its end (the `ended` event); seeking is not policed.
- The video is `C-training-full.mp4` (8 min 39 s) on the shared Drive folder, streamed through `/api/references/C-training-full/stream`.
- A completion is keyed by a training id with a version (`C-v1`): a new training video gets a new id and everyone watches it again.
- Admins are not gated; the admin dashboard shows who has completed it.

## Acceptance

- A1 An annotator who has not completed `C-v1` sees the training video in place of the C form; the other cards work.
- A2 Playing it to the end records the completion and opens the C form without a reload.
- A3 `POST /api/drafts/{id}/annotation` for a C draft answers 403 `training_required` until the caller completed `C-v1`, whatever the client sends.
- A4 An annotator can record and read only their own completions.
- A5 `/admin` shows, per annotator, when they completed the C training.
