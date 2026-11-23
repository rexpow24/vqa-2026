---
name: 00_grill-me
description: Step 00 of the ship-feature pipeline. Turn a vague desire (overview.md) into requirements.md — verified assumptions, resolved open questions, and acceptance criteria someone can execute. Use when the user wants a request grilled, stress-tested, or made safe to specify.
---

# 00 · Grill the desire into requirements

Input: `features/<slug>/overview.md`. Output: `features/<slug>/requirements.md`.
You write no production code in this step.

The value here is not the questions. It is **refusing to ask from a position of
ignorance**, and refusing to let a wrong assumption survive because nobody
checked it.

## 1. Verify before you ask

When people describe their own system they are describing their memory of it,
and memory drifts. Before writing a single question, go and look.

| They named… | You do |
|---|---|
| a table, column, file, env var | open it, confirm its real shape |
| an endpoint or service | call it |
| a constraint — "we already have X" | find X, or report that you could not |
| a behaviour — "it re-downloads every time" | run it and measure |

Then read the project's law — `CLAUDE.md`, ADRs, `architecture.md`. **A
constraint already agreed is not an open question**, and asking about it burns a
round. A constraint that *contradicts the request* is the most valuable thing
you can surface in this whole step.

Open `requirements.md` with a **reality table**: claim, what is actually true,
and where they differ. Do this especially when it contradicts the person who
asked, and say it plainly, without drama.

Half the time this step ends the feature: **the thing already exists.** Say so
and ask what they actually observed, offering "chưa thấy, chỉ muốn chắc" — *I
haven't seen it fail, I just want to be sure* — as a real option.

## 2. Ask in rounds

`AskUserQuestion`, at most 4 questions per round, **blocking decisions first**.
A decision is blocking when different answers produce materially different work.
Everything else gets your default and a 💭 marker so the user can accept twenty
of them with one "ok".

Each option carries its **consequence, not its label**. "Store it in session
state" tells the user nothing; "the framework already owns that key, so the two
writers drift and the older one silently wins" lets them choose. Name what your
recommended option *gives up*, not only what it buys.

Mark one option `(khuyến nghị)` and put it first. You have read the code; they
have not, recently. Withholding a recommendation is not neutrality.

Quote your evidence in the preamble with `file:line` links. A question arriving
with three lines of code attached gets a decisive answer; a bare question gets
"tùy bạn".

Between rounds, keep working on anything that does not depend on the answer.

**When the user pushes back, stop and restate.** One short paragraph per item
saying what you now think is being asked, then drop every question built on the
old reading.

## 3. Write requirements.md

Four sections, in this order:

**Reality** — the table from step 1, plus binding constraints found.

**Assumptions** — one per line, each marked `verified` (you checked, say how) or
`unverified` (you did not, say what would check it). An unverified assumption
that survives to step 02 becomes a probe for `01_feature-conflict-audit`.

**Open questions** — a table: `# | Question | Why it matters | My default |
Level | Status`. Level is the **cost if wrong**: 🟢 fixable in one commit ·
🟡 touches several places, no data lost · 🔴 needs a migration or a rewritten
flow. Status: ✅ decided · ⏳ blocking · 💭 default proposed · ❄️ deferred.

**Acceptance criteria** — verifiable propositions, not adjectives. Not "auth
works" but:

> - Sign up with a fresh email → lands on `/workspace`, sidebar shows that email.
> - `SELECT * FROM profiles WHERE id = auth.uid()` returns **exactly one** row.
> - Sign up with an existing email → error under the field, **and the typed
>   password is still on screen**.

Prefer criteria that fail loudly when the feature is subtly broken. Include at
least one for data that has an owner ("user A reads user B's rows → empty"), and
at least one for the second run — re-run, refresh, re-submit — because "once" is
never the real case.

Rewrite answered rows **in place** across rounds. The file is current state, not
a transcript.

## Done when

No ⏳ rows remain, every 🔴 row is ✅, and every acceptance criterion names a
command or an observation that yields yes/no. Then stop — specifying is step 02.

## Scope discipline

If the user says a topic is out of scope, stop investigating it. Record what you
already found under "deferred" so nobody re-derives it, and move on.
