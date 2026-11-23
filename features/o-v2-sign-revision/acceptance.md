# Acceptance

1. `python -m pytest tests -q`: O.v2 tests pin 9 signs (new labels, new sign at moderate) and levels `none, minor, moderate, severe`; migration bytes match; only the 6 pre-existing `test_codebook_map` failures remain.
2. `node --test` codebook tests: legacy unclear C -> `level.none`; `compose(level.none)` -> "Không quan sát thấy va chạm hoặc hư hỏng phương tiện."; `sign.visible_body_damage` alone -> level moderate, sentence "... va chạm vừa, có hư hỏng nhìn thấy được ở thân xe (ô tô)."
3. `tsc --noEmit` and `eslint` clean.
4. Local DB after `supabase db reset`: saving O with `level.not_assessed` is refused; saving O with the new sign and `level.moderate` is accepted (`verify-outcome.mjs`).
5. Browser, review annotator: O shows 9 signs with the new labels and no "không đánh giá" button; choosing the new sign shows "va chạm vừa"; no V group on the page; Prev is read-only and filled from C.
