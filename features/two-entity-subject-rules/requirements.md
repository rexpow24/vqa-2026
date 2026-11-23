# Requirements

## Assumptions

- A1. A new frozen book E.v5 = E.v4 cells unchanged + `max_entities: 2`.
  Colours are not touched (a later bump drops them).
- A2. Zero entities stays allowed: the E guideline already answers "Không thể xác định" when no party can be declared.
  Only the upper bound is new.
- A3. The relation "C is K18 means E has one party" is guideline text only, not enforced.
  Enforcing it would be a new cross-group rule nobody asked for.
- A4. C needs no new version: the C.v4 JSON is unchanged in behaviour.
  Its `object.auto_fill` text still mentions "từ 3 thực thể trở lên"; that text is not shown in the UI or read by any code (grep), so the frozen file stays and the guideline carries the current wording.
- A5. Legacy E rows with 3 or 4 parties (production agreement export: 13 of 251 E answers; local: 1) stay valid as stored.
  The limit applies when a list is saved under E.v5, which every new save is: the entities route saves E with the current version, like O and Prev, so an old open page cannot keep writing E.v4.
- A6. Guideline edits are only the listed rules and the stale lines (event type "không rõ", the 3+ party section, the 3+ object line).
  No rule of my own.

## Open questions

- None blocking.
  Bundling the colour removal would have saved one bump (one migration, one copy, one version branch); kept separate as asked.

## Acceptance

See acceptance.md.
