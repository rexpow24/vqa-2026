---
name: feature-conflict-audit
description: Audit a proposed new feature against what already exists before writing it, then recommend an approach. Use when the user proposes a feature, pastes a spec, says "add X", "implement X", "build X", or asks whether a change will break something. Also use before large refactors of existing behaviour.
---

# Feature conflict audit

## Background

Features rarely break on their own. They break where they touch something that
was already there: a default value, a state store someone else owns, an
invariant old code silently assumed. In this repo every serious bug so far has
been of that kind, and **none of them were found by reading code** — they were
found by running it.

That is the whole point of this skill: interrogate the seam between new and old,
then prove the answer empirically.

## When to run

Run when a feature is **proposed**, not after it is built. The output is an
input to the implementation, not a review of it.

Scale the audit to the change. A new sidebar toggle deserves three minutes and
two sentences. A new state layer, a new artifact tier, a new detection signal,
or anything touching the reviewer's outputs deserves the full pass. Do not
produce a report longer than the diff it is about — this project ships (see
`CLAUDE.md` Principle 2), and a bureaucratic audit is itself a failure.

## The audit

Read the feature, then answer only the probes that apply. Each probe exists
because it caught a real bug here.

1. **What exists before the feature acts?**
   Defaults, seed values, the state the user is handed on arrival. A feature
   that creates things must say what happens when the thing it creates meets
   the default that was already there.

2. **Who else writes this data?**
   The framework, the DB, another code path, a cache, a previous run. If the
   answer is "two owners", that is the bug. Name the second owner explicitly.

3. **What did old code assume that is now false?**
   Grep the consumers of any table, file, folder or field the feature touches.
   An added column changes every write path that did not name its columns.

4. **If it adds a signal or source, is it actually independent?**
   Two signals that move together are one signal wearing two hats. Confidence
   derived from them is inflated, not corroborated. Measure correlation before
   claiming independence.

5. **What happens the second time?**
   Re-run, re-approve, re-render, refresh, reconnect. Streamlit re-executes the
   script on every interaction and the pipeline re-runs per video, so "once" is
   never the real case.

6. **Does it contradict a recorded decision?**
   Check the `CLAUDE.md` Decision Log, `architecture.md`, and `GUIDE.md`. If it
   does, say so and either argue the decision should change or change the
   feature. Never leave a doc describing a design the code no longer has.

## Verify, then report

**A conflict you cannot demonstrate is a hypothesis, not a finding.** Before
reporting anything as real, reproduce it — a script against `vqa/`, an
`AppTest` run, a query against `pipeline.db`. Show the before/after values.

Equally: if a probe comes back clean, say clean and move on. Do not pad.

## Output format

```
## Conflicts

| # | New vs. existing | What breaks | Verified |
|---|---|---|---|
| 1 | <feature> vs <what it collides with> | concrete failure | how |

## Recommended approach
<one paragraph: what to build, and the one design point that avoids the conflict>

**Trade-off:** <what this gives up>
**Not doing:** <options rejected, one line each>
```

If there are no conflicts, say so in one line and give the recommendation.

## Criticism is the job

You were asked to critique, so critique. Say plainly when a feature should not
be built, when the spec contradicts itself, or when it solves a problem the
review tool already handles. State the concern in a sentence or two, then — if
the user reaffirms — build the full thing anyway under stated assumptions.

## Examples

<example>
<scenario>New UI action collides with a seeded default</scenario>
<input>"Mark cut: playhead → a shot of impact ±5s, refusing overlaps."</input>
<reasoning>Probe 1. The reviewer arrives with one shot already covering the
whole clip. Every first Mark cut lands inside it, so the overlap rule fires
100% of the time.</reasoning>
<output>Conflict: Mark cut vs. the whole-clip default shot — the first press
always fails with "cannot auto-adjust". Fix: the first Mark cut *replaces* an
untouched default rather than adding beside it; track it with a `default` flag
cleared on any manual edit.</output>
</example>

<example>
<scenario>New state layer on top of a state layer the framework owns</scenario>
<input>"Keep the shot list in st.session_state and render Start/End number
inputs from it."</input>
<reasoning>Probe 2 and 5. Streamlit owns widget state keyed by `key=`. Once
`s_<cid>_0` exists it ignores `value=` on re-render, so the widgets and the
shot list are two owners of one number.</reasoning>
<output>Conflict: verified by AppTest — deleting shot 1 left shot 1's numbers
on top of shot 2, destroying shot 2 silently. Fix: version the widget keys
(`s_{cid}_{rev}_{i}`) and bump `rev` on every programmatic change, so those
renders create new widgets that do accept `value=`. Writebacks from typing must
not bump.</output>
</example>

<example>
<scenario>New signal claimed as independent corroboration</scenario>
<input>"Fuse the on-screen counter with PySceneDetect; agreement = HIGH
confidence."</input>
<reasoning>Probe 4. Measured the candidate counter region's change rate: 0.244
versus 0.000 for a pure-scene control. It was the alpha-blended logo bleeding
the scene through — it changes *because* the scene changes.</reasoning>
<output>Conflict: the two signals are not independent, so "HIGH" would be one
detector agreeing with itself. Recommendation: drop the counter path entirely
and label every boundary MEDIUM. Trade-off: no confidence ranking, so review
order falls back to duration.</output>
</example>
