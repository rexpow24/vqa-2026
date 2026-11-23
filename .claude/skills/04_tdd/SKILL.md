---
name: 04_tdd
description: Step 04 of the ship-feature pipeline — the RED half. Write exactly one failing test for one task, through the public interface, and confirm it fails for the stated reason. Use when the user wants test-first work, red-green-refactor, or a failing test that reproduces a bug.
---

# 04 · RED — one test, genuinely failing

Input: one row of `tasks.md` (or, for a bug, the reproduction). Output: one test
that fails, and the failure output quoted.

## One test. One.

Writing all the tests first and then all the code is not TDD, it is horizontal
slicing with extra steps. Tests written in bulk describe **imagined** behaviour:
they end up asserting the *shape* of things — signatures, data structures —
because that is all you know before the code exists. They then pass when
behaviour breaks and fail when it is fine.

Write the next test only after the previous one is green, when you know what
actually matters.

## Through the public interface

A test that reaches inside is a test that breaks on every refactor while
behaviour is unchanged — that is the diagnostic. If renaming an internal
function fails a test, the test was measuring implementation.

- Exercise the real code path. **Drive the real application**, not a mock of it:
  the framework's own test harness against the real entry point, with the
  storage pointed at a temp location.
- Verify through the interface, not around it. Reading the database directly to
  check something the UI is supposed to show tests half the system and passes
  while the other half is on fire.
- **Assert nothing blew up**, explicitly, on anything that clicks or submits.
  Frameworks catch exceptions and render them; a test that only checks stored
  state will happily pass with a traceback on screen.
- Address widgets and elements **positionally or by role**, the way a user
  reaches them — not by internal keys, which are often designed to change.

## RED must fail, and fail for the stated reason

Run it. Read the output. **A test that passes the moment you write it has told
you nothing** — either the behaviour already exists (say so, and go delete the
task) or the test does not reach the behaviour.

Then check *why* it failed. `AssertionError: expected 2, got 1` is a good RED.
`ImportError` or `TypeError: takes 2 positional arguments` is scaffolding
failing, not behaviour — fix the scaffolding and get a real RED first.

Quote the failure. That line is the definition of done for step 05.

## Naming

Name the test as a sentence about the system: `approve_writes_one_file_per_shot`
— it should read as a line of the spec. Match the project's existing test
vocabulary and file layout; do not invent a second convention beside it.

## Then stop

Do not write the implementation in this step. Hand the quoted failure to
`05_implement`.
