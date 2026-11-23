# Conflict audit

| # | Possible collision | Probe | Result |
| --- | --- | --- | --- |
| 1 | Editing a committed codebook rewrites stored answers | O.v2 is local only: CLAUDE.md "Group O.v2" row and handoff say "Not applied to production yet"; no production credentials on this machine to probe further (known from docs, not from a query) | no stored O.v2 rows in production; local DB is reset |
| 2 | `level.not_assessed` read by other code | `grep not_assessed` over `frontend/src`, `scripts`, `tests`, `supabase` | only O.v2 copies, `deriveOutcome`, `composeOutcomeSigns`, `validate_outcome_slots`, tests, guideline. All changed here |
| 3 | `outcomeConflict` blocks completion when stored level differs from the derived one | `outcome.ts` compares stored level with `deriveOutcome` | a local row stored with `not_assessed` would now block `complete` with "tải lại trang"; the page sync re-derives it. Only local rows exist |
| 4 | Sign labels used as keys | IAA (`slot_signature`) and `audit_slot_disagreements` key on option IDs; `test_audit_slot_disagreements` prints labels | one test asserts the old label text; update it |
| 5 | Sentence text changes for already composed answers | `edited_answer` of O is re-composed on save and sync | only local rows |
| 6 | V/Prev already done | `qgroups.json` has no V; Prev.v4 `inferred_from: C`; migration `20261122160000` | nothing to build; verified in the app at step 07 |
| 7 | Guideline edits must be minimal (rule 60) | edit only the lines naming the changed options | respected |

Verdict: **PASS** (no blocking conflict; #3 and #5 affect only local data).
