# Requirements

## Request mapped onto the current code

| Request (O.v1 wording) | State in O.v2 before this feature | Change here |
| --- | --- | --- |
| merge "không rõ" into "không va chạm" | `level.unclear` gone; `level.not_assessed` "không đánh giá" still exists for a legacy C with `event_type.unclear` | remove `level.not_assessed` and its template; a legacy unclear C derives `level.none` |
| moderate: drop "lệch hướng" | sign `sign.spun_or_lost_control` "xoay ngang hoặc lệch hướng mất lái" | label becomes "xoay ngang mất lái" |
| moderate: drop "dừng đột ngột" | already absent | none |
| moderate: merge "xe ngã" + "người ngã" (xe máy) | `sign.fell_in_place` "ngã tại chỗ" | label becomes "xe hoặc người ngã tại chỗ" |
| moderate: add visible body damage (ô tô) | absent | new `sign.visible_body_damage` "có hư hỏng nhìn thấy được ở thân xe (ô tô)", level moderate |
| severe: drop "người nằm trên đường" | already absent | none |
| severe: "biến dạng rõ" -> "biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt" | `sign.major_deformation` "thân hoặc khung xe biến dạng lớn" | label becomes "biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt" |
| remove group V | done in `48502d4`: V absent from `qgroups.json`, `remove_v_from_active_workflow.sql` | verify only |
| Prev from C | done in `48502d4`: Prev.v4 `inferred_from: C`, `derivePreventionFromCause` | verify only |

## Assumptions (stated, not asked)

1. **Edit O.v2 in place, no O.v3.** O.v2 was never applied to production (CLAUDE.md "Group O.v2" row, handoff `plan.md` Phase 8), so no stored answer uses it; a third version nobody ever labelled with would only add a legacy branch.
   The migration `20261123100000` is edited and its sha256 recomputed; a local DB that already applied it needs `supabase db reset`.
2. **Sign IDs stay** (`spun_or_lost_control`, `fell_in_place`, `major_deformation`); only labels change. The meanings did not change direction, and stable IDs keep the IAA scripts and tests aligned.
3. **"(ô tô)" is guidance in the label, not enforced.** The form does not hide the sign when no party is a car; enforcing it needs entity-type conditions in O, which nothing else in O has.
4. **"xoay ngang" stays at moderate.** Open question 1 of the handoff (move it to severe) is the owner's and stays open.

## Basis

These are the requesting teammate's decisions, with no cited source (rule `60-project-feedback.md`, "Methods need a cited basis").
Guideline O may rest on the project's Human Refinement guideline instead of a paper (exception of 2026-11-14), but nothing has been cited for these four changes.
They stay local until the owner approves, like the rest of the 2026-11-23 handoff.

## Acceptance (summary; executable list in acceptance.md)

- O form shows exactly 9 signs with the new labels, no "không đánh giá" button.
- A legacy unclear C gives O "Không quan sát thấy va chạm hoặc hư hỏng phương tiện."
- The new sign alone gives level "va chạm vừa"; the database accepts it and refuses `level.not_assessed`.
- Labeling page shows no V group; Prev is filled from C.
- Whole test suites green except the 6 pre-existing `test_codebook_map` failures.
