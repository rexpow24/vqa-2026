# Tasks

| # | Slice | Proving test |
|---|---|---|
| T1 | O.v2 codebook, frontend copy, index registration | tests/test_codebook_copies.py (copy, sha256, content) |
| T2 | `deriveOutcome` + compose O.v2 | compose.test.ts / form.test.ts new cases |
| T3 | Form O.v2 (fields, derived level, exclusive minor sign, problems) | form.test.ts |
| T4 | Migration: seed O.v2, `validate_outcome_slots` | psql against local DB, rolled back |
| T5 | Save route, C save, page sync, complete check | typecheck + lint; local route probe if a dev server is available |
| T6 | Guideline O (both md, html) + test_codebook_map retarget | tests/test_codebook_map.py O cases |
| T7 | IAA signature sorts multi-select options | tests/test_iaa_round.py, tests/test_audit_slot_disagreements.py |
| T8 | Docs fold-up | read-through |
