# O.v2: signs first, level = highest sign, signs grouped by level

User decision, 2026-11-24, after reviewing `features/o-level-first/`: go back to deriving the O level from the ticked signs (highest level wins), and show the signs grouped under their level.

## Why

- The O.v1 agreement audit (videos #1-#40) gave level alpha 0.588 nominal vs 0.864 ordinal: disagreement was almost all between adjacent levels, i.e. the subjective level call.
  Choosing the level first brings that call back.
- With level first, two annotators who differ on the level see disjoint sign lists, so the sign cell disagrees too.
- A video with a moderate and a severe sign could only record the severe ones.
- Basis: GraDE (Darji & Gondaliya 2026, doi:10.36548/jtcsst.2026.4.006), one clearly visible Major indicator suffices; SHRP 2 criteria-based crash levels.

## Kept from `features/o-level-first/` and `features/o-v2-sign-revision/`

- The sign set (split "xe đổ" / "người ngã", body damage moderate, no "va chạm thứ cấp", renamed deformation).
- No "không đánh giá": any non-collision C derives "không va chạm".
- One-party sentence "[Chủ thể]: [2]." and the E.v6 vehicle colour.

## Conflict check

- O.v2 is in production since 2026-11-24 with 0 stored answers (read-only query, 2026-11-24).
  The O.v2 row is therefore revised in place by a new migration, which refuses to run if any O.v2 answer exists.
- O.v1 rows (246) are untouched: `validate_outcome_slots` runs only for a book with a `signs` cell.

## Acceptance

- A1 On a C collision the level field is read-only and shows the highest level of the ticked signs; the signs field shows every sign, grouped under "va chạm nhẹ" / "va chạm vừa" / "va chạm mạnh".
- A2 The server stores the level derived from the signs, whatever level the client sent; a collision without a sign is refused (`missing_cell`).
- A3 Compose and the database refuse a level that is not the highest level of its signs (`level_mismatch`); a moderate plus a severe sign is valid as severe.
- A4 Near miss still derives "không va chạm", read-only, no sign; the exclusive "giữ thăng bằng" sign still stands alone.
- A5 Production: migration applied, O.v2 sha256 equals the repo file, app deployed.
