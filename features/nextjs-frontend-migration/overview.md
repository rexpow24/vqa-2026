# Overview — Next.js frontend migration

## The desire, in the user's words

"do next.js for frontend instead of streamlit . Do darkmode and minmalist theme."
Confirmed scope, via `AskUserQuestion`: **"Full replacement"** — reversing the
recorded "Streamlit only" decision project-wide, not a bolt-on secondary app.

## Why this is a big deal, stated once so it isn't re-litigated

This reverses a decision `CLAUDE.md` made deliberately and recorded explicitly
(`Tech stack`: "Streamlit + Python, no FastAPI, no JS framework, no separate
web server"; "One app, one process"). The cost, stated to the user before they
confirmed:

- All 66 existing tests are `streamlit.testing.v1.AppTest` driving `app.py`
  directly. `CLAUDE.md:82` says this is *how every real bug in this project
  was ever found* (widget-state bugs, stranded-state bugs). None of that
  method carries over to a Next.js frontend — a new test strategy is required,
  not a port of the old one.
- Next.js needs its own backend tier to reach `pipeline.db` (SQLite, WAL,
  written by a separate `run_pipeline.py` subprocess) and to start/stop that
  subprocess. `CLAUDE.md`'s "Don't add a layer" rule previously authorised
  exactly one exception (the VLM Docker container); this migration is the
  second, and needs its own documented boundary rather than an improvised one
  per API route.
- `CLAUDE.md` has been updated (2026-09-22) to record this reversal in its
  Decision Log and Working Agreements, with an explicit note: **`app.py`
  remains the real reviewer interface until this migration actually ships.**
  Do not let the Streamlit app bit-rot or lose test coverage while this is in
  progress — that would leave the project with neither a working old UI nor a
  finished new one.

## Scope for a first pass

Given the size of a full rewrite, treat this as a phased migration, and say
explicitly in `ship-review.md` what shipped vs. what is still Streamlit-only:

1. Next.js app scaffold, dark mode + minimalist theme (the two explicit asks).
2. A documented backend-access design for `pipeline.db` + `run_pipeline.py`
   (this is the one open architecture question — resolve it in
   `architecture.md`, don't improvise per-route).
3. Functional parity for the two tabs `architecture.md` §10 calls out as
   where "every serious bug in this project was found by running it, not by
   reading it" — **Review** (trim geometry, timeline, approve/reject) and
   **Queue** (URL add/remove/retry) — before Run/Export, since those two are
   where the state-ownership bugs actually live.
4. Everything not finished in this pass: name it, don't silently drop it.

## Where this goes next

This migration is large enough to deserve its own `00_grill-me` pass in a
calmer moment (backend architecture, data-fetching strategy, how `st.fragment`
polling's job is replaced, deployment target). Given the user asked to spawn
agents and move now, the first pass is being scaffolded directly under
architectural guardrails stated above, with the formal grill/spec pass to
follow once there's a running skeleton to ground it in — mirroring how this
project's own Phase 2 (VLM) started with a proven V1 before the full
methodology was speced.
