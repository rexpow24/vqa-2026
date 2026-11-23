# Ship review

## Shipped (local only, not committed, not applied to production)

- `codebook/O.v2.json` (+ byte copy, migration seed and sha256): level no longer `read_only`; "va chạm thứ cấp" removed; constraints, level `auto_fill` and signs `note` describe level first.
- `derivation.ts`: `collisionLevels()`, `signsOfLevel()`; `deriveOutcome` keeps the chosen collision level and only its signs (`outcomeLevel` removed).
- `form.ts`: O shows a read-only level on a near miss; on a collision the level (without "không va chạm") and, once chosen, the signs of that level; a new level keeps only its signs; a single-option multiple field is auto-filled as `{ options: [...] }`.
- `compose.ts` and `validate_outcome_slots`: every sign must belong to the level (was: the level is the highest sign).
- `codebook/E.v6.json` (+ copy, seed, sha256): E.v5 without `clothing_color`; templates `màu [3]`; `validate_video_entity` treats E.v6 like E.v4/E.v5.
- `scripts/iaa_round.py`: E.v6 scores `vehicle_color` conditionally again.
- Guidelines: O (md x2, html) level first and no secondary collision; E (md x2, html) question, colour row and colour rules back.

## Verification

| Check | Before this change | After |
| --- | --- | --- |
| node codebook tests | 76/76 | 76/76 (O and E cases rewritten) |
| tsc, eslint | clean | clean |
| `test_codebook_copies`, `test_iaa_round`, `test_entity_match` | pass | pass |
| `test_codebook_map` | 6 fail (S, E type order, V x2, Prev x2) | same 6 |
| verify-outcome | 15 PASS | 18 PASS |
| verify-entities | 13 PASS | 16 PASS |
| verify-slots, labeling, adjudication, assignments | fail | identical failures |
| verify-revisions, difficulty, video-import | pass | pass |
| browser E2E (`o-level-first.mjs`, review annotator) | - | 19/19 |

Whole `pytest tests` cannot run in one process on this machine (commit limit nearly exhausted); run file by file, the only other failures were memory (`OpenBLAS ... Memory allocation`) and timing (`test_app_run`), both outside this change.

## Follow-up, 2026-11-24

- Card titles show the full group name ("Hậu quả", not "O"): `groupName()` in `src/lib/qgroups.ts` prefers `qgroups.json` over `video_drafts.group_name` (the local review seed wrote the code there; it now writes the name).
- O "va chạm vừa": `sign.fell_in_place` split into `sign.vehicle_fell` "xe đổ tại chỗ" and `sign.person_fell` "người ngã tại chỗ".
- Bug: Prev from a K14 C between two vehicles was always "Không thể xác định": `derivePreventionFromCause` copied the K15 pedestrian logic, and a test pinned it. The Prev guideline says "phương tiện: quan sát và nhường đường"; a crossing vehicle now gets `observe_and_yield`, an animal stays unclear. Reproduced in the browser first (K14 C, Prev unclear), verified after (stored Prev "Xe máy màu đen nên quan sát và nhường đường.").

## Not done / open

- Level agreement must be re-measured: choosing the level gives back the O.v2 audit's fix.
- Guideline line "thấy dấu hiệu của nhiều mức thì chọn mức cao nhất" keeps the old O.v2 rule as guidance; confirm with the owner.
- The annotator copy of guideline E still lists the stale cells "Cỡ" and "Số người trên xe"; only the colour was added there.
- Production: owner approval pending.
