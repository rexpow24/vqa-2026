# Conflict audit

| # | Seam | Probe | Finding | Resolution |
|---|---|---|---|---|
| 1 | Naming legacy entities | `entityPhrase` (compose.ts) calls `clearLabel(book, cells, "vehicle_color")` with the current E book | Under E.v6 a stored entity with a colour would hit `chosenOption` on a cell the book lacks, so composing C/O/R/Attr/Prev on any already-labelled video would throw | Name only by cells the current book has; RED test first |
| 2 | Old open page | Entities route saves under `currentVersion("E")`; `validate_slots` refuses cells the book does not define | A page loaded before deploy still sends colours, so its save would answer 422 | Route keeps only the cells the current book defines (form already does this via `entityCells`) |
| 3 | `validate_video_entity` | Version branches E.v3 / E.v4,E.v5 for dashcam and colour | E.v6 needs the dashcam rule without colour rules | New branch for E.v6 |
| 4 | IAA | `conditional_scored_cell_ids` and `normalize_e_entities` know E.v3-E.v5 | E.v6 needs dashcam conditional only | Add E.v6 |
| 5 | entity_match.py | Colours are low-weight tie-breakers read only when present | E.v6 rows have none; nothing to change | Confirmed by test with colourless entities |
| 6 | Guideline map test | `test_codebook_map._newest("E")` checks the newest E book against `docs/guidelines/E-thuc-the.md` | Already failing before (one of 7 known) | Must not add failures |
| 7 | VLM draft prompt | `vlm/prompts.py` asks for colours | Out of scope (A3) | Reported |

## Verdict: PASS
