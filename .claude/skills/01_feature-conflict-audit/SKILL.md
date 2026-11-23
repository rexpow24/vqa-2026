---
name: 01_feature-conflict-audit
description: Step 01 of the ship-feature pipeline and the gate that can stop it. Audit a proposed feature against what already exists — defaults, second writers, stale assumptions, recorded decisions — prove each conflict by running something, then return PASS or BLOCK. Use before writing a feature or a large refactor of existing behaviour.
---

# 01 · The conflict gate

Input: `requirements.md`. Output: `features/<slug>/conflicts.md`, ending in
**PASS** or **BLOCK**.

Features rarely break on their own. They break where they touch something that
was already there: a default value, a store someone else owns, an invariant old
code silently assumed. Those bugs are almost never found by reading — they are
found by running.

That is the whole point of this step: interrogate the seam between new and old,
then prove the answer empirically.

## Scale it to the change

A sidebar toggle deserves two probes and two sentences. A new state layer, a new
stored artefact, or anything touching data the user has already produced
deserves the full pass. **A report longer than the diff it is about is itself a
failure.**

## The probes

Answer only the ones that apply.

1. **What exists before the feature acts?**
   Defaults, seed values, the state the user is handed on arrival. A feature
   that creates things must say what happens when the thing it creates meets the
   default that was already sitting there.

2. **Who else writes this data?**
   The framework, the DB, a cache, another code path, a previous run. If the
   answer is "two owners", **that is the bug** — name the second owner out loud.

3. **What did old code assume that is now false?**
   Grep every consumer of each table, file, folder or field the feature touches.
   An added column changes every write path that did not name its columns.

4. **If it adds a signal or a source, is it actually independent?**
   Two signals that move together are one signal wearing two hats, and
   confidence derived from them is inflated rather than corroborated. Measure the
   correlation before claiming independence.

5. **What happens the second time?**
   Re-run, re-submit, refresh, reconnect, re-approve. Anything that re-executes
   per interaction or per item makes "once" the case that never occurs.

6. **Does it contradict a recorded decision?**
   Check the decision log, the ADRs, the architecture doc, the user guide. If it
   does, say so and either argue the decision should change or change the
   feature. **Never leave a doc describing a design the code no longer has.**

7. **Do the unverified assumptions from step 00 hold?**
   Each one, individually. This is the cheapest place to find out that the whole
   requirement rests on something false.

## Prove it or it is not a finding

**A conflict you cannot demonstrate is a hypothesis.** Before reporting one as
real, reproduce it — a throwaway script, a test run, a query — and show the
before/after values. Stub the boundary and count the calls:

```python
# "Does it re-download?" -- 20 lines beats an hour of reading.
monkeypatch.setattr(client, "fetch", Tripwire)   # raises if called
```

If a probe comes back clean, write "clean" and move on. Do not pad.

## Output

```
## Conflicts

| # | New vs. existing | What breaks | Verified how |
|---|---|---|---|
| 1 | <feature> vs <what it collides with> | concrete failure | the command you ran |

## Verdict: PASS | BLOCK

## Recommended approach
<one paragraph: what to build, and the one design point that avoids the conflict>

**Trade-off:** <what this gives up>
**Not doing:** <options rejected, one line each>
```

## PASS or BLOCK

**PASS** — conflicts exist but each has a fix that fits inside the requirements
as decided. Carry the fixes forward as constraints into `02_to-spec`; they are
the reason the architecture has the shape it has.

**BLOCK** — one of these is true:

- a conflict has no fix without re-opening a decision the user already made;
- the feature contradicts a recorded decision the user has not agreed to change;
- a probe proved a requirement rests on something false;
- the feature solves a problem that is already solved elsewhere.

On BLOCK, name the **single decision** to re-open, hand back to `00_grill-me`
for that decision only, and do not re-ask what is already settled.

## Criticism is the job

Say plainly when a feature should not be built, when the spec contradicts
itself, or when the review step downstream already handles the case. State it in
a sentence or two — then if the user reaffirms, build the full thing under
stated assumptions and stop arguing.
