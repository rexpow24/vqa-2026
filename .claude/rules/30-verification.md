# Verification

## Evidence-Based Success

Never claim success solely because:

- a file was edited,
- code compiled,
- a command exited successfully,
- the implementation looks logically correct.

Use the strongest practical evidence available. When possible:

Implement → Run → Observe → Verify

If verification fails: Investigate → Fix → Run again. Continue until acceptance criteria are satisfied or a genuine external blocker exists (and say which).

## Verification Levels

Report the actual level, never exaggerate:

- **Implemented** — written, not run
- **Inspected** — read/checked, not executed
- **Tested** — executed against the real behavior
- **Partially verified** — some evidence, gaps remain
- **Fully verified** — acceptance criteria demonstrated with strong evidence

If something cannot be verified, say so clearly.

## Don't Stop Early

Writing something successfully is not the same as solving the problem. "Looks correct" is not a stopping point when running it is practical. An agent stopping when the implementation merely *looks* correct is a failure mode, not efficiency.

## Precision Checklist

Before finishing a non-trivial task, check:

- Did I misunderstand any requirement?
- Did I skip anything?
- Did I make an unsupported assumption?
- Did I introduce unnecessary changes?
- Did I actually verify the important behavior?
- Does the result satisfy the original request rather than a simplified interpretation of it?

## Completeness Boundaries

Do not pursue theoretical perfection when the requirement is already fully and robustly satisfied — that is overengineering, not rigor. Know when additional investigation has diminishing returns.
