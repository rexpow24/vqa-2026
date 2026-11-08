# Architecture

## Data

Migration `supabase/migrations/20261107_answer_adjudication.sql`.

- `answer_adjudications(draft_id pk → video_drafts cascade, annotator_ids uuid[], final_verdict, final_answer, final_keyframes_s numeric(9,3)[], llm_suggestion, followed_llm boolean, decided_by → user_profiles set null, decided_at)`.
- `label_adjudications(video_id pk → videos cascade, annotator_ids uuid[], event_label, llm_suggestion, followed_llm, decided_by, decided_at)`.
- RLS: select for admins and for `auth.uid() = any(annotator_ids)`; no write grants. Writes go through the `import_adjudications(rows jsonb)` security-definer RPC, which checks `is_admin()`.
- `effective_answer(verdict, edited_answer, draft_answer)` and `normalize_answer(text)` (trim, collapse whitespace).
- Views, `security_invoker`, admin use only (annotators see only their own rows through RLS, so the view is meaningless to them):
  - `final_answers`: per draft whose video has a completed assignment. Columns `draft_id, video_id, qgroup, annotators, annotator_ids, source, final_verdict, final_answer, final_keyframes_s, fingerprint`.
  - `final_video_labels`: per video, `video_id, annotators, annotator_ids, source, event_label, fingerprint`.
  - `fingerprint` = md5 over the completed annotators' rows (annotator id, verdict, reason, note, edited answer, keyframes; or event label), ordered by annotator id. A change to any of them, or a new completed annotator, changes it.

## Triggers

- `validate_qa_annotation` (extends the 20261105 version):
  - edited answer only with DISAGREE;
  - DISAGREE needs an edited answer whose normalized text differs from the draft's;
  - an update by an annotator listed in the draft's decision is refused.
- `validate_video_label`: an update by a listed annotator is refused.
- `guard_adjudicated_delete` (BEFORE DELETE on both tables): refuses the delete for a listed annotator. It allows the delete when the draft, video or profile is already gone, so cascades still work.
- `validate_assignment`: completion is refused while an answer is AGREE/NOT_ANSWERABLE with an edited answer (legacy rows).

## Routes

- `GET /api/admin/adjudications/export` (admin): reads `final_answers` / `final_video_labels` where `source = 'conflict'`, joins the raw rows and user names, and returns `text/csv` with a BOM.
- `POST /api/admin/adjudications/import` (admin): body `{ rows }` (the browser parses the CSV and sends chunks of 200). It normalizes keyframes and the yes/no column, then calls the RPC.
- `POST /api/drafts/[id]/annotation`: 422 on an inconsistent verdict/answer.

## UI

- `HostedLabeling` / `DraftCard`:
  - "Sửa đáp án" appears only under DISAGREE, and DISAGREE is blocked until the answer is edited;
  - a legacy-row warning;
  - a locked card that shows the final answer.
- `annotate/[videoId]/page.tsx` loads the caller's decisions.
- `/admin`: the `Adjudication` section, with an `AdjudicationImport` client component that uses `lib/csv.ts` (an RFC 4180 parser and writer, BOM-safe).

## Seams kept

Raw tables are written only by annotators. Difficulty views are untouched. The queue is untouched.
