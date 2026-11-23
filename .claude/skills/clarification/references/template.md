# CLARIFICATION — <subject>

> Requirement-clarification document, written **before** any spec. Not a spec, not a plan.
> It records what was verified, what the user decided, what is still open, and **how much detail
> each item must be specified to**.
>
> Status: 🟡 <state> · Updated: <YYYY-MM-DD>

---

## How to read the detail levels

| Level | Meaning | The spec must contain |
|---|---|---|
| 🟢 Low | Fixable in one commit, affects nothing else | A one-line decision |
| 🟡 Medium | Touches several places, but no data is lost | Field table, I/O list, constraints |
| 🔴 High | Requires a data migration or a rewritten flow | Diagram + state machine + I/O + checklist + acceptance criteria |

Status: ✅ decided · ⏳ blocking · 💭 default proposed, needs a nod · ❄️ deferred

---

## 0. Verified context (not assumptions)

State how you checked, then the results.

| What was checked | What is actually true |
|---|---|
| <claim from the request> | ✅ / ❌ <reality, with the real shape> |

### Binding constraints found

Rules from the constitution / CLAUDE.md / existing specs that already answer part of the request,
and — more importantly — any that **conflict** with it.

---

# Task N — <name>

**What you asked for:** *"<verbatim quote>"*

One paragraph: what that sentence does not say, which this section settles.

## N.1 Decisions made

| # | Field | Decision | Level | Status |
|---|---|---|---|---|

> Consequences of each high-level decision: what work it removes, what it adds, what it forecloses.

## N.2 Sequence diagrams

One `mermaid` sequenceDiagram per flow, **including failure branches**.

## N.3 State machine

`mermaid` stateDiagram-v2. Note explicitly which transitions do not exist, and what that guarantees.

## N.4 Input / output

| Operation | Input | Success output | Failure output |
|---|---|---|---|

## N.5 Implementation checklist

- [ ] …

## N.6 What counts as done

Numbered, verifiable propositions. Include at least one security check when data has an owner.

## N.7 Open questions

| # | Question | Why it matters | My proposed default | Level | Status |
|---|---|---|---|---|---|

---

# Detail-level summary

| Task | Item | Level | Why that level |
|---|---|---|---|

---

# What I'm waiting on

| Priority | Item |
|---|---|
| ✅ Decided | … |
| 🟡 Needs a nod | N items marked 💭 |
| ❄️ Deferred | … |
| ⬜ After review | … |

## Clarification log

| Round | Asked | Answered |
|---|---|---|
