# Ship review: E.v5 two main parties + C subject rules

## Shipped (working tree, not committed)

- `codebook/E.v5.json` + frontend copy (E.v4 cells, `max_entities: 2`); registered in `index.ts`.
- `20261123110000_e_v5_two_entities.sql`: seeds E.v5, E.v5 gets the E.v4 cell rules in `validate_video_entity`, `save_video_entities` refuses a list over the book's `max_entities` (hint `too_many_entities`).
- Form: `entityLimit()`, `entityProblems` reports `_list`; `EntityCard` hides "+ Thêm bên" at the limit and states the two-party rule.
- Route `PUT /api/videos/[id]/entities`: saves under `currentVersion("E")`; 422 `too_many_entities`.
- Guidelines (both copies of E and C, HTML): two-party rule; SHRP 2 subject rules with citation; stale C lines removed (event type "không rõ", 3+ object line, 3+ section, unclear-event template).
- `iaa_round.py` treats E.v5 like E.v4.
- `frontend/scripts/verify-entities.mjs`.
- Docs: CLAUDE.md Decision Log, architecture.md 15c, TODO.md bug row.

## Verification

| Check | Result |
|---|---|
| `venv/Scripts/python.exe -m pytest tests -q` | 420 passed, 7 failed; all 7 in `test_codebook_map` (S, E, V, Prev guideline drift), failing before; the C template failure is gone because the stale unclear-event template row was removed |
| `node --test src/lib/codebook/*.test.ts` | 73/73 |
| `tsc --noEmit`, `eslint src scripts` | clean |
| Migration probe on local DB, rolled back (`migration-probe.txt`) | 3 parties E.v5 refused `too_many_entities`; 2 saved as E.v5; car without dashcam colour refused; 3 parties E.v4 still allowed; 0 parties allowed |
| Migration applied to local DB (recorded 20261123110000), sha256 matches the file | yes |
| `verify-entities.mjs` against a local dev server + local Supabase | 9/9 PASS, fixture removed |
| `verify-outcome.mjs` regression on the same server | all PASS |
| Browser, local: E card with two parties has no add button; C subject B fills object A | `artifacts/local-e2e-e5/01-e-two-parties-no-add.jpg`, `02-c-object-autofilled.jpg`; DB rows A, B = E.v5 |

## Not done

- Production migration and Vercel deploy (not requested).
- `docs/guidelines/` and `annotator-guidelines/huong-dan/` copies of E and C were already out of sync before this feature; the same lines were added to both, no resync.
- `02-E-thuc-the.html` was hand-edited after its Markdown, so it was patched in place, not regenerated.
- Colour removal (next E bump). Bundling it here would have saved one migration, one copy and one version branch.
