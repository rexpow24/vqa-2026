---
name: 06_verify-task
description: Step 06 of the ship-feature pipeline. Verify one task actually passed — its proving test, its acceptance criteria, and nothing else broken — then tick the ledger or send it back to 05 with the failure named.
---

# 06 · Verify the task

Input: a task from `tasks.md` its author believes is done. Output: a ticked box
in `TODO.md`, or a named failure handed back to `05_implement`.

This step exists because "done" is the least reliable claim in software. It is
separate from step 05 so that the claim has to survive being checked by someone
who did not just write the code.

## Run three things

1. **The proving test** from the task row. Green.
2. **Every acceptance criterion the task's `Covers` column names.** Execute
   them, one at a time, from `acceptance.md`. Quote the real output — the actual
   number, the actual row, the actual screen state. **Reading the code and
   concluding a criterion holds is not executing it.**
3. **The tests that already existed** in the area you touched. Not yet the whole
   suite — that is step 07 — but enough to know you did not trade one behaviour
   for another.

## PASS

All three green, with output quoted. Then:

- Tick the box in `TODO.md` and set its status to `done`.
- If anything was learned that changes a later task, edit `tasks.md` **now**,
  while you remember why.
- If a bug surfaced that reading would never have found, add it to the
  `Bugs found by testing, not by reading` table with its symptom and its cause.
  That table feeds the next feature's conflict audit.

Then move to the next task, starting again at `04_tdd`.

## FAIL

Name the failure precisely — the assertion, the value, the line — and hand it
back to `05_implement`. Do not fix it here; do not weaken the test to make it
pass. A criterion that is genuinely wrong gets **changed in `acceptance.md` with
a reason**, in the open, never quietly relaxed inside the test.

**Budget: three attempts.** If the same task fails a third time, stop
implementing and report. Three failures means the task is mis-cut or the design
is wrong, and the answer is at step 03 or 02, not in another attempt at 05.

## The ledger is the truth

The only thing that ticks a box in `TODO.md` is this step, having actually run
the checks. A box ticked from memory turns the ledger into a story about what
you meant to do, and the whole pipeline downstream trusts it.
