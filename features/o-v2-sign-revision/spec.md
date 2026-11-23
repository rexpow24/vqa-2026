# Spec

**What:** revise the O.v2 sign list and drop the "không đánh giá" level, in place (O.v2 is unreleased).

**Scope:** `codebook/O.v2.json` + its frontend copy + the seeded JSON and `validate_outcome_slots` in `20261123100000_o_v2_visible_signs.sql`; `deriveOutcome`, `composeOutcomeSigns`; tests; guideline O (`annotator-guidelines/huong-dan/06-O-hau-qua.{md,html}`, `docs/guidelines/O-hau-qua.md`), only the lines naming changed options.

**Non-goals:** moving "xoay ngang" to severe (owner's open question 1); enforcing the car-only sign; any change to V or Prev (already done in `48502d4`); production apply/deploy.

## architecture

Same mechanism as `features/o-codebook-v2/architecture.md`; only data changes plus one branch:

- `deriveOutcome`: any C event other than collision (near miss, legacy unclear) gives `{ level: level.none }`.
- `composeOutcomeSigns`: only `level.none` is a no-sign level.
- `validate_outcome_slots`: only `level.none` takes no sign; `level.not_assessed` is refused by the generic option check because it is no longer in the book.
- New sign `sign.visible_body_damage` (level moderate) sits after `sign.spun_or_lost_control`, so sentences list it in that order.
