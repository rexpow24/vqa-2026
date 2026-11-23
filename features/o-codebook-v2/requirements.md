# Requirements

## Assumptions (stated, not asked)

1. C.v4 has no `event_type.unclear`; only legacy C rows (C.v1-v3) can carry it. The "C không rõ" path exists for those rows only.
2. "O không hỏi" when C is unclear still stores an O row, because completing a video requires every active question answered. The row is derived (`level.not_assessed`), read-only, and has its own fixed sentence, so it is not an annotator choice.
3. The minor sign "có chạm, các bên giữ thăng bằng" contradicts every moderate or severe sign, so it is exclusive in the form and in the database. This is a consistency check on the approved definitions, not a new labeling rule.
4. Parties stay optional and auto-filled from the C pair, as in O.v1; they are not scored by IAA (required = false).
5. O.v1 rows are not migrated. They stay valid as stored and decode with O.v1; re-saving one saves O.v2.
6. A video whose C changes to collision while its O row still says none/not assessed cannot be completed until O is answered again.

## Open questions

None blocking. Training videos and the next measuring round are separate work.

## Acceptance

- New O answers are saved as O.v2; the level is never chosen by hand.
- C near miss gives O "không va chạm" automatically (on C save and on page sync); legacy C unclear gives O "không đánh giá"; C collision needs at least one sign.
- Level equals the highest sign level; the database refuses a mismatch, an empty sign list on a collision level, signs on none/not assessed, and the minor sign combined with any other.
- O.v1 rows still compose, validate and score.
- `iaa_round.py` and `audit_slot_disagreements.py` read O.v2 (multi-select signs) and O.v1.
- Guideline O (docs/guidelines and annotator-guidelines copies, plus HTML) describes O.v2 with the GraDE/SHRP 2 basis.
- Whole Python suite and frontend node tests pass except failures that existed before this feature.
