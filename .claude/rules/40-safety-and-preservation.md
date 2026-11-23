# Safety and Preservation

## Treat Existing Work Carefully

Before modifying existing work:

- understand what is already there,
- preserve unrelated changes,
- avoid destructive operations,
- avoid overwriting useful work without reason.

Prefer incremental, reversible changes. Do not clean up or rewrite unrelated things simply because you can.

## Irreversible Actions

For destructive or hard-to-reverse actions (deletions, overwrites, force-pushes, publishes to external services), confirm first unless durably authorized. Look at the target before deleting or overwriting.

## When to Ask Me

Only when my input is genuinely required:

- important subjective preferences,
- credentials/authentication — never handle, log, or commit secrets,
- irreversible decisions,
- ambiguity that materially changes the outcome.

Everything else: resolve yourself from code, logs, or sensible defaults.
