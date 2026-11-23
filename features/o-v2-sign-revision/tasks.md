# Tasks

| # | Slice | Proving test |
| --- | --- | --- |
| T1 | Codebook data: labels, new sign, no `not_assessed`, three copies byte-identical, migration sha | `tests/test_codebook_copies.py::test_o_v2_*` |
| T2 | Derivation + compose: unclear C -> none; only none takes no sign | `form.test.ts`, `compose.test.ts` |
| T3 | Database rule: `validate_outcome_slots` without `not_assessed` | `verify-outcome.mjs` against local Supabase |
| T4 | Guideline lines for the changed options | read-through (doc only) |
| T5 | V/Prev verification in the running app | acceptance 5 |
