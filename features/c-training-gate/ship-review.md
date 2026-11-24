# Ship review: mandatory group C training video

## Shipped

- Until the caller completed `C-v1`, the C card shows the full C training video (8 min 39 s) in place of the form; playing it to the end records the completion and opens the form without a reload.
  Other groups are not locked; admins are not gated.
- `POST /api/drafts/{id}/annotation` refuses a C draft with 403 `training_required` until the caller completed it.
- `training_completions` (own rows only, RLS) and `POST /api/trainings/{id}/complete` (idempotent).
- `/admin` shows "Đã xem hướng dẫn C" per annotator (`reference_view_stats()` gained `training_c_completed_at`).
- `<html suppressHydrationWarning>`: a browser extension adds `mdl-js` to `<html>`, which React reported as a hydration error on every page.

## Verified (local)

- `verify-training.mjs` 9/9, `verify-references.mjs` 9/9, `verify-outcome.mjs` 18/18, `verify-entities.mjs` 16/16.
  The last two first failed with 403 `training_required`: their test annotators now complete `C-v1` in setup.
- Browser: gate shown on the C card, seeking near the end and playing fired `ended`, the form opened, and after a reload the gate stayed gone.

## Not verified

- Playing the full 8 min video in real time; seeking is not policed (user decision).
