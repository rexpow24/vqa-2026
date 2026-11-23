# Requirements

## Acceptance (from the user's decision)
- New E book E.v6 = E.v5 without `vehicle_color` and `clothing_color`; keeps `max_entities: 2`, `type`, `dashcam`.
- The E form no longer shows or requires any colour.
- Every sentence that names a party (E, C, O, R, Attr, Prev) names it without colour; two parties of the same type get their letter ("xe máy A", "xe máy B"), as the existing guideline wording already says.
- Stored E rows with colours (E.v1-E.v5) stay valid as stored.
- Guideline E (both copies, html): remove colour cells, colour rows, colour template parts and colour advice; keep the positional naming rule.

## Assumptions
- A1. The E question drops "và màu sắc" ("Loại phương tiện của các bên liên quan là gì?"): the question names what is asked, and colours are no longer asked. Stated in the report.
- A2. A video whose stored entities still carry colours is named without them once E.v6 is current (compose always names with the current E book). Stored answer sentences are not rewritten.
- A3. The VLM draft prompt (`vlm/prompts.py`, "Nêu loại phương tiện và màu sắc") is out of scope: drafts are reference text and E answers are composed from cells.

## Open questions
None blocking.
