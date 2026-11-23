---
name: 08_ship-review
description: Step 08 of the ship-feature pipeline, the last one. Review the finished diff, fold the feature's docs into the repo's permanent docs, and report what shipped and what did not.
---

# 08 · Ship review

Input: a feature whose `07_verify-feature` run is clean. Output:
`features/<slug>/ship-review.md`, updated repo docs, and a final report.

## 1. Read the diff you are about to ship

The whole diff, as a diff — not the files as you remember writing them.

- **Dead code.** Anything added for a task that later changed shape. Delete it.
- **Debug residue.** Prints, commented-out branches, temporary thresholds,
  hardcoded paths, the fixture you swore you would remove.
- **Scope.** Every hunk should trace to a task in `tasks.md`. A hunk that traces
  to nothing is either an undocumented decision or an accident; name which.
- **Non-goals.** Re-read that section of `spec.md`. Features grow while you
  build them, and this is the one moment you can see it.
- **Secrets and local paths.** Nothing machine-specific in what ships.

## 2. Fold the docs up

`features/<slug>/architecture.md` and `TODO.md` are the feature's, not the
repo's. They stop being current the moment the feature ships, so promote what
outlives them and leave the rest behind:

| From the feature | Into the repo |
|---|---|
| `architecture.md` — the mechanism and *why* | the repo's architecture doc, in the section it belongs to |
| the ✅ decisions in `spec.md` worth never relitigating | the repo's decision log, one row each |
| `Bugs found by testing, not by reading` | the repo's equivalent table |
| anything the operator now does differently | the user guide |
| unfinished, deferred, or newly found work | the repo's tracker, as its own items |

**A doc describing a design the code no longer has is worse than no doc.** If
this feature invalidated a paragraph somewhere, rewrite that paragraph now —
finding it later costs someone a day.

## 3. ship-review.md

```
# <feature> — ship review

**Shipped:** <date> · **Acceptance:** N/N pass · **Suite:** N tests, green

## What shipped
<one paragraph, in the user's terms>

## Decisions worth remembering
<the ones promoted to the repo's log, one line each>

## What changed about the plan
<where the build disagreed with the spec, and what won>

## Not shipped
<deferred items, each with where it now lives>

## Still broken
<including anything predating this feature, with where it is logged>
```

## 4. Commit

Commit to the current branch — branch first if you are on the default one.
Message in English, describing the behaviour that changed, not the files. Commit
or push only when the user has asked for it.

## 5. Report

Say **shipped** only when: every acceptance criterion passed, the full suite is
green, the docs are folded up, and the "still broken" list contains nothing that
touches this feature. Otherwise say exactly which of those four is not true.

Then stop. The feature folder stays on disk as the record of how it was built,
and the next feature starts with its own `overview.md`.
