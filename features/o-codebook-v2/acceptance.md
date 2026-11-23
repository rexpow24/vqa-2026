# Acceptance

1. `codebook/O.v2.json` equals its frontend copy byte for byte, and the migration seeds its sha256.
2. O.v2 has no `level.unclear`, no "Không thể xác định" template, and the eight approved signs with their levels.
3. `deriveOutcome`: near miss gives none; legacy unclear gives not assessed; collision level is the max sign level; no C gives null.
4. Compose O.v2: none and not-assessed are fixed sentences; collision lists level and signs; O.v1 still composes.
5. Form O.v2: collision shows signs and parties, level read-only and derived; near miss shows only the read-only level; the minor sign is exclusive.
6. Local DB: O.v2 accepts a consistent row; refuses wrong level, empty signs on collision, signs on none, minor with another sign; an O.v1 row still saves.
7. IAA: O.v2 rows with the same signs in different order agree; O.v1 rows still score.
8. Guideline O describes O.v2 and cites GraDE and SHRP 2; tests/test_codebook_map.py O cases pass.
9. `python -m pytest tests -q` and frontend `node --test` pass apart from pre-existing failures (8 in test_codebook_map for C, E, V, Prev, S).
