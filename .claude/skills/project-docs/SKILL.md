---
name: project-docs
description: Own the two documentation layers — docs/ for what is true about the whole system (business value, architecture, data model, use cases, feature inventory, product spec) and features/<slug>/ for what is changing right now. Routes every spec through grill-me or grill-with-docs before it is written. Use when the user asks to set up project docs, write architecture/business/data-model/use-case docs, take stock of features, or says "tạo docs", "viết tài liệu dự án", "project overview".
---

# Project docs

Two layers, one rule between them:

| Layer | Answers | Lifetime |
|---|---|---|
| `docs/` | *What is true about this system?* | outlives every feature |
| `features/<slug>/` | *What are we changing right now?* | ends when the feature ships |

That rule is the whole skill. A fact that survives the feature that produced it
**graduates** to `docs/`; a fact that dies with the feature stays in the folder.
When you cannot tell which, ask: *would this still be written the same way six
features from now?* Yes → `docs/`.

You write no production code here.

## 1. Map before you create

Almost no repo is empty. This one has `reports/`, that one has `knowledge/`, a
third has half an architecture doc in the README. **Creating `docs/` without
reading them gives the project two truths**, and the reader now has to guess.

First action, always — survey, then report:

```
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.next/*" | head -50
```

For each thing you find, decide one of three and say which:

- **Adopt** — it already is the doc. Move it under `docs/`, keep its history.
- **Point** — it is a valid artefact of another kind (a report, a benchmark, an
  n8n note). It stays where it is; `docs/` links to it.
- **Fold** — it is a stale fragment. Its content moves into a real doc and the
  original goes, in one move so nothing is stranded.

Read the project's law first — `CLAUDE.md`, `AGENTS.md`, ADRs. **They outrank
this skill.** If the project already mandates a layout, use it and say so; do
not rename someone's `knowledge/` to `docs/` because a skill said `docs/`.

## 2. docs/ — the overview layer

```
docs/
  README.md        the map: which question each file answers
  business.md      why this exists, who for, what it is worth
  spec.md          what the product does, as a whole
  architecture.md  boundaries, services, data flow, seams
  data-model.md    entities, relationships, who owns each field
  use-cases.md     actor → goal → flow, per real path
  features.md      the inventory: every feature, status, link
  glossary.md      domain terms, one meaning each
  decisions/       ADRs, one file per irreversible choice
```

Write only the files the project needs now. Eight thin stubs are worse than
three real documents — a stub teaches the reader that `docs/` is decorative.

**business.md** — the problem in the user's own words, who has it, what changes
for them when it is solved, and how success is measured. Measures are numbers or
observations, never adjectives. If you cannot write the measure, say so in the
file; an honest gap beats an invented KPI.

**spec.md** — the product's behaviour as observable statements, plus **scope**
and **non-goals**. Project-level non-goals are the highest-leverage lines in
`docs/`: they are what stops the system growing sideways for a year.

**architecture.md** — components, boundaries, and what crosses each boundary.
One diagram beats three paragraphs when there is more than one actor or a record
changes state; use mermaid. Name the **seam** each component sits behind,
because seams are what make the next change cheap. Include a *Rejected* section
— designs considered and dropped, one line and one reason each — or the same
debate reopens every quarter.

**data-model.md** — every entity, its fields, and **who writes each field**. Two
writers on one field is the most common bug in any system; name the single
owner. Record relationships and cardinality, the identity/idempotency keys, and
the retention rule for anything that grows without bound.

**use-cases.md** — one section per case: actor, precondition, the flow, and
**what happens when it fails**. A use case with only a happy path is hiding the
part that costs you a week.

**features.md** — the inventory, and the answer to *how many features are
there*. A table, nothing more:

```
| Feature | Slug | Status | Owner doc |
|---|---|---|---|
| Landscape chunk delivery | media_variants_manifest | shipped | features/media_variants_manifest/spec.md |
| Publisher queue worker | publisher_queue_worker | planned | features/publisher_queue_worker/spec.md |
```

Status is one of `planned · in progress · shipped · abandoned`. Keep
`abandoned` rows with their reason — a deleted row invites someone to propose it
again next month.

