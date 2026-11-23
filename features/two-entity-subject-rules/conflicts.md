# Conflict audit

| # | Seam | Probe | Finding | Resolution |
|---|---|---|---|---|
| 1 | Stored E rows with 3+ parties | Count per (video, annotator) in `csvs/answers-agreement.csv` and local `video_entities` | Production export: E.v2 8, E.v4 5 answers with 3-4 parties; local: 1 (E.v1) | The limit lives in `save_video_entities` for books with `max_entities`; stored rows are never re-validated, so they stay |
| 2 | Re-saving a legacy 3-party list | `guard_referenced_entity` (20261116100000 s.6) refuses to delete a party another group points to | An annotator reopening such a video must drop the third party from C (or another group) before E saves | Accepted: the 409 message names the groups; the form shows the over-limit problem before saving |
| 3 | Version trust | The entities route passes the client `codebook_version` through | An old open page would keep saving E.v4 lists of 3 | The route saves E with `currentVersion("E")` (the O/Prev pattern) |
| 4 | C object auto-fill | form.ts `apply`: fills `object` when `keys.length === 2` | Already right for two parties; with one party (K18) the object list is empty and optional | No C change; C.v4 stays the current C book |
| 5 | `validate_video_entity` | Version branches for the E.v3/E.v4 cell rules | E.v5 must get the E.v4 cell rules, or a car without dashcam could save without a colour | Branch on `in ('E.v4','E.v5')` |
| 6 | IAA scripts | `iaa_round.py` special-cases E.v3/E.v4 (conditional dashcam/colour cells) | E.v5 would lose that treatment | Extend the version sets to E.v5 |
| 7 | Guideline tests | `test_codebook_map._newest("E")` compares the newest E book with `docs/guidelines/E-thuc-the.md` | Already failing before this feature (one of the 8 known failures; the docs copy drifted) | Not fixed here; the failure count must not grow |
| 8 | Two guideline copies | `diff docs/guidelines/C-nguyen-nhan.md annotator-guidelines/huong-dan/03-C-nguyen-nhan.md` | Already differ (speed cell, wording) | Apply the same new lines to both; no resync |
| 9 | `entity_match.py` (step 1) | Parses E slots for any version | Unaffected | No change |

## Verdict: PASS
