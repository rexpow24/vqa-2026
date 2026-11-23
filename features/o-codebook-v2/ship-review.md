# Ship review: O.v2

## Shipped (working tree, not committed)

- `codebook/O.v2.json` + frontend copy; `20261123100000_o_v2_visible_signs.sql` seeds it and adds `validate_outcome_slots`.
- `deriveOutcome`, `outcomeLevel`, `outcomeNeedsAnnotator`, `causePair` (moved) in `derivation.ts`; `outcome.ts` (`outcomeRow`, `outcomeConflict`).
- Compose O.v2, form O.v2 (read-only derived level, signs only on a collision, exclusive balanced sign), SlotCard shows the derived level.
- Save route derives O from C; C save and `derive-prev` write O when C decides it; `complete` refuses a contradicting O.v2.
- Guideline O rewritten in both copies, HTML regenerated with Python-Markdown (verified byte-identical on 07-R).
- `iaa_round.py`: multi-select options sorted; O.v2 `signs` scored as a conditional cell.
- Docs: CLAUDE.md Decision Log, architecture.md 15b, TODO.md bug row.

## Verification

| Check | Result |
|---|---|
| `python -m pytest tests -q` (venv) | 404 passed, 8 failed; the 8 are `test_codebook_map` for S, C, E, V, Prev and failed identically before this feature |
| `node --test src/lib/codebook/*.test.ts` | 71/71 (65 before) |
| `tsc --noEmit`, `eslint src` | clean |
| Migration on local DB, rolled back, 12 SQL probes | all as expected |
| Migration applied to local DB (recorded 20261123100000) | yes |
| `verify-outcome.mjs` against a local dev server + local Supabase | 13/13 PASS, fixture removed |
| Browser, local: collision signs, exclusive sign, near-miss C re-derives O | screenshots in `artifacts/local-e2e-o-v2/`, DB row checked |

## Not done

- Production migration and Vercel deploy (not requested).
- `verify-slots.mjs` still uses O.v1/V shapes; it was already stale (V answers 410 since 48502d4).
- `annotator-guidelines.zip` / `huong-dan.zip` not regenerated.
- Training videos for O.
