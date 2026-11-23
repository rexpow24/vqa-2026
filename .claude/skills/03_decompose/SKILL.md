---
name: 03_decompose
description: Step 03 of the ship-feature pipeline. Cut a spec into tracer-bullet vertical slices — tasks.md with a proving test per task, TODO.md as the ledger, and mermaid diagrams for flow and state.
---

# 03 · Decompose into tasks

Inputs: `spec.md`, `architecture.md`, `acceptance.md`. Outputs: `tasks.md`,
`TODO.md`, `diagrams/` in `features/<slug>/`.

## Vertical slices, not layers

Each task is a **tracer bullet**: a thin cut through every layer it touches that
ends in something you can run and observe. Not "add the column", not "write the
UI" — those are horizontal slices that only prove the *shape* of things and
leave you with nothing working until the last one lands.

```
WRONG (horizontal):   schema · model · service · route · UI
RIGHT (vertical):     one field end to end · then the next behaviour · then errors
```

The first task is the thinnest slice that proves the whole path works. Get that
one green before you plan the rest in detail — what you learn from it usually
rewrites the tasks after it, and rewriting them is correct, not a failure.

## tasks.md

```
| id | Slice | Touches | The test that proves it | Covers | Depends on |
|----|-------|---------|-------------------------|--------|------------|
| T1 | ...   | file:fn | one sentence, observable | A1, A3 | —          |
```

Rules for each row:

- **Independently verifiable.** If you cannot say what running it looks like,
  the row is a layer, not a slice. Re-cut it.
- **One proving test**, named as behaviour ("approve writes one file per shot"),
  not as structure ("test_writer_class").
- **Covers** points at `acceptance.md` ids. When you are done, every criterion
  in `acceptance.md` is covered by some task. Uncovered criteria mean either a
  missing task or a criterion nobody intends to meet — resolve it now, out loud.
- **Depends on** is real ordering, not a wish. A long dependency chain means you
  cut horizontally; try again.

Keep tasks small enough that a failed one is cheap to redo. If a task cannot
be verified without three others landing first, it is too big.

## TODO.md — the ledger

```
# <feature> — progress

- [ ] T1 — <slice>            status: pending
- [ ] T2 — <slice>            status: pending

## Notes
<what changed about the plan while building, dated>

## Bugs found by testing, not by reading
| Bug | Symptom | Cause |
```

`06_verify-task` ticks a box only after the proving test and its acceptance
criteria pass. **A box ticked from memory is worse than no ledger at all.**

The bugs table matters more than it looks: it is the record of what running the
code taught you that reading it did not, and it is where the next feature's
conflict audit finds its probes.

## diagrams/

Mermaid, in `features/<slug>/diagrams/`:

- **`sequence.mmd`** — every actor, **including the failure branches**.
- **`state.mmd`** — the states a record moves through, and explicitly which
  transitions do not exist. Say when a transition is forward-only and what that
  buys you.

Skip a diagram only when there is genuinely one actor and no record with states.
Say which you skipped and why.

## Done when

Every `acceptance.md` id appears in some task's **Covers** column, `TODO.md`
lists every task unticked, and the first task is small enough to be green today.
Show the user `tasks.md` before starting T1.
