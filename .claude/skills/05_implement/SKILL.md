---
name: 05_implement
description: Step 05 of the ship-feature pipeline — the GREEN half. Write the minimum code that turns the failing test green, then refactor only while green.
---

# 05 · GREEN — minimum code, then refactor

Input: the failing test from `04_tdd` and its quoted error. Output: that test
passing, and nothing else newly broken.

## Minimal means minimal

Write only enough to satisfy the test in front of you. Do not build for the
tasks you can see coming — you have been wrong about them before, and code
written for an imagined caller is code no test covers.

The named error from RED is the target. When it stops appearing, this step is
over.

## Follow the architecture, but say when it was wrong

`architecture.md` names the seam and the owner of each field. Implement that
shape. When the code tells you the design was wrong — the seam is in the wrong
place, the field needs a second writer after all — **stop and say so** rather
than quietly diverging. Update `architecture.md` and note it in `TODO.md`. A doc
describing a design the code does not have is worse than no doc.

## Refactor only while green

Once the test passes:

- extract the duplication you just created;
- push complexity **behind** an interface rather than out to the callers — a
  module earns its keep by how much it hides;
- ask what this code reveals about the code that was already there;
- run the test after each step.

**Never refactor while red.** Get to green first, then change one thing at a
time with the test as your net.

## Match what surrounds it

Comment density, naming, error handling, import style, how failures are logged —
read the neighbouring code and write code that reads like it. A file where your
contribution is identifiable by style is a file that got worse.

## Destructive operations

Deleting rows, dropping files, overwriting outputs, migrating data: **look at
the target first, back it up, then show the counts before and after.** Databases
with write-ahead logs need a checkpoint before the file is copied, or the backup
is short. Report the real numbers afterwards, and when they disagree with what
you predicted — 35 deleted where you said 33 — say so and explain the gap.

## Then hand off

Do not run the wider suite here and do not tick anything in `TODO.md`. That is
`06_verify-task`, and it is a separate step precisely so that "it passes on my
machine" has to survive someone checking.
