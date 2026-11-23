---
name: ship-feature
description: The pipeline for shipping a feature end to end — grill the desire into requirements, gate it through a conflict audit, spec it, decompose it, then TDD each task to green and ship-review. Use when the user asks for a feature, pastes a spec, reports a bug to fix, or says "implement X" / "add X" / "build X" / "làm feature" / "ship it". Also use to resume half-finished work in features/.
---

# Ship a feature

The one skill that runs the whole pipeline. Each stage is its own skill you can
also invoke by hand (`/quyen:02_to-spec`); this one decides which stage you are
at and drives them in order.

```
        overview.md  (DESIRE — what the user wants)
              |
    00_grill-me                -> requirements.md
              |
    01_feature-conflict-audit  -> conflicts.md  ── BLOCK ──> back to 00
              |  PASS
    02_to-spec                 -> spec.md, architecture.md, acceptance.md
              |
    03_decompose               -> tasks.md, TODO.md, diagrams/
              |
     ┌──── per task ─────────────────────────────┐
     │  04_tdd  ->  05_implement  ->  06_verify  │
     │        ^                          |       │
     │        └────── FAIL ──────────────┘       │
     └──────────────── PASS: tick TODO, next ────┘
              |
    07_verify-feature          -> acceptance run + regression
              |
    08_ship-review             -> docs folded up, SHIPPED
```

## The feature folder is the state

Everything lives in `features/<slug>/`. There is no other state, no separate
tracker, no memory of what you did. **The files on disk are the pipeline's
program counter.**

```
features/<slug>/
  overview.md       the desire, in the user's own words          (input)
  requirements.md   assumptions · open questions · acceptance     (00)
  conflicts.md      probes, verdict PASS or BLOCK                 (01)
  spec.md           what and why, scope, non-goals                (02)
  architecture.md   mechanism, seams, data shapes                 (02)
  acceptance.md     executable criteria, one per line             (02)
  tasks.md          vertical slices, each with its proving test    (03)
  TODO.md           the ledger — ticked as tasks verify            (03)
  diagrams/         sequence + state machine, mermaid              (03)
  ship-review.md    what shipped, what did not                     (08)
```

`architecture.md` and `TODO.md` here are the **feature's**, not the repo's.
Step 08 folds them into the repo's own docs; until then they stay scoped.

## Resuming

First action, always: list `features/<slug>/`. The **first artefact missing or
stale is the next step.** An artefact is stale when its inputs are newer than
it — re-run that step rather than patching downstream.

If the user names no slug and several folders are unfinished, ask which one.
If the folder does not exist, you are at DESIRE: write `overview.md` from what
the user said, show it to them, then start at 00.

## The gate is real

01 can come back **BLOCK**. That is not a formality — it means the feature as
specified collides with something that already exists and no amount of careful
implementation fixes it. On BLOCK: report the conflict, re-open the specific
decision it invalidates, and go back to 00 for that decision only. **Never walk
past a BLOCK by deciding it is probably fine.**

## When to run less than all of this

The pipeline is for work whose shape is not yet known. It is not a ceremony to
perform on a one-line change.

- The user fully specified a small edit → make the edit.
- A bug with a known cause → `04_tdd` (a failing test that reproduces it) then
  `05_implement`, `06_verify-task`. Skip 00–03.
- A feature touching shared state, stored data, or a recorded decision → the
  whole pipeline, no shortcuts. That seam is where this repo's bugs live.

Say which path you picked and why, in one line, before you start.

## Repo law outranks this skill

Before step 00, read whatever the project treats as law: `CLAUDE.md`,
`AGENTS.md`, ADRs, `architecture.md`, contributing rules. They tell you the test
command, the docs to keep in step, and the decisions already made. Where they
disagree with anything here, **they win** — and say so out loud rather than
silently following one.

## Language

Reply and write artefacts in the user's language. Code, comments, test names,
commit messages and docs the repo already keeps in English stay English.

## Reporting

At each stage boundary, one short paragraph: what the stage produced, what it
changed about the plan, what is next. At the end, what passed, what you skipped,
and what is still broken — in those words, without softening.
