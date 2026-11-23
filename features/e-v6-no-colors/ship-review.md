# Ship review

Shipped to the working tree (not committed, not applied to production, not deployed):
- `codebook/E.v6.json` + byte copy, registered in `frontend/src/lib/codebook/index.ts`; current E is E.v6.
- `compose.ts` / `form.ts`: colour read and shown only when the current E book defines it.
- `PUT /api/videos/[id]/entities`: keeps only cells the current book defines.
- `supabase/migrations/20261123120000_e_v6_no_colors.sql`: seeds E.v6, E.v6 branch in `validate_video_entity`; applied to the LOCAL database (version recorded).
- `scripts/iaa_round.py`: E.v6 dashcam-only conditional scoring.
- Guideline E (both copies, html): colour cells, rows, template parts and advice removed; question without "và màu sắc"; one line noting E.v6.
- `verify-entities.mjs` / `verify-outcome.mjs` updated for E.v6.

| Check | Result |
|---|---|
| `venv/Scripts/python.exe -m pytest tests -q` | 430 passed, 6 failed, all pre-existing `test_codebook_map` drift (S, E type order, V, Prev); was 7, the E template test now passes |
| `node --test src/lib/codebook/*.test.ts` | 76/76 |
| `tsc --noEmit`, `eslint src scripts` | clean |
| Local DB probe (transaction, rolled back) | colour refused under E.v6; car without dashcam refused; motorbike with dashcam refused; two parties save; three refused; E.v5 row with colour still inserts (`migration-probe.txt`) |
| `verify-entities.mjs` (local server + DB) | 13/13 PASS |
| `verify-outcome.mjs` regression | all PASS |
| Browser, local | E form shows no colour, "Xe máy A, xe máy B."; C picker "A · xe máy"; C, O, R, Prev sentences without colour |

Not done / out of scope: VLM draft prompt still asks for colours; infographic `11-E-nhan-dien-xe.png` may still show colours; guideline examples in other groups that name parties with colours were not touched.
