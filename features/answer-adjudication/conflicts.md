# Conflict audit

## Probes

| # | Existing thing | Collision | Evidence | Resolution |
|---|---|---|---|---|
| 1 | "Sửa đáp án" works under any verdict; API/trigger store `edited_answer` regardless | AGREE + rewritten answer: the final answer is ambiguous, difficulty undercounts Gemini errors, the effective-answer rule cannot be defined | Query on production: 5 AGREE rows with rewritten answers, one with the opposite cause | Task 1 enforces verdict/answer consistency in UI, API and trigger; completion refuses legacy rows; report flags them |
| 2 | DISAGREE without an edited answer is valid | A wrong draft with no right answer gives adjudication nothing to compare | Trigger and API code (no check) | Task 1 requires the edited answer |
| 3 | `verify-difficulty`, `verify-revisions`, `verify-labeling` insert DISAGREE without an edited answer | They would fail after task 1 | Read the scripts | Update fixtures in task 1 |
| 4 | Queue keeps sample videos reachable past 2 annotators | A third annotator after a decision: a draft-wide lock would stop them from saving and completing; reading the decision would anchor them | Queue rule (Decision Log, Agreement sample) | Store the decided annotators on the decision; lock and read access apply only to them |
| 5 | Deleting a video or a user cascades into `qa_annotations` / `video_labels` | A lock trigger would block the cascade | Cascade FKs in `20261003_qa_labeling.sql` | Lock allows the delete when the parent draft/video/user is already gone; tested by cleanup |
| 6 | `reopen_qa_assignment` reopens on answer delete | A locked answer cannot be deleted, so no reopen happens | Trigger code | Intended |
| 7 | Annotators may edit answers after completing | Answers can change between export and upload | `validate_assignment` allows it | Fingerprint in the CSV; stale rows refused |
| 8 | Derived difficulty reads raw verdicts | Must not read final answers | `20261105_derived_difficulty.sql` | Raw rows never written by this feature |

## Verdict

**PASS**, with task 1 as a prerequisite (probes 1-3).
