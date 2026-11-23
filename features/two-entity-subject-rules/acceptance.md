# Acceptance

1. `codebook/E.v5.json` equals its frontend copy byte for byte; its cells equal E.v4's; `max_entities` is 2; the migration seeds its sha256.
2. `currentVersion("E")` is E.v5; `entityProblems` reports three parties; two parties have no list problem.
3. Local DB: `save_video_entities` with E.v5 and three parties fails with hint `too_many_entities`; with two it saves; E.v5 applies the E.v4 cell rules.
4. Route: PUT entities with three parties answers 422 `too_many_entities`; with two answers 200 and the stored rows carry E.v5 even when the client sent E.v4.
5. A stored legacy three-party list stays readable and untouched.
6. Browser, local: the E card never offers a third party; the C object shows the other party filled in.
7. Guidelines: E and C (both copies) carry the two-party rule and the four SHRP 2 subject rules with the citation; the C event type lists no "không rõ"; no "từ 3 thực thể trở lên" line or 3+ section remains.
8. IAA: E.v5 rows score like E.v4 rows.
9. Whole pytest suite: failures only the 8 known `test_codebook_map`; node tests, tsc, eslint clean.
