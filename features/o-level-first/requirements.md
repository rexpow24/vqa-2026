# O level first, E vehicle colour back

Team request, 2026-11-24 (Vietnamese, summarised):

1. Group E: bring the vehicle colour back (only the vehicle colour; the pedestrian clothing colour stays out).
2. Group O: keep the old selection format: the annotator chooses the level first, then the visible signs of that level are shown.
3. Group O, va chạm mạnh: remove the sign "va chạm thứ cấp".

Decisions taken with the user:
- Only the vehicle colour returns (not the clothing colour).
- Several signs of the chosen level may be ticked (at least one), as O.v2 already stored.

Both books are unreleased (handoff 2026-11-23), so E.v6 and O.v2 are edited in place; no new version.

## Acceptance

- A1 E.v6 cells are `type`, `dashcam`, `vehicle_color`; the form asks the colour where E.v5 did; a clothing colour is dropped by the route and refused by the database.
- A2 E sentences name the vehicle colour ("Xe máy màu đỏ"); pedestrians are "người đi bộ".
- A3 On a C collision, O shows the levels nhẹ / vừa / mạnh and no sign until a level is chosen; then only that level's signs.
- A4 Changing the level drops signs of the old level; "va chạm nhẹ" ticks its single sign.
- A5 The server keeps the chosen collision level and only its signs; no level, or "không va chạm" on a collision, is refused.
- A6 The database refuses a sign of another level (including a moderate sign under severe) and the removed "va chạm thứ cấp".
- A7 A near miss still derives "không va chạm", read-only, no sign.
- A8 No old case breaks: every suite fails exactly as before.
