# Spec

## What

One final answer per question and one final event label per video, derived from the annotators' independent labels, with a CSV round trip for the questions where they disagree.

## Why

Two annotators labelling the same video produce two answers.
The dataset needs one, agreement needs both untouched, and difficulty needs the raw verdicts.
Keeping the decision in its own table satisfies all three.

## Behaviour

1. Annotators can edit the answer only after choosing "Sai" (DISAGREE), and must edit it before it saves. Switching back to another verdict restores the draft answer.
2. `final_answers` and `final_video_labels` (views) give, for every question and video with at least one completed annotator, the source and the final value.
3. Admin dashboard, section "Thống nhất đáp án": counts of open conflicts and decisions, a "Tải CSV mâu thuẫn" link, and an upload form.
4. The downloaded CSV has one row per open conflict (`kind` = `answer` or `event`), every involved annotator's verdict, reason, answer and keyframes, a link to the video page, a `fingerprint`, and empty decision columns.
5. The uploaded CSV is applied row by row; each row reports `saved`, `stale`, `not_conflict` or `invalid` with a reason.
6. After a decision, the involved annotators see the final answer on the video page and their controls for that question are locked; their stored rows can no longer be changed through any path.

## Non-goals

Kappa, LLM calls, an in-app adjudication screen, dataset export.
