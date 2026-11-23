# Tasks

| # | Slice | Proving test |
|---|---|---|
| T1 | E.v5 codebook + copy + index | tests/test_codebook_copies.py; form.test.ts currentVersion |
| T2 | Form limit (entityProblems, EntityCard) | form.test.ts |
| T3 | Migration: seed E.v5, limit in save_video_entities, E.v5 cell rules | psql on local DB in a rolled-back transaction |
| T4 | Route: current version + 422 | verify-entities.mjs against local routes |
| T5 | Guidelines E, C (md x2, html) | grep for acceptance 7 + read-through |
| T6 | IAA E.v5 | tests/test_iaa_round.py |
| T7 | Docs fold-up | read-through |
