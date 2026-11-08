# Acceptance

Proven by `frontend/scripts/verify-adjudication.mjs` (with `TEST_BASE_URL` for the HTTP lines) unless noted.

1. Saving AGREE or NOT_ANSWERABLE with an edited answer is refused by the trigger and by the API (422).
2. Saving DISAGREE without an edited answer, or with the draft's text, is refused by the trigger and by the API (422).
3. A video with one completed annotator has `single` final answers equal to that annotator's effective answers, and a `single` event label.
4. A double-labelled video gives:
   - `consensus` where verdicts and normalized answers match, with the union of keyframes;
   - `conflict` (no final answer) on AGREE vs DISAGREE and on two different edits;
   - an event `conflict` when labels differ.
5. The export CSV (admin) lists exactly the open conflicts of the test video, with fingerprints; an annotator gets 403.
6. Import:
   - a row with a wrong fingerprint is `stale`;
   - a row for a non-conflicting question is `not_conflict`;
   - DISAGREE with no answer is `invalid`;
   - valid rows are `saved` and the views turn `adjudicated` with the decided values;
   - re-uploading the same decision is accepted.
7. After a decision:
   - an involved annotator cannot update or delete that answer or event label;
   - they can read the decision;
   - an uninvolved annotator cannot read it;
   - deleting the video and the users still succeeds.
8. Existing checks still pass: `verify-labeling`, `verify-difficulty`, `verify-revisions`, `verify-annotator-queue`.
9. Browser, local dev server: "Sửa đáp án" only under Sai; a decided question shows the final answer and is locked; the admin section downloads and uploads.
