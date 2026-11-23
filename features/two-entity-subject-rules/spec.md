# Spec

## What

1. `codebook/E.v5.json`: E.v4 cells, `max_entities: 2`, frozen 2026-11-23; frontend copy, registration, migration seed.
2. E form: no "+ Thêm bên" once the list holds `max_entities`; a list over the limit (legacy) shows a problem and cannot be saved.
3. Entities route: saves with the current E version; refuses a list over `max_entities` (422 `too_many_entities`).
4. Database: `save_video_entities` refuses a list longer than the book's `max_entities`; `validate_video_entity` applies the E.v4 cell rules to E.v5.
5. Guidelines E and C (both copies, HTML): the two-party rule; the SHRP 2 subject rules; the stale C lines fixed.
6. IAA scripts treat E.v5 like E.v4.

## Why

The audit showed 25% of annotator pairs disagreeing on the C subject only through naming, and the E party count at alpha 0.297.
Two parties make the C object automatic and the subject a choice between A and B.

## Non-goals

Colour removal; a C version bump; enforcing K18 means one party; re-validating stored rows.
