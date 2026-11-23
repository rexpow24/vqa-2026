# Architecture: O.v2

## Data shape

```json
{"parties":[{"entity":"A"},{"entity":"B"}],
 "level":{"option":"level.severe"},
 "signs":{"options":["sign.fell_in_place","sign.person_thrown"]}}
```

- `level`: required, read-only, derived. Options `level.none`, `level.minor`, `level.moderate`, `level.severe`, `level.not_assessed`.
- `signs`: multiple, each option has `level`. Present exactly when the level is minor, moderate or severe.
- `parties`: as O.v1, auto-filled from the C pair, optional.

## One derivation, three callers

`deriveOutcome(cause, submitted)` in `frontend/src/lib/codebook/derivation.ts`:

| C event | Result |
|---|---|
| none saved | null (O cannot be saved yet) |
| `event_type.near_miss` | `{level: none}` |
| `event_type.unclear` (C.v1-v3 only) | `{level: not_assessed}` |
| `event_type.collision` | signs from `submitted` in codebook order, minor sign alone if picked alone, level = max; parties kept if valid else the C pair; no signs gives `{level: ...}` missing, refused |

Callers:

1. Save route, O draft: the stored slots are `deriveOutcome(C, client slots)`, never the client's level.
2. Save route, C draft: also writes the O row when the derived O needs no annotator input (near miss, unclear) or when an existing O.v2 collision answer can be re-derived.
3. `derive-prev` page sync: same as 2, so a C saved before this feature gets its O on the next page load.

`complete` route refuses when the stored O.v2 contradicts the stored C (an O written for a near miss after C became a collision).

## Database

`validate_outcome_slots(book, slots)` runs from `validate_slots` for a book whose cells include `signs`:
level and signs must agree, the minor sign is alone, none/not assessed carry no signs.
O.v1 never reaches it.

## Form

`fields("O")` on O.v2: level (read-only), then signs and parties only for a collision.
`outcomeState(state, context)` fills the derived level before rendering, so the read-only chip shows what will be stored.
`choose` keeps the minor sign exclusive.
