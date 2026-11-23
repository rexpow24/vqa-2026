---
name: 07_verify-feature
description: Step 07 of the ship-feature pipeline. Execute every acceptance criterion end to end and run the full regression pass, including the behaviours the conflict audit flagged, before anything is called shippable.
---

# 07 · Verify the feature, then the rest of the system

Input: `acceptance.md`, `conflicts.md`, a fully ticked `TODO.md`. Output: a
results table, and a plain statement of what is still broken.

Individual tasks passing does not mean the feature works. Tasks are verified in
isolation, against the code as it was when each one landed; this is the first
time anything runs against the finished whole.

## 1. Acceptance run

Every line of `acceptance.md`, executed, in order, against the real system —
not the test doubles, not the fixtures.

```
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| A1 | ...      | PASS   | actual output, quoted |
```

Rules:

- **Evidence is real output.** A number you observed, a row you selected, a
  screen you looked at. "Verified by inspection" is not evidence.
- A criterion that cannot be executed as written is a **defect in the spec**.
  Say so and rewrite it in `acceptance.md`, with the reason, before ticking it.
- One FAIL means the feature is not done. Go back to the task that covers it.

## 2. Regression pass

- **The whole suite**, not just the files you touched. The command the project
  documents as its own — read `CLAUDE.md` / `AGENTS.md` / the contributing docs
  for it rather than inventing one.
- **The conflicts from `conflicts.md`, re-probed.** Each one had a design point
  that was supposed to avoid it; run the thing that would have shown the
  collision and confirm it is gone. This is the highest-value check in the whole
  pipeline, because these are the collisions you already proved were real.
- **The second run.** Re-execute the feature's main path a second time on the
  same data — re-submit, re-approve, re-import, refresh. Most of what survives
  a first-run test dies here.
- **The behaviour nobody asked about.** The path adjacent to the one you
  changed, which the feature was never meant to touch. If the feature added a
  column, exercise the writer that does not name its columns.

## 3. Report, without softening

Three lists, in these words:

- **what passed** — with counts.
- **what I skipped** — and why. A skipped check named is fine; a skipped check
  unmentioned is a lie by omission.
- **what is still broken** — including anything you found that predates this
  feature. Log those in the repo's own tracker rather than fixing them here;
  scope creep at the finish line is how features stop shipping.

If anything in the third list touches the feature, it is not ready for step 08.
