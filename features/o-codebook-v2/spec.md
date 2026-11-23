# Spec: O.v2

## What

Group O records the visible outcome of the event.
The annotator no longer chooses a severity level.
On a collision they tick every clearly visible sign, and the level is the highest level among the ticked signs.
On a near miss O is "không va chạm" without asking; on a legacy C with an unclear event O is "không đánh giá".

## Why

Audit of agreement videos #1-#40 (O.v1, 243 answers): level alpha 0.588 nominal, 0.864 ordinal, so almost every disagreement is between adjacent levels.
45 of 73 moderate/severe pairs come from "người nằm trên đường" versus a fall; 51 sign pairs from "người ngã" versus "xe ngã"; 24 pairs from "không va chạm" versus "không rõ", mostly on videos the same annotator coded as a near miss in C.
GraDE grades visible physical severity with a list of indicators, any one of which suffices, and SHRP 2 grades crashes with discrete criteria.

## Scope

- `codebook/O.v2.json` and its frontend copy, seeded by a new migration.
- Database rule for O.v2: level matches the signs.
- Form, compose, derivation, save route, page sync, completion check.
- Guideline O (both copies, HTML).
- IAA signature sorts multi-select options.

## Non-goals

- No rewrite of O.v1 rows; no production migration or deploy here.
- No training videos (separate plan).
- No per-party signs; the level is for the whole event.
- No change to C.
