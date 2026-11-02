# Conflict audit

Verdict: **PASS**

| # | Seam | Finding | Probe |
|---|---|---|---|
| 1 | Decision Log, "Annotator queue" rule 2 (`coverage asc, filename asc`) | Deliberately replaced. Rules 1 and 3 stay. Log updated at ship. | Read `CLAUDE.md`. |
| 2 | `verify-annotator-queue.mjs` | Already broken before this work: at 1496 ready videos the `zzz-` test video is outside the first 100 rows. Its coverage-order check also pins the old rule. Rewritten here. | Ran it: `ready video appears in the queue failed: not present`. |
| 3 | `/complete` next video | Compatible: still reads row 0, and the function signature is unchanged. No frontend deploy needed. | Read the route. |
| 4 | Two annotators in lockstep on single-label videos | Real risk under any shared order: both see the same first row. Solved by counting other annotators' open claims as taken. | Read `claim` route. |
| 5 | Abandoned claims | Would hold a slot forever if it hid the video. It only lowers priority, so the video stays reachable. | Design check; covered by test. |
| 6 | Existing data | None to migrate. | Table counts: all 0. |
| 7 | `videos` writers | New column has a default, and no `select("*")` on `videos` in `frontend/src`. | Grep. |
| 8 | `admin_stats` | Unaffected: counts assignments, not queue order. | Read migration. |
