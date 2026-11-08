# Acceptance

Proven by `frontend/scripts/verify-assignments.mjs` (`TEST_BASE_URL` for the HTTP lines) unless noted.

1. An annotator cannot read `drive_file_id`, explicitly or via `select=*`. They see only assigned videos and their drafts. An admin's session client cannot read `drive_file_id` either; admin pages still show it.
2. An annotator cannot insert an assignment; the claim route answers 403.
3. A regular video assigned to A cannot be assigned to B. An agreement video can be assigned to three annotators.
4. `assign_range` assigns only regular, untaken videos with 9 drafts in the range and reports what it skipped. `unassign_range` keeps assignments with answers or labels.
5. `create_agreement_group(N)`:
   - picks N videos whose strata match the proportional allocation;
   - numbers them 1..N and the rest from N+1 by filename;
   - refuses once a non-legacy assignment exists.
6. `my_assignments`:
   - pages 10 at a time ordered by number;
   - `total` is right;
   - search by number and by filename part works;
   - only own videos are returned.
7. `next_assigned_video` returns the next unfinished own video.
8. `/annotate` (HTTP) shows page links and the search result; an unassigned `/annotate/{id}` is 404 for an annotator.
9. `import_reference_labels` upserts by shot stem (as `export_labels_csv.py` writes it) and reports unknown and invalid keys.
10. `pytest` still passes (no Python change).
11. Regression: `verify-labeling`, `verify-difficulty`, `verify-revisions`, `verify-adjudication`.
12. Browser: annotator pagination, search and the admin assignment page.