**glossary.md** — each domain term, one meaning, in the words the team already
speaks. This is what makes `grill-with-docs` sharp later: a session that can
challenge your wording against a real glossary catches misunderstandings a bare
interview never reaches.

### Two rules that keep docs/ alive

**One fact, one home.** Cross-link, never copy. The moment a number lives in two
files, one of them is already wrong and no one knows which.

**docs/ describes what runs, not what is planned.** Intentions belong in
`features/<slug>/`. Mixing the two is exactly how a team learns to stop
believing `docs/` — a reader who is burned once by a documented feature that
does not exist will never trust the directory again. Graduate a fact **when it
ships**, not when it is decided.

Give every file a last line: `Verified against <commit or date>.` A reader who
knows a doc is four months old can use it. A reader who cannot tell its age
cannot.

## 3. features/ — the per-feature layer

```
features/
  README.md      how this directory works
  _shared/       decisions and contracts spanning several features
  <slug>/
    spec.md      what this feature is, and why       ← grilled, never guessed
    todo.md      the ledger, ticked as work verifies
```

If the repo runs the full `quyen` pipeline, `features/<slug>/` also holds
`overview.md`, `requirements.md`, `conflicts.md`, `architecture.md`,
`acceptance.md`, `tasks.md`. This skill does not replace that pipeline — it sets
up the ground the pipeline stands on, and keeps `docs/features.md` in step with
what is actually in `features/`.

A feature's `spec.md` carries, at minimum: **problem · behaviour · scope ·
non-goals (each with its reason) · decisions (each with the trade-off accepted)
· done when**. A `done when` that cannot be executed is not a `done when`.

## 4. Every spec gets grilled first

**Do not write a spec from what you think the user meant.** Interview first,
write second. Which skill you use depends on one thing — whether a domain model
exists yet:

| Situation | Use | Why |
|---|---|---|
| No `docs/` yet; first spec in the repo | `grill-me` | nothing to ground against; the questions *are* the model |
| `docs/` exists (glossary, ADRs, data model) | `grill-with-docs` | grounds every answer in the project's own language, updates the docs inline as decisions crystallise |
| Feature inside the `quyen` pipeline | `quyen:00_grill-me` | same interview, but writes `requirements.md` for the conflict gate |

Once `docs/` exists, **prefer `grill-with-docs` every time**. An ungrounded
interview re-invents terminology, and two names for one concept is how a data
model rots. The grilling rules that matter most:

- **Verify before you ask.** When people describe their own system they are
  describing their memory of it, and memory drifts. Open the table, call the
  endpoint, find the constraint. A question that arrives with three lines of code
  attached gets a decisive answer; a bare question gets *"tùy bạn"*.
- **One question at a time**, blocking decisions first. Blocking means different
  answers produce materially different work.
- **Always recommend.** Mark one option `(khuyến nghị)` and put it first. You
  have read the code; they have not, recently. Withholding a recommendation is
  not neutrality.
- **A constraint already agreed is not an open question.** Asking about it burns
  a round. A constraint that *contradicts the request* is the most valuable thing
  you can surface.

Stop grilling when no blocking question remains — then write the spec.

## 5. Keeping the two layers in step

Whenever a feature ships, three things must be true, and this skill checks them:

1. `docs/features.md` shows the new status.
2. Every fact the feature made permanent has graduated into the right `docs/`
   file — new entity into `data-model.md`, new boundary into `architecture.md`,
   new term into `glossary.md`.
3. Nothing was copied. The feature's own docs now **link** to `docs/` rather
   than restating it.

A doc is **stale** when its inputs are newer than it. Say so plainly and offer to
re-derive it; do not quietly patch a line and leave the rest wrong.

## Done when

`docs/README.md` maps every file that exists · each written doc answers its one
question with no second home for the same fact · `docs/features.md` matches the
real contents of `features/` · every spec you produced was grilled, not guessed ·
every doc carries its verified-against line.

Then report, in one short paragraph: what you adopted, what you wrote fresh, what
you deliberately left out, and which docs you could not verify.

## Language

Reply and write in the user's language. Code, identifiers, commit messages, and
docs the repo already keeps in English stay English.
