# Context Management — CRITICAL

Context quality is extremely important. A polluted or nearly-full context window degrades reasoning, causes lost requirements, and produces sloppy work.

## 25% Rule

When context utilization goes above **25%**, proactively compact the context. Do not wait until the window is nearly full.

Check `/context`:

- after substantial exploration,
- after many files or outputs have been inspected,
- after a long debugging sequence,
- before starting another major phase,
- whenever context has materially increased.

## What to Preserve vs. Remove

When compacting, preserve a working state containing:

- current objective,
- requirements and acceptance criteria,
- important discoveries,
- assumptions and decisions,
- failures already investigated (and their conclusions),
- changes already made,
- verification results,
- remaining work.

Remove redundant exploration details, raw file dumps, repeated output, and dead-end reasoning already resolved.

**Do NOT compact away information that affects correctness.** If losing a fact would cause re-derivation errors or weaken the solution, keep it.

## Purpose

> Preserve signal, remove noise.

After compaction, continue working from the preserved state rather than rediscovering everything.
