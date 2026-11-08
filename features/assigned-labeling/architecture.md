# Architecture

Migration `supabase/migrations/20261108_assigned_labeling.sql`.

## Schema

- `user_profiles.label text`.
- `videos.seq integer unique not null`:
  - a `before insert` trigger gives new rows `max + 1`;
  - initial numbering is by filename, until an agreement group exists.
- `videos.agreement_sample` is kept as the column name, now meaning "agreement group"; it is reset.
- `video_assignments.batch text not null default 'manual'`: `legacy`, `agreement` or the admin's batch label.

## Access

- `revoke select on videos from authenticated`, then `grant select (every column except drive_file_id)`.
- `videos_read`: admin, or active status and `has_assignment(id)`.
- `video_drafts_read`: admin, or `has_assignment(video_id)`.
- `assignments_insert`: admin only.
- `validate_assignment` on insert:
  - the assignee must be an enabled user;
  - a non-agreement video already assigned to someone else is refused.

## RPCs (security definer, admin-checked where noted)

- `my_assignments(page_size, page_offset, search)`: own rows plus `total` (window count).
- `annotator_progress()`: `{ assigned, completed }`.
- `next_assigned_video(after_video uuid)`: the next unfinished own video by `seq`.
- Admin only:
  - `assignment_overview()`: per user label, ranges (compressed `seq`), totals, plus `next_free_seq`, `unassigned` and `group_size`;
  - `assign_range(annotator, from, to, batch)`;
  - `unassign_range(annotator, from, to)`;
  - `assign_agreement_group(annotators uuid[])`;
  - `create_agreement_group(size)`: refused when a non-legacy assignment exists; stratified largest remainder; renumbers;
  - `import_reference_labels(rows jsonb)`, keyed by `clip_id`.

## App

- Stream route and admin video pages read `drive_file_id` through `lib/supabase/admin.ts` (privileged), after the session client proves access.
- `/annotate` page uses `my_assignments`; `Pagination` component; search form via `?q=&page=`.
- `/api/videos/{id}/claim` answers 403; `HostedLabeling` drops the claim button.
- `/api/videos/{id}/complete` uses `next_assigned_video`.
- `/admin/assignments` (server page + client panel) and `/api/admin/assignments/*` routes calling the RPCs; label edit on `/admin/users`.
- Reference labels come from the existing `scripts/export_labels_csv.py` (read-only `pipeline.db`, per-shot `video_id`).
