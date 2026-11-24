# Mandatory welcome video and the "Hướng dẫn" tab

Owner decision, 2026-11-24: a new tab "Hướng dẫn" holds a welcome video about the app, followed by the group training videos (C and E).
Every annotator must watch the welcome video to the end before labelling anything.

## Decisions

- The welcome training has the id `WELCOME-v1` and the reference video id `welcome`; it is not tied to a question group.
- Its Drive id is not known yet: `welcome` is listed with an empty Drive id, and the reference stream answers 404 until a real id is set in `scripts/build-c-references.mjs` and `C.json` is rebuilt.
- "Watched" means the video was played to its end (the `ended` event), as for the C and E trainings.
- Admins are never gated.
- Until the welcome video is uploaded, no annotator can complete `WELCOME-v1`, so this must not reach production before the Drive id is set.

## Acceptance

- W1 `/huong-dan` shows "Video welcome (bắt buộc)", "Hướng dẫn nhóm C" and "Hướng dẫn nhóm E", each with its player and whether it is watched.
- W2 Playing a video to the end on `/huong-dan` records its training for an annotator; after the welcome video the page shows "Đã xem" and "Bắt đầu gán nhãn".
- W3 The navigation shows "Hướng dẫn" next to "Gán nhãn" for every signed-in user in hosted mode.
- W4 An annotator without `WELCOME-v1` who opens `/annotate` or `/annotate/{id}` is sent to `/huong-dan` before any video data is read.
- W5 The annotation save route and the entities route answer 403 `training_required` while `WELCOME-v1` is missing, even when `C-v1` and `E-v1` are done.
- W6 `/admin` shows, per annotator, when they watched the welcome video (`reference_view_stats().training_welcome_completed_at`).
