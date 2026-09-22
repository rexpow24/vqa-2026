# Overview — License plate and face anonymization

## The desire, in the user's words

"Implementing license plate and face anonymized model"

## Why this is on the table now

`TODO.md` already carries this as a **BLOCKED / needs a decision** item, found
2026-09-05 by looking at a keyframe:

> The pipeline does not blur faces or licence plates at all — only channel
> overlays, and calibration measures *motion*, so it structurally cannot mask a
> plate on a moving vehicle (`architecture.md` §5). `docs/01…TeamA.md` step 2 has
> been corrected to stop claiming otherwise, but the capability gap is real and
> matters before any dataset leaves this machine.

`architecture.md` §5 explains the structural reason: overlay calibration (S4)
detects *static* regions by per-pixel temporal variance. A face or a licence
plate on a moving vehicle is never static, so this signal cannot find it by
construction. §5 also names the fix already, in passing: "A learned text
detector absolutely would."

Also relevant: `TODO.md` records that **30 files already sitting in
`trimmed/`** show a burned-in plate (`37B-016.09`), built before the
`middle_bottom` fixed band existed — a concrete example of the gap, not a
hypothetical.

## What this is not

- Not a change to the existing overlay-removal machinery (S4 calibration, S7
  fixed bands) — that stays as-is for channel branding.
- Not OCR. `architecture.md` explicitly rejected PaddleOCR/OCR for the counter
  problem; this is a detect-and-blur task (bounding boxes), not a
  read-the-text task.
- Not yet scoped to whether this runs on `clips/` (masters) or in the same S8
  blur+encode stage as the existing overlay removal — that is a spec
  decision, not a foregone conclusion.

## Where this goes next

Straight into `00_grill-me`: this touches a recorded architecture decision
("Overlay removal" in `CLAUDE.md`'s Decision Log), the `delivered/` and
`trimmed/` artifact tiers, and possibly the config schema and DB — per
`ship-feature`'s own routing rule, that means the full pipeline, no shortcuts.
