# Tasks

Each task is a vertical slice with its proving test. The SQL lives in one migration file, applied once per task as it grows (it is idempotent).

## T1 - Verdict and answer must agree

- Trigger, API and UI enforce: edited answer only with DISAGREE; DISAGREE needs one that differs from the draft.
- Completion refuses legacy rows; `annotator-report` flags them.
- Existing scripts send an edited answer with DISAGREE.
- Proof: `verify-adjudication.mjs` section "Consistency" (acceptance 1, 2), and acceptance 8.

## T2 - Final answers and conflicts

- `effective_answer`, `normalize_answer`, the `final_answers` and `final_video_labels` views, and the fingerprint.
- Proof: section "Final answers" (acceptance 3, 4).

## T3 - Decisions, import and lock

- The two decision tables, RLS, the `import_adjudications` RPC, the lock triggers and the cascade escape.
- Proof: sections "Import" and "Lock" (acceptance 6, 7) through the RPC.

## T4 - CSV routes and admin UI

- `lib/csv.ts`, the export and import routes, and the admin section.
- Proof: section "HTTP" (acceptance 5, 6 over HTTP).

## T5 - Annotator view of the decision

- The video page loads the decisions; a locked card shows the final answer.
- Proof: acceptance 9 in the browser.
