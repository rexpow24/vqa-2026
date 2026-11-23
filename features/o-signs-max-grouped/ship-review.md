# Ship review: O.v2 signs first, level = highest sign

## Shipped

- The O form on a C collision shows every sign, grouped under "va chạm nhẹ" / "va chạm vừa" / "va chạm mạnh" (the existing `OptionPicker` group headings), and a read-only level that is the highest level of the ticked signs.
- `deriveOutcome`, compose and `validate_outcome_slots` use the highest-sign rule again; the level the client sends is ignored.
- `20261124100000_o_v2_signs_max.sql` revises the O.v2 row in place and refuses to run once any O.v2 answer exists.
- Guideline pages (`docs/guidelines/O-hau-qua.md`, `annotator-guidelines/huong-dan/06-O-hau-qua.*`) describe signs-first.

## Verified

- Node codebook tests 76/76, pytest unchanged from baseline (6 pre-existing `test_codebook_map` failures).
- Local Supabase reset with the new migration; `verify-outcome.mjs` 18/18, `verify-entities.mjs` 16/16.

## Not verified

- The grouped sign layout was not inspected in a browser; it reuses the C conflict-type grouping.
- `annotator-guidelines/huong-dan.zip` was not regenerated.
