---
name: 02_to-spec
description: Step 02 of the ship-feature pipeline. Synthesize requirements.md and conflicts.md into spec.md, architecture.md and acceptance.md — no new interviewing, just the decisions already made written down as a design.
---

# 02 · Spec it

Inputs: `requirements.md`, `conflicts.md` (verdict **PASS**). Outputs three
files in `features/<slug>/`.

**Do not interview.** Every question was answered in step 00. If you find
yourself wanting to ask something, either it has a defensible default — take it
and record it — or step 00 was not finished, in which case say so and go back.

If `conflicts.md` says BLOCK, stop. This step does not run on a blocked gate.

## spec.md — what and why

- **Problem** — one paragraph, in the user's terms, from `overview.md`.
- **Behaviour** — what the system does after this ships, as observable
  statements. No mechanism here.
- **Scope** — a bulleted list of what is in.
- **Non-goals** — what is deliberately out, each with its one-line reason. This
  section is what stops the feature growing while you build it.
- **Decisions** — the ✅ rows from `requirements.md`, one line each, with the
  trade-off that was accepted. This is the record; nobody should relitigate a
  row that is here.

## architecture.md — mechanism

- **Shape** — the modules, files and functions that change, and the seam each
  one sits behind. Prefer few interfaces over many: complexity belongs inside a
  module, not spread across its callers.
- **Data** — every field added or changed, with its type, its default, and
  **who writes it**. Probe 2 of the gate exists because two writers is the most
  common bug; name the single owner of every field here.
- **Flow** — the path through the system, including the failure branches. A
  design that shows only the happy path is hiding the hard part.
- **Why this shape** — one short paragraph per conflict from `conflicts.md`,
  naming the design point that avoids it. If a conflict has no paragraph here,
  it is unaddressed and you are not done.
- **Rejected** — designs considered and dropped, one line each with the reason.

## acceptance.md — the contract

Promote every acceptance criterion from `requirements.md`, plus one per conflict
in `conflicts.md` proving the collision no longer happens. Each line is a
proposition someone can execute:

```
| # | Criterion | How to check | Covers |
|---|---|---|---|
| A1 | Second Mark cut on an untouched clip succeeds | AppTest: click twice, assert 2 shots | conflict 1 |
```

Rules:

- Every criterion names a **command or an observation**, never an adjective.
- At least one covers the **second run** — re-run, refresh, re-submit.
- At least one covers **data with an owner**, if the feature stores anything.
- Every 🔴 field from `requirements.md` has at least one criterion.

This file is what `07_verify-feature` executes line by line. Anything not
written here will not be checked, so anything you care about goes here now.

## Diagrams

If the flow has more than one actor or the record moves through states, the
diagrams belong in step 03 alongside the tasks. Note here that they are needed;
do not draw them twice.

## Done when

All three files exist, every conflict has a paragraph in `architecture.md`, and
every 🔴 requirement has a criterion in `acceptance.md`. Show the user the
non-goals and the decisions list before moving on — that is where they will
notice you understood something differently than they meant.
