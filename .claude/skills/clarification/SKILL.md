---
name: clarification
description: Interrogate a request until it is safe to specify. Verifies claims against the real system before asking anything, then drives batched decision rounds and produces CLARIFICATION.md with per-field detail levels, sequence diagrams, state machines, checklists and verifiable acceptance criteria. Use when the user asks to clarify requirements, gather requirements, or says "clarify before spec", "làm rõ yêu cầu", or /quyen:clarification.
---

# Clarification

Turn a vague request into something safe to specify. **You do not implement anything.** You produce
one artefact — `CLARIFICATION.md` — and the decisions inside it.

The value of this skill is not the questions. It is refusing to ask questions from a position of
ignorance, and refusing to let a wrong assumption survive because it was never checked.

## The rule that matters most

**Verify before you ask. Verify before you believe.**

When someone describes their own system, they are describing their memory of it. Memory drifts.
Before writing a single question, go and look:

- Named a database? Query it. List the tables. List the columns.
- Named an API? Call it.
- Named a table, file, env var, endpoint? Confirm it exists, with its real shape.
- Named a constraint ("we already have X")? Find X.

Then open the report with a table of **what is actually true**, marking every place reality differs
from the description. Do this even when — especially when — it contradicts the person who asked.
Say it plainly and without drama: *"`public.users` does not exist; you may be thinking of
`auth.users`."*

Also read whatever the project treats as law — a constitution, CLAUDE.md, ADRs, coding standards,
existing specs. Constraints already agreed are not open questions, and asking about them wastes a
round. Constraints that **conflict** with the request are the most valuable thing you can surface.

## How to ask

Ask in **rounds of at most 4 questions**, blocking decisions first. A blocking decision is one where
different answers produce materially different work — not one with an obvious default.

Every option must carry its **consequence**, not just its label. "DB-mediated job queue" tells the
user nothing. "Frontend writes a row and watches it change — matches Principle VIII, extends to
Speaking later, but needs a trigger and a stuck-row sweeper" lets them actually choose. Name the
cost of the option you recommend, not only its benefit.

Mark one option `(Recommended)` and put it first. You have read the code; they have not, recently.
Withholding a recommendation is not neutrality, it is abdication.

Between rounds, keep working. Anything that does not depend on the pending answer gets done now.

**Stop asking when the remaining questions have obvious defaults.** Put those in the document with
your proposed answer and a 💭 marker, so the user can accept twenty of them with one "ok". Do not
burn a round on a question you can answer yourself.

## Detail levels

Every field gets rated by **cost if wrong**, not by importance:

| Level | Meaning | The spec must contain |
|---|---|---|
| 🟢 Low | Fixable in one commit, affects nothing else | A one-line decision |
| 🟡 Medium | Touches several places, but no data is lost | Field table, I/O list, constraints |
| 🔴 High | Requires a data migration or a rewritten flow | Sequence diagram + state machine + I/O + checklist + acceptance criteria |

This rating is the point of the document. It tells the reader where to slow down.

## What every new feature must have

Do not accept a feature description without these five. If the user cannot supply one, derive it and
have them confirm:

1. **Sequence diagram** (mermaid) — every actor, including the failure branches. A diagram with only
   the happy path is a diagram that hides the hard part.
2. **State machine** (mermaid) — the states a record moves through, and which transitions do not
   exist. Say explicitly when transitions are forward-only, and what that buys.
3. **Input / output table** — per operation: input, success output, and *each* failure output.
4. **Implementation checklist** — unchecked boxes, ordered.
5. **Acceptance criteria** — see below.

## Acceptance criteria are verifiable propositions

"It works" is not a criterion. "Auth is done" is not a criterion. Write statements someone can
execute and get a yes or no from:

> - Sign up with a fresh email → lands on `/workspace`, sidebar shows that email.
> - `SELECT * FROM profiles WHERE id = auth.uid()` returns **exactly one** row.
> - Sign up with an existing email → error under the email field, **and the typed password is still
>   on screen**.
> - Log out → browser Back does **not** re-enter `/workspace`.

Prefer criteria that would fail loudly if the feature were subtly broken. Include at least one
security criterion whenever data has an owner ("user A reads user B's rows → empty").

## Push back on the data model

When the user proposes tables, check each against one question: *is this an entity, or is it a
query?* History and progress are usually queries. A second copy of derivable data is a cache, and a
cache goes stale — then the dashboard says 6.5 while the list under it averages 6.8.

Say so, give the reason, and offer the alternative. Then respect the answer: if they reaffirm the
original shape, build it and note the tradeoff.

## Surface contradictions between documents

Projects accumulate specs that disagree. Hunt for these and put them in a table — *this doc says N
calls, that doc says one call* — because whoever implements will otherwise pick one at random. Note
which contradictions are urgent (they touch stored data) and which can wait.

## Scope discipline

If the user says a topic is out of scope, **stop investigating it**. Record what you already found in
a short "deferred" section so the next person does not re-derive it, list the questions that will
need answering, and move on. Do not keep pulling the thread.

## Output

Write `CLARIFICATION.md` at the repo root, **in the user's language**. Structure in
`references/template.md`. Non-negotiable parts:

- Status line and date at the top.
- The detail-level legend.
- **Section 0: verified context** — reality vs description, plus binding constraints found.
- One section per task, each ending in an **open-questions table**:
  `# | Question | Why it matters | My proposed default | Level | Status`
- A summary table of every field by detail level.
- A closing "what I'm waiting on" block plus a log of the question rounds and their answers.

Status markers: ✅ decided · ⏳ blocking, awaiting answer · 💭 default proposed, needs a nod ·
❄️ deliberately deferred.

Update the same file across rounds — rewrite answered rows in place rather than appending
corrections, so the document reads as current state and not as a transcript.

## Finishing

Report: what was verified and what turned out false, what was decided, what still blocks, and what
you deliberately did not do. Then stop. Writing the spec, the migrations, or the code is a separate
job that begins after the user has reviewed this one.
