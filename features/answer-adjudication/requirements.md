# Requirements

## Verified facts (read 2026-11-07)

- `qa_annotations` has one row per (draft, annotator); `video_labels` one per (video, annotator). Both are overwritten on save; `qa_annotation_revisions` logs answer versions.
- Production holds 14 answers: 11 AGREE, 3 NOT_ANSWERABLE, 0 DISAGREE.
- **5 of the 11 AGREE rows carry a rewritten `edited_answer`** (one annotator, one video, `-8mCpnb02Z4_222200_237433_t01.mp4`, assignment in progress). Some rewrites flip the meaning: C "the motorbike rode into the truck's blind spot" became "the truck turned right too abruptly". Cause: the UI offers "Sửa đáp án" under any verdict, and the API and trigger store `edited_answer` whatever the verdict.
- `DISAGREE` does not require a corrected answer today, so a "wrong" draft can end with no right answer.
- One sample video is completed by one annotator; none has two completed annotators yet.
- A sample video can collect more than two annotators (the queue keeps videos past their target reachable).

## Decisions

- **Verdict and answer must agree.** An edited answer is allowed only with `DISAGREE`, and `DISAGREE` requires an edited answer that differs from the draft. AGREE means the draft answer is the answer; NOT_ANSWERABLE means the answer is "Không trả lời được". Enforced by the UI, the API and the trigger.
- Completing a video is refused while one of the annotator's answers still has the old inconsistent shape, so the 5 legacy rows must be fixed before that video counts.
- **Effective answer** of one annotator: AGREE → the draft answer; DISAGREE → the edited answer; NOT_ANSWERABLE → "Không trả lời được". Compared after trimming and collapsing whitespace.
- **Conflict**, per question, among the annotators who completed the video: verdicts differ or effective answers differ. Keyframes never cause a conflict (user, 2026-11-07); the final keyframes are the union of everyone's.
- Event label conflict, per video: labels differ.
- **Final answer** per question: `single` (one completed annotator), `consensus` (two or more, no conflict), `adjudicated` (decided after a conflict), `conflict` (not decided yet, no final answer). Computed at read time from raw rows, except adjudicated decisions, which are stored.
- Adjudication: the two annotators decide together with an LLM suggestion they obtain themselves and the guidelines (user). Admin downloads a CSV of open conflicts and uploads the decided CSV.
- The upload stores the final verdict, final answer, final keyframes (C/V/Attr, default the union), the LLM suggestion (optional) and whether the final followed it (required).
- A CSV row whose underlying answers changed after export is refused as stale, not applied.
- After a decision the involved annotators' rows for that question (or that event label) are locked. Annotators who were not part of the decision are unaffected, and cannot read it, so a later annotator is not anchored by it.
- Involved annotators see the final answer on the video page (user).
- Raw rows are never modified; agreement and difficulty keep reading them.

## Acceptance criteria

See `acceptance.md`.

## Out of scope

- Computing kappa (the raw data stays available for it).
- Calling an LLM from the system.
- An in-app adjudication screen; the CSV round trip is the interface.
- Exporting the final dataset.
