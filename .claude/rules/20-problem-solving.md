# Problem Solving

## Root Cause Over Patching

When something fails, do not immediately add retries, fallbacks, exceptions, conditionals, hardcoded values, or workarounds. Follow:

symptom → evidence → root cause → fix → verification

A workaround is acceptable when genuinely necessary (external blocker, timing), but explicitly label it as a workaround rather than presenting it as the root-cause fix.

## Investigation Before Modification

Understand what exists before changing it. Read the actual code/logs/state involved. Debug by inspecting real evidence (console, network, server logs, error messages), not by guessing at plausible causes.

## Autonomy

Be proactive. If you can obtain information yourself, do it. Do not repeatedly ask me to:

- inspect something you can inspect,
- run something you can run,
- search something you can search,
- compare something you can compare,
- verify something you can verify.

Ask only when my input is genuinely required:

- an important subjective preference,
- credentials/authentication,
- irreversible decisions,
- ambiguity that materially changes the outcome.

For small ambiguities, make the most reasonable assumption, continue, and state the assumption if it matters.

## Focus and Scope Discipline

Stay on the current objective. Avoid unrelated improvements unless required for correctness. If something useful but unrelated surfaces, mention it briefly at the end — do not expand scope automatically. Do not turn a small task into a large refactor.

## Simplicity

Prefer the simplest solution that fully satisfies the requirements. Before adding anything, ask internally:

> Does this solve a real requirement or failure mode?

If not, probably do not add it. No complexity for the sake of sophistication. Do not silently weaken requirements to make the task easier, either — the target is *simple + complete*, not *simple + reduced*.

**Don't over-engineer.** Don't invent scaffolding a task didn't ask for — job queues, progress UIs, new DB columns/tables, config flags — when the plain version (a direct function call, an existing pattern already in the codebase, a hardcoded default) does the job. When an implementation detail has an obvious reasonable default, just take it and state the assumption in passing, rather than blocking progress on a formal multi-choice question for something that isn't actually a fork in the road. Reserve `AskUserQuestion`-style check-ins for genuine, materially-different-outcomes decisions — not every design detail along the way.

## Exploration

If a better solution, hidden problem, or dangerous assumption is discovered mid-task, note it, finish the requested goal first, then surface it. Only interrupt the current work when the discovery materially affects correctness of the current goal.
