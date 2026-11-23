# Ship review

## Shipped (local only)

- O.v2 edited in place (never released): "xoay ngang mất lái" (no "lệch hướng"), "xe hoặc người ngã tại chỗ", new moderate sign `sign.visible_body_damage` "có hư hỏng nhìn thấy được ở thân xe (ô tô)", "biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt"; `level.not_assessed` and its template removed, a legacy unclear C derives "không va chạm".
- `deriveOutcome`, `composeOutcomeSigns`, `validate_outcome_slots` follow; migration sha256 recomputed.
- Guideline O (md x2, html): only the lines naming changed options.

## Bug found by running it

`20261123100000_o_v2_visible_signs.sql` patched `validate_slots` with a literal `replace()` anchor that contained the file's own newline.
The working copy is CRLF (`core.autocrlf=true`) and so is the stored function source; once the file was rewritten with LF the anchor stopped matching and `supabase db reset` failed ("Could not add the O.v2 rule to validate_slots").
The anchor is now a `regexp_replace` with `\r?\n`, proven on LF and CRLF samples. The same hazard would have hit production if its function source and the deploying checkout disagree.

## Verification

| Check | Baseline (HEAD) | After |
| --- | --- | --- |
| pytest | 430 pass / 6 fail (`test_codebook_map` S, E, V, Prev) | same |
| node codebook tests | 76/76 | 76/76 (updated cases) |
| tsc, eslint | clean | clean |
| verify-outcome | 13 PASS | 15 PASS (2 new) |
| verify-entities, revisions, difficulty, video-import | pass | pass |
| verify-slots (8 FAIL), verify-labeling, verify-adjudication, verify-assignments (1 each) | fail | identical failures |
| browser E2E (review annotator) | - | 14/14 |

The failing verify scripts fail identically on HEAD: they still expect nine drafts (V was removed in `48502d4`), three E parties (E.v5 caps at two) and O.v1. Not fixed here.

## Not done

- Production: owner approval pending (handoff), and this machine has no Vercel or Supabase CLI login.
- "(ô tô)" is not enforced by entity type.
- Guideline definition of the deformation sign still reads "Thân hoặc khung xe bị bẹp..."; whether minor dents now count as the new body-damage sign is undecided.
