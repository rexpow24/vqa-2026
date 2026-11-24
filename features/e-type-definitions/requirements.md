# E types: definitions, no "khác"

User decision, 2026-11-24: define what each vehicle type covers and remove the type "khác".

- xe máy: xe số, xe tay ga, xe côn tay, xe máy điện (no pedals).
- xe đạp: xe đạp thường, xe đạp điện (with pedals).
- xe ba gác: every three-wheeler, home-made ones included.
- No "khác": every party is one of the listed types.

Basis for the e-bike boundary: Luật Trật tự, an toàn giao thông đường bộ 2024 (xe đạp điện is a xe thô sơ, xe máy điện a xe gắn máy); secondary summary read, not the original article.
Production use of "khác" before this: 15 E.v2 and 4 E.v4 parties (xe đạp, xe đạp điện, xe điện, xe tải cẩu, xe bồn, xe kéo, a dashcam car), none under E.v6.

## Change

- `codebook/E.v6.json` (and the frontend copy) drops `type.other`; the template case "Xe cứu thương, xe ba gác, khác" loses "khác".
- `20261124130000_e_v6_no_other_type.sql` revises the E.v6 row in place and refuses to run if any E.v6 party uses `type.other`; E.v2/E.v4 rows keep theirs.
- Guideline E (docs and the annotator copy) gets the definitions.

## Verified (local)

pytest unchanged from baseline plus one new test, node codebook tests pass, tsc/eslint clean, migration applied to the local database.
