# Conflict audit

| # | Seam | Probe | Finding | Resolution |
|---|---|---|---|---|
| 1 | Stored O.v1 rows (local 1, production 243+ in the agreement export) | Read `validate_qa_annotation` (20261116100000): `validate_slots` runs on every insert/update of a SLOTS row with the row's own `codebook_version` | O.v1 rows keep validating against O.v1 content; nothing rewrites them | The new O rule runs only for a book that has the `signs` cell, so O.v1 is untouched |
| 2 | Generic multi-select validation (20261119100000) | Read `validate_slot_cells` | Every option of a multiple cell must sit under `parent_cell` when the cell has one | `signs` has no `parent_cell`; each option carries `level` instead, checked by the new O rule |
| 3 | C to O consistency | `problems()` in form.ts; DB leaves C/O to the form | v1 kept the C/O rule in the form only, so a later C edit could leave a contradicting O | Server derives O from the caller's C on O save, on C save, and on page sync; `complete` refuses a video whose O.v2 contradicts its C |
| 4 | Guideline tests (tests/test_codebook_map.py) | `_newest("O")` must match `docs/guidelines/O-hau-qua.md`; `test_frozen_o_signs_per_level_match_the_guideline_table` reads the v1 sign table from the same file | Rewriting the guideline for v2 breaks the v1 sign-table test | Retarget that test at the newest codebook's `signs.level`; it is about the guideline, which follows the newest book |
| 5 | Two copies of the O guideline | `diff docs/guidelines/O-hau-qua.md annotator-guidelines/huong-dan/06-O-hau-qua.md` is empty | Annotators read the second copy, tests read the first | Write both from one text; regenerate the HTML |
| 6 | IAA scripts | `slot_signature` drops `required: false` cells by reading `codebook/<version>.json` | O.v2 works without code changes except order of `options` | Sort multi-select `options` in the signature so a different click order never counts as disagreement; pin with a test |
| 7 | `verify-slots.mjs` (local E2E) | Reads O with `level.unclear` and `O.v1` through the route | Already stale: it also saves V, which returns 410 since 48502d4 | Not used as evidence here; noted in ship review |
| 8 | Adjudication, revisions, answers export | Read `answers_export` (20261118100000) | Generic over `slots` and `codebook_version` | No change |

## Verdict: PASS
